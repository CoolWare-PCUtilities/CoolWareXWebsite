const test = require('node:test');
const assert = require('node:assert/strict');

const { getClientIp } = require('../netlify/functions/lib/http');

test('getClientIp prefers x-nf-client-connection-ip over x-forwarded-for', () => {
  const ip = getClientIp({
    headers: {
      'x-forwarded-for': '203.0.113.8, 70.1.1.1',
      'x-nf-client-connection-ip': '198.51.100.99'
    }
  });
  assert.equal(ip, '198.51.100.99');
});
