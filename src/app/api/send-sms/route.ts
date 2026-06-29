import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const SMS_API_KEY = process.env.ELITBUZZ_SMS_API_KEY;
const SMS_SENDER_ID = process.env.ELITBUZZ_SENDER_ID || 'Micare';
const SMS_API_URL = 'https://msg.mram.com.bd/smsapi';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const requestId = generateId();
  const meta = { requestId };

  try {
    const { to, msg } = await request.json();
    const maskedPhone = logger.maskPhone(to);

    logger.info('SMS request received', { ...meta, to: maskedPhone, msgLength: msg?.length });

    if (!SMS_API_KEY) {
      logger.error('SMS API key not configured', meta);
      return NextResponse.json({ error: 1, msg: 'SMS API key not configured' }, { status: 500 });
    }

    if (!to || !msg) {
      logger.warn('SMS missing required fields', { ...meta, to: maskedPhone, hasMsg: !!msg });
      return NextResponse.json({ error: 1, msg: 'Missing required fields: to, msg' }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.append('api_key', SMS_API_KEY);
    params.append('senderid', SMS_SENDER_ID);
    params.append('type', 'unicode');
    params.append('msg', msg);
    params.append('contacts', to);
    params.append('label', 'transactional');

    const queryString = params.toString();
    logger.info('Forwarding SMS to MRAM provider', { ...meta, to: maskedPhone });

    const response = await fetch(`${SMS_API_URL}?${queryString}`, {
      method: 'GET',
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    const isSuccess =
      response.ok &&
      (String(data?.error) === '0' ||
        data?.status === 'success' ||
        data?.response === 'success' ||
        text.includes('SMS SUBMITTED'));

    if (!response.ok || !isSuccess) {
      logger.error('SMS provider returned error', {
        ...meta,
        to: maskedPhone,
        statusCode: response.status,
        providerResponse: data,
      });
    } else {
      logger.info('SMS sent successfully', { ...meta, to: maskedPhone, providerResponse: data });
    }

    return NextResponse.json({ error: isSuccess ? 0 : 1, ...data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('SMS send failed', {
      ...meta,
      error: errorMessage,
      stack: errorStack,
    });
    return NextResponse.json({ error: 1, msg: 'Failed to send SMS' }, { status: 500 });
  }
}
