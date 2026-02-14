document.addEventListener('DOMContentLoaded', () => {
  const screenshotSlots = document.querySelectorAll('.screenshot-item[data-src]');

  screenshotSlots.forEach((slot) => {
    const src = slot.getAttribute('data-src');
    const img = slot.querySelector('img');
    const placeholder = slot.querySelector('.placeholder');

    if (!src || !img || !placeholder) return;

    img.onload = () => {
      img.style.display = 'block';
      placeholder.style.display = 'none';
    };

    img.onerror = () => {
      img.style.display = 'none';
      placeholder.style.display = 'flex';
    };

    img.src = src;
  });
});
