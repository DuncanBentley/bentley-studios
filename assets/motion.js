/* motion.js (award-level-websites): scroll + reveal kit, vanilla, no dependencies. Load with defer, with motion.css.
 * Readable without JS; nothing hides under prefers-reduced-motion; data-motion-toggle pauses everything.
 *  data-reveal="fade|up|scale|blur|clip-up|clip-down|clip-left|clip-right|iris|letterbox" (clip = clip-down)
 *  [data-delay]   data-wipe="up|down|left|right|iris"   data-stagger   data-split="lines|words|chars"
 *  data-scrub (--p 0..1) [data-scrub-range="55% 45%"]   data-parallax="0.15"   data-progress
 *  data-pin data-span="2" [data-pin-min="700x600"] + children data-cue="0.1 0.45"   data-pan (.pan__track)
 *  data-drift[="#hex"] [data-drift-ink]   data-fit (one line fills its box)   data-count-to="1200"
 *  [data-prefix data-suffix data-decimals]   data-marquee [data-speed]   data-magnetic="0.25" | data-tilt="6" |
 *  data-spotlight (one per element)   data-header   data-motion-toggle
 *  Motion.refresh(el), Motion.pause(), Motion.play(). Full guide: references/sections.md (motion kit). */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const native = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp01 = v => Math.min(1, Math.max(0, v));
  let paused = false;
  try { paused = localStorage.getItem('awl-motion') === 'off'; } catch (e) { /* storage blocked: default on */ }
  const still = () => reduce.matches || paused;

  const acts = [];              // scroll-linked elements that publish --p: { el, kind: view | contain | page, inset }
  const pinCounters = [];
  const marquees = [];
  const fits = [];
  let drifts = [], header = null, io = null, ro = null, lastY = scrollY, lastW = innerWidth, queued = false;

  /* reveals */
  function show(el) {
    el.classList.add('is-in');
    if (el.hasAttribute('data-count-to') && !el.closest('[data-pin]')) countOnce(el);
  }

  function reveals(scope) {
    $$('[data-stagger]', scope).forEach(p => Array.from(p.children).forEach((c, i) => {
      c.style.setProperty('--i', i);
      if (!c.matches('[data-reveal],[data-wipe]')) c.setAttribute('data-reveal', p.dataset.stagger || 'up');
    }));
    const els = $$('[data-reveal],[data-wipe],[data-split],[data-count-to]', scope).filter(el => !el.classList.contains('is-in'));
    els.forEach(el => { if (el.dataset.delay) el.style.setProperty('--delay', el.dataset.delay + 'ms'); });
    if (still() || !('IntersectionObserver' in window)) { els.forEach(show); return; }
    io = io || new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    els.forEach(el => io.observe(el));
  }

  /* counters: the real value stays in the DOM (sr-only); an aria-hidden copy animates */
  function counter(el) {
    if (el._num) return el._num;
    const to = parseFloat(el.dataset.countTo);
    const dec = +(el.dataset.decimals || 0);
    const fmt = new Intl.NumberFormat(root.lang || undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const real = el.textContent.trim();
    el.style.minWidth = el.getBoundingClientRect().width + 'px';
    const sr = Object.assign(document.createElement('span'), { className: 'sr-only', textContent: real });
    const vis = Object.assign(document.createElement('span'), { textContent: real });
    vis.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    el.append(sr, vis);
    el._num = { to, real, vis, text: v => (el.dataset.prefix || '') + fmt.format(v) + (el.dataset.suffix || '') };
    return el._num;
  }

  function countOnce(el) {
    if (el._done || still() || isNaN(parseFloat(el.dataset.countTo))) return;
    el._done = true;
    const n = counter(el), t0 = performance.now();
    const tick = now => {
      const k = clamp01((now - t0) / 1400);
      if (k < 1) { n.vis.textContent = n.text(n.to * (1 - Math.pow(1 - k, 3))); requestAnimationFrame(tick); return; }
      el.textContent = n.real;          // done: back to the original single text node
      el.style.minWidth = '';
      el._num = null;
    };
    requestAnimationFrame(tick);
  }

  /* split headings: sr-only full text + aria-hidden pieces; CSS staggers with --i */
  function split(el) {
    if (el.querySelector('a, button, input, select, textarea')) return;
    if (el._src == null) el._src = el.innerHTML; else el.innerHTML = el._src;
    const mode = el.dataset.split || 'lines';
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    const chars = mode === 'chars' && text.split(' ').length <= 2;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    vis.append(...el.childNodes);
    let i = 0;
    const wrap = node => Array.from(node.childNodes).forEach(n => {
      if (n.nodeType === 1) { wrap(n); return; }
      if (n.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (!part.trim()) { frag.append(part); return; }
        const w = Object.assign(document.createElement('span'), { className: 'sw' });
        (chars ? Array.from(part) : [part]).forEach(t => {
          const s = Object.assign(document.createElement('span'), { className: 'si', textContent: t });
          s.style.setProperty('--i', i++);
          w.append(s);
        });
        frag.append(w);
      });
      n.replaceWith(frag);
    });
    wrap(vis);
    el.append(Object.assign(document.createElement('span'), { className: 'sr-only', textContent: text }), vis);
    if (mode === 'lines') {           // words on the same visual line share one index
      let top = null, line = -1;
      $$('.si', vis).forEach(s => { if (s.offsetTop !== top) { top = s.offsetTop; line++; } s.style.setProperty('--i', line); });
    }
  }

  /* fit: one line set to fill its box, like wood type. Measured with the real face (after fonts load), so the
     size changes at most once; CSS reserves an estimate from --fit (font-size as % of the line) until then. */
  function fit(el) {
    const cs = getComputedStyle(el);
    try { if (document.fonts && !document.fonts.check('1em ' + cs.fontFamily)) return; } catch (e) { /* measure anyway */ }
    el.style.whiteSpace = 'nowrap';   // measure the line unbroken
    const size = parseFloat(cs.fontSize), r = document.createRange();
    r.selectNodeContents(el);
    const line = r.getBoundingClientRect().width;
    const box = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    el.style.whiteSpace = '';
    el._fw = el.clientWidth;
    if (!line || !box) return;
    const pct = size / line * 99.6;   // a hair under 100% so sub-pixel rounding never wraps
    el.style.setProperty('--fit', pct.toFixed(3));
    el.style.setProperty('--fit-px', (box * pct / 100).toFixed(2) + 'px');
    const floor = parseFloat(getComputedStyle(el).fontSize) > box * pct / 100 + 0.5;   // cannot fit above --fit-min
    el.classList.toggle('fit-wrap', floor);
    el.classList.toggle('is-fit', !floor);
  }

  /* marquee: one group + aria-hidden clones; CSS moves the track by exactly one group */
  function marquee(el) {
    if (el._fill) return;
    const track = Object.assign(document.createElement('div'), { className: 'marquee__track' });
    const group = Object.assign(document.createElement('div'), { className: 'marquee__group' });
    group.append(...el.childNodes);
    track.append(group);
    el.append(track);
    el.classList.add('is-ready');
    el._fill = () => {
      $$('.marquee__group[aria-hidden]', track).forEach(g => g.remove());
      const w = group.getBoundingClientRect().width;
      if (!w) return;
      for (let k = Math.ceil(el.clientWidth / w); k > 0; k--) {
        const c = group.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.inert = true;
        track.append(c);
      }
      track.style.setProperty('--marquee-shift', w + 'px');
      track.style.setProperty('--marquee-dur', (w / (parseFloat(el.dataset.speed) || 50)).toFixed(2) + 's');
    };
    el._fill();
    marquees.push(el);
  }

  /* scroll acts publish --p */
  function addAct(el, kind) { if (!acts.some(a => a.el === el)) acts.push({ el, kind }); }

  function panSize(el) {
    const stage = el.firstElementChild, track = el.querySelector('.pan__track');
    if (!stage || !track) return;
    const travel = Math.max(0, track.scrollWidth - stage.clientWidth);
    el.style.setProperty('--pan-travel', travel + 'px');
    el.classList.toggle('is-ready', travel > 0 && !reduce.matches);
  }

  // pins need room: below data-pin-min (default 700x600 CSS px) the stage stacks, unpinned, with every cue visible
  function pinRoom(pin) {
    const [w, h] = (pin.dataset.pinMin || '700x600').split(/[x×\s,]+/).map(parseFloat);
    const on = innerWidth >= (w || 0) && innerHeight >= (h || 0);
    pin.classList.toggle('pin-on', on);
    pin.classList.toggle('pin-off', !on);
  }

  // cue windows: a start <= 0 is fully shown at p = 0; the last cue of each stack (and any ending at 1) holds;
  // two TEXT cues in one stack never overlap: they hand over at the midpoint (one fades out, then the next fades in)
  function cues(pin) {
    const stacks = new Map();
    $$('[data-cue]', pin).forEach(c => {
      const [a, b] = (c.dataset.cue || '0 1').split(/[\s,]+/).map(parseFloat);
      c._cue = { a: isNaN(a) ? 0 : a, b: isNaN(b) ? 1 : b };   // as written: counters scrub over this window
      if (!stacks.has(c.parentElement)) stacks.set(c.parentElement, []);
      stacks.get(c.parentElement).push({ c, a: c._cue.a, b: c._cue.b, text: !!c.textContent.trim() });
    });
    stacks.forEach(list => {
      list.sort((x, y) => x.a - y.a);
      for (let k = 1; k < list.length; k++) {
        const prev = list[k - 1], cur = list[k];
        if (prev.text && cur.text && prev.b > cur.a) {
          const m = Math.min(cur.b - 0.02, Math.max(prev.a + 0.02, (prev.b + cur.a) / 2));
          prev.b = m;
          cur.a = m;
        }
      }
      list.forEach((w, k) => {
        w.c.style.setProperty('--a', w.a <= 0 ? -1 : w.a);
        w.c.style.setProperty('--b', w.b >= 1 || k === list.length - 1 ? 2 : w.b);
      });
    });
  }

  const insetOf = v => String(v || '').trim().split(/\s+/).slice(0, 2).map(x =>
    x.endsWith('px') ? parseFloat(x) / innerHeight : (parseFloat(x) || 0) / 100);

  function scrollActs(scope) {
    $$('[data-parallax]', scope).forEach(el => { el.style.setProperty('--parallax', parseFloat(el.dataset.parallax) || 0.15); addAct(el, 'view'); });
    $$('[data-scrub]', scope).forEach(el => {
      if (el.dataset.scrubRange) el.style.setProperty('--scrub-inset', el.dataset.scrubRange);   // native: view(inset)
      addAct(el, 'view');
    });
    $$('[data-pin]', scope).forEach(pin => {
      pin.style.setProperty('--span', parseFloat(pin.dataset.span) || 2);
      pinRoom(pin);
      cues(pin);
      $$('[data-count-to]', pin).forEach(el => { if (!still()) { counter(el); pinCounters.push({ el, pin }); } });
      addAct(pin, 'contain');
    });
    $$('[data-pan]', scope).forEach(el => { panSize(el); addAct(el, 'contain'); });
    $$('[data-progress]', scope).forEach(el => addAct(el, 'page'));
    $$('[data-fit]', scope).forEach(el => {
      if (!fits.includes(el)) { fits.push(el); if (ro) ro.observe(el); }
      fit(el);
    });
    readDrift();
  }

  function progressOf(a, vh) {
    if (a.kind === 'page') { const max = root.scrollHeight - vh; return max > 0 ? clamp01(scrollY / max) : 0; }
    const r = a.el.getBoundingClientRect();
    if (a.kind === 'contain') return clamp01(-r.top / Math.max(1, r.height - vh));
    const [s = 0, e = s] = a.el.dataset.scrubRange ? insetOf(a.el.dataset.scrubRange) : [];
    const top = vh * s, bottom = vh * (1 - e);     // the inset viewport; "55% 45%" is a line 55% down the screen
    return clamp01((bottom - r.top) / Math.max(1, bottom - top + r.height));
  }

  /* colour drift: the page ground blends between section grounds in OKLCH (shortest hue path), so complementary
     grounds never pass through grey. Each section keeps its own ground (CSS background or data-drift="#hex")
     without JS, under reduced motion and when paused; only while drifting do sections turn transparent. */
  let cx = null;
  function rgbOf(value) {
    const m = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
    try {                                     // any other CSS colour: let the browser resolve it on a 1px canvas
      cx = cx || Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#010203';
      cx.fillStyle = value;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return d[3] > 200 && !(d[0] === 1 && d[1] === 2 && d[2] === 3) ? [d[0], d[1], d[2]] : null;
    } catch (e) { return null; }
  }
  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  function oklch(c) {
    const [r, g, b] = c.map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function fromOklch(L, C, h) {
    const gam = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
    for (L = clamp01(L); ; C *= 0.92) {     // out of sRGB: lower chroma, keep lightness and hue
      const A = C * Math.cos(h), B = C * Math.sin(h);
      const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
      const s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
      const c = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
      if (C < 1e-4 || c.every(v => v > -1e-4 && v < 1.0001)) return c.map(v => Math.round(Math.min(255, Math.max(0, gam(v)))));
    }
  }
  function blend(x, y, t) {
    const a = oklch(x), b = oklch(y);
    if (a[1] < 0.02) a[2] = b[2];             // a grey end borrows the other hue instead of swinging through red
    if (b[1] < 0.02) b[2] = a[2];
    let dh = b[2] - a[2];
    if (dh > Math.PI) dh -= 2 * Math.PI; else if (dh < -Math.PI) dh += 2 * Math.PI;
    // light <-> dark: cross the mid-tones fast, where neither ink would reach 4.5:1
    const tl = Math.abs(b[0] - a[0]) > 0.3 ? 0.5 + 0.5 * Math.tanh(8 * (t - 0.5)) / Math.tanh(4) : t;
    return fromOklch(a[0] + (b[0] - a[0]) * tl, a[1] + (b[1] - a[1]) * t, a[2] + dh * t);
  }
  const token = name => getComputedStyle(root).getPropertyValue(name).trim();
  function readDrift() {
    const on = ['drift-on', 'has-drift'].filter(c => root.classList.contains(c));
    root.classList.remove('drift-on', 'has-drift');           // read each section's own ground and ink
    const ink = rgbOf(token('--c-ink')) || [17, 17, 17], paper = rgbOf(token('--c-bg')) || [250, 250, 248];
    drifts = $$('[data-drift]').map(sec => {
      const cs = getComputedStyle(sec);
      const bg = rgbOf(sec.dataset.drift) || rgbOf(cs.backgroundColor);
      if (!bg) return null;
      const own = rgbOf(sec.dataset.driftInk) || rgbOf(cs.color);
      const fg = own && ratio(own, bg) >= 4.5 ? own : ratio(ink, bg) >= ratio(paper, bg) ? ink : paper;
      if (sec.dataset.drift) {               // a ground given as data-drift="#hex" becomes the section's own ground
        sec.style.setProperty('--drift-ground', css(bg));
        sec.style.setProperty('--drift-ground-ink', css(fg));
      }
      return { sec, bg, ink: fg };
    }).filter(Boolean);
    root.classList.add(...on);
  }
  const css = c => 'rgb(' + c.join(' ') + ')';
  function drift(vh) {
    if (!drifts.length) return;
    if (still()) { root.classList.remove('drift-on', 'has-drift'); return; }
    root.classList.add('drift-on');
    let cur = null, prev = null, t = 1;
    drifts.forEach(d => {
      const top = d.sec.getBoundingClientRect().top;
      if (top < vh * 0.6) { prev = cur; cur = d; t = clamp01((vh * 0.6 - top) / (vh * 0.4)); }
    });
    if (!cur) { root.classList.remove('has-drift'); return; }
    const from = prev ? prev.bg : rgbOf(token('--c-bg')) || cur.bg;
    const ground = blend(from, cur.bg, t);
    const inks = prev ? [prev.ink, cur.ink] : [cur.ink];
    root.style.setProperty('--drift-bg', css(ground));
    root.style.setProperty('--drift-ink', css(inks.reduce((x, y) => ratio(y, ground) > ratio(x, ground) ? y : x)));
    root.classList.add('has-drift');
  }

  /* one rAF per scroll: read everything, then write */
  function frame() {
    queued = false;
    const vh = innerHeight, y = scrollY;
    if (!still()) {
      const ps = native ? null : acts.map(a => progressOf(a, vh));
      if (ps) acts.forEach((a, k) => a.el.style.setProperty('--p', ps[k].toFixed(4)));
      pinCounters.forEach(({ el, pin }) => {
        const p = ps ? ps[acts.findIndex(a => a.el === pin)] : parseFloat(getComputedStyle(pin).getPropertyValue('--p')) || 0;
        const cue = el.closest('[data-cue]'), w = (cue && cue._cue) || { a: 0, b: 1 };
        const n = counter(el), b = Math.min(1, w.b), q = pin.classList.contains('pin-off') ? 1 : clamp01((p - w.a) / Math.max(0.01, b - w.a));
        n.vis.textContent = q >= 1 ? n.real : n.text(n.to * q);
      });
    }
    drift(vh);
    if (header) {
      header.classList.toggle('is-scrolled', y > 8);
      if (y < 160 || y < lastY - 2 || header.contains(document.activeElement)) header.classList.remove('is-hidden');
      else if (y > lastY + 2) header.classList.add('is-hidden');
    }
    lastY = y;
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };

  /* pointer effects (fine pointers, motion allowed, one per element) */
  function pointerFx(scope) {
    if (!fine.matches || reduce.matches) return;
    const solo = el => !el._fx && !el.matches('[data-parallax], [data-cue]') && (el._fx = true);
    $$('[data-magnetic]', scope).filter(solo).forEach(el => {
      const k = Math.min(0.35, parseFloat(el.dataset.magnetic) || 0.25);
      el.addEventListener('pointermove', e => {
        if (paused) return;
        const r = el.getBoundingClientRect();
        el.style.translate = ((e.clientX - r.left - r.width / 2) * k).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * k).toFixed(1) + 'px';
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
    $$('[data-tilt]', scope).filter(solo).forEach(el => {
      const max = Math.min(9, parseFloat(el.dataset.tilt) || 6);
      el.addEventListener('pointermove', e => {
        if (paused) return;
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateX(' + (-y * max).toFixed(2) + 'deg) rotateY(' + (x * max).toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    $$('[data-spotlight]', scope).filter(solo).forEach(el => el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    }));
  }

  /* global pause (WCAG 2.2.2) */
  function setPaused(v) {
    paused = v;
    root.classList.toggle('motion-paused', v);
    try { localStorage.setItem('awl-motion', v ? 'off' : 'on'); } catch (e) { /* ignore */ }
    $$('[data-motion-toggle]').forEach(b => b.setAttribute('aria-pressed', String(v)));
    if (v) $$('[data-reveal],[data-wipe],[data-split]').forEach(show);
    queue();
  }

  function init(scope) {
    scope = scope || document;
    root.classList.add('motion-ready');
    root.classList.toggle('motion-paused', paused);
    header = document.querySelector('[data-header]');
    if (!ro && 'ResizeObserver' in window) {
      ro = new ResizeObserver(entries => entries.forEach(e => { if (e.target.clientWidth !== e.target._fw) fit(e.target); }));
    }
    if (!reduce.matches) {
      $$('[data-split]', scope).forEach(split);
      $$('[data-marquee]', scope).forEach(marquee);
    }
    reveals(scope);
    scrollActs(scope);
    pointerFx(scope);
    $$('[data-motion-toggle]', scope).forEach(b => {
      if (b._t) return;
      b._t = true;
      b.setAttribute('aria-pressed', String(paused));
      b.addEventListener('click', () => setPaused(!paused));
    });
    queue();
  }

  function relayout() {
    if (!reduce.matches) $$('[data-split]').filter(el => el._src != null && (el.dataset.split || 'lines') === 'lines').forEach(split);
    fits.forEach(fit);
    marquees.forEach(el => el._fill());
    $$('[data-pan]').forEach(panSize);
    $$('[data-pin]').forEach(pinRoom);
    queue();
  }

  addEventListener('scroll', queue, { passive: true });
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; relayout(); } else queue(); }, 150);
  }, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(relayout);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => fits.forEach(fit));
  }
  if (reduce.addEventListener) reduce.addEventListener('change', () => { if (reduce.matches) $$('[data-reveal],[data-wipe],[data-split]').forEach(show); queue(); });

  // in-page anchors: scroll (smoothly only if motion is allowed) and move focus to the target
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    if (!t.hasAttribute('tabindex') && !t.matches('a, button, input, select, textarea')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
    if (history.pushState) history.pushState(null, '', '#' + id);
  });

  window.Motion = { refresh: init, pause: () => setPaused(true), play: () => setPaused(false) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
})();
