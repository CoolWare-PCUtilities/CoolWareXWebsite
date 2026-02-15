(function initTheme() {
  const root = document.documentElement;
  const savedPreference = localStorage.getItem('cw-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-theme', savedPreference || (prefersDark ? 'dark' : 'light'));
})();

document.addEventListener('DOMContentLoaded', () => {
  const config = window.CW_CONFIG || {};
  const themeButton = document.querySelector('[data-theme-toggle]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('header nav');

  if (config.BUY_URL) {
    document.querySelectorAll('[data-buy-link]').forEach((link) => {
      link.href = config.BUY_URL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  if (config.TRIAL_DOWNLOAD_URL) {
    document.querySelectorAll('[data-trial-download]').forEach((link) => {
      link.href = config.TRIAL_DOWNLOAD_URL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  if (themeButton) {
    const syncThemeLabel = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeButton.textContent = dark ? '☀️' : '🌙';
      themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      themeButton.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
    };

    syncThemeLabel();
    themeButton.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('cw-theme', next);
      syncThemeLabel();
    });
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(nav.classList.contains('open')));
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
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
});
