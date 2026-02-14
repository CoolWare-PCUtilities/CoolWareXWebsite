(function initTheme() {
  const storedTheme = localStorage.getItem('cw-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const activeTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', activeTheme);
})();

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cw-theme', theme);
}

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.toggle('success', !isError);
}

document.addEventListener('DOMContentLoaded', () => {
  const themeButton = document.querySelector('[data-theme-toggle]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('header nav');

  if (themeButton) {
    const syncThemeLabel = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeButton.textContent = dark ? '☀️' : '🌙';
      themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    syncThemeLabel();
    themeButton.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(current);
      syncThemeLabel();
    });
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(nav.classList.contains('open')));
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('open')));
  }

  const reveals = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach((node) => io.observe(node));
  } else {
    reveals.forEach((node) => node.classList.add('visible'));
  }

  document.querySelectorAll('[data-buy-direct]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const status = button.closest('section, article, .card')?.querySelector('[data-buy-status]') || document.querySelector('[data-buy-status]');
      button.setAttribute('aria-busy', 'true');
      setStatus(status, 'Connecting to secure checkout...');

      try {
        const emailField = document.querySelector('[data-checkout-email]');
        const payload = {
          source: window.location.pathname,
          customer_email: emailField?.value?.trim() || undefined
        };

        const response = await fetch('/.netlify/functions/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start checkout.');
        window.location.href = data.url;
      } catch (error) {
        setStatus(status, error.message || 'Checkout unavailable right now.', true);
      } finally {
        button.setAttribute('aria-busy', 'false');
      }
    });
  });

  const lookupForm = document.querySelector('[data-license-lookup-form]');
  if (lookupForm) {
    const status = document.querySelector('[data-lookup-status]');
    const results = document.querySelector('[data-lookup-results]');
    lookupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = lookupForm.querySelector('input[name="email"]').value.trim();
      if (!email) return;

      setStatus(status, 'Checking for licenses...');
      results.innerHTML = '';

      try {
        const response = await fetch('/.netlify/functions/lookup-license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.status === 429) throw new Error(data.error || 'Request limit reached.');
        if (!response.ok) throw new Error('Request unavailable, please try again soon.');

        if (!data.found || !Array.isArray(data.licenses) || data.licenses.length === 0) {
          setStatus(status, data.message || 'If a matching license exists, it has been returned.');
          return;
        }

        setStatus(status, `Found ${data.licenses.length} license record(s).`);
        const list = document.createElement('ul');
        data.licenses.forEach((item) => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${item.product || 'CoolAutoSorter'}</strong> · ${item.order_id}<br><code>${item.license_key}</code>`;
          list.appendChild(li);
        });
        results.appendChild(list);
      } catch (error) {
        setStatus(status, error.message, true);
      }
    });
  }

  const updatesForm = document.querySelector('[data-updates-form]');
  if (updatesForm) {
    const updatesStatus = document.querySelector('[data-updates-status]');
    updatesForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = updatesForm.querySelector('input[name="email"]').value.trim();
      setStatus(updatesStatus, 'Submitting...');
      try {
        const response = await fetch('/.netlify/functions/subscribe-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to subscribe right now.');
        setStatus(updatesStatus, 'Thanks — you are on the CoolClipboard updates list.');
        updatesForm.reset();
      } catch (error) {
        setStatus(updatesStatus, error.message, true);
      }
    });
  }

  const successSession = document.querySelector('[data-success-session]');
  if (successSession) {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (sessionId) successSession.textContent = `Order reference: ${sessionId}`;
  }
});
