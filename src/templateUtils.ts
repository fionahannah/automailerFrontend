export interface EmailTemplate {
  emailTemplateGuid: string;
  emailTemplateId: number;
  templateName: string;
  bodyText: string | null;
  bodyHtml: string | null;
  designJson: string | null;
}

export interface Customer {
  customerId: number;
  customerGuid: string;
  firstName: string;
  lastName: string;
  email: string;
  iptvUser: string;
  iptvPassword: string | null;
  notes: string | null;
  expirationDate: string | null;
  followUp: boolean;
}

export const sampleCustomer: Customer = {
  customerId: 0,
  customerGuid: '00000000-0000-0000-0000-000000000000',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
  iptvUser: 'jsmith_iptv',
  iptvPassword: 'x8k2Qm9z',
  notes: 'VIP customer, prefers evening support',
  expirationDate: '2026-08-15',
  followUp: false,
};

export function customerToVars(c: Customer): Record<string, string> {
  return {
    'customer.firstName': c.firstName,
    'customer.lastName': c.lastName,
    'customer.name': `${c.firstName} ${c.lastName}`,
    'customer.email': c.email,
    'customer.iptvUser': c.iptvUser,
    'customer.iptvPassword': c.iptvPassword || '',
    'customer.notes': c.notes || '',
    'customer.expirationDate': c.expirationDate || '',
  };
}

export const availableVars = Object.keys(customerToVars(sampleCustomer));

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}
