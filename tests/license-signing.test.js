const test = require('node:test');
const assert = require('node:assert/strict');

const TEST_SIGNING_KEY_B64 =
  'LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0KYjNCbGJuTnphQzFyWlhrdGRqRUFBQUFBQkc1dmJtVUFBQUFFYm05dVpRQUFBQUFBQUFBQkFBQUFNd0FBQUF0emMyZ3RaVwpReU5UVXhPUUFBQUNCVHFzVlh4U2pNeEpsNENuVmJ1YmNJYkcrdWVuSEdrU2pDb2xUR1AyaFM1QUFBQUpqMjVNSmg5dVRDCllRQUFBQXR6YzJndFpXUXlOVFV4T1FBQUFDQlRxc1ZYeFNqTXhKbDRDblZidWJjSWJHK3VlbkhHa1NqQ29sVEdQMmhTNUEKQUFBRUNvd2ZDaEM5TDZPeUFRbiticlY4c1lsNGk5dWdkNnJNQzdlK0Y0WDJYRVAxT3F4VmZGS016RW1YZ0tkVnU1dHdocwpiNjU2Y2NhUktNS2lWTVkvYUZMa0FBQUFFWEp2YjNSQU16VXhZemxqT0RZMk1HVTJBUUlEQkE9PQotLS0tLUVORCBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K';

test('license signing roundtrip sign/verify', () => {
  process.env.LICENSE_SIGNING_SSH_PRIVATE_KEY_B64 = TEST_SIGNING_KEY_B64;
  const signing = require('../netlify/functions/_lib/licenseSigning');

  const payload = {
    product: 'CoolAutoSorter',
    order_id: 'order_test_123',
    purchaser_email_hash: 'abc123',
    issued_at: '2026-01-01T00:00:00.000Z'
  };

  const signed = signing.signLicensePayload(payload);
  assert.equal(typeof signed, 'string');
  assert.equal(signing.verifyLicensePayload(signed), true);
});
