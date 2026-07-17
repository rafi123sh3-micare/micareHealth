import toast from 'react-hot-toast';

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

export function calculateExpectedTime(appointmentTime: string, serialNumber: string): string {
  const baseTime = (appointmentTime || '09:00').split(' - ')[0];
  const [rawH, rawM] = baseTime.split(':').map(Number);
  const baseH = rawH || 9;
  const baseM = rawM || 0;

  let position = 0;
  if (serialNumber) {
    const match = serialNumber.match(/-(\d+)/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq)) position = Math.max(0, seq - 1);
    }
  }

  const totalMin = baseH * 60 + baseM + position * 5;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const disp = h % 12 || 12;
  return `${String(disp).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function buildConfirmationSMS(
  doctorName: string,
  date: string,
  time: string,
  serialNumber: string
): string {
  const formattedDate = formatDateBangla(date);
  const expectedTime = calculateExpectedTime(time, serialNumber);

  return `আপনার অ্যাপয়েন্টমেন্ট নিশ্চিত করা হয়েছে।
${doctorName}
তারিখ: ${formattedDate}
সময়: ${expectedTime}
Serial Number: ${serialNumber}`;
}

function formatDateBangla(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
}
