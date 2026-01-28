import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getLeadDetails(leadId: string, accessToken: string): Promise<any> {
    try {
      // Facebook Lead Ads API
      const response = await axios.get(`https://graph.facebook.com/v19.0/${leadId}`, {
        params: { access_token: accessToken },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching Facebook lead details: ${error}`);
      return null;
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string, verifyToken: string): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Facebook Webhook verified');
      return challenge;
    }
    this.logger.error(`Facebook Webhook verification failed. Received token: ${token}, Expected: ${verifyToken}`);
    return null;
  }

  async handleWebhookPayload(payload: any) {
    this.logger.log(`Received Facebook webhook: ${JSON.stringify(payload)}`);
    
    if (payload.object === 'page') {
      for (const entry of payload.entry) {
        const pageId = entry.id;
        // Find channel by pageId (identifier)
        const channel = await this.prisma.channel.findFirst({
            where: { 
                type: 'facebook_leads',
                identifier: pageId 
            }
        });

        if (!channel) {
            this.logger.warn(`No channel found for Facebook Page ID: ${pageId}`);
            continue;
        }

        const accessToken = (channel as any).accessToken; 

        for (const change of entry.changes) {
          if (change.field === 'leadgen') {
             const leadgen = change.value;
             const leadId = leadgen.leadgen_id;
             const formId = leadgen.form_id;
             
             // Fetch lead details
             const leadDetails = await this.getLeadDetails(leadId, accessToken);
             if (leadDetails) {
                 await this.processLead(leadDetails, channel, formId);
             }
          }
        }
      }
    }
    return 'EVENT_RECEIVED';
  }

  async processLead(leadDetails: any, channel: any, formId: string) {
      const fieldData = leadDetails.field_data || [];
      let name = 'Facebook Lead';
      let email = null;
      let phone = null;
      let company = null;

      for (const field of fieldData) {
          const val = field.values[0];
          const fieldName = field.name.toLowerCase();
          if (fieldName.includes('name')) name = val;
          if (fieldName.includes('email')) email = val;
          if (fieldName.includes('phone')) phone = val;
          if (fieldName.includes('company')) company = val;
      }
      
      // Check if lead exists by email or phone
      const existingLead = await this.prisma.lead.findFirst({
          where: {
              organizationId: channel.organizationId,
              OR: [
                  { email: email || undefined },
                  { phone: phone || undefined }
              ]
          }
      });

      if (existingLead) {
          this.logger.log(`Lead already exists: ${existingLead.id}`);
          // Update source if missing
          if (!(existingLead as any).source) {
              await this.prisma.lead.update({
                  where: { id: existingLead.id },
                  data: { source: 'facebook_leads' } as any
              });
          }
      } else {
          // Create new lead
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const leadData: any = {
              name,
              email,
              phone,
              source: 'facebook_leads',
              status: 'Lead Novo',
              temperature: 'cold',
              organizationId: channel.organizationId,
              customFields: { formId, leadId: leadDetails.id }
          };
          
          if (company) {
            leadData.company = company;
          }

          const newLead = await this.prisma.lead.create({
              data: leadData
          });
          this.logger.log(`New lead created from Facebook: ${newLead.id}`);
      }
  }
}
