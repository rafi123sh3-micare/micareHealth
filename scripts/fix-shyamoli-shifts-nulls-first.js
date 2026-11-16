const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function extractLast4(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length >= 4) return digits.slice(-4);
  return digits.padStart(4, '0');
}

function rebuildSerial(existingSerial, shift, phone) {
  if (!existingSerial) return existingSerial;
  const s = String(existingSerial).trim();
  const marker = shift === 'evening' ? 'E' : 'M';
  const p4 = extractLast4(phone) || '0000';

  let m = s.match(/^([A-Z]{2}\d{2}-\d{3}[AT])([NFR]?)([ME]?)(\d{0,4})$/);
  if (m) {
    const head = m[1];
    const fee = m[2] || '';
    let suffix = m[4];
    if (suffix.length !== 4) suffix = p4;
    return head + fee + marker + suffix;
  }

  m = s.match(/^([A-Z]{2}\d{2}-\d{3}[AT][NFR]?)([ME]?)(.*)$/);
  if (m) {
    return m[1] + marker + p4;
  }

  return s;
}

async function run() {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, doctor_id, date, shift, serial_number, created_at, patient_mobile, patients(phone)')
    .eq('branch', 'shyamoli')
    .gte('date', '2026-11-02')
    .not('serial_number', 'is', null)
    .order('doctor_id', { ascending: true })
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fetch error:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No rows found');
    process.exit(0);
  }

  const groups = {};
  for (const apt of data) {
    const key = apt.doctor_id + '|' + apt.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(apt);
  }

  const updates = [];
  for (const key of Object.keys(groups)) {
    const list = groups[key];
    const sorted = [...list].sort((a, b) => {
      const an = a.shift === null || a.shift === undefined || a.shift === '';
      const bn = b.shift === null || b.shift === undefined || b.shift === '';
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    sorted.forEach((apt, idx) => {
      const seq = idx + 1;
      const newShift = seq <= 20 ? 'morning' : 'evening';
      const phone = apt.patient_mobile || (apt.patients && apt.patients.phone) || '';
      const newSerial = rebuildSerial(apt.serial_number, newShift, phone);
      updates.push({
        id: apt.id,
        doctor_id: apt.doctor_id,
        date: apt.date,
        old_shift: apt.shift,
        old_serial: apt.serial_number,
        new_seq: seq,
        new_shift: newShift,
        new_serial: newSerial
      });
    });
  }

  fs.writeFileSync('./shyamoli-shift-fix-preview.json', JSON.stringify(updates, null, 2));
  console.log('Preview written:', updates.length);

  let ok = 0;
  let fail = 0;
  for (const u of updates) {
    const { error: e2 } = await supabase
      .from('appointments')
      .update({ shift: u.new_shift, serial_number: u.new_serial })
      .eq('id', u.id);
    if (e2) {
      console.error('Failed', u.id, e2.message);
      fail++;
    } else {
      ok++;
    }
  }
  console.log('Done:', ok, 'ok,', fail, 'failed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});