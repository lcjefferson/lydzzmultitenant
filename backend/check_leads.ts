import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        status: 'Reuniões Agendadas',
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        assignedToId: true,
        assignedTo: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log('--- LEADS IN "Reuniões Agendadas" ---');
    console.log(`Total count: ${leads.length}`);
    leads.forEach(l => {
      console.log(`ID: ${l.id}, Name: ${l.name}, Created: ${l.createdAt.toISOString()}, AssignedTo: ${l.assignedTo?.name || 'Unassigned'} (${l.assignedToId})`);
    });

    // Also check leads that might have slight variations in status string
    const allLeads = await prisma.lead.findMany({
        select: { status: true }
    });
    const statuses = new Set(allLeads.map(l => l.status));
    console.log('\n--- ALL STATUSES IN DB ---');
    console.log(Array.from(statuses));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
