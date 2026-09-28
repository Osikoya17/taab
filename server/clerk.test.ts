import { verifyToken } from '@clerk/backend';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';

import { authorizedPartiesFor } from './clerk';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwtKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const allowed = ['http://localhost:8081', 'http://localhost:8082'];

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function sign(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'RS256', typ: 'JWT', kid: 'test' })}.${encode({ sub: 'user_1', sid: 'sess_1', iat: now, nbf: now - 5, exp: now + 60, ...claims })}`;
  const signature = createSign('RSA-SHA256').update(body).sign(privateKey).toString('base64url');
  return `${body}.${signature}`;
}

async function verify(token: string) {
  return verifyToken(token, { jwtKey, authorizedParties: authorizedPartiesFor(token, allowed) });
}

test('native app tokens without azp are accepted', async () => {
  const claims = await verify(sign({}));
  assert.equal(claims.sub, 'user_1');
});

test('browser tokens from an allowed origin are accepted', async () => {
  const claims = await verify(sign({ azp: 'http://localhost:8082' }));
  assert.equal(claims.azp, 'http://localhost:8082');
});

test('browser tokens from another origin are rejected', async () => {
  await assert.rejects(verify(sign({ azp: 'https://evil.example' })), { reason: 'token-invalid-authorized-parties' });
});

test('stripping azp from a signed browser token breaks the signature', async () => {
  const [header, , signature] = sign({ azp: 'https://evil.example' }).split('.');
  const now = Math.floor(Date.now() / 1000);
  const forged = `${header}.${encode({ sub: 'user_1', sid: 'sess_1', iat: now, nbf: now - 5, exp: now + 60 })}.${signature}`;
  await assert.rejects(verify(forged));
});
