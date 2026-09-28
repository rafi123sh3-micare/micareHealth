import { supabase, getFeeAmount } from '@/lib/supabase';

/** Outstanding balance on a single appointment. Mirrors the Due column formula. */
export function computeDue(apt: any): number {
  return Math.max(0, getFeeAmount(apt.fee_type) - (apt.refunded || 0) - (apt.paid || 0));
}

/**
 * Total outstanding balance across all of a patient's non-cancelled
 * appointments. Used to block the barcode -> prescription hand-off until
 * the patient has settled up.
 */
export async function getPatientDue(patientId: string): Promise<number> {
  const { data, error } = await supabase
    .from('appointments')
    .select('status, fee_type, paid, refunded')
    .eq('patient_id', patientId)
    .neq('status', 'cancelled');

  if (error || !data || data.length === 0) return 0;

  return data.reduce((sum: number, apt: any) => sum + computeDue(apt), 0);
}
