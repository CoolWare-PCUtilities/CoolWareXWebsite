const crypto = require('crypto');
const nacl = require('tweetnacl');
const sshpk = require('sshpk');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function base64urlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecodeToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function extractEd25519Seed(privateKey) {
  const candidates = [
    privateKey?.part?.k?.data,
    privateKey?.parts?.find((part) => part?.name === 'k')?.data,
    privateKey?.k,
    privateKey?.seed,
    privateKey?.privateKey,
    privateKey?.private
  ];

  for (const candidate of candidates) {
    if (candidate) {
      const bytes = Buffer.from(candidate);
      if (bytes.length >= 32) return bytes.subarray(0, 32);
    }
  }

  throw new Error('Unable to extract Ed25519 seed from OpenSSH private key');
}

function extractEd25519PublicKey(privateKey) {
  const publicKey = privateKey.toPublic();
  const candidates = [
    publicKey?.part?.A?.data,
    publicKey?.parts?.find((part) => part?.name === 'A')?.data,
    publicKey?.A,
    publicKey?.publicKey,
    publicKey?.public
  ];

  for (const candidate of candidates) {
    if (candidate) {
      const bytes = Buffer.from(candidate);
      if (bytes.length >= 32) return bytes.subarray(0, 32);
    }
  }

  throw new Error('Unable to extract Ed25519 public key from OpenSSH private key');
}

let cachedKeys;

function getSigningKeypair() {
  if (cachedKeys) return cachedKeys;

  const sshPrivB64 = process.env.LICENSE_SIGNING_SSH_PRIVATE_KEY_B64;
  if (!sshPrivB64) throw new Error('Missing LICENSE_SIGNING_SSH_PRIVATE_KEY_B64');

  const keyBytes = Buffer.from(sshPrivB64, 'base64');
  const parsed = sshpk.parsePrivateKey(keyBytes, 'ssh');
  if (parsed.type !== 'ed25519') throw new Error(`Unsupported key type: ${parsed.type}`);

  const seed = extractEd25519Seed(parsed);
  const pairFromSeed = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));

  const expectedPublic = extractEd25519PublicKey(parsed);
  if (!Buffer.from(pairFromSeed.publicKey).equals(expectedPublic)) {
    throw new Error('Derived Ed25519 public key does not match OpenSSH public key');
  }

  cachedKeys = {
    seed: new Uint8Array(seed),
    secretKey: pairFromSeed.secretKey,
    publicKey: pairFromSeed.publicKey
  };

  return cachedKeys;
}

function getPublicKeyB64() {
  const { publicKey } = getSigningKeypair();
  return Buffer.from(publicKey).toString('base64');
}

function signLicensePayload(payloadObj) {
  const payloadJson = JSON.stringify(payloadObj);
  const payloadBytes = Buffer.from(payloadJson, 'utf8');
  const payloadB64 = base64urlEncode(payloadBytes);
  const { secretKey } = getSigningKeypair();
  const signature = nacl.sign.detached(new Uint8Array(payloadBytes), secretKey);

  return `COOLWAREX-${payloadB64}.${base64urlEncode(signature)}`;
}

function verifyLicensePayload(licenseKeyString) {
  if (!licenseKeyString || typeof licenseKeyString !== 'string') return false;
  if (!licenseKeyString.startsWith('COOLWAREX-')) return false;

  const token = licenseKeyString.slice('COOLWAREX-'.length);
  const [payloadB64, signatureB64, ...rest] = token.split('.');
  if (!payloadB64 || !signatureB64 || rest.length > 0) return false;

  const payloadBytes = base64urlDecodeToBytes(payloadB64);
  const signatureBytes = base64urlDecodeToBytes(signatureB64);
  const { publicKey } = getSigningKeypair();

  return nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKey);
}

module.exports = {
  sha256Hex,
  base64urlEncode,
  base64urlDecodeToBytes,
  signLicensePayload,
  verifyLicensePayload,
  getPublicKeyB64
};
