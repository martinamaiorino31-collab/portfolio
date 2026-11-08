const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.navigation');
const navLinks = [...document.querySelectorAll('.navigation a')];
const progressBar = document.querySelector('[data-scroll-progress]');
const bookPages = [...document.querySelectorAll('[data-book-page]')];
const bookPrevious = document.querySelector('[data-book-prev]');
const bookNext = document.querySelector('[data-book-next]');
const bookCurrent = document.querySelector('[data-book-current]');
const bookTotal = document.querySelector('[data-book-total]');
const bookTitle = document.querySelector('[data-book-title]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll('[data-year]').forEach((year) => {
  year.textContent = new Date().getFullYear();
});

const setMenuState = (open) => {
  menuButton?.setAttribute('aria-expanded', String(open));
  navigation?.classList.toggle('is-open', open);
};

menuButton?.addEventListener('click', () => {
  setMenuState(menuButton.getAttribute('aria-expanded') !== 'true');
});
navLinks.forEach((link) => link.addEventListener('click', () => setMenuState(false)));

const hashIndex = bookPages.findIndex((page) => `#${page.id}` === location.hash);
let currentBookPage = hashIndex >= 0 ? hashIndex : 0;
let turningPage = false;
let wheelIntent = 0;
let wheelReset;
let touchStartX = 0;
let touchStartY = 0;

const activePage = () => bookPages[currentBookPage];

const updateBookProgress = () => {
  const page = activePage();
  if (!page) return;
  const available = page.scrollHeight - page.clientHeight;
  const withinPage = available > 0 ? page.scrollTop / available : 0;
  const denominator = Math.max(bookPages.length - 1, 1);
  const progress = Math.min((currentBookPage + withinPage) / denominator, 1);
  progressBar?.style.setProperty('transform', `scaleX(${progress})`);
  header?.classList.toggle('is-scrolled', page.scrollTop > 18);
};

const updateBookNav = () => {
  const page = activePage();
  if (bookCurrent) bookCurrent.textContent = String(currentBookPage + 1).padStart(2, '0');
  if (bookTotal) bookTotal.textContent = String(bookPages.length).padStart(2, '0');
  if (bookTitle) bookTitle.textContent = page?.dataset.pageTitle ?? '';
  if (bookPrevious) bookPrevious.disabled = currentBookPage === 0;
  if (bookNext) bookNext.disabled = currentBookPage === bookPages.length - 1;
  navLinks.forEach((link) => {
    const isCurrent = link.getAttribute('href') === `#${page?.id}`;
    if (isCurrent) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  updateBookProgress();
};

const revealPage = (page) => {
  page?.querySelectorAll('.reveal').forEach((element, index) => {
    window.setTimeout(() => element.classList.add('is-visible'), index * 70);
  });
};

const setBookPage = (index) => {
  currentBookPage = Math.max(0, Math.min(index, bookPages.length - 1));
  bookPages.forEach((page, pageIndex) => {
    page.classList.remove('is-active', 'is-before', 'is-after');
    page.classList.add(pageIndex < currentBookPage ? 'is-before' : pageIndex > currentBookPage ? 'is-after' : 'is-active');
    page.inert = pageIndex !== currentBookPage;
    page.setAttribute('aria-hidden', String(pageIndex !== currentBookPage));
  });
  const page = activePage();
  bookPages.forEach((bookPage, pageIndex) => {
    if (pageIndex !== currentBookPage) {
      bookPage.querySelectorAll('video').forEach((video) => video.pause());
    }
  });
  revealPage(page);
  history.replaceState(null, '', `#${page.id}`);
  updateBookNav();
};

const clonePageForTurn = (source) => {
  const clone = source.cloneNode(true);
  clone.classList.remove('is-active', 'is-before', 'is-after');
  clone.classList.add('flip-clone');
  clone.removeAttribute('data-book-page');
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  clone.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
  clone.querySelectorAll('video').forEach((video) => {
    video.removeAttribute('controls');
    video.muted = true;
    video.setAttribute('preload', 'none');
  });
  clone.style.top = `${-source.scrollTop}px`;
  clone.style.height = `${Math.max(source.scrollHeight, source.clientHeight)}px`;
  return clone;
};

const buildTurningLeaf = (current, target, forward) => {
  const layer = document.createElement('div');
  layer.className = `book-flip ${forward ? 'book-flip-next' : 'book-flip-prev'}`;
  layer.setAttribute('aria-hidden', 'true');

  const leaf = document.createElement('div');
  leaf.className = 'book-leaf';

  const front = document.createElement('div');
  front.className = 'book-face book-face-front';
  const frontInner = document.createElement('div');
  frontInner.className = 'book-face-inner';
  frontInner.append(clonePageForTurn(current));
  front.append(frontInner);

  const back = document.createElement('div');
  back.className = 'book-face book-face-back';
  const backInner = document.createElement('div');
  backInner.className = 'book-face-inner';
  backInner.append(clonePageForTurn(target));
  back.append(backInner);

  const curl = document.createElement('span');
  curl.className = 'book-curl';
  const edge = document.createElement('span');
  edge.className = 'book-paper-edge';

  leaf.append(front, back, curl, edge);
  layer.append(leaf);
  document.body.append(layer);
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('is-turning')));
  return layer;
};

