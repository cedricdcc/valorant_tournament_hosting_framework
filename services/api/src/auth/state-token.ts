import { createHmac, timingSafeEqual } from 'node:crypto';

const HMAC_ALGO = 'sha256';

type TokenPayload = Record<string, unknown>;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(content: string, secret: string): string {
  return createHmac(HMAC_ALGO, secret).update(content).digest('base64url');
}

export function createSignedStateToken(payload: TokenPayload, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const completePayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(completePayload));
  const unsigned = `${header}.${body}`;
  const signature = sign(unsigned, secret);
  return `${unsigned}.${signature}`;
}

export function verifySignedStateToken<T extends TokenPayload>(token: string, secret: string): T {
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) {
    throw new Error('Invalid token format');
  }

  const unsigned = `${header}.${body}`;
  const expected = sign(unsigned, secret);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as T & { exp?: number };
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
}
