import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & {
        user?: { organizationId: string };
        tenantId?: string;
      }
    >();

    const user = req.user;
    if (!user?.organizationId) {
      throw new ForbiddenException('Tenant não identificado');
    }

    const orgFromParams = req.params?.organizationId;
    const orgFromBody =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as { organizationId?: string }).organizationId
        : undefined;
    const orgFromQuery = req.query?.organizationId;
    const requestedOrg =
      (typeof orgFromParams === 'string' && orgFromParams) ||
      (typeof orgFromBody === 'string' && orgFromBody) ||
      (typeof orgFromQuery === 'string' && orgFromQuery) ||
      undefined;

    if (requestedOrg && requestedOrg !== user.organizationId) {
      throw new ForbiddenException('Acesso negado a este tenant');
    }

    req.tenantId = user.organizationId;
    return true;
  }
}
