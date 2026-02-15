function getRequestId(event) {
  return (
    event?.headers?.['x-nf-request-id'] ||
    event?.headers?.['X-Nf-Request-Id'] ||
    event?.headers?.['x-request-id'] ||
    event?.headers?.['X-Request-Id'] ||
    `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  );
}

function jsonResponse(statusCode, payload, requestId) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify({ ...payload, requestId })
  };
}

function getClientIp(event) {
  const headers = event?.headers || {};
  const value =
    headers['x-nf-client-connection-ip'] ||
    headers['X-Nf-Client-Connection-Ip'] ||
    headers['x-forwarded-for'] ||
    headers['X-Forwarded-For'] ||
    'unknown';

  return String(value).split(',')[0].trim() || 'unknown';
}

module.exports = { getRequestId, jsonResponse, getClientIp };
