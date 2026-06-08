export async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    const formattedPhone = phone.startsWith('01') ? '88' + phone :
      phone.startsWith('+88') ? phone.replace('+', '') :
        phone.startsWith('880') ? phone :
          '88' + phone;

    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: formattedPhone, msg: message }),
    });

    const data = await response.json();
    if (data.error === 0) {
      console.log('SMS sent successfully:', data);
      return true;
    } else {
      console.error('SMS send failed:', data);
      return false;
    }
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

export function buildConfirmationSMS(
  doctorName: string,
  date: string,
  time: string,
  serialNumber: string
): string {
  const formattedDate = formatDateBangla(date);
  const formattedTime = time ? time.substring(0, 5) : '';

  return `আপনার অ্যাপয়েন্টমেন্ট নিশ্চিত করা হয়েছে।

${doctorName}

তারিখ: ${formattedDate}

সময়: ${formattedTime}

Serial Number: ${serialNumber}`;
}

function formatDateBangla(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}
