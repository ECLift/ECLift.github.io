// Minimal masonry gallery + lightbox
// Prefers inline JSON (script#memories-data), falls back to fetching assets/memories/index.json

(function () {
  const manifestUrl = 'assets/memories/index.json';
  const grid = document.getElementById('memories-grid');
  if (!grid) return;
  const isCarousel = grid.classList.contains('memories-carousel');

  let images = [];
  let current = 0;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    if (props.className) node.setAttribute('class', props.className);
    children.forEach(c => node.appendChild(c));
    return node;
  }

  // Lightbox
  const lightbox = el('div', { id: 'lightbox', className: 'lightbox' });
  const inner = el('div', { className: 'lightbox-inner' });
  const closeBtn = el('button', { className: 'close-btn', title: 'Close', innerText: 'x' });
  const prevBtn = el('button', { className: 'nav-btn prev', title: 'Previous', innerText: '<' });
  const nextBtn = el('button', { className: 'nav-btn next', title: 'Next', innerText: '>' });
  const figure = el('figure');
  const imgEl = el('img', { alt: '' });
  const caption = el('figcaption');
  figure.appendChild(imgEl);
  figure.appendChild(caption);
  inner.appendChild(closeBtn);
  inner.appendChild(prevBtn);
  inner.appendChild(nextBtn);
  inner.appendChild(figure);
  lightbox.appendChild(inner);
  document.body.appendChild(lightbox);

  function open(index) {
    current = (index + images.length) % images.length;
    const item = images[current];
    imgEl.src = item.full || item.src;
    imgEl.alt = item.alt || '';
    caption.textContent = item.title || '';
    lightbox.classList.add('is-open');
    // Preload neighbors
    [current - 1, current + 1].forEach(i => {
      const j = (i + images.length) % images.length;
      const src = images[j].full || images[j].src;
      const p = new Image();
      p.src = src;
    });
  }

  function close() { lightbox.classList.remove('is-open'); }
  function next() { open(current + 1); }
  function prev() { open(current - 1); }

  closeBtn.addEventListener('click', close);
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });

  function addToGrid(item, index) {
    const img = new Image();
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = item.alt || item.title || 'Memory photo';
    if (item.w && item.h) { img.width = item.w; img.height = item.h; }
    img.src = item.thumb || item.src;

    const a = el('a', { href: item.full || item.src, className: isCarousel ? 'item' : 'masonry-item' });
    a.dataset.index = String(index);
    a.appendChild(img);
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      open(Number(a.dataset.index));
    });
    return a;
  }

  function render(list) {
    images = list || [];
    if (!isCarousel) {
      images.forEach((it, i) => grid.appendChild(addToGrid(it, i)));
      return;
    }
    // Carousel with two rows, each showing a different random subset per load
    const row1 = el('div', { className: 'row' });
    const row2 = el('div', { className: 'row' });

    const track1 = el('div', { className: 'carousel-track dir-rtl' });
    const track2 = el('div', { className: 'carousel-track dir-ltr' });

    // Shuffle indices to randomize selection per visit
    const entries = images.map((it, i) => ({ it, index: i }));
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    // Split into two disjoint sets (alternate items to balance)
    const set1 = [];
    const set2 = [];
    entries.forEach((e, idx) => (idx % 2 === 0 ? set1 : set2).push(e));

    const nodes1 = set1.map(e => addToGrid(e.it, e.index));
    const nodes2 = set2.map(e => addToGrid(e.it, e.index));

    // Append and duplicate each track for seamless loop
    nodes1.forEach(n => track1.appendChild(n.cloneNode(true)));
    nodes1.forEach(n => track1.appendChild(n.cloneNode(true)));

    nodes2.forEach(n => track2.appendChild(n.cloneNode(true)));
    nodes2.forEach(n => track2.appendChild(n.cloneNode(true)));

    // Re-bind click handlers for all anchors in both tracks
    [track1, track2].forEach(track => {
      track.querySelectorAll('a').forEach(a => {
        const idx = Number(a.dataset.index);
        a.addEventListener('click', (ev) => { ev.preventDefault(); open(idx); });
      });
    });

    row1.appendChild(track1);
    row2.appendChild(track2);
    grid.innerHTML = '';
    grid.appendChild(row1);
    grid.appendChild(row2);

    // Slightly faster than before and different per row, with offset to avoid alignment
    const base = Math.max(44, images.length * 9.0); // overall duration baseline
    track1.style.setProperty('--scroll-duration', base + 's');
    track2.style.setProperty('--scroll-duration', Math.round(base * 0.9) + 's');
    // Start second row partway through its loop
    track2.style.setProperty('--scroll-offset', (Math.round(base * 0.3)) + 's');
  }

  // 1) Inline JSON manifest
  try {
    const inline = document.getElementById('memories-data');
    if (inline && inline.textContent) {
      const data = JSON.parse(inline.textContent);
      const list = Array.isArray(data) ? data : (data.images || []);
      if (list && list.length) {
        render(list);
        return;
      }
    }
  } catch (e) {
    console.warn('Memories inline JSON parse failed:', e);
  }

  // 2) Fetch manifest with cache-busting
  const bust = (manifestUrl.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now();
  fetch(manifestUrl + bust, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Missing memories manifest')))
    .then(data => render(Array.isArray(data) ? data : (data.images || [])))
    .catch((err) => {
      console.warn('Memories manifest fetch failed, using demo set:', err);
      render([
        { "src": "assets/memories/1.webp", "title": "Photo 1" },
        { "src": "assets/memories/2.webp", "title": "Photo 2" },
        { "src": "assets/memories/3.webp", "title": "Photo 3" },
        { "src": "assets/memories/4.webp", "title": "Photo 4" },
        { "src": "assets/memories/5.webp", "title": "Photo 5" },
        { "src": "assets/memories/6.webp", "title": "Photo 6" },
        { "src": "assets/memories/7.webp", "title": "Photo 7" },
        { "src": "assets/memories/8.webp", "title": "Photo 8" },
        { "src": "assets/memories/9.webp", "title": "Photo 9" },
        { "src": "assets/memories/10.webp", "title": "Photo 10" },
        { "src": "assets/memories/11.webp", "title": "Photo 11" },
        { "src": "assets/memories/12.webp", "title": "Photo 12" },
        { "src": "assets/memories/13.webp", "title": "Photo 13" },
        { "src": "assets/memories/14.webp", "title": "Photo 14" },
        { "src": "assets/memories/15.webp", "title": "Photo 15" }
      ]);
    });
})();
