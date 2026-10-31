import {scrypt, timingSafeEqual} from 'node:crypto';

// OWASP-listed scrypt profile; ~32 MiB working memory. Never weaken on failure.
const N = 32768, R = 8, P = 3, LENGTH = 32;
const PREFIX = 'folio-scrypt-v1';
function derive(password, salt) {
  return new Promise((resolve, reject) => scrypt(password.normalize('NFKC'), salt, LENGTH, {N, r:R, p:P, maxmem:64*1024*1024}, (error, key) => error ? reject(error) : resolve(key)));
}
function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join(''); }
function unhex(value) { return Uint8Array.from(value.match(/../g), b => parseInt(b,16)); }

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${PREFIX}$${hex(salt)}$${hex(await derive(password,salt))}`;
}

export async function verifyPassword({hash,password}) {
  if (typeof hash !== 'string' || typeof password !== 'string' || !/^folio-scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash)) return false;
  const [,salt,expected] = hash.split('$');
  const actual = await derive(password,unhex(salt));
  return timingSafeEqual(actual,unhex(expected));
}
