function getFromAddressParts(fromValue) {
  const match = String(fromValue || '').match(/^(.*)<([^>]+)>$/);
  if (!match) return { email: String(fromValue || '').trim(), name: 'CoolWareX' };
  return { name: match[1].trim().replace(/^"|"$/g, '') || 'CoolWareX', email: match[2].trim() };
}

async function sendViaResend({ apiKey, from, to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend failed (${response.status}): ${errorBody.slice(0, 200)}`);
  }
}

async function sendViaSendGrid({ apiKey, from, to, subject, html }) {
  const fromParts = getFromAddressParts(from);
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: fromParts,
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SendGrid failed (${response.status}): ${errorBody.slice(0, 200)}`);
  }
}

async function sendLicenseEmail({ to, licenseKey, orderId }) {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  const from = process.env.EMAIL_FROM || 'CoolWareX <coolwarex@proton.me>';
  if (!apiKey) return { skipped: true };

  const html = `
    <h2>Thanks for purchasing CoolAutoSorter</h2>
    <p>Your lifetime license is ready.</p>
    <p><strong>Order ID:</strong> ${orderId}</p>
    <p><strong>License Key:</strong></p>
    <pre style="padding:12px;border-radius:8px;background:#f5f8fb;overflow:auto">${licenseKey}</pre>
    <p>Keep this key stored safely. You can also retrieve it on the support page with your purchase email.</p>
  `;

  const payload = { apiKey, from, to, subject: 'Your CoolAutoSorter License Key', html };
  if (provider === 'sendgrid') await sendViaSendGrid(payload);
  else await sendViaResend(payload);

  return { sent: true };
}

module.exports = { sendLicenseEmail };
