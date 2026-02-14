exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const siteUrl = process.env.SITE_URL || 'http://localhost:8888';

  if (!stripeKey || !priceId || !siteUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing server configuration' }) };
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cancel`,
    'metadata[source]': body.source || 'website',
    'payment_intent_data[metadata][product]': 'CoolAutoSorter'
  });

  if (body.customer_email) {
    params.append('customer_email', String(body.customer_email).trim().toLowerCase());
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    return { statusCode: 502, body: JSON.stringify({ error: data.error?.message || 'Checkout unavailable' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ url: data.url }) };
};
