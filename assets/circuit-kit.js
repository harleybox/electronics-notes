/* ============================================================================
 * circuit-kit.js — a tiny reusable circuit-drawing engine.
 *
 * Why: stop hand-placing SVG coordinates per figure (the source of gaps /
 * misalignment bugs). Components have FIXED geometry and named PINS; wires
 * connect pin→pin exactly, so connections can't drift or leave gaps.
 *
 * A figure just declares: place components, connect pins. The panel / notes /
 * formulas / interactivity stay in the page (they were never the buggy part).
 * ========================================================================== */
(function (global) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    wire: '#2e3a50', green: '#22d36a', amber: '#f5a623', danger: '#e05050',
    gray: '#8899aa', faint: '#4a5a6a', body: '#1e2535', blue: '#4a7aaa',
  };
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function txt(x, y, s, fill, size) {
    const t = el('text', { x, y, class: 'lbl', fill: fill || C.gray, 'font-size': size || 11 });
    t.textContent = s;
    return t;
  }

  class Circuit {
    constructor(svg) {
      this.svg = svg;
      this.wireLayer = el('g', {}); svg.appendChild(this.wireLayer);
      this.partLayer = el('g', {}); svg.appendChild(this.partLayer);
      this.dotLayer  = el('g', {}); svg.appendChild(this.dotLayer);
      this.particleLayer = el('g', {}); svg.appendChild(this.particleLayer);
      this.wires = [];   // {el, a:[x,y], b:[x,y]}
    }
    _add(node) { this.partLayer.appendChild(node); return node; }

    /* Frame the content with a small EVEN margin, displayed at `scale` size.
       margin = gap from content to edge (small, even on all sides);
       scale  = how big to render the whole thing (bigger canvas). */
    fit(margin = 12, scale = 1.25) {
      const b = this.svg.getBBox();
      const m = margin, w = b.width + 2 * m, h = b.height + 2 * m;
      this.svg.setAttribute('viewBox', `${(b.x - m).toFixed(1)} ${(b.y - m).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
      this.svg.setAttribute('width', (w * scale).toFixed(0));
      this.svg.setAttribute('height', (h * scale).toFixed(0));
    }

    /* ---- wire: orthogonal connection between two pins (no gaps) ---- */
    wire(a, b, opts = {}) {
      const pts = [];
      if (a[0] === b[0] || a[1] === b[1]) {
        pts.push(a, b);                          // straight
      } else {
        pts.push(a, [b[0], a[1]], b);            // L-shape (horizontal then vertical)
        if (opts.vfirst) pts.splice(1, 1, [a[0], b[1]]);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const w = el('line', { x1: pts[i][0], y1: pts[i][1], x2: pts[i+1][0], y2: pts[i+1][1],
          stroke: C.wire, 'stroke-width': 2 });
        this.wireLayer.appendChild(w);
        this.wires.push({ el: w, a: pts[i], b: pts[i+1] });
      }
      return pts;
    }
    node(p) { this.dotLayer.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3.5, fill: C.faint })); }

    /* ---- components (fixed geometry, named pins) ---- */
    // Battery / DC source, vertical. pins: pos (top), neg (bottom).
    source(x, y, o = {}) {
      const g = this._add(el('g', {}));
      if (o.dir === 'h') { // horizontal: − on left, + on right
        const lL = el('line', { x1: x - 28, y1: y, x2: x - 7, y2: y, stroke: C.wire, 'stroke-width': 2 });
        const lR = el('line', { x1: x + 7, y1: y, x2: x + 28, y2: y, stroke: C.wire, 'stroke-width': 2 });
        g.appendChild(lL);
        g.appendChild(el('line', { x1: x - 7, y1: y - 8, x2: x - 7, y2: y + 8, stroke: C.gray, 'stroke-width': 2.5 }));
        g.appendChild(el('line', { x1: x + 7, y1: y - 15, x2: x + 7, y2: y + 15, stroke: C.amber, 'stroke-width': 2.5 }));
        g.appendChild(lR);
        this.wires.push({ el: lL, a: [x - 28, y], b: [x - 7, y] }, { el: lR, a: [x + 7, y], b: [x + 28, y] });
        g.appendChild(txt(x - 13, y - 12, '−', C.gray, 13));
        g.appendChild(txt(x + 9, y - 12, '+', C.amber, 13));
        let lbl = null;
        if (o.label) { lbl = txt(x - 12, y + 26, o.label, C.amber, 12); g.appendChild(lbl); }
        return { neg: [x - 28, y], pos: [x + 28, y], labelEl: lbl };
      }
      const lTop = el('line', { x1: x, y1: y - 28, x2: x, y2: y - 7,  stroke: C.wire, 'stroke-width': 2 });
      const lBot = el('line', { x1: x, y1: y + 7, x2: x, y2: y + 28, stroke: C.wire, 'stroke-width': 2 });
      g.appendChild(lTop);
      g.appendChild(el('line', { x1: x - 15, y1: y - 7, x2: x + 15, y2: y - 7, stroke: C.amber, 'stroke-width': 2.5 }));
      g.appendChild(el('line', { x1: x - 8,  y1: y + 7, x2: x + 8,  y2: y + 7, stroke: C.gray,  'stroke-width': 2.5 }));
      g.appendChild(lBot);
      // register the source leads so they light with the loop
      this.wires.push({ el: lTop, a: [x, y - 28], b: [x, y - 7] }, { el: lBot, a: [x, y + 7], b: [x, y + 28] });
      g.appendChild(txt(x + 19, y - 4, '+', C.amber, 13));
      g.appendChild(txt(x + 19, y + 15, '−', C.gray, 13));
      let labelEl = null;
      if (o.label) { labelEl = txt(x - 40, y + 5, o.label, C.amber, 12); g.appendChild(labelEl); }
      return { pos: [x, y - 28], neg: [x, y + 28], labelEl };
    }
    // Resistor box. dir 'v' (default) → pins a(top) b(bottom); 'h' → a(left) b(right).
    resistor(x, y, o = {}) {
      const g = this._add(el('g', {}));
      const h = o.dir === 'h';
      g.appendChild(el('rect', h
        ? { x: x - 30, y: y - 10, width: 60, height: 20, rx: 3, fill: C.body, stroke: C.faint, 'stroke-width': 1.5 }
        : { x: x - 10, y: y - 30, width: 20, height: 60, rx: 3, fill: C.body, stroke: C.faint, 'stroke-width': 1.5 }));
      let v = null;
      if (h) {
        if (o.label) g.appendChild(txt(x - 6, y - 16, o.label, C.gray, 12));
        if (o.value) { v = txt(x - 16, y + 26, o.value, C.green, 10); g.appendChild(v); }
      } else {
        if (o.label) g.appendChild(txt(x + 18, y - 6, o.label, C.gray, 12));
        if (o.value) { v = txt(x + 18, y + 9, o.value, C.green, 10); g.appendChild(v); }
      }
      return h ? { a: [x - 30, y], b: [x + 30, y], _valEl: v } : { a: [x, y - 30], b: [x, y + 30], _valEl: v };
    }
    // LED, vertical, current flows top→bottom (anode top). pins anode, cathode.
    led(x, y, o = {}) {
      const g = this._add(el('g', {}));
      const h = o.dir === 'h';
      const glow = el('circle', { cx: x, cy: y, r: 28, fill: 'url(#kitGlow)', opacity: 0 }); // base r = max lit size so fit() reserves room
      g.appendChild(glow);
      let tri, bar;
      const rays = el('g', { opacity: 0, stroke: C.green, 'stroke-width': 1.5, 'stroke-linecap': 'round' });
      if (h) { // triangle points right: anode left, cathode (bar) right
        tri = el('polygon', { points: `${x-12},${y-14} ${x-12},${y+14} ${x+12},${y}`, fill: '#1a6b3a', stroke: C.green, 'stroke-width': 1.5 });
        bar = el('line', { x1: x + 12, y1: y - 14, x2: x + 12, y2: y + 14, stroke: C.green, 'stroke-width': 2.5 });
        rays.appendChild(el('line', { x1: x + 2, y1: y - 16, x2: x + 12, y2: y - 28 }));
        rays.appendChild(el('line', { x1: x + 10, y1: y - 12, x2: x + 20, y2: y - 24 }));
        g.appendChild(tri); g.appendChild(bar); g.appendChild(rays);
        if (o.label) g.appendChild(txt(x - 6, y + 30, o.label, C.gray, 12));
      } else { // triangle points down: anode top, cathode (bar) bottom
        tri = el('polygon', { points: `${x-14},${y-12} ${x+14},${y-12} ${x},${y+12}`, fill: '#1a6b3a', stroke: C.green, 'stroke-width': 1.5 });
        bar = el('line', { x1: x - 14, y1: y + 12, x2: x + 14, y2: y + 12, stroke: C.green, 'stroke-width': 2.5 });
        rays.appendChild(el('line', { x1: x + 18, y1: y - 10, x2: x + 30, y2: y - 20 }));
        rays.appendChild(el('line', { x1: x + 24, y1: y - 2, x2: x + 38, y2: y - 10 }));
        g.appendChild(tri); g.appendChild(bar); g.appendChild(rays);
        if (o.label) g.appendChild(txt(x + 22, y + 5, o.label, C.gray, 12));
      }
      // burnt "✕" mark (hidden until burnt)
      const burnX = el('g', { opacity: 0, stroke: C.danger, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
      burnX.appendChild(el('line', { x1: x - 11, y1: y - 11, x2: x + 11, y2: y + 11 }));
      burnX.appendChild(el('line', { x1: x + 11, y1: y - 11, x2: x - 11, y2: y + 11 }));
      g.appendChild(burnX);
      return {
        anode: h ? [x - 12, y] : [x, y - 12], cathode: h ? [x + 12, y] : [x, y + 12],
        set(state) { // 'green'|'amber'|'off'|'burnt', brightness 0..1
          const col = state.color === 'amber' ? C.amber : C.green;
          if (state.color === 'off' || state.color === 'burnt') {
            tri.setAttribute('fill', '#33373f'); tri.setAttribute('stroke', '#5a6b7d');
            bar.setAttribute('stroke', '#5a6b7d'); glow.setAttribute('opacity', 0); rays.setAttribute('opacity', 0);
          } else {
            tri.setAttribute('fill', state.color === 'amber' ? '#7a5410' : '#1a6b3a');
            tri.setAttribute('stroke', col); bar.setAttribute('stroke', col);
            glow.setAttribute('fill', state.color === 'amber' ? 'url(#kitGlowWarn)' : 'url(#kitGlow)');
            glow.setAttribute('opacity', (state.b == null ? 0.7 : state.b * 0.9).toFixed(2));
            glow.setAttribute('r', 14 + (state.b == null ? 0.5 : state.b) * 14);
            rays.setAttribute('stroke', col); rays.setAttribute('opacity', state.b == null ? 1 : state.b.toFixed(2));
          }
          burnX.setAttribute('opacity', state.color === 'burnt' ? 1 : 0);
        }
      };
    }
    // Ground symbol. pin top.
    ground(x, y) {
      const g = this._add(el('g', {}));
      g.appendChild(el('line', { x1: x, y1: y, x2: x, y2: y + 10, stroke: C.wire, 'stroke-width': 2 }));
      g.appendChild(el('line', { x1: x - 14, y1: y + 10, x2: x + 14, y2: y + 10, stroke: C.faint, 'stroke-width': 2 }));
      g.appendChild(el('line', { x1: x - 9,  y1: y + 17, x2: x + 9,  y2: y + 17, stroke: C.faint, 'stroke-width': 1.5 }));
      g.appendChild(el('line', { x1: x - 4,  y1: y + 24, x2: x + 4,  y2: y + 24, stroke: C.faint, 'stroke-width': 1 }));
      g.appendChild(txt(x - 16, y + 40, 'GND', C.faint, 11));
      return { top: [x, y] };
    }

    // Horizontal switch. pins a (left), b (right). setClosed(bool).
    switchH(x, y, o = {}) {
      const g = this._add(el('g', {}));
      const lead1 = el('line', { x1: x - 30, y1: y, x2: x - 12, y2: y, stroke: C.wire, 'stroke-width': 2 });
      const lead2 = el('line', { x1: x + 12, y1: y, x2: x + 30, y2: y, stroke: C.wire, 'stroke-width': 2 });
      g.appendChild(lead1); g.appendChild(lead2);
      // register leads as real wires so lightLoop()/lightAll() recolor them too
      this.wires.push({ el: lead1, a: [x - 30, y], b: [x - 12, y] }, { el: lead2, a: [x + 12, y], b: [x + 30, y] });
      const d1 = el('circle', { cx: x - 12, cy: y, r: 3, fill: C.faint });
      const d2 = el('circle', { cx: x + 12, cy: y, r: 3, fill: C.faint });
      g.appendChild(d1); g.appendChild(d2);
      const arm = el('line', { x1: x - 12, y1: y, x2: x + 8, y2: y - 14, stroke: C.faint, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
      g.appendChild(arm);
      if (o.label) g.appendChild(txt(x - 4, y - 20, o.label, C.gray, 12));
      return {
        a: [x - 30, y], b: [x + 30, y],
        setClosed(on) {
          const col = on ? C.green : C.faint;
          d1.setAttribute('fill', col); d2.setAttribute('fill', col); arm.setAttribute('stroke', col);
          if (on) { arm.setAttribute('x2', x + 12); arm.setAttribute('y2', y); }
          else    { arm.setAttribute('x2', x + 8);  arm.setAttribute('y2', y - 14); }
        }
      };
    }
    // small open (unconnected) terminal marker
    openTerm(x, y) { this.dotLayer.appendChild(el('circle', { cx: x, cy: y, r: 4, fill: '#161b27', stroke: C.faint, 'stroke-width': 1.5 })); return [x, y]; }
    // dashed lead (for a floating/not-connected leg)
    dashed(a, b) { this.wireLayer.appendChild(el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.wire, 'stroke-width': 2, 'stroke-dasharray': '4,3' })); }

    /* ---- light the whole loop (all wires) by state ---- */
    lightAll(color) { this.wires.forEach(w => w.el.setAttribute('stroke', color)); }
    // light only wires lying on the active loop (green); dead branches stay gray
    lightLoop(loop, color) {
      const sd = (p, a, b) => { const dx = b[0]-a[0], dy = b[1]-a[1], L = dx*dx+dy*dy, u = L ? ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L : 0, uu = Math.max(0, Math.min(1, u)); return Math.hypot(p[0]-(a[0]+uu*dx), p[1]-(a[1]+uu*dy)); };
      this.wires.forEach(w => {
        const m = [(w.a[0]+w.b[0])/2, (w.a[1]+w.b[1])/2];
        let on = false;
        for (let k = 0; k < loop.length - 1; k++) { if (sd(m, loop[k], loop[k+1]) <= 4) { on = true; break; } }
        w.el.setAttribute('stroke', on ? color : C.wire);
      });
    }

    /* ---- current particles along an ordered loop of points ---- */
    particles(loop, o = {}) {
      const self = this; let arr = []; let acc = 0, last = 0, on = false, color = C.green, speed = 1;
      function spawn() {
        const p = el('circle', { r: 3.5, fill: color, opacity: 0.85 });
        self.particleLayer.appendChild(p); arr.push({ el: p, idx: 0, frac: 0 });
      }
      function frame(ts) {
        const dt = last ? Math.min(50, ts - last) : 16; last = ts;
        if (on) { acc += dt; if (acc > Math.max(90, 300 / speed)) { spawn(); acc = 0; } }
        const step = 0.012 * speed * (dt / 16);
        arr = arr.filter(o2 => {
          o2.frac += step; while (o2.frac >= 1) { o2.frac -= 1; o2.idx++; }
          if (o2.idx >= loop.length - 1) { o2.el.remove(); return false; }
          const [x0, y0] = loop[o2.idx], [x1, y1] = loop[o2.idx + 1];
          o2.el.setAttribute('cx', x0 + (x1 - x0) * o2.frac);
          o2.el.setAttribute('cy', y0 + (y1 - y0) * o2.frac);
          o2.el.setAttribute('fill', color);
          return true;
        });
        if (!on && !arr.length) { /* idle */ }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      return { set(o2) { on = !!o2.on; if (o2.color) color = o2.color; if (o2.speed != null) speed = o2.speed; if (!on) { arr.forEach(p => p.el.remove()); arr = []; } } };
    }

    // gradients used by led()
    static defs() {
      return `<defs>
        <radialGradient id="kitGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#aaffcc" stop-opacity="0.85"/>
          <stop offset="45%" stop-color="#22d36a" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#22d36a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="kitGlowWarn" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffe1a8" stop-opacity="0.9"/>
          <stop offset="45%" stop-color="#f5a623" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#f5a623" stop-opacity="0"/>
        </radialGradient>
      </defs>`;
    }
  }

  global.Circuit = Circuit;
})(window);
