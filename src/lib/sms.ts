import toast from 'react-hot-toast';
import { getSessionSlots, type BranchId } from './branch';

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-3);
}

export async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    const maskedPhone = maskPhone(phone);
    const formattedPhone = phone.startsWith('01') ? '88' + phone :
      phone.startsWith('+88') ? phone.replace('+', '') :
        phone.startsWith('880') ? phone :
          '88' + phone;

    console.log(`[SMS] Sending to ${maskedPhone}, length: ${message.length}`);

    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: formattedPhone, msg: message }),
    });

    const data = await response.json();

    if (data.error === 0) {
      console.log(`[SMS] Sent successfully to ${maskedPhone}`);
      toast.success('SMS সফলভাবে পাঠানো হয়েছে');
      return true;
    }

    console.error(`[SMS] Provider error for ${maskedPhone}:`, JSON.stringify(data));
    toast.error('SMS পাঠানো ব্যর্থ হয়েছে');
    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SMS] Failed for ${phone ? maskPhone(phone) : 'unknown'}:`, errorMessage);
    toast.error('SMS পাঠানোতে ত্রুটি হয়েছে');
    return false;
  }
}

/**
 * Extracts the sequential patient number (1, 2, 3, ...) from the generated
 * serial code (e.g. "DR01-001AN5363" -> "1").
 * Falls back to the raw code if it does not match the expected format.
 */
export function extractSerialNumber(serialNumber: string): string {
  if (!serialNumber) return '';
  const match = serialNumber.match(/-(\d+)/);
  if (match) {
    const seq = parseInt(match[1], 10);
    if (!isNaN(seq)) return String(seq);
  }
  return serialNumber;
}

function getSerialSequence(serialNumber?: string): number {
  if (!serialNumber) return NaN;
  const seq = parseInt(extractSerialNumber(serialNumber), 10);
  return isNaN(seq) ? NaN : seq;
}

/** Sort appointments by date, doctor, then DRxx-NNN sequence (NNN defines queue order). */
export function compareBySerialNumber(
  a: { serial_number?: string; created_at?: string; date?: string; doctor_id?: string },
  b: { serial_number?: string; created_at?: string; date?: string; doctor_id?: string }
): number {
  if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.doctor_id && b.doctor_id && a.doctor_id !== b.doctor_id) return a.doctor_id.localeCompare(b.doctor_id);

  const seqA = getSerialSequence(a.serial_number);
  const seqB = getSerialSequence(b.serial_number);
  const hasA = !isNaN(seqA);
  const hasB = !isNaN(seqB);

  if (hasA && hasB && seqA !== seqB) return seqA - seqB;
  if (hasA && !hasB) return -1;
  if (!hasA && hasB) return 1;
  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
}

function formatExpectedTime(start: string, position: number): string {
  const [rawH, rawM] = (start || '09:00').split(':').map(Number);
  const totalMin = (rawH || 9) * 60 + (rawM || 0) + Math.max(0, position) * 5;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const disp = h % 12 || 12;
  return `${String(disp).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Expected (queue) time for an appointment, honouring days that run more than
 * one session. The session serving the serial is chosen from the serial number,
 * so a multi-session day resets the clock at each session start. On Shyamoli's
 * two-session days, serials 1-20 start at 10:00 and 21+ start at 17:00.
 */
export function calculateAppointmentExpectedTime(
  branch: BranchId | string | undefined,
  date: string,
  serialNumber: string
): string {
  const slots = getSessionSlots(branch, date);
  const seq = parseInt(extractSerialNumber(serialNumber), 10);
  const position = isNaN(seq) ? 0 : Math.max(0, seq - 1);

  let consumed = 0;
  let start = slots[slots.length - 1]?.start || '17:00';
  let offset = position;
  let served = false;

  for (const slot of slots) {
    if (slot.capacity === undefined || position < consumed + slot.capacity) {
      start = slot.start;
      offset = position - consumed;
      served = true;
      break;
    }
    consumed += slot.capacity;
  }

  // Serial ran past every capped session: keep counting from the last session.
  if (!served) {
    start = slots[slots.length - 1]?.start || '17:00';
    offset = position - consumed;
  }

  return formatExpectedTime(start, offset);
}

export function buildConfirmationSMS(
  doctorName: string,
  branch: BranchId | string | undefined,
  date: string,
  serialNumber: string
): string {
  const formattedDate = formatDateEnglish(date);
  const expectedTime = calculateAppointmentExpectedTime(branch, date, serialNumber);
  const serial = extractSerialNumber(serialNumber);

  return `Your appointment has been confirmed.
${doctorName}
Date: ${formattedDate}
Time: ${expectedTime}
Serial Number: ${serial}`;
}

function formatDateEnglish(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
