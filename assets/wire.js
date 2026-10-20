/* wire.js: Bentley Studios signature move.
   A bare steel line twists into barbed wire as the #wire section scrolls; each barb that knots
   unlocks one discipline in the list. Also draws the barbed frame round the hero portrait.
   Without JS or with reduced motion, the wire is drawn complete and every discipline shows. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  // one barb: a tight coil of wraps plus four spikes, centred on (x, y)
  function barb(x, y, s) {
    const g = el('g', { class: 'barb', transform: `translate(${x} ${y})` });
    const inner = el('g', { class: 'barb__in' });
    [[-28, -34], [26, -36], [-24, 36], [30, 32]].forEach(([dx, dy]) => {
      inner.appendChild(el('path', { d: `M0 0 L${dx * s} ${dy * s}`, stroke: 'url(#chrome-h)', 'stroke-width': 5, 'stroke-linecap': 'round' }));
    });
    for (let i = -2; i <= 2; i++) {
      inner.appendChild(el('ellipse', { cx: i * 5.5, cy: 0, rx: 4, ry: 15, fill: 'none', stroke: 'url(#chrome)', 'stroke-width': 3.2 }));
    }
    g.appendChild(inner);
    return g;
  }

  function strand(x0, x1, y, amp, wave, phase) {
    let d = '';
    for (let x = x0; x <= x1; x += 4) {
      const yy = y + amp * Math.sin((x / wave) * Math.PI + phase);
      d += (x === x0 ? 'M' : 'L') + x.toFixed(1) + ' ' + yy.toFixed(1) + ' ';
    }
    return d;
  }

  // ---- signature: the wire ----
  const svg = document.querySelector('[data-wire]');
  const section = document.getElementById('wire');
  if (svg && section) {
    const W = 1200, Y = 130;
    const paths = [0, Math.PI].map((ph, i) => {
      const p = el('path', { d: strand(20, W - 20, Y, 10, 26, ph), fill: 'none', stroke: i ? 'url(#chrome-h)' : 'url(#chrome)', 'stroke-width': 6, 'stroke-linecap': 'round' });
      svg.appendChild(p);
      return p;
    });
    const xs = [130, 318, 506, 694, 882, 1070];
    const barbs = xs.map(x => { const b = barb(x, Y, 1); svg.appendChild(b); return b; });
    const items = Array.from(section.querySelectorAll('.wire__list li'));
    const lens = paths.map(p => p.getTotalLength());
    paths.forEach((p, i) => { p.style.strokeDasharray = lens[i]; });

    let ticking = false;
    function render() {
      ticking = false;
      let p = 1;
      if (!still.matches) {
        const r = section.getBoundingClientRect();
        const run = r.height - innerHeight;
        p = run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 1;
      }
      section.style.setProperty('--p', p.toFixed(3));
      const drawn = 20 + p * 1.08 * (W - 40);           // x position the strand has reached
      paths.forEach((path, i) => { path.style.strokeDashoffset = lens[i] * (1 - Math.min(1, p * 1.08)); });
      barbs.forEach((b, i) => {
        const k = Math.min(1, Math.max(0, (drawn - xs[i]) / 90));
        b.style.setProperty('--k', k.toFixed(3));
        if (items[i]) items[i].classList.toggle('is-on', k > 0.6);
      });
    }
    const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    section.classList.add('is-live');
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    still.addEventListener && still.addEventListener('change', ask);
    render();
  }

  // ---- hero frame: wavy chrome border with barbs at the corners ----
  const frame = document.querySelector('[data-wire-frame]');
  if (frame) {
    const W = 400, H = 600, m = 10;
    let d = '';
    const pts = [];
    const side = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } };
    side(m, m, W - m, m, 40); side(W - m, m, W - m, H - m, 60); side(W - m, H - m, m, H - m, 40); side(m, H - m, m, m, 60);
    pts.forEach(([x, y], i) => {
      const w = 4 * Math.sin(i * 0.9);
      const nx = x === m ? -w : x === W - m ? w : 0, ny = y === m ? -w : y === H - m ? w : 0;
      d += (i ? 'L' : 'M') + (x + nx).toFixed(1) + ' ' + (y + ny).toFixed(1) + ' ';
    });
    frame.appendChild(el('path', { d: d + 'Z', fill: 'none', stroke: 'url(#chrome-h)', 'stroke-width': 5, 'vector-effect': 'non-scaling-stroke' }));
    [[m, m], [W - m, m], [W - m, H - m], [m, H - m], [W / 2, m], [W / 2, H - m]].forEach(([x, y]) => frame.appendChild(barb(x, y, 0.55)));
  }
})();
