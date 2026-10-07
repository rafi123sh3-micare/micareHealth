export type BranchId = 'cumilla' | 'shyamoli';

/** Accounts whose invoices must carry the Cumilla chamber header. */
const CUMILLA_EMAILS = new Set([
  'miadmcu@gmail.com',
  'miapcu@gmail.com',
]);

/** Accounts that keep the original Dhaka/Shyamoli invoice header. */
const SHYAMOLI_EMAILS = new Set([
  'miadm@gmail.com',
  'micare@gmail.com',
]);

export const USER_EMAIL_KEY = 'userEmail';

/**
 * Cached at login, but sessions restored after a reload predate that key, so
 * fall back to the role payloads the login page persists alongside it.
 */
function resolveEmail(): string | null {
  try {
    const direct = localStorage.getItem(USER_EMAIL_KEY);
    if (direct) return direct.trim().toLowerCase();

    for (const key of ['adminData', 'doctorData', 'patientData']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const email = JSON.parse(raw)?.email;
      if (email) return String(email).trim().toLowerCase();
    }
  } catch {
    // storage or JSON unavailable
  }
  return null;
}

/**
 * Cache the signed-in email so invoice headers can be resolved synchronously.
 * CashMemo opens its print window synchronously (popup blockers require that),
 * so the header must be known before any async work starts.
 */
export function cacheUserEmail(email?: string | null) {
  try {
    if (email) localStorage.setItem(USER_EMAIL_KEY, email.trim().toLowerCase());
    else localStorage.removeItem(USER_EMAIL_KEY);
  } catch {
    // storage unavailable — branch falls back to the default
  }
}

export function getBranchId(): BranchId {
  const email = resolveEmail();
  if (email && CUMILLA_EMAILS.has(email)) return 'cumilla';
  if (email && SHYAMOLI_EMAILS.has(email)) return 'shyamoli';
  return 'shyamoli';
}

export interface BranchHeader {
  /** Bold sub-heading shown above the address. Empty for branches without one. */
  boldTitle: string;
  address: string;
  /** Single-line contact string, used by the PDF header. */
  contact: string;
  /** Multi-line contact strings, used by the HTML cash memo. */
  contactLines: string[];
}

const HEADERS: Record<BranchId, BranchHeader> = {
  cumilla: {
    boldTitle: 'Cumilla Micare Center:',
    address:
      'Cumilla Trauma Centre, 7th Floor (Lift 6), New Building, Nazrul Avenue, Cumilla.',
    contact:
      'Wed: 11:00 AM - 5:00 PM | Thu: 2:00 PM - 7:00 PM | Tel: +8801841960102, +8801841960103 | info@micare.com.bd | www.micare.com.bd',
    contactLines: [
      'Wed: 11:00 AM - 5:00 PM | Thu: 2:00 PM - 7:00 PM',
      'Tel: +8801841960102, +8801841960103',
      'Email: info@micare.com.bd | Web: www.micare.com.bd',
    ],
  },
  shyamoli: {
    boldTitle: '',
    address: 'Shyamoli Cinema Hall Building Complex, Ring Road Shyamoli, Dhaka-1207',
    contact: 'Tel: +8801898803000 | Email: info@micare.com.bd | Web: www.micare.com.bd',
    contactLines: [
      'Tel: +8801898803000 | Email: info@micare.com.bd',
      'Web: www.micare.com.bd',
    ],
  },
};

export function getBranchHeader(): BranchHeader {
  return HEADERS[getBranchId()];
}
