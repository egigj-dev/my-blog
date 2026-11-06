/* ============================================================================
 * card-thumbnails.js  —  three animated card-header visuals, zero dependencies
 *
 *   CardThumbnails.activation(el, opts)      animated ReLU / Sigmoid / Tanh
 *   CardThumbnails.optimization(el, opts)    vector field + descent particles
 *   CardThumbnails.regularization(el, opts)  node graph with dropout
 *   CardThumbnails.mountAll(root)            auto-mount every [data-thumb]
 *
 * Each factory returns { destroy() }. Instances share one requestAnimationFrame
 * loop, pause when scrolled off-screen, and render a single static frame when
 * the user has "reduce motion" enabled.
 *
 * opts: { palette, seed, speed }  — all optional.
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardThumbnails = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- palette */
  var PALETTE = {
    bg:      '#0B132B',   // card background (slate)
    bgAlt:   '#0F172A',   // alternate slate
    cyan:    '#00E5FF',   // primary accent
    cyanLit: '#00F2FE',   // brighter cyan for glow / highlights
    amber:   '#FF9F1C',   // warm accent
    violet:  '#A78BFA',   // third accent (computer-vision topics)
    grid:    '#1B2846',   // grid + inactive strokes
    dim:     '#2C3E63'    // secondary strokes
  };

  /* ------------------------------------------------------------- utilities */
  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }

  // Deterministic PRNG (mulberry32) so a given seed always yields the same layout.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hexToRgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ------------------------------------------------------- shared RAF loop */
  // One loop for every mounted instance; it stops entirely when none are visible.
  var live = [], rafId = null, t0 = 0, last = 0;

  function tick(now) {
    var t = (now - t0) / 1000;
    var dt = t - last; last = t;
    if (!(dt > 0) || dt > 0.05) dt = 1 / 60;      // clamp tab-switch spikes

    var anyVisible = false;
    for (var i = 0; i < live.length; i++) {
      var inst = live[i];
      if (!inst.visible) continue;
      anyVisible = true;
      // ease hover 0..1 so speed/glow ramp instead of snapping
      inst.ease = clamp(inst.ease + ((inst.hover ? 1 : 0) - inst.ease) * 0.09, 0, 1);
      inst.frame(Math.max(0, t), dt, inst.ease);  // rAF's timestamp can precede the start time on the first frame
    }
    // Park entirely when every instance is off-screen; wake() restarts us.
    rafId = anyVisible ? requestAnimationFrame(tick) : null;
  }

  function wake() {
    if (rafId !== null || !live.length) return;
    t0 = performance.now() - last * 1000;         // resume the clock, don't reset it
    rafId = requestAnimationFrame(tick);
  }
  function join(inst) {
    live.push(inst);
    wake();
  }
  function leave(inst) {
    var i = live.indexOf(inst);
    if (i >= 0) live.splice(i, 1);
    if (!live.length && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ------------------------------------------------- per-instance lifecycle */
  // Wires visibility, hover and teardown around a frame() callback.
  function makeInstance(el, frame, cleanup) {
    var inst = { visible: true, hover: false, ease: 0, frame: frame };

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) inst.visible = entries[i].isIntersecting;
        if (inst.visible) wake();                 // loop may be parked
      }, { threshold: 0.01 });
      io.observe(el);
    }

    function onEnter() { inst.hover = true; }
    function onLeave() { inst.hover = false; }

    // The card, not just the canvas, is the hover target where one exists.
    var hoverTarget = el.closest ? (el.closest('[data-thumb-hover]') || el) : el;
    hoverTarget.addEventListener('mouseenter', onEnter);
    hoverTarget.addEventListener('mouseleave', onLeave);

    if (REDUCED) { frame(0.8, 1 / 60, 0); }      // one static frame, no loop
    else join(inst);

    return {
      destroy: function () {
        leave(inst);
        if (io) io.disconnect();
        hoverTarget.removeEventListener('mouseenter', onEnter);
        hoverTarget.removeEventListener('mouseleave', onLeave);
        if (cleanup) cleanup();
      }
    };
  }

  /* ------------------------------------------------------- canvas plumbing */
  function makeCanvas(el) {
    var c = document.createElement('canvas');
    c.style.cssText = 'display:block;width:100%;height:100%';
    el.appendChild(c);
    return c;
  }

  // Resizes the backing store to the CSS box * DPR. Returns true if it changed.
  function fit(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas._w === w && canvas._h === h && canvas._dpr === dpr) return false;
    canvas._w = w; canvas._h = h; canvas._dpr = dpr;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  var uid = 0;

  /* ========================================================================
   * CARD 1 — Activation Functions
   * SVG. A path morphs ReLU -> Sigmoid -> Tanh over a faint grid while a
   * glowing tracer slides along it, trailing particles.
   *
   * Note: ReLU is drawn as its real ramp (max(0,x)), scaled to fit the box —
   * not as a step. Softmax is intentionally absent: it maps a vector to a
   * vector, so it has no single-curve form on these axes.
   * ==================================================================== */
  function activation(el, opts) {
    opts = opts || {};
    var P = Object.assign({}, PALETTE, opts.palette || {});
    var SPEED = opts.speed || 1;

    var W = 600, H = 260, PAD = 26;   // H is recomputed from the container
    var NS = 'http://www.w3.org/2000/svg';
    var id = 'ct' + (++uid);

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.cssText = 'display:block;width:100%;height:100%';
    el.appendChild(svg);

    // glow filter (unique id so multiple instances can coexist)
    var defs = document.createElementNS(NS, 'defs');
    defs.innerHTML =
      '<filter id="' + id + '-glow" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feGaussianBlur stdDeviation="4" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    svg.appendChild(defs);

    function add(parent, tag, attrs) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      parent.appendChild(n);
      return n;
    }

    // axes -------------------------------------------------------------
    var X = function (v) { return PAD + (v + 6) / 12 * (W - 2 * PAD); };
    var Y = function (v) { return H - PAD - (v + 1.2) / 2.4 * (H - 2 * PAD); };

    var gGrid = add(svg, 'g', {});
    var hLines = [-1, -0.5, 0.5, 1].map(function (v) {
      return { v: v, node: add(gGrid, 'line', { stroke: P.grid, 'stroke-width': 1 }) };
    });
    var vLines = [-4, -2, 2, 4].map(function (v) {
      return { v: v, node: add(gGrid, 'line', { stroke: P.grid, 'stroke-width': 1 }) };
    });
    var axH = add(gGrid, 'line', { stroke: P.dim, 'stroke-width': 1.4 });
    var axV = add(gGrid, 'line', { stroke: P.dim, 'stroke-width': 1.4 });

    var gTrail = add(svg, 'g', {});
    var path = add(svg, 'path', {
      fill: 'none', stroke: P.cyan, 'stroke-width': 3,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      filter: 'url(#' + id + '-glow)'
    });
    var dot = add(svg, 'circle', { r: 5, fill: P.cyanLit, filter: 'url(#' + id + '-glow)' });
    var label = add(svg, 'text', {
      x: W - PAD, y: PAD + 4, 'text-anchor': 'end',
      fill: P.cyan, 'font-size': 15, 'font-family': 'ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing': '0.14em', opacity: 0.75
    });

    // Match the viewBox to the container's aspect ratio, so the curve is never
    // cropped in a wide banner nor letterboxed in a narrow one.
    function relayout() {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var want = clamp(Math.round(W * r.height / r.width), 130, 460);
      if (want === H) return;
      H = want;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      hLines.forEach(function (o) {
        o.node.setAttribute('x1', PAD); o.node.setAttribute('x2', W - PAD);
        o.node.setAttribute('y1', Y(o.v)); o.node.setAttribute('y2', Y(o.v));
      });
      vLines.forEach(function (o) {
        o.node.setAttribute('x1', X(o.v)); o.node.setAttribute('x2', X(o.v));
        o.node.setAttribute('y1', PAD); o.node.setAttribute('y2', H - PAD);
      });
      axH.setAttribute('x1', PAD); axH.setAttribute('x2', W - PAD);
      axH.setAttribute('y1', Y(0)); axH.setAttribute('y2', Y(0));
      axV.setAttribute('x1', X(0)); axV.setAttribute('x2', X(0));
      axV.setAttribute('y1', PAD); axV.setAttribute('y2', H - PAD);
    }
    relayout();

    // the three curves, each scaled to sit inside y ∈ [-1.2, 1.2]
    var FNS = [
      { name: 'RELU',    f: function (v) { return Math.max(0, v) / 5.2; } },
      { name: 'SIGMOID', f: function (v) { return 1 / (1 + Math.exp(-v)); } },
      { name: 'TANH',    f: function (v) { return Math.tanh(v); } }
    ];

    var XS = [];
    for (var v = -6; v <= 6.0001; v += 0.1) XS.push(v);

    var trail = [], trailNodes = [];
    for (var i = 0; i < 22; i++) trailNodes.push(add(gTrail, 'circle', { r: 2, fill: P.cyanLit, opacity: 0 }));

    var DWELL = 2.4, MORPH = 1.1, PERIOD = DWELL + MORPH;

    function frame(t, dt, hov) {
      relayout();
      t *= SPEED;
      var cyc = t / PERIOD;
      var i0 = Math.floor(cyc) % FNS.length;
      var i1 = (i0 + 1) % FNS.length;
      var local = (cyc - Math.floor(cyc)) * PERIOD;
      var m = local < DWELL ? 0 : smooth((local - DWELL) / MORPH);
      var f = function (x) { return lerp(FNS[i0].f(x), FNS[i1].f(x), m); };

      var d = '';
      for (var k = 0; k < XS.length; k++) d += (k ? 'L' : 'M') + X(XS[k]).toFixed(2) + ',' + Y(f(XS[k])).toFixed(2);
      path.setAttribute('d', d);
      path.setAttribute('stroke-width', (2.6 + hov * 1.6).toFixed(2));

      label.textContent = m > 0.5 ? FNS[i1].name : FNS[i0].name;
      label.setAttribute('opacity', (0.55 + hov * 0.45).toFixed(2));

      // tracer
      var u = (t * (0.15 + hov * 0.22)) % 1;
      var xv = -6 + 12 * u, px = X(xv), py = Y(f(xv));
      dot.setAttribute('cx', px.toFixed(2));
      dot.setAttribute('cy', py.toFixed(2));
      dot.setAttribute('r', (4 + hov * 2.5).toFixed(2));

      trail.push([px, py]);
      var maxLen = 8 + Math.round(hov * 14);
      while (trail.length > maxLen) trail.shift();
      for (var n = 0; n < trailNodes.length; n++) {
        var pt = trail[trail.length - 1 - n];
        var node = trailNodes[n];
        if (!pt || n >= maxLen) { node.setAttribute('opacity', 0); continue; }
        var fall = 1 - n / maxLen;
        node.setAttribute('cx', pt[0].toFixed(2));
        node.setAttribute('cy', pt[1].toFixed(2));
        node.setAttribute('r', (1 + fall * (1.6 + hov * 1.4)).toFixed(2));
        node.setAttribute('opacity', (fall * fall * (0.25 + hov * 0.55)).toFixed(3));
      }
    }

    return makeInstance(el, frame, function () { if (svg.parentNode) svg.parentNode.removeChild(svg); });
  }

  /* ========================================================================
   * CARD 2 — Optimization Techniques
   * Canvas. A real vector field (arrows point along the negative gradient of
   * an analytic loss surface) with amber particles running gradient descent
   * with momentum, trailing their paths into the basin.
   * ==================================================================== */
  // Loss surface: shallow bowl minus two Gaussian wells. Gradient is analytic
  // and verified against central differences.
  var WELLS = [
    { A: 1.45, cx: 1.30, cy: 0.55, s: 0.90 },
    { A: 0.95, cx: -1.45, cy: -0.70, s: 1.00 }
  ];
  var BOWL = 0.10;

  function lossAt(x, y) {
    var v = BOWL * (x * x + y * y);
    for (var i = 0; i < WELLS.length; i++) {
      var w = WELLS[i];
      v -= w.A * Math.exp(-(((x - w.cx) * (x - w.cx)) + ((y - w.cy) * (y - w.cy))) / w.s);
    }
    return v;
  }
  function gradAt(x, y) {
    var gx = 2 * BOWL * x, gy = 2 * BOWL * y;
    for (var i = 0; i < WELLS.length; i++) {
      var w = WELLS[i];
      var e = Math.exp(-(((x - w.cx) * (x - w.cx)) + ((y - w.cy) * (y - w.cy))) / w.s);
      gx += w.A * e * 2 * (x - w.cx) / w.s;
      gy += w.A * e * 2 * (y - w.cy) / w.s;
    }
    return [gx, gy];
  }

  function optimization(el, opts) {
    opts = opts || {};
    var P = Object.assign({}, PALETTE, opts.palette || {});
    var SPEED = opts.speed || 1;
    var g = rng(opts.seed || 21);

    var canvas = makeCanvas(el);
    var ctx = canvas.getContext('2d');

    var XR = 3.4, YR = 1.9;                       // world extents (wide banner)
    var N = 7;                                    // particles
    var TRAIL = 30;

    function spawn() {
      return {
        x: (g() * 2 - 1) * XR, y: (g() * 2 - 1) * YR,
        vx: 0, vy: 0, age: 0, hist: []
      };
    }
    var parts = [];
    for (var i = 0; i < N; i++) parts.push(spawn());

    function frame(t, dt, hov) {
      fit(canvas);
      var w = canvas._w, h = canvas._h;
      if (!w || !h) return;

      var toX = function (x) { return (x + XR) / (2 * XR) * w; };
      var toY = function (y) { return h - (y + YR) / (2 * YR) * h; };

      ctx.clearRect(0, 0, w, h);

      // --- vector field -------------------------------------------------
      var step = Math.max(26, Math.round(w / 22));
      ctx.lineWidth = 1;
      for (var px = step * 0.6; px < w; px += step) {
        for (var py = step * 0.6; py < h; py += step) {
          var wx = px / w * 2 * XR - XR;
          var wy = (1 - py / h) * 2 * YR - YR;
          var gr = gradAt(wx, wy);
          var mag = Math.hypot(gr[0], gr[1]) || 1e-6;
          var ux = -gr[0] / mag, uy = -gr[1] / mag;         // downhill direction
          var len = clamp(mag * 7, 3, step * 0.42) * (1 + hov * 0.35);
          var ex = px + ux * len, ey = py - uy * len;
          ctx.strokeStyle = hexToRgba(P.dim, clamp(0.16 + mag * 0.30, 0.10, 0.60) * (0.75 + hov * 0.5));
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
          // arrowhead
          var a = Math.atan2(-uy, ux), hd = 3.2;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - hd * Math.cos(a - 0.42), ey - hd * Math.sin(a - 0.42));
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - hd * Math.cos(a + 0.42), ey - hd * Math.sin(a + 0.42));
          ctx.stroke();
        }
      }

      // --- basin glow ---------------------------------------------------
      var deep = WELLS[0];
      var bx = toX(deep.cx), by = toY(deep.cy);
      var rg = ctx.createRadialGradient(bx, by, 0, bx, by, Math.min(w, h) * 0.45);
      rg.addColorStop(0, hexToRgba(P.amber, 0.16 + hov * 0.10));
      rg.addColorStop(1, hexToRgba(P.amber, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);

      // --- particles: real gradient descent with momentum ---------------
      var boost = (0.55 + hov * 1.25) * SPEED;
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        var gr2 = gradAt(p.x, p.y);
        p.vx = 0.86 * p.vx - gr2[0] * 0.05 * boost;
        p.vy = 0.86 * p.vy - gr2[1] * 0.05 * boost;
        p.x = clamp(p.x + p.vx, -XR, XR);
        p.y = clamp(p.y + p.vy, -YR, YR);
        p.age += dt;

        p.hist.push([toX(p.x), toY(p.y)]);
        if (p.hist.length > TRAIL) p.hist.shift();

        // recycle once it has settled so the animation keeps breathing
        if (Math.hypot(p.vx, p.vy) < 0.0022 && p.age > 2.8) {
          parts[k] = spawn();
          continue;
        }

        // trail
        ctx.lineWidth = 1.4 + hov * 0.8;
        for (var q = 1; q < p.hist.length; q++) {
          var f2 = q / p.hist.length;
          ctx.strokeStyle = hexToRgba(P.amber, f2 * f2 * (0.30 + hov * 0.35));
          ctx.beginPath();
          ctx.moveTo(p.hist[q - 1][0], p.hist[q - 1][1]);
          ctx.lineTo(p.hist[q][0], p.hist[q][1]);
          ctx.stroke();
        }
        // head
        var hx = toX(p.x), hy = toY(p.y), r = 2.6 + hov * 1.5;
        var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 4);
        hg.addColorStop(0, hexToRgba(P.amber, 0.95));
        hg.addColorStop(1, hexToRgba(P.amber, 0));
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFD9A0';
        ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
      }
    }

    return makeInstance(el, frame, function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); });
  }

  /* ========================================================================
   * CARD 3 — Regularization Techniques
   * Canvas. A small force-directed graph (hand-rolled springs + repulsion).
   * On a repeating beat a random subset of units drops out: they fade, their
   * edges go with them, and the survivors re-settle into a new subnetwork —
   * which is what dropout actually does at train time.
   * ==================================================================== */
  function regularization(el, opts) {
    opts = opts || {};
    var P = Object.assign({}, PALETTE, opts.palette || {});
    var SPEED = opts.speed || 1;
    var g = rng(opts.seed || 42);

    var canvas = makeCanvas(el);
    var ctx = canvas.getContext('2d');

    var N = 18;
    var nodes = [], links = [];
    for (var i = 0; i < N; i++) {
      nodes.push({ x: g(), y: g(), vx: 0, vy: 0, alive: 1, target: 1 });
    }
    for (var a = 0; a < N; a++) {
      for (var b = a + 1; b < N; b++) if (g() < 0.16) links.push([a, b]);
    }
    // guarantee no isolated node
    for (var n = 0; n < N; n++) {
      var has = links.some(function (l) { return l[0] === n || l[1] === n; });
      if (!has) links.push([n, (n + 1) % N]);
    }

    var beat = 0, CYCLE = 1.6;

    function dropout(rate) {
      for (var i = 0; i < nodes.length; i++) nodes[i].target = Math.random() < rate ? 0 : 1;
    }
    dropout(0.28);

    // Physics in normalised [0,1] space so it is resolution independent.
    function physics(dt) {
      var REST = 0.20, K = 2.4, REP = 0.0016, DAMP = 0.86;
      var i, j;
      for (i = 0; i < N; i++) {
        var p = nodes[i];
        // pull toward centre
        p.vx += (0.5 - p.x) * 0.6 * dt;
        p.vy += (0.5 - p.y) * 0.6 * dt;
        // pairwise repulsion
        for (j = i + 1; j < N; j++) {
          var q = nodes[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var d2 = dx * dx + dy * dy + 1e-4;
          var f = REP / d2;
          var d = Math.sqrt(d2);
          var ux = dx / d, uy = dy / d;
          p.vx += ux * f; p.vy += uy * f;
          q.vx -= ux * f; q.vy -= uy * f;
        }
      }
      // springs, but only between units that are both switched on: dropped
      // units stop exerting structure, so survivors genuinely rearrange
      for (i = 0; i < links.length; i++) {
        var A = nodes[links[i][0]], B = nodes[links[i][1]];
        var w = Math.min(A.alive, B.alive);
        if (w < 0.02) continue;
        var ddx = B.x - A.x, ddy = B.y - A.y;
        var dist = Math.hypot(ddx, ddy) || 1e-4;
        var force = (dist - REST) * K * w * dt;
        var nx = ddx / dist, ny = ddy / dist;
        A.vx += nx * force; A.vy += ny * force;
        B.vx -= nx * force; B.vy -= ny * force;
      }
      for (i = 0; i < N; i++) {
        var s = nodes[i];
        s.vx *= DAMP; s.vy *= DAMP;
        s.x = clamp(s.x + s.vx * dt * 6, 0.06, 0.94);
        s.y = clamp(s.y + s.vy * dt * 6, 0.10, 0.90);
        s.alive += (s.target - s.alive) * Math.min(1, dt * 6);
      }
    }

    // settle before the first paint so it never appears mid-explosion
    for (var w0 = 0; w0 < 240; w0++) physics(1 / 60);

    function frame(t, dt, hov) {
      fit(canvas);
      var cw = canvas._w, ch = canvas._h;
      if (!cw || !ch) return;

      beat += dt * SPEED * (1 + hov * 0.9);
      if (beat > CYCLE) { beat = 0; dropout(0.22 + Math.random() * 0.20); }

      physics(dt * SPEED * (1 + hov * 0.5));
      ctx.clearRect(0, 0, cw, ch);

      var toX = function (x) { return x * cw; };
      var toY = function (y) { return y * ch; };

      // edges
      for (var i = 0; i < links.length; i++) {
        var A = nodes[links[i][0]], B = nodes[links[i][1]];
        var w = Math.min(A.alive, B.alive);
        ctx.strokeStyle = hexToRgba(P.cyan, 0.05 + w * (0.34 + hov * 0.22));
        ctx.lineWidth = 0.6 + w * (1.1 + hov * 0.6);
        ctx.beginPath();
        ctx.moveTo(toX(A.x), toY(A.y));
        ctx.lineTo(toX(B.x), toY(B.y));
        ctx.stroke();
      }

      // nodes
      for (var k = 0; k < N; k++) {
        var p = nodes[k];
        var x = toX(p.x), y = toY(p.y);
        var r = 2.2 + p.alive * (2.2 + hov * 1.2);
        if (p.alive > 0.05) {
          var rg = ctx.createRadialGradient(x, y, 0, x, y, r * 3.6);
          rg.addColorStop(0, hexToRgba(P.cyanLit, 0.55 * p.alive));
          rg.addColorStop(1, hexToRgba(P.cyanLit, 0));
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.arc(x, y, r * 3.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = p.alive > 0.05
          ? hexToRgba(P.cyanLit, 0.35 + p.alive * 0.65)
          : hexToRgba(P.grid, 0.9);
        ctx.beginPath(); ctx.arc(x, y, Math.max(1.4, r), 0, Math.PI * 2); ctx.fill();

        // dropped units leave a hollow ring behind
        if (p.alive < 0.4) {
          ctx.strokeStyle = hexToRgba(P.dim, 0.55 * (1 - p.alive));
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, 4.6, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    return makeInstance(el, frame, function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); });
  }

  /* ========================================================================
   * CARD 4 — Transfer Learning
   * Canvas. A backbone of frozen blocks feeding a trainable head. A gradient
   * pulse travels backwards from the output and stops dead at the freeze
   * boundary: nothing upstream of it receives an update.
   * ==================================================================== */
  function transfer(el, opts) {
    opts = opts || {};
    var P = Object.assign({}, PALETTE, opts.palette || {});
    var SPEED = opts.speed || 1;
    var ACCENT = (opts.palette && opts.palette.accent) || P.violet;

    var canvas = makeCanvas(el);
    var ctx = canvas.getContext('2d');
    var BLOCKS = 6, FROZEN = 4;                  // last two blocks train

    function frame(t, dt, hov) {
      fit(canvas);
      var w = canvas._w, h = canvas._h;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      var pad = Math.max(26, w * 0.09);
      var gap = (w - 2 * pad) / (BLOCKS - 1);
      var cy = h / 2;
      var bx = function (i) { return pad + i * gap; };

      // connections
      ctx.strokeStyle = hexToRgba(P.dim, 0.55);
      ctx.lineWidth = 1;
      for (var i = 0; i < BLOCKS - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(bx(i) + gap * 0.16, cy);
        ctx.lineTo(bx(i + 1) - gap * 0.16, cy);
        ctx.stroke();
      }

      // backwards pulse, halted at the boundary between frozen and trainable
      var startX = bx(BLOCKS - 1), stopX = bx(FROZEN - 1);
      var cyc = (t * SPEED * (0.42 + hov * 0.55)) % 1;
      var px = startX - (startX - stopX) * cyc;

      // blocks
      var bw = Math.min(gap * 0.42, h * 0.20);
      var bh = h * 0.42;
      for (var k = 0; k < BLOCKS; k++) {
        var frozen = k < FROZEN;
        var x = bx(k);
        var near = Math.abs(x - px) < gap * 0.5 ? 1 : 0;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - bw / 2, cy - bh / 2, bw, bh, 4);
        else ctx.rect(x - bw / 2, cy - bh / 2, bw, bh);
        if (frozen) {
          ctx.fillStyle = hexToRgba(P.grid, 0.75);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(P.dim, 0.9);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = hexToRgba(ACCENT, 0.14 + near * 0.16);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(ACCENT, 0.6 + near * 0.4 + hov * 0.1);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // the pulse itself
      var g = ctx.createRadialGradient(px, cy, 0, px, cy, 16 + hov * 8);
      g.addColorStop(0, hexToRgba(P.amber, 0.9 * (1 - cyc) + 0.1));
      g.addColorStop(1, hexToRgba(P.amber, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, cy, 16 + hov * 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hexToRgba('#FFD9A0', 0.85 * (1 - cyc) + 0.15);
      ctx.beginPath(); ctx.arc(px, cy, 3 + hov * 1.4, 0, Math.PI * 2); ctx.fill();

      // freeze boundary
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = hexToRgba(ACCENT, 0.35 + hov * 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((bx(FROZEN - 1) + bx(FROZEN)) / 2, h * 0.16);
      ctx.lineTo((bx(FROZEN - 1) + bx(FROZEN)) / 2, h * 0.84);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    return makeInstance(el, frame, function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); });
  }

  /* ========================================================================
   * CARD 5 — Data Augmentation
   * Canvas. One seed sample emits transformed copies that drift outward,
   * rotating and rescaling as they go: one example becomes many.
   * ==================================================================== */
  function sampling(el, opts) {
    opts = opts || {};
    var P = Object.assign({}, PALETTE, opts.palette || {});
    var SPEED = opts.speed || 1;
    var ACCENT = (opts.palette && opts.palette.accent) || P.amber;
    var g = rng(opts.seed || 63);

    var canvas = makeCanvas(el);
    var ctx = canvas.getContext('2d');

    var K = 16, variants = [];
    for (var i = 0; i < K; i++) {
      variants.push({
        ph: g(), ang: g() * Math.PI * 2, dist: 0.28 + g() * 0.62,
        spin: g() * 2 - 1, sc: 0.5 + g() * 0.7
      });
    }

    function glyph(size) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.55, size * 0.45);
      ctx.lineTo(0, -size * 0.6);
      ctx.lineTo(size * 0.6, size * 0.3);
      ctx.closePath();
    }

    function frame(t, dt, hov) {
      fit(canvas);
      var w = canvas._w, h = canvas._h;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      var cx = w / 2, cy = h / 2;
      var reach = Math.min(w, h) * 0.62;
      var speed = 0.20 * SPEED * (1 + hov * 1.1);

      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        var u = (t * speed + v.ph) % 1;
        var r = v.dist * reach * u;
        var x = cx + Math.cos(v.ang) * r;
        var y = cy + Math.sin(v.ang) * r * 0.72;
        var a = (1 - u) * (0.5 + hov * 0.4);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(v.spin * u * 1.4);
        ctx.scale(v.sc, v.sc);
        ctx.strokeStyle = hexToRgba(ACCENT, a);
        ctx.lineWidth = 1.4 / v.sc;
        var s = Math.min(w, h) * 0.13;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-s * 0.8, -s * 0.66, s * 1.6, s * 1.32, 3);
        else ctx.rect(-s * 0.8, -s * 0.66, s * 1.6, s * 1.32);
        ctx.stroke();
        glyph(s * 0.9);
        ctx.fillStyle = hexToRgba(ACCENT, a * 0.55);
        ctx.fill();
        ctx.restore();
      }

      // the original sample, held at the centre
      var s0 = Math.min(w, h) * 0.15;
      var gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, s0 * 2.6);
      gl.addColorStop(0, hexToRgba(ACCENT, 0.30 + hov * 0.16));
      gl.addColorStop(1, hexToRgba(ACCENT, 0));
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(cx, cy, s0 * 2.6, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = hexToRgba(ACCENT, 0.95);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-s0 * 0.8, -s0 * 0.66, s0 * 1.6, s0 * 1.32, 3);
      else ctx.rect(-s0 * 0.8, -s0 * 0.66, s0 * 1.6, s0 * 1.32);
      ctx.stroke();
      glyph(s0 * 0.9);
      ctx.fillStyle = hexToRgba(ACCENT, 0.9);
      ctx.fill();
      ctx.restore();
    }

    return makeInstance(el, frame, function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); });
  }

  /* ========================================================================
   * CARD 6 — AlexNet / architecture cascade
   * Canvas. A signal front sweeps through progressively narrower feature
   * layers, brightening whichever stage it is passing through.
   * ==================================================================== */
  function cascade(el, opts) {
    opts = opts || {};
    var P = Object.assign({}, PALETTE, opts.palette || {});
    var SPEED = opts.speed || 1;
    var ACCENT = (opts.palette && opts.palette.accent) || P.violet;

    var canvas = makeCanvas(el);
    var ctx = canvas.getContext('2d');
    var L = 8;

    function frame(t, dt, hov) {
      fit(canvas);
      var w = canvas._w, h = canvas._h;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      var pad = Math.max(24, w * 0.08);
      var span = w - 2 * pad;
      var front = pad + span * ((t * SPEED * (0.26 + hov * 0.32)) % 1);
      var cy = h / 2;

      for (var i = 0; i < L; i++) {
        var x = pad + span * (i / (L - 1));
        var bh = h * 0.74 * (1 - i / (L * 1.22));      // spatial extent collapses
        var near = clamp(1 - Math.abs(x - front) / (span / L * 0.9), 0, 1);
        var lw = 1 + near * (2.6 + hov * 1.2);

        if (near > 0.05) {
          ctx.strokeStyle = hexToRgba(ACCENT, near * 0.22);
          ctx.lineWidth = lw * 4;
          ctx.beginPath();
          ctx.moveTo(x, cy - bh / 2); ctx.lineTo(x, cy + bh / 2);
          ctx.stroke();
        }
        ctx.strokeStyle = hexToRgba(ACCENT, 0.24 + near * 0.7);
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, cy - bh / 2); ctx.lineTo(x, cy + bh / 2);
        ctx.stroke();

        // channel depth grows as resolution falls
        var dots = Math.min(6, 1 + Math.round(i * 0.8));
        for (var d = 0; d < dots; d++) {
          var dy = cy - bh / 2 + (bh / (dots + 1)) * (d + 1);
          ctx.fillStyle = hexToRgba(ACCENT, 0.18 + near * 0.55);
          ctx.beginPath(); ctx.arc(x, dy, 1.1 + near * 0.9, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    return makeInstance(el, frame, function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); });
  }

  /* ---------------------------------------------------------------- mount */
  var REGISTRY = {
    activation: activation,
    optimization: optimization,
    regularization: regularization,
    transfer: transfer,
    sampling: sampling,
    cascade: cascade
  };

  // Auto-mount: <div class="ct-thumb" data-thumb="activation" data-seed="11">
  function mountAll(rootEl) {
    var scope = rootEl || document;
    var out = [];
    var els = scope.querySelectorAll('[data-thumb]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var name = el.getAttribute('data-thumb');
      var fn = REGISTRY[name];
      if (!fn) {
        if (window.console) console.warn('[CardThumbnails] unknown renderer "' + name + '"');
        continue;
      }
      var seed = parseInt(el.getAttribute('data-seed'), 10);
      var accent = el.getAttribute('data-accent');
      try { out.push(fn(el, {
        seed: isNaN(seed) ? undefined : seed,
        palette: accent ? { accent: accent, cyan: accent, cyanLit: accent, amber: accent } : undefined
      })); } catch (error) {
        el.textContent = 'Decorative preview unavailable';
        if (window.console) console.warn('[CardThumbnails] renderer unavailable', error);
      }
    }
    return {
      instances: out,
      destroy: function () { out.forEach(function (o) { o.destroy(); }); }
    };
  }

  return {
    activation: activation,
    optimization: optimization,
    regularization: regularization,
    transfer: transfer,
    sampling: sampling,
    cascade: cascade,
    mountAll: mountAll,
    PALETTE: PALETTE
  };
}));
    