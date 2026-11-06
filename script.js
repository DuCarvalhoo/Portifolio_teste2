(() => {
  const year = document.querySelector('#current-year');
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('open', !isOpen);
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menuButton.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
      });
    });
  }

  const dialog = document.querySelector('#project-dialog');
  const closeButton = dialog?.querySelector('.dialog-close');
  if (dialog) {
    document.querySelectorAll('.details-link').forEach((button) => {
      button.addEventListener('click', () => {
        dialog.querySelector('#dialog-title').textContent = button.dataset.title || 'Projeto';
        dialog.querySelector('#dialog-origin').textContent = button.dataset.origin || 'DETALHES';
        dialog.querySelector('#dialog-description').textContent = button.dataset.description || '';
        const stack = dialog.querySelector('#dialog-stack');
        stack.replaceChildren();
        (button.dataset.stack || '').split('·').map((item) => item.trim()).filter(Boolean).forEach((item) => {
          const tag = document.createElement('span');
          tag.textContent = item;
          stack.append(tag);
        });
        dialog.showModal();
      });
    });
    closeButton?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }
})();
