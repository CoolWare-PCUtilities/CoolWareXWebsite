(function initTheme() {
  const stored = localStorage.getItem('cw-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cw-theme', theme);
}

document.addEventListener('DOMContentLoaded', () => {
  const themeButton = document.querySelector('[data-theme-toggle]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('header nav');

  if (themeButton) {
    const sync = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeButton.textContent = dark ? '☀️' : '🌙';
      themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    sync();
    themeButton.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(current);
      sync();
    });
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      const expanded = nav.classList.contains('open');
      navToggle.setAttribute('aria-expanded', String(expanded));
    });
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
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  document.querySelectorAll('[data-buy-direct]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const status = document.querySelector('[data-buy-status]');
      button.setAttribute('aria-busy', 'true');
      if (status) status.textContent = 'Connecting to secure checkout...';
      try {
        const response = await fetch('/.netlify/functions/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: window.location.pathname })
        });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start checkout.');
        window.location.href = data.url;
      } catch (error) {
        if (status) status.textContent = error.message;
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
      status.textContent = 'Looking up licenses...';
      results.innerHTML = '';
      try {
        const response = await fetch('/.netlify/functions/lookup-license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to process request.');
        if (!data.found || !data.licenses.length) {
          status.textContent = 'If a license exists for that email, it will appear here.';
          return;
        }
        status.textContent = 'License(s) found.';
        const list = document.createElement('ul');
        data.licenses.forEach((item) => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${item.order_id}</strong><br><code>${item.license_key}</code>`;
          list.appendChild(li);
        });
        results.appendChild(list);
      } catch (error) {
        status.textContent = error.message;
      }
    });
  }

  const successBox = document.querySelector('[data-success-session]');
  if (successBox) {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) successBox.textContent = `Checkout session: ${sessionId}`;
  }
});
