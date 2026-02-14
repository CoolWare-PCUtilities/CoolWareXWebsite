exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const siteUrl = process.env.SITE_URL || 'http://localhost:8888';

  if (!stripeKey || !priceId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Stripe configuration' }) };
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cancel.html`,
    'metadata[source]': body.source || 'website'
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json();
  if (!response.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: data.error?.message || 'Stripe error' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ url: data.url, id: data.id }) };
};
