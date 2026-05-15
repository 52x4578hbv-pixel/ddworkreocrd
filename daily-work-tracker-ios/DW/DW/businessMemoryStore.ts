import crypto from 'crypto';

export type BusinessTenant = {
  tenantId: string;
  businessName: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt?: string;
};

const tenantById = new Map<string, BusinessTenant>();
const accessCodeToTenantId = new Map<string, string>();

const generateTenantId = () => {
  // stable enough for doc-like ids
  return `tenant_${crypto.randomBytes(6).toString('hex')}`;
};

const generateAccessCode = () => {
  // 10-ish chars, uppercase alnum
  const raw = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return raw.slice(0, 10).toUpperCase();
};

export const businessMemoryStore = {
  registerBusiness: (params: { businessName: string; contactEmail?: string | null }) => {
    const tenantId = generateTenantId();
    const now = new Date().toISOString();

    const tenant: BusinessTenant = {
      tenantId,
      businessName: params.businessName,
      contactEmail: params.contactEmail ?? null,
      createdAt: now,
      updatedAt: now,
    };

    tenantById.set(tenantId, tenant);

    // mint an access code
    for (let attempts = 0; attempts < 10; attempts++) {
      const code = generateAccessCode();
      if (accessCodeToTenantId.has(code)) continue;
      accessCodeToTenantId.set(code, tenantId);
      return { businessCode: code, tenantId };
    }

    throw new Error('Failed to generate access code (memory store).');
  },

  getTenantIdByAccessCode: (accessCode: string) => {
    return accessCodeToTenantId.get(accessCode) ?? null;
  },

  getTenantById: (tenantId: string) => {
    return tenantById.get(tenantId) ?? null;
  },

  reset: () => {
    tenantById.clear();
    accessCodeToTenantId.clear();
  },
};
