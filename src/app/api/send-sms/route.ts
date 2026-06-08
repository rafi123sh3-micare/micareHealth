import { NextRequest, NextResponse } from 'next/server';

const SMS_API_KEY = process.env.SMS_NET_BD_API_KEY;
const SMS_API_URL = 'https://api.sms.net.bd/sendsms';

export async function POST(request: NextRequest) {
  try {
    const { to, msg } = await request.json();

    if (!SMS_API_KEY) {
      return NextResponse.json({ error: 1, msg: 'SMS API key not configured' }, { status: 500 });
    }

    if (!to || !msg) {
      return NextResponse.json({ error: 1, msg: 'Missing required fields: to, msg' }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.append('api_key', SMS_API_KEY);
    params.append('msg', msg);
    params.append('to', to);

    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('SMS send error:', error);
    return NextResponse.json({ error: 1, msg: 'Failed to send SMS' }, { status: 500 });
  }
}