const turnToPage = (index) => {
  const nextIndex = Math.max(0, Math.min(index, bookPages.length - 1));
  if (nextIndex === currentBookPage || turningPage || !bookPages[nextIndex]) return;

  const forward = nextIndex > currentBookPage;
  const current = activePage();
  const target = bookPages[nextIndex];
  turningPage = true;
  target.scrollTop = 0;
  revealPage(target);

  if (reduceMotion.matches) {
    setBookPage(nextIndex);
    turningPage = false;
    return;
  }

  const turningLeaf = buildTurningLeaf(current, target, forward);
  window.setTimeout(() => setBookPage(nextIndex), 430);
  window.setTimeout(() => {
    turningLeaf.remove();
    turningPage = false;
  }, 940);
};

bookPrevious?.addEventListener('click', () => turnToPage(currentBookPage - 1));
bookNext?.addEventListener('click', () => turnToPage(currentBookPage + 1));

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  const target = document.querySelector(link.getAttribute('href'));
  const targetIndex = bookPages.indexOf(target);
  if (targetIndex < 0) return;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setMenuState(false);
    turnToPage(targetIndex);
  });
});

bookPages.forEach((page) => {
  page.addEventListener('scroll', updateBookProgress, { passive: true });
  page.addEventListener('wheel', (event) => {
    if (turningPage || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    const atTop = page.scrollTop <= 1;
    const atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 2;
    const canTurn = (event.deltaY > 0 && atBottom) || (event.deltaY < 0 && atTop);
    if (!canTurn) {
      wheelIntent = 0;
      return;
    }
    event.preventDefault();
    wheelIntent += event.deltaY;
    window.clearTimeout(wheelReset);
    wheelReset = window.setTimeout(() => { wheelIntent = 0; }, 180);
    if (Math.abs(wheelIntent) > 70) {
      turnToPage(currentBookPage + (wheelIntent > 0 ? 1 : -1));
      wheelIntent = 0;
    }
  }, { passive: false });

  page.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });
  page.addEventListener('touchend', (event) => {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      turnToPage(currentBookPage + (deltaX < 0 ? 1 : -1));
    }
  }, { passive: true });
});

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, textarea, select, button')) return;
  const page = activePage();
  const atTop = page.scrollTop <= 1;
  const atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 2;
  if (event.key === 'ArrowRight' || (event.key === 'PageDown' && atBottom)) {
    event.preventDefault();
    turnToPage(currentBookPage + 1);
  } else if (event.key === 'ArrowLeft' || (event.key === 'PageUp' && atTop)) {
    event.preventDefault();
    turnToPage(currentBookPage - 1);
  } else if (event.key === 'PageDown') {
    event.preventDefault();
    page.scrollBy({ top: page.clientHeight * .82, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  } else if (event.key === 'PageUp') {
    event.preventDefault();
    page.scrollBy({ top: page.clientHeight * -.82, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
});

document.documentElement.classList.add('book-ready');
setBookPage(currentBookPage);
