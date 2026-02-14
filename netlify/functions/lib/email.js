async function sendLicenseEmail({ to, licenseKey, orderId }) {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM || 'CoolWareX <coolwarex@proton.me>';
  if (!apiKey) return { skipped: true };

  const html = `<p>Thank you for purchasing CoolAutoSorter.</p><p><strong>Order:</strong> ${orderId}</p><p><strong>Your license key:</strong><br><code>${licenseKey}</code></p><p>Keep this key safe. You can retrieve it later from support.</p>`;

  if (apiKey.startsWith('SG.') || process.env.EMAIL_PROVIDER === 'sendgrid') {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from.match(/<(.*)>/)?.[1] || from, name: 'CoolWareX' },
        subject: 'Your CoolAutoSorter License Key',
        content: [{ type: 'text/html', value: html }]
      })
    });
    if (!response.ok) throw new Error(`SendGrid failed (${response.status})`);
    return { sent: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject: 'Your CoolAutoSorter License Key', html })
  });
  if (!response.ok) throw new Error(`Resend failed (${response.status})`);
  return { sent: true };
}

module.exports = { sendLicenseEmail };
