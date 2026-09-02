import { describe, it, expect } from 'vitest';
import { Webhook } from 'svix';
import crypto from 'crypto';

describe('Webhook Verification', () => {
  const secret = 'whsec_' + crypto.randomBytes(32).toString('base64');
  const wh = new Webhook(secret);

  it('should successfully verify a valid signature', () => {
    const payloadObj = { type: 'email.received', data: { email_id: '123' } };
    const payload = JSON.stringify(payloadObj);
    
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const id = 'msg_' + crypto.randomBytes(12).toString('hex');
    
    // Generate valid signature manually for testing purposes as Svix would do
    const toSign = `${id}.${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', Buffer.from(secret.split('_')[1], 'base64'))
      .update(toSign)
      .digest('base64');

    const headers = {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    };

    // Should not throw on valid signature
    expect(() => wh.verify(payload, headers)).not.toThrow();
  });

  it('should throw on an invalid signature', () => {
    const payload = JSON.stringify({ type: 'email.received' });
    const headers = {
      'svix-id': 'msg_123',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      'svix-signature': 'v1,invalid_signature',
    };

    expect(() => wh.verify(payload, headers)).toThrow();
  });
});
