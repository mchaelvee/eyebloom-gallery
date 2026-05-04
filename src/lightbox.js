export function createLightbox({ onOpen, onClose }) {
  const root = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const title = document.getElementById('lightbox-title');
  const sub = document.getElementById('lightbox-sub');
  const desc = document.getElementById('lightbox-desc');
  const closeBtn = document.getElementById('lightbox-close');

  let open = false;
  let suppressClickTimer = null;

  function show(piece) {
    img.src = piece.src;
    img.alt = piece.title || '';
    title.textContent = piece.title || 'Untitled';
    const subParts = [];
    if (piece.medium) subParts.push(piece.medium);
    if (piece.year) subParts.push(piece.year);
    sub.textContent = subParts.join('  ·  ');
    desc.textContent = piece.description || '';
    root.classList.remove('hidden');
    open = true;
    onOpen?.();
  }

  function hide() {
    if (!open) return;
    root.classList.add('hidden');
    open = false;
    onClose?.();
  }

  function suppressNextClick() {
    const swallow = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.removeEventListener('click', swallow, true);
      if (suppressClickTimer) clearTimeout(suppressClickTimer);
      suppressClickTimer = null;
    };
    document.addEventListener('click', swallow, true);
    suppressClickTimer = setTimeout(() => {
      document.removeEventListener('click', swallow, true);
      suppressClickTimer = null;
    }, 300);
  }

  function closeFromPointer(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    suppressNextClick();
    hide();
  }

  closeBtn.addEventListener('pointerdown', closeFromPointer);
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  });
  root.addEventListener('click', (e) => {
    if (e.target !== root) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopImmediatePropagation();
      hide();
    }
  });

  return { show, hide, get isOpen() { return open; } };
}
