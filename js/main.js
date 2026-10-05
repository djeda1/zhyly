(() => {
  const EN = document.documentElement.lang === 'en';
  const L = (ru, en) => (EN ? en : ru);
  const T = (pair) => (pair ? pair[EN ? 1 : 0] : '');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BASE = EN ? '../' : '';
  const CATS = window.CATEGORIES;
  const MENU = window.MENU;
  const DISH = Object.fromEntries(MENU.map((d) => [d.id, d]));

  const TAGS = {
    hit:   { icon: 'ph-fill ph-star', n: ['Хит', 'Bestseller'] },
    kids:  { icon: 'ph ph-smiley',    n: ['Детям', 'For kids'] },
    veg:   { icon: 'ph ph-leaf',      n: ['Без мяса', 'Meat-free'] },
    spicy: { icon: 'ph-fill ph-pepper', n: ['Острое', 'Spicy'] },
    new:   { icon: 'ph ph-sparkle',   n: ['Новинка', 'New'] },
  };
  const FILTERS = ['hit', 'kids', 'veg', 'spicy'];
  const UNITS = { g: ['г', 'g'], kg: ['кг', 'kg'], ml: ['мл', 'ml'], l: ['л', 'l'], pcs: ['шт.', 'pcs'], cm: ['см', 'cm'], scoops: ['шарика', 'scoops'] };
  const SERVICE = 0.1;

  /* ---------- Форматирование ---------- */
  const money = (n) => (EN ? n.toLocaleString('en-US') : n.toLocaleString('ru-RU').replace(/\s/g, ' ')) + ' ₸';
  const num = (n) => (EN ? String(n) : String(n).replace('.', ','));
  const weight = (w) => (w ? `${num(w[0])} ${T(UNITS[w[1]])}` : '');
  const plural = (n, forms) => {
    if (EN) return forms[n === 1 ? 0 : 1];
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е');

  const priceOf = (d, vi = 0) => (d.v ? d.v[vi].p : d.p);
  const minPrice = (d) => (d.v ? Math.min(...d.v.map((x) => x.p)) : d.p);
  const priceLabel = (d) => (d.v ? `<small>${L('от', 'from')}</small> ${money(minPrice(d))}` : money(d.p));
  const big = (d) => `${BASE}img/${d.img}.webp`;
  const small = (d) => `${BASE}img/${d.img}-s.webp`;

  /* ---------- Состояние ---------- */
  const KEY = 'zhyly:picks:v1';
  const state = { q: '', filters: new Set(), cart: load() };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      // убираем позиции, которых больше нет в меню
      return Object.fromEntries(Object.entries(raw).filter(([k, q]) => {
        const [id, vi] = k.split('|');
        const d = DISH[id];
        return d && q > 0 && (d.v ? d.v[+vi] : +vi === 0);
      }));
    } catch { return {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state.cart)); } catch { /* приватный режим */ }
  }

  const qtyOfDish = (id) => Object.entries(state.cart).reduce((s, [k, q]) => (k.split('|')[0] === id ? s + q : s), 0);

  function setQty(key, qty) {
    if (qty > 0) state.cart[key] = Math.min(qty, 99);
    else delete state.cart[key];
    save();
    refreshControls(key.split('|')[0]);
    refreshCartbar();
    if (!$('#cart-sheet').hidden) renderCart();
  }
  const change = (key, delta) => setQty(key, (state.cart[key] || 0) + delta);

  /* ---------- Кнопки у блюда ---------- */
  function controls(d) {
    const name = esc(T(d.n));
    if (d.v) {
      const q = qtyOfDish(d.id);
      return `<button class="add" type="button" data-open="${d.id}" aria-label="${L('Выбрать вариант', 'Choose option')}: ${name}">
        <i class="ph ph-plus"></i>${q ? `<span class="qty-dot">${q}</span>` : ''}</button>`;
    }
    const key = `${d.id}|0`;
    const q = state.cart[key] || 0;
    if (!q) return `<button class="add" type="button" data-inc="${key}" aria-label="${L('Добавить', 'Add')}: ${name}"><i class="ph ph-plus"></i></button>`;
    return stepper(key, q, name);
  }
  function stepper(key, q, name, cls = '') {
    return `<div class="stepper ${cls}">
      <button type="button" data-dec="${key}" aria-label="${L('Убрать одну', 'Remove one')}: ${name}"><i class="ph ph-minus"></i></button>
      <output aria-live="polite">${q}</output>
      <button type="button" data-inc="${key}" aria-label="${L('Добавить ещё', 'Add one more')}: ${name}"><i class="ph ph-plus"></i></button>
    </div>`;
  }
  function refreshControls(id) {
    const d = DISH[id];
    $$(`[data-ctrl="${id}"]`).forEach((el) => { el.innerHTML = controls(d); });
  }

  function badges(d) {
    return d.t.filter((t) => t !== 'kids' || d.c !== 'kids').map((t) => (t === 'new'
      ? `<span class="badge-new">${L('новинка', 'new')}</span>`
      : `<i class="badge is-${t} ${TAGS[t].icon}" title="${T(TAGS[t].n)}" role="img" aria-label="${T(TAGS[t].n)}"></i>`)).join('');
  }
  const priceLine = (d) => `<span class="price">${priceLabel(d)}${d.w ? `<span class="w">${weight(d.w)}</span>` : ''}</span>`;

  /* ---------- Любимое гостями ---------- */
  function renderFeatured() {
    $('#featured').innerHTML = window.FEATURED.map((id) => {
      const d = DISH[id];
      return `<article class="fav reveal" role="listitem">
        <button class="fav-photo" type="button" data-open="${d.id}" aria-label="${esc(T(d.n))}">
          <img src="${big(d)}" alt="" loading="lazy" width="1000" height="1000">
        </button>
        <h3 class="fav-name">${esc(T(d.n))}</h3>
        <div class="fav-row"><span class="price">${priceLabel(d)}</span><span data-ctrl="${d.id}">${controls(d)}</span></div>
      </article>`;
    }).join('');
  }

  /* ---------- Меню ---------- */
  function matches(d) {
    for (const f of state.filters) if (!d.t.includes(f)) return false;
    if (!state.q) return true;
    const cat = CATS.find((c) => c.id === d.c);
    const hay = norm([d.n[0], d.n[1], T(d.d), T(cat.n), d.v ? d.v.map((x) => T(x.l)).join(' ') : ''].join(' '));
    return norm(state.q).trim().split(/\s+/).every((w) => hay.includes(w));
  }

  function dishHero(d) {
    return `<li class="dish dish-hero">
      <button class="dish-open" type="button" data-open="${d.id}">
        <span class="ph-wrap"><img src="${big(d)}" alt="" loading="lazy" width="1000" height="700"></span>
        <span class="dish-text">
          <span class="dish-name">${esc(T(d.n))}<span class="badges">${badges(d)}</span></span>
          ${T(d.d) ? `<span class="dish-desc">${esc(T(d.d))}</span>` : ''}
        </span>
      </button>
      <div class="dish-foot">${priceLine(d)}<span data-ctrl="${d.id}">${controls(d)}</span></div>
    </li>`;
  }

  function dishRow(d) {
    return `<li class="dish dish-row">
      <button class="thumb-btn" type="button" data-open="${d.id}" tabindex="-1" aria-hidden="true">
        <img class="thumb" src="${small(d)}" alt="" loading="lazy" width="320" height="320">
      </button>
      <div class="dish-text">
        <button class="dish-open" type="button" data-open="${d.id}">
          <span class="dish-name">${esc(T(d.n))}<span class="badges">${badges(d)}</span></span>
          ${T(d.d) ? `<span class="dish-desc">${esc(T(d.d))}</span>` : ''}
        </button>
        <div class="dish-foot">${priceLine(d)}<span data-ctrl="${d.id}">${controls(d)}</span></div>
      </div>
    </li>`;
  }

  let firstRender = true;
  function renderMenu() {
    let total = 0;
    const visible = [];
    const html = CATS.map((c) => {
      const items = MENU.filter((d) => d.c === c.id && matches(d));
      if (!items.length) return '';
      total += items.length;
      visible.push(c.id);
      return `<section class="cat${firstRender ? ' reveal' : ''}" id="cat-${c.id}" data-cat="${c.id}" aria-labelledby="h-${c.id}">
        <h3 class="cat-title" id="h-${c.id}">${T(c.n)}<sup>${items.length}</sup></h3>
        ${c.note ? `<p class="cat-note">${T(c.note)}</p>` : ''}
        <ul class="dishes">${items.map((d, i) => (i === 0 ? dishHero(d) : dishRow(d))).join('')}</ul>
      </section>`;
    }).join('');

    $('#sections').innerHTML = html;
    $('#empty').hidden = total > 0;
    $$('.chip').forEach((ch) => { ch.hidden = !visible.includes(ch.dataset.cat); });
    observeSections();
    if (firstRender) $$('#sections .reveal').forEach((el) => revealer.observe(el));
    firstRender = false;
  }

  function renderChips() {
    $('#chips').innerHTML = CATS.map((c) => `<a class="chip" href="#cat-${c.id}" data-cat="${c.id}">${T(c.n)}</a>`).join('');
  }

  function renderFilters() {
    const any = state.filters.size > 0;
    $('#filters').innerHTML = FILTERS.map((f) => `<button class="filter" type="button" data-filter="${f}" aria-pressed="${state.filters.has(f)}">
        <i class="${TAGS[f].icon}" aria-hidden="true"></i>${T(TAGS[f].n)}</button>`).join('')
      + (any ? `<button class="filter-reset" type="button" data-reset>${L('Сбросить', 'Clear')}</button>` : '');
  }

  // Позиция, где панель разделов стоит в потоке (до прилипания)
  const catbarHome = () => $('#menu .menu-head').getBoundingClientRect().bottom + window.scrollY;
  function toMenuTop() {
    const home = catbarHome();
    if (window.scrollY > home) window.scrollTo({ top: home });
  }

  /* ---------- Появление при прокрутке ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealer.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  /* ---------- Подсветка раздела и прилипшая панель ---------- */
  const catbar = $('#catbar');
  let activeCat = null;
  let spyLock = false;
  const seen = new Map();

  function setActive(id) {
    if (!id || id === activeCat) return;
    activeCat = id;
    const chips = $('#chips');
    $$('.chip', chips).forEach((ch) => {
      const on = ch.dataset.cat === id;
      ch.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) chips.scrollTo({ left: ch.offsetLeft - chips.clientWidth / 2 + ch.offsetWidth / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
    });
  }

  // Активен раздел, который пересекает полосу сразу под панелью
  let spy;
  function observeSections() {
    if (spy) spy.disconnect();
    seen.clear();
    activeCat = null;
    const top = catbar.offsetHeight + 8;
    spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.dataset.cat, e.isIntersecting));
      if (spyLock) return;
      const first = $$('#sections .cat').find((s) => seen.get(s.dataset.cat));
      if (first) setActive(first.dataset.cat);
    }, { rootMargin: `-${top}px 0px -${Math.max(0, window.innerHeight - top - 120)}px 0px` });
    $$('#sections .cat').forEach((s) => spy.observe(s));
    const firstCat = $('#sections .cat');
    if (firstCat) setActive(firstCat.dataset.cat);
  }
  window.addEventListener('resize', () => observeSections());

  // Тень у панели, когда она прилипла
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  catbar.before(sentinel);
  new IntersectionObserver(([e]) => catbar.classList.toggle('stuck', !e.isIntersecting)).observe(sentinel);

  function goToCat(id) {
    const s = $(`#cat-${id}`);
    if (!s) return;
    setActive(id);
    spyLock = true;
    const top = s.getBoundingClientRect().top + window.scrollY - catbar.offsetHeight + 8;
    window.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });
    const release = () => { spyLock = false; };
    if ('onscrollend' in window) window.addEventListener('scrollend', release, { once: true });
    setTimeout(release, 900);
  }

  /* ---------- Поиск ---------- */
  const searchForm = $('#search');
  const q = $('#q');

  function openSearch() {
    const home = catbarHome();
    if (window.scrollY < home) window.scrollTo({ top: home });
    $('#chips').hidden = true;
    $('#search-open').hidden = true;
    searchForm.hidden = false;
    q.focus({ preventScroll: true });
  }
  function closeSearch() {
    q.value = '';
    state.q = '';
    searchForm.hidden = true;
    $('#chips').hidden = false;
    $('#search-open').hidden = false;
    renderMenu();
  }
  q.addEventListener('input', () => { state.q = q.value; renderMenu(); toMenuTop(); });
  searchForm.addEventListener('submit', (e) => { e.preventDefault(); q.blur(); });
  $('#search-open').addEventListener('click', openSearch);
  $('#search-close').addEventListener('click', closeSearch);
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearch(); });

  function resetAll() {
    state.filters.clear();
    renderFilters();
    if (!searchForm.hidden) closeSearch(); else renderMenu();
    toMenuTop();
  }

  /* ---------- Шторки ---------- */
  let lastFocus = null;
  const openSheets = [];

  function openSheet(el) {
    if (!el.hidden) return;
    lastFocus = document.activeElement;
    el.hidden = false;
    document.documentElement.classList.add('lock');
    openSheets.push(el);
    const panel = $('.sheet-panel', el);
    panel.scrollTop = 0;
    panel.setAttribute('tabindex', '-1');
    void panel.offsetWidth; // запускаем анимацию с закрытого положения
    el.classList.add('open');
    panel.focus({ preventScroll: true });
  }
  function closeSheet(el) {
    if (el.hidden || !el.classList.contains('open')) return;
    el.classList.remove('open');
    $('.sheet-panel', el).style.transform = '';
    openSheets.splice(openSheets.indexOf(el), 1);
    const done = () => {
      el.hidden = true;
      if (!openSheets.length) document.documentElement.classList.remove('lock');
    };
    if (reduceMotion()) done(); else setTimeout(done, 420);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  // Свайп вниз закрывает шторку
  $$('.sheet').forEach((sheet) => {
    const panel = $('.sheet-panel', sheet);
    let y0 = null, dy = 0;
    panel.addEventListener('touchstart', (e) => {
      if (panel.scrollTop > 0) return;
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0 && panel.scrollTop <= 0) {
        panel.classList.add('dragging');
        panel.style.transform = `translateY(${dy}px)`;
      } else if (dy < 0) {
        y0 = null;
        panel.classList.remove('dragging');
        panel.style.transform = '';
      }
    }, { passive: true });
    panel.addEventListener('touchend', () => {
      if (y0 === null) return;
      panel.classList.remove('dragging');
      if (dy > 110) closeSheet(sheet); else panel.style.transform = '';
      y0 = null;
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openSheets.length) closeSheet(openSheets.at(-1));
    if (e.key === 'Tab' && openSheets.length) {
      // держим фокус внутри открытой шторки
      const panel = $('.sheet-panel', openSheets.at(-1));
      const f = $$('button, a[href], input, [tabindex="0"]', panel).filter((x) => !x.disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === panel)) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------- Карточка блюда ---------- */
  const sheetState = { id: null, vi: 0, qty: 1 };

  function renderDish() {
    const d = DISH[sheetState.id];
    const tags = d.t.map((t) => `<span class="pill is-${t}"><i class="${TAGS[t].icon}" aria-hidden="true"></i>${T(TAGS[t].n)}</span>`).join('');
    const variants = d.v ? `<fieldset class="d-variants">
        <legend>${L('Выберите', 'Choose')}</legend>
        ${d.v.map((v, i) => `<label class="opt">
          <input type="radio" name="variant" value="${i}" ${i === sheetState.vi ? 'checked' : ''}>
          <span class="opt-dot" aria-hidden="true"></span>
          <span class="opt-label">${T(v.l)}</span>
          <span class="opt-price">${money(v.p)}</span>
        </label>`).join('')}
      </fieldset>` : '';

    $('#dish-body').innerHTML = `
      <div class="d-photo"><img src="${big(d)}" alt="${esc(T(d.n))}" width="1000" height="800"></div>
      <div class="d-body">
        <h2 class="d-title" id="dish-title">${esc(T(d.n))}</h2>
        ${tags ? `<div class="d-tags">${tags}</div>` : ''}
        ${T(d.d) ? `<p class="d-desc">${esc(T(d.d))}</p>` : ''}
        ${d.w ? `<p class="d-meta">${L('Выход', 'Portion')}: ${weight(d.w)}</p>` : ''}
        ${variants}
        <div class="d-foot">
          <div class="stepper soft lg">
            <button type="button" data-sheet-qty="-1" aria-label="${L('Меньше', 'Fewer')}"><i class="ph ph-minus"></i></button>
            <output id="sheet-qty" aria-live="polite">${sheetState.qty}</output>
            <button type="button" data-sheet-qty="1" aria-label="${L('Больше', 'More')}"><i class="ph ph-plus"></i></button>
          </div>
          <button class="btn btn-primary" type="button" id="sheet-add"></button>
        </div>
      </div>`;
    updateDishFoot();
    $$('input[name="variant"]', $('#dish-body')).forEach((r) => r.addEventListener('change', () => {
      sheetState.vi = +r.value;
      updateDishFoot();
    }));
  }

  function updateDishFoot() {
    const d = DISH[sheetState.id];
    $('#sheet-qty').textContent = sheetState.qty;
    $('[data-sheet-qty="-1"]').disabled = sheetState.qty <= 1;
    $('#sheet-add').textContent = `${L('Добавить', 'Add')} · ${money(priceOf(d, sheetState.vi) * sheetState.qty)}`;
  }

  function openDish(id) {
    Object.assign(sheetState, { id, vi: 0, qty: 1 });
    renderDish();
    openSheet($('#dish-sheet'));
  }

  /* ---------- Мой выбор ---------- */
  function cartTotals() {
    let count = 0, sum = 0;
    for (const [k, qn] of Object.entries(state.cart)) {
      const [id, vi] = k.split('|');
      count += qn;
      sum += priceOf(DISH[id], +vi) * qn;
    }
    return { count, sum };
  }

  let lastCount = null;
  function refreshCartbar() {
    const { count, sum } = cartTotals();
    const bar = $('#cartbar');
    bar.hidden = count === 0;
    document.body.classList.toggle('has-cart', count > 0);
    $('#cartbar-count').textContent = count;
    $('#cartbar-sum').textContent = money(sum);
    bar.setAttribute('aria-label', `${L('Мой выбор', 'My picks')}: ${count} ${plural(count, L(['позиция', 'позиции', 'позиций'], ['item', 'items']))}, ${money(sum)}`);
    lastCount = count;
  }
  function bump() {
    const bar = $('#cartbar');
    bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump');
  }

  // Фото блюда «улетает» в плашку: видно, куда попало блюдо
  function fly(fromEl, d) {
    const target = $('#cartbar-count');
    if (!fromEl || reduceMotion() || $('#cartbar').hidden) { bump(); return; }
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const img = document.createElement('img');
    img.className = 'flyer';
    img.src = small(d);
    img.alt = '';
    const x0 = a.left + a.width / 2 - 28, y0 = a.top + a.height / 2 - 28;
    const x1 = b.left + b.width / 2 - 28, y1 = b.top + b.height / 2 - 28;
    img.style.left = '0px'; img.style.top = '0px';
    document.body.append(img);
    const anim = img.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 80}px) scale(.9)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(.35)`, opacity: .6 },
    ], { duration: 700, easing: 'cubic-bezier(.45, 0, .2, 1)' });
    anim.onfinish = () => { img.remove(); bump(); };
  }

  function renderCart() {
    const entries = Object.entries(state.cart);
    if (!entries.length) { closeSheet($('#cart-sheet')); return; }
    const { sum } = cartTotals();
    const service = Math.round(sum * SERVICE);
    const rows = entries.map(([k, qn]) => {
      const [id, vi] = k.split('|');
      const d = DISH[id];
      const p = priceOf(d, +vi);
      const name = esc(T(d.n));
      return `<li class="c-row">
        <img src="${small(d)}" alt="" width="56" height="56">
        <span><span class="c-name">${name}</span>${d.v ? `<span class="c-var">${T(d.v[+vi].l)}</span>` : ''}<span class="c-line">${qn > 1 ? `${qn} × ${money(p)} = ` : ''}${money(p * qn)}</span></span>
        ${stepper(k, qn, name, 'soft')}
      </li>`;
    }).join('');
    $('#cart-body').innerHTML = `
      <h2 class="c-title" id="cart-title">${L('Мой выбор', 'My picks')}</h2>
      <p class="c-sub">${L('Это ещё не заказ. Покажите список официанту, так быстрее и ничего не забудется.', 'This is not an order yet. Show the list to your waiter: quicker, and nothing gets forgotten.')}</p>
      <ul class="c-list">${rows}</ul>
      <div class="c-sum">
        <div><span>${L('Блюда', 'Dishes')}</span><span>${money(sum)}</span></div>
        <div><span>${L('Обслуживание 10%', 'Service 10%')}</span><span>${money(service)}</span></div>
        <div class="total"><span>${L('Итого', 'Total')}</span><span>${money(sum + service)}</span></div>
      </div>
      <div class="c-actions">
        <button class="btn btn-ghost" type="button" data-clear><i class="ph ph-trash" aria-hidden="true"></i>${L('Очистить', 'Clear')}</button>
        <button class="btn btn-primary" type="button" data-close>${L('Готово', 'Done')}</button>
      </div>`;
  }

  /* ---------- Тост ---------- */
  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------- Клики ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open],[data-inc],[data-dec],[data-filter],[data-reset],[data-close],[data-clear],[data-sheet-qty],#sheet-add,#cartbar,#reset,.chip');
    if (!t) return;

    if (t.classList.contains('chip')) { e.preventDefault(); goToCat(t.dataset.cat); return; }
    if (t.dataset.open) { openDish(t.dataset.open); return; }
    if (t.dataset.inc) {
      const key = t.dataset.inc;
      const first = !state.cart[key];
      const holder = t.closest('.dish, .fav');
      const src = holder && $('img', holder);
      change(key, 1);
      if (!t.closest('.sheet')) {
        fly(src, DISH[key.split('|')[0]]);
        if (first && lastCount === 1) toast(L('Добавлено в «Мой выбор»', 'Added to My picks'));
      }
      focusAfterRefresh(t, 'inc');
      return;
    }
    if (t.dataset.dec) { change(t.dataset.dec, -1); focusAfterRefresh(t, 'dec'); return; }
    if (t.dataset.filter) {
      const f = t.dataset.filter;
      if (state.filters.has(f)) state.filters.delete(f); else state.filters.add(f);
      renderFilters();
      $(`[data-filter="${f}"]`).focus();
      renderMenu();
      toMenuTop();
      return;
    }
    if (t.hasAttribute('data-reset') || t.id === 'reset') { resetAll(); return; }
    if (t.hasAttribute('data-close')) { closeSheet(t.closest('.sheet')); return; }
    if (t.hasAttribute('data-clear')) {
      const ids = Object.keys(state.cart).map((k) => k.split('|')[0]);
      state.cart = {};
      save();
      new Set(ids).forEach(refreshControls);
      refreshCartbar();
      closeSheet($('#cart-sheet'));
      return;
    }
    if (t.dataset.sheetQty) {
      sheetState.qty = Math.max(1, Math.min(99, sheetState.qty + +t.dataset.sheetQty));
      updateDishFoot();
      return;
    }
    if (t.id === 'sheet-add') {
      const d = DISH[sheetState.id];
      const key = `${sheetState.id}|${sheetState.vi}`;
      const photo = $('.d-photo img');
      const rect = photo.getBoundingClientRect();
      setQty(key, (state.cart[key] || 0) + sheetState.qty);
      closeSheet($('#dish-sheet'));
      // летим из центра фото в шторке
      const ghost = { getBoundingClientRect: () => rect };
      fly(ghost, d);
      if (lastCount === sheetState.qty) toast(L('Добавлено в «Мой выбор»', 'Added to My picks'));
      return;
    }
    if (t.id === 'cartbar') { renderCart(); openSheet($('#cart-sheet')); }
  });

  // После перерисовки кнопки фокус не должен теряться (клавиатура, скринридер)
  function focusAfterRefresh(btn, kind) {
    if (!btn.matches(':focus-visible')) return;
    const holder = btn.closest('[data-ctrl]') || btn.closest('.c-row');
    if (!holder) return;
    const next = $(`[data-${kind}]`, holder) || $('[data-inc]', holder) || $('button', holder);
    if (next) next.focus();
  }

  /* ---------- Открыто или закрыто ---------- */
  function status() {
    const el = $('#status');
    if (!el) return;
    const OPEN = 9 * 60, CLOSE = 23 * 60;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (type) => +parts.find((p) => p.type === type).value;
    const now = get('hour') * 60 + get('minute');
    let st, text;
    if (now >= OPEN && now < CLOSE - 60) { st = 'open'; text = L('Открыто до 23:00', 'Open until 11 pm'); }
    else if (now >= CLOSE - 60 && now < CLOSE) { st = 'soon'; text = L('Скоро закрываемся, до 23:00', 'Closing soon, at 11 pm'); }
    else { st = 'closed'; text = L('Сейчас закрыто, откроемся в 09:00', 'Closed now, opens at 9 am'); }
    el.dataset.state = st;
    el.textContent = text;
  }

  function renderCredits() {
    const el = $('#credits');
    if (!el) return;
    el.innerHTML = (window.PHOTO_CREDITS || []).map((c) => {
      const d = MENU.find((x) => x.img === c.img);
      return `${esc(T(d.n))}: <a href="${c.url}" target="_blank" rel="noopener">${esc(c.by)}</a>, ${c.lic}`;
    }).join('; ') + '.';
  }

  /* ---------- Старт ---------- */
  renderChips();
  renderFilters();
  renderFeatured();
  renderMenu();
  refreshCartbar();
  renderCredits();
  status();
  setInterval(status, 60_000);
  $$('.reveal').forEach((el) => { if (!el.classList.contains('in')) revealer.observe(el); });
})();
