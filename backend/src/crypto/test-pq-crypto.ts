/**
 * UAT Test Script for PQ Crypto Utilities (Plan 2-05)
 * Run with: cd backend && npx tsx src/crypto/test-pq-crypto.ts
 */

import {
  generateHybridKeyPair,
  encapsulate,
  decapsulate,
  serializeKeyPair,
  deserializeKeyPair
} from './pq-kem';

import {
  generateSigningKeyPair,
  sign,
  verify,
  signJSON,
  verifyJSON,
  serializeSigningKeyPair,
  deserializeSigningKeyPair
} from './pq-signatures';

import { bytesToHex } from '@noble/hashes/utils.js';

console.log('='.repeat(60));
console.log('UAT: Plan 2-05 Post-Quantum Cryptography Utilities');
console.log('='.repeat(60));
console.log();

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    const result = fn();
    if (result) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.log(`✗ FAIL: ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${error}`);
    failed++;
  }
}

// Test 1: Hybrid KEM Key Generation
test('Hybrid KEM key generation', () => {
  const keyPair = generateHybridKeyPair();
  // ML-KEM-768 public key = 1184 bytes, X25519 = 32 bytes
  const expectedPublicKeySize = 1184 + 32;
  // ML-KEM-768 secret key = 2400 bytes, X25519 = 32 bytes
  const expectedSecretKeySize = 2400 + 32;

  console.log(`  Public key size: ${keyPair.publicKey.length} bytes (expected: ${expectedPublicKeySize})`);
  console.log(`  Secret key size: ${keyPair.secretKey.length} bytes (expected: ${expectedSecretKeySize})`);
  console.log(`  Algorithm: ${keyPair.algorithm}`);

  return keyPair.publicKey.length === expectedPublicKeySize &&
         keyPair.secretKey.length === expectedSecretKeySize &&
         keyPair.algorithm === 'ML-KEM-768-X25519';
});

// Test 2: Hybrid KEM Encapsulation/Decapsulation Round-trip
test('Hybrid KEM encapsulate/decapsulate round-trip', () => {
  const keyPair = generateHybridKeyPair();
  const { cipherText, sharedSecret: senderSecret } = encapsulate(keyPair.publicKey);
  const recipientSecret = decapsulate(cipherText, keyPair.secretKey);

  console.log(`  Ciphertext size: ${cipherText.length} bytes`);
  console.log(`  Shared secret size: ${senderSecret.length} bytes`);
  console.log(`  Sender secret (first 16 hex): ${bytesToHex(senderSecret.slice(0, 8))}`);
  console.log(`  Recipient secret (first 16 hex): ${bytesToHex(recipientSecret.slice(0, 8))}`);

  // Compare shared secrets
  const match = senderSecret.length === recipientSecret.length &&
                senderSecret.every((b, i) => b === recipientSecret[i]);
  console.log(`  Secrets match: ${match}`);

  return match;
});

// Test 3: Hybrid KEM Key Serialization
test('Hybrid KEM key serialization round-trip', () => {
  const original = generateHybridKeyPair();
  const serialized = serializeKeyPair(original);
  const restored = deserializeKeyPair(serialized);

  console.log(`  Serialized public key length: ${serialized.publicKeyHex.length} chars`);
  console.log(`  Algorithm preserved: ${serialized.algorithm}`);

  const publicMatch = original.publicKey.every((b, i) => b === restored.publicKey[i]);
  const secretMatch = original.secretKey.every((b, i) => b === restored.secretKey[i]);

  return publicMatch && secretMatch && original.algorithm === restored.algorithm;
});

// Test 4: ML-DSA-65 Key Generation
test('ML-DSA-65 key generation', () => {
  const keyPair = generateSigningKeyPair();

  console.log(`  Public key size: ${keyPair.publicKey.length} bytes (expected: ~1952)`);
  console.log(`  Secret key size: ${keyPair.secretKey.length} bytes (expected: ~4032)`);
  console.log(`  Algorithm: ${keyPair.algorithm}`);

  return keyPair.publicKey.length > 1900 &&
         keyPair.secretKey.length > 4000 &&
         keyPair.algorithm === 'ML-DSA-65';
});

// Test 5: ML-DSA-65 Sign/Verify Round-trip
test('ML-DSA-65 sign/verify round-trip', () => {
  const keyPair = generateSigningKeyPair();
  const message = 'Hello, Post-Quantum World!';

  const signature = sign(message, keyPair.secretKey);
  console.log(`  Signature size: ${signature.length} bytes (expected: ~3309)`);

  const isValid = verify(signature, message, keyPair.publicKey);
  console.log(`  Signature valid: ${isValid}`);

  return isValid;
});

// Test 6: ML-DSA-65 Tamper Detection
test('ML-DSA-65 tamper detection', () => {
  const keyPair = generateSigningKeyPair();
  const message = 'Original message';
  const tamperedMessage = 'Tampered message';

  const signature = sign(message, keyPair.secretKey);
  const isValid = verify(signature, tamperedMessage, keyPair.publicKey);

  console.log(`  Tampered message verification: ${isValid} (should be false)`);

  return !isValid;
});

// Test 7: JSON Canonical Signing
test('JSON canonical signing (key order independence)', () => {
  const keyPair = generateSigningKeyPair();

  // Same data, different key order
  const obj1 = { name: 'Alice', role: 'admin', clearance: 'SECRET' };
  const obj2 = { clearance: 'SECRET', name: 'Alice', role: 'admin' };

  // Sign obj1, verify with both orderings
  const sig1 = signJSON(obj1, keyPair.secretKey);

  console.log(`  Signature (first 32 chars): ${sig1.slice(0, 32)}...`);

  // The key test: signature from obj1 should verify against obj2
  // (since canonical form is identical)
  const valid1 = verifyJSON(obj1, sig1, keyPair.publicKey);
  const valid2 = verifyJSON(obj2, sig1, keyPair.publicKey);  // Same sig, different key order

  console.log(`  Verify with original order (obj1): ${valid1}`);
  console.log(`  Verify with different order (obj2): ${valid2}`);
  console.log(`  Canonical form independent of key order: ${valid1 && valid2}`);

  // Note: ML-DSA signatures are randomized, so signing twice gives different
  // (but equally valid) signatures. The key property is that verification
  // works regardless of original object key order.

  return valid1 && valid2;
});

// Test 8: Signing Key Serialization
test('ML-DSA-65 key serialization round-trip', () => {
  const original = generateSigningKeyPair();
  const serialized = serializeSigningKeyPair(original);
  const restored = deserializeSigningKeyPair(serialized);

  console.log(`  Serialized public key length: ${serialized.publicKeyHex.length} chars`);

  const publicMatch = original.publicKey.every((b, i) => b === restored.publicKey[i]);
  const secretMatch = original.secretKey.every((b, i) => b === restored.secretKey[i]);

  return publicMatch && secretMatch && original.algorithm === restored.algorithm;
});

// Summary
console.log();
console.log('='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n✓ All tests passed! PQ crypto utilities working correctly.\n');
  process.exit(0);
} else {
  console.log('\n✗ Some tests failed. Please review the output above.\n');
  process.exit(1);
}
