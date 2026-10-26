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
  /** Brand line above the branch heading. Empty string suppresses it entirely. */
  brand: string;
  /** Bold branch heading. Empty string suppresses it; never rendered with a colon. */
  title: string;
  address: string;
  /** Single-line contact string, used by the PDF header. */
  contact: string;
  /** Multi-line contact strings, used by the HTML cash memo. */
  contactLines: string[];
}

const HEADERS: Record<BranchId, BranchHeader> = {
  cumilla: {
    brand: 'Micare Health',
    title: '',
    address:
      'Cumilla Trauma Centre, 7th Floor (Lift 6), New Building, Nazrul Avenue, Cumilla.',
    contact:
      'Wed: 11:00 AM - 5:00 PM | Thu: 1:00 PM - 7:00 PM | Tel: +8801841960102, +8801841960103 | info@micare.com.bd | www.micare.com.bd',
    contactLines: [
      'Wed: 11:00 AM - 5:00 PM | Thu: 1:00 PM - 7:00 PM',
      'Tel: +8801841960102, +8801841960103',
      'Email: info@micare.com.bd | Web: www.micare.com.bd',
    ],
  },
  shyamoli: {
    brand: 'Micare Health',
    title: '',
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

/**
 * Consultation fees differ per branch: Cumilla charges less than Shyamoli.
 * Keep these in one place — every Due, Paid and report total derives from them.
 */
export const BRANCH_FEES: Record<BranchId, Record<string, number>> = {
  cumilla: { new: 700, follow_up: 500, report: 0 },
  shyamoli: { new: 1000, follow_up: 700, report: 0 },
};

/** Fee for a fee type at a given branch; undefined when the type is unknown. */
export function getBranchFee(feeType?: string, branch: BranchId = getBranchId()): number | undefined {
  if (!feeType) return undefined;
  return BRANCH_FEES[branch]?.[feeType];
}

/** Charged when an appointment carries an unrecognised fee type. */
export const UNKNOWN_FEE = 500;

/**
 * A chamber session. The expected (queue) time counts up from `start` at 5
 * minutes per serial. `capacity` is the number of serials the session takes
 * before the next session begins; omit it for a session that takes the rest.
 */
export interface SessionSlot {
  start: string;
  capacity?: number;
}

/**
 * Chamber sessions per branch/day. Cumilla runs a single session (Wed 11:00,
 * Thu 13:00). Shyamoli runs two: a fixed 20-seat morning block at 10:00 and an
 * evening block from 17:00 that takes the overflow (and any extra bookings).
 */
export const BRANCH_SESSIONS: Record<
  BranchId,
  { byWeekday: Partial<Record<number, SessionSlot[]>>; default: SessionSlot[] }
> = {
  cumilla: {
    byWeekday: { 3: [{ start: '11:00' }], 4: [{ start: '13:00' }] },
    default: [{ start: '11:00' }],
  },
  shyamoli: {
    byWeekday: {},
    default: [{ start: '10:00', capacity: 20 }, { start: '17:00' }],
  },
};

function getWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00`);
  return isNaN(d.getTime()) ? -1 : d.getDay();
}

/** Sessions ("HH:MM" starts + capacities) for a branch on a YYYY-MM-DD date. */
export function getSessionSlots(branch: BranchId | string | undefined, date: string): SessionSlot[] {
  const b: BranchId = branch === 'cumilla' ? 'cumilla' : 'shyamoli';
  const cfg = BRANCH_SESSIONS[b];
  return cfg.byWeekday[getWeekday(date)] || cfg.default;
}

/** First session start ("HH:MM") for a branch on a YYYY-MM-DD date (weekday aware). */
export function getSessionStart(branch: BranchId | string | undefined, date: string): string {
  return getSessionSlots(branch, date)[0]?.start || '17:00';
}

/** Map a UI shift choice to the session index for a branch/day. */
export function getSessionIndexForShift(
  branch: BranchId | string | undefined,
  _date: string,
  shift?: string | null
): number | null {
  if (branch !== 'shyamoli') return null;
  if (shift === 'morning' || shift === '10am' || shift === 'am') return 0;
  if (shift === 'evening' || shift === '5pm' || shift === 'pm' || shift === 'night') return 1;
  return null;
}

/**
 * Branch an appointment was billed under. Falls back to the signed-in user's
 * branch for rows created before the branch column existed.
 */
export function getAptBranch(apt: any): BranchId {
  const branch = apt?.branch;
  return branch === 'cumilla' || branch === 'shyamoli' ? branch : getBranchId();
}

/**
 * Fee for a specific appointment. Keyed off the appointment's own branch (not
 * the viewer's), so a Cumilla booking shows 700/500 to every account.
 */
export function getAptFee(apt: any): number {
  const fee = getBranchFee(apt?.fee_type, getAptBranch(apt));
  return fee !== undefined ? fee : UNKNOWN_FEE;
}
