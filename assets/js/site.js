(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function fmtPct(v) { return v + "%"; }
  function fmtDelta(d) {
    if (d > 0) return "+" + d + " pp";
    if (d < 0) return "−" + Math.abs(d) + " pp";
    return "0 pp";
  }

  // Shared tooltip positioning inside a relatively positioned host.
  function Tooltip(host) {
    var tip = host.querySelector(".viz-tooltip");
    return {
      show: function (build, clientX, clientY, anchor) {
        tip.textContent = "";
        build(tip);
        var h = host.getBoundingClientRect();
        var x, y;
        if (clientX != null) { x = clientX - h.left; y = clientY - h.top; }
        else { var a = anchor.getBoundingClientRect(); x = a.left + a.width / 2 - h.left; y = a.top - h.top; }
        tip.classList.add("show");
        var w = tip.offsetWidth, th = tip.offsetHeight;
        var left = Math.min(Math.max(x + 14, 0), Math.max(0, h.width - w));
        var top = y - th - 14;
        if (top < 0) top = y + 20;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
      },
      hide: function () { tip.classList.remove("show"); }
    };
  }
  function ttRow(tip, color, value, name) {
    var r = el("div", "tt-row");
    if (color) { var k = el("span", "tt-key"); k.style.background = color; r.appendChild(k); }
    r.appendChild(el("span", "tt-val", value));
    if (name) r.appendChild(el("span", "tt-name", name));
    tip.appendChild(r);
  }
  function buildTable(host, headers, rows) {
    var table = document.createElement("table");
    var hr = table.createTHead().insertRow();
    headers.forEach(function (h, i) {
      var th = document.createElement("th");
      th.scope = "col"; th.textContent = h;
      if (i === 0) th.className = "left";
      hr.appendChild(th);
    });
    var tb = table.createTBody();
    rows.forEach(function (row) {
      var r = tb.insertRow();
      row.forEach(function (v, i) {
        var c = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) c.scope = "row";
        c.textContent = v;
        r.appendChild(c);
      });
    });
    host.appendChild(table);
  }
  // Re-render SVG charts at their real width so text stays at its true size.
  function responsive(host, render) {
    var last = 0;
    function go() {
      var w = Math.round(host.clientWidth);
      if (!w || Math.abs(w - last) < 4) return;
      last = w;
      render(w);
    }
    if ("ResizeObserver" in window) new ResizeObserver(go).observe(host);
    else window.addEventListener("resize", go);
    go();
  }

  // ---------- Hero artwork ----------
  // A small neural network drawn as string art. Seven rings of neurons sit on one
  // axis, wide → bottleneck → wide like an autoencoder, and every neuron is laced
  // to the next ring with straight threads. The rings sway against each other so
  // the lacing twists and relaxes, the form turns slowly, and pulses of activation
  // merge on the way into the bottleneck and fan out again on the way out.
  (function () {
    var figure = document.querySelector(".hero-network");
    var canvas = figure && figure.querySelector("canvas");
    var ctx = canvas && canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    var toggle = figure.querySelector(".signal-toggle");

    var TAU = Math.PI * 2;
    var RADII = [1.08, 0.84, 0.57, 0.32, 0.57, 0.84, 1.08];
    var PER_RING = 30, LACE = 3, MID = 3;
    var SPAN = 2.3, CAMERA = 5.5;
    var BASE = { yaw: -0.5, pitch: -0.12, roll: -0.06 };
    var OUTLINE = "112,114,103", NODE = [53, 53, 47], BRAND = [164, 69, 42], GLOW = "217,157,130";

    var layers = [], nodes = [], edges = [], signals = [], ripples = [];
    RADII.forEach(function (r, l) {
      var ring = [];
      for (var i = 0; i < PER_RING; i++) {
        var n = { l: l, a: TAU * i / PER_RING, r: r, x: SPAN * (l / (RADII.length - 1) - 0.5), act: 0, out: [], vx: 0, vy: 0, vz: 0, px: 0, py: 0, d: 0 };
        ring.push(n); nodes.push(n);
      }
      layers.push(ring);
    });
    // Each neuron is laced to two neurons of the next ring, a few places either side:
    // the crossing threads trace hyperboloids, like a string sculpture.
    layers.slice(0, -1).forEach(function (ring, l) {
      ring.forEach(function (n, i) {
        [-LACE, LACE].forEach(function (o) {
          var e = { a: n, b: layers[l + 1][(i + o + PER_RING) % PER_RING], heat: 0 };
          n.out.push(e); edges.push(e);
        });
      });
    });
    var order = nodes.slice();
    function mix(a, b, u) { return a.map(function (c, i) { return Math.round(c + (b[i] - c) * u); }); }
    // Threads shade from sage at the input, through grey at the bottleneck, to terracotta at the output.
    var SAGE = [82, 116, 107], GREY = [112, 114, 103], CLAY = [158, 88, 64];
    var TINTS = layers.slice(0, -1).map(function (ring, l) {
      var t = 2 * l / (layers.length - 2);
      return (t < 1 ? mix(SAGE, GREY, t) : mix(GREY, CLAY, t - 1)).join(",");
    });

    // Camera: yaw about the vertical axis, then pitch, then roll in the picture plane.
    var cy, sy, cp, sp, cr, sr, k = 1, ox = 0, oy = 0, W = 0, H = 0;
    function aimCamera(yaw, pitch) {
      cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch);
      cr = Math.cos(BASE.roll); sr = Math.sin(BASE.roll);
    }
    function toView(x, y, z, o) {
      var x1 = x * cy + z * sy, z1 = z * cy - x * sy;
      var y1 = y * cp - z1 * sp;
      o.vx = x1 * cr - y1 * sr; o.vy = x1 * sr + y1 * cr; o.vz = y * sp + z1 * cp;
    }
    function toScreen(o) {
      var s = CAMERA / (CAMERA - o.vz);
      o.px = ox + o.vx * s * k; o.py = oy - o.vy * s * k;
    }
    // Scale the form to the canvas once per size; the rings keep their outline as they turn.
    function fit() {
      var p = {}, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      aimCamera(BASE.yaw, BASE.pitch);
      RADII.forEach(function (r, l) {
        for (var i = 0; i < 48; i++) {
          toView(SPAN * (l / (RADII.length - 1) - 0.5), r * Math.cos(TAU * i / 48), r * Math.sin(TAU * i / 48), p);
          var s = CAMERA / (CAMERA - p.vz);
          x0 = Math.min(x0, p.vx * s); x1 = Math.max(x1, p.vx * s);
          y0 = Math.min(y0, p.vy * s); y1 = Math.max(y1, p.vy * s);
        }
      });
      k = Math.min(W * 0.88 / (x1 - x0), H * 0.88 / (y1 - y0));
      ox = W / 2 - k * (x0 + x1) / 2; oy = H / 2 + k * (y0 + y1) / 2;
    }

    var clock = 0, nextWave = 0, look = { yaw: 0, pitch: 0 }, aim = { yaw: 0, pitch: 0 };
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
    function launch(e) { signals.push({ e: e, t: 0, dur: 0.75 + Math.random() * 0.45 }); }
    function step(dt) {
      clock += dt;
      if (clock >= nextWave) {
        nextWave = clock + 1.4 + Math.random() * 1.6;
        for (var i = 0, count = 2 + Math.floor(Math.random() * 3); i < count; i++) {
          var input = pick(layers[0]);
          input.act = 1; launch(pick(input.out));
        }
      }
      for (var j = signals.length - 1; j >= 0; j--) {
        var sg = signals[j];
        if ((sg.t += dt / sg.dur) < 1) continue;
        signals.splice(j, 1);
        var n = sg.e.b, merged = n.l <= MID && n.act > 0.6;
        sg.e.heat = 1; n.act = 1;
        if (!n.out.length) { ripples.push({ n: n, age: 0 }); continue; }
        if (merged) continue;
        launch(pick(n.out));
        if (n.l >= MID && signals.length < 48 && Math.random() < 0.5) launch(pick(n.out));
      }
      var fade = Math.exp(-dt / 0.55), cool = Math.exp(-dt / 1.1), follow = 1 - Math.exp(-dt * 2.2);
      nodes.forEach(function (n) { n.act *= fade; });
      edges.forEach(function (e) { e.heat *= cool; });
      ripples = ripples.filter(function (r) { return (r.age += dt) < 1.2; });
      look.yaw += (aim.yaw - look.yaw) * follow;
      look.pitch += (aim.pitch - look.pitch) * follow;
    }

    function ease(t) { return t * t * (3 - 2 * t); }
    var head = {}, tail = {};
    function along(e, t, o) {
      o.vx = e.a.vx + (e.b.vx - e.a.vx) * t;
      o.vy = e.a.vy + (e.b.vy - e.a.vy) * t;
      o.vz = e.a.vz + (e.b.vz - e.a.vz) * t;
      toScreen(o);
    }
    function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      aimCamera(BASE.yaw + look.yaw + 0.12 * Math.sin(clock * 0.09), BASE.pitch + look.pitch + 0.06 * Math.sin(clock * 0.07 + 1));
      var spin = clock * TAU / 70, z0 = Infinity, z1 = -Infinity;
      nodes.forEach(function (n) {
        var th = n.a + spin + 0.32 * Math.sin(clock * 0.3 + n.l * 0.8);
        toView(n.x, n.r * Math.cos(th), n.r * Math.sin(th), n);
        toScreen(n);
        z0 = Math.min(z0, n.vz); z1 = Math.max(z1, n.vz);
      });
      nodes.forEach(function (n) { n.d = (n.vz - z0) / (z1 - z0 || 1); });

      // A faint outline for each layer's ring.
      var p = {};
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(" + OUTLINE + ",.14)";
      ctx.beginPath();
      layers.forEach(function (ring) {
        for (var i = 0; i <= 64; i++) {
          toView(ring[0].x, ring[0].r * Math.cos(TAU * i / 64), ring[0].r * Math.sin(TAU * i / 64), p);
          toScreen(p);
          if (i) ctx.lineTo(p.px, p.py); else ctx.moveTo(p.px, p.py);
        }
      });
      ctx.stroke();

      // Threads, batched by layer and depth band: far ones fainter.
      var BANDS = 5, groups = [];
      edges.forEach(function (e) {
        var key = e.a.l * BANDS + Math.min(BANDS - 1, Math.floor((e.a.d + e.b.d) / 2 * BANDS));
        (groups[key] || (groups[key] = [])).push(e);
      });
      ctx.lineWidth = 0.6;
      groups.forEach(function (group, key) {
        ctx.strokeStyle = "rgba(" + TINTS[Math.floor(key / BANDS)] + "," + (0.05 + 0.2 * (key % BANDS) / (BANDS - 1)) + ")";
        ctx.beginPath();
        group.forEach(function (e) { ctx.moveTo(e.a.px, e.a.py); ctx.lineTo(e.b.px, e.b.py); });
        ctx.stroke();
      });
      // Threads that just carried a pulse keep a warm trace.
      edges.forEach(function (e) {
        if (e.heat < 0.02) return;
        ctx.strokeStyle = "rgba(" + BRAND + "," + (e.heat * 0.45) + ")";
        ctx.beginPath(); ctx.moveTo(e.a.px, e.a.py); ctx.lineTo(e.b.px, e.b.py); ctx.stroke();
      });

      // Neurons, far to near; active ones warm up and glow.
      order.sort(function (a, b) { return a.vz - b.vz; });
      order.forEach(function (n) {
        var r = (0.6 + 1.1 * n.d) * (1 + n.act), base = 0.2 + 0.55 * n.d;
        if (n.act > 0.03) { ctx.fillStyle = "rgba(" + GLOW + "," + (0.3 * n.act) + ")"; dot(n.px, n.py, r * 3.2); }
        ctx.fillStyle = "rgba(" + mix(NODE, BRAND, n.act) + "," + (base + (1 - base) * n.act) + ")";
        dot(n.px, n.py, r);
      });

      // Pulses with short fading tails.
      ctx.lineWidth = 1.4;
      signals.forEach(function (sg) {
        along(sg.e, ease(Math.max(0, sg.t - 0.32)), tail);
        along(sg.e, ease(sg.t), head);
        var g = ctx.createLinearGradient(tail.px, tail.py, head.px, head.py);
        g.addColorStop(0, "rgba(" + BRAND + ",0)");
        g.addColorStop(1, "rgba(" + BRAND + ",.9)");
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(tail.px, tail.py); ctx.lineTo(head.px, head.py); ctx.stroke();
        ctx.fillStyle = "rgba(" + GLOW + ",.35)"; dot(head.px, head.py, 4.5);
        ctx.fillStyle = "rgb(" + BRAND + ")"; dot(head.px, head.py, 1.8);
      });

      // Output neurons ring out when a pulse arrives.
      ctx.lineWidth = 0.8;
      ripples.forEach(function (rp) {
        var t = rp.age / 1.2;
        ctx.strokeStyle = "rgba(" + BRAND + "," + (0.4 * (1 - t)) + ")";
        ctx.beginPath(); ctx.arc(rp.n.px, rp.n.py, 2.5 + 9 * ease(t), 0, TAU); ctx.stroke();
      });
    }

    var running = false, paused = false, visible = true, raf = 0, last = 0;
    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      step(dt); draw();
      if (running) raf = requestAnimationFrame(frame);
    }
    function sync() {
      var go = visible && !paused && !reduceMotion;
      if (go === running) return;
      running = go;
      if (go) { last = 0; raf = requestAnimationFrame(frame); }
      else cancelAnimationFrame(raf);
    }
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!w || !h || (w === W && h === H)) return;
      W = w; H = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fit();
      if (!running) draw();
    }

    // Start mid-thought, so the first frame (and the reduced-motion still) is already alive.
    for (var i = 0; i < 180; i++) step(1 / 60);
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener("resize", resize);
    resize();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { visible = entries[entries.length - 1].isIntersecting; sync(); }).observe(canvas);
    }
    sync();

    // The form leans gently towards the pointer.
    var hero = figure.closest(".hero");
    if (hero && !reduceMotion && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        aim.yaw = ((e.clientX - r.left) / r.width - 0.5) * 0.24;
        aim.pitch = ((e.clientY - r.top) / r.height - 0.5) * 0.16;
      });
      hero.addEventListener("pointerleave", function () { aim.yaw = aim.pitch = 0; });
    }

    // Decorative animation has its own pause control.
    if (toggle) toggle.addEventListener("click", function () {
      paused = !paused;
      toggle.querySelector("path").setAttribute("d", paused ? "M7 4l8 6-8 6Z" : "M7 5v10M13 5v10");
      toggle.setAttribute("aria-label", (paused ? "Play" : "Pause") + " animated graphic");
      sync();
    });
  })();

  // ---------- Reveal on scroll ----------
  var reveals = document.querySelectorAll("[data-reveal]");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); ro.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    Array.prototype.forEach.call(reveals, function (n) { ro.observe(n); });
  } else {
    Array.prototype.forEach.call(reveals, function (n) { n.classList.add("is-visible"); });
  }

  // ---------- Sticky in-page navigation ----------
  var subnav = document.querySelector(".subnav");
  if (subnav && "IntersectionObserver" in window) {
    var sentinel = el("div");
    sentinel.style.height = "1px";
    subnav.parentNode.insertBefore(sentinel, subnav);
    new IntersectionObserver(function (entries) {
      subnav.classList.toggle("is-stuck", !entries[0].isIntersecting);
    }).observe(sentinel);
    var links = Array.prototype.slice.call(subnav.querySelectorAll(".subnav__list a"));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          links.forEach(function (a) { a.classList.remove("is-active"); a.removeAttribute("aria-current"); });
          map[e.target.id].classList.add("is-active");
          map[e.target.id].setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) so.observe(s); });
  }

  // ---------- LIBERO-Goal bars ----------
  // Per-task success (%), 50 episodes each, seed 0. Source: robot/panda-libero/results.
  var LIBERO_SERIES = [
    { key: "vla", name: "VLA (SmolVLM2-500M + LoRA)", color: "var(--series-1)" },
    { key: "bc", name: "Baseline (ResNet-FiLM, 27M)", color: "var(--series-2)" }
  ];
  var LIBERO = [
    { task: "Push the plate to the front of the stove", vla: 100, bc: 72 },
    { task: "Put the cream cheese in the bowl", vla: 78, bc: 68 },
    { task: "Put the wine bottle on the rack", vla: 90, bc: 82 },
    { task: "Put the bowl on the stove", vla: 100, bc: 94 },
    { task: "Put the bowl on the plate", vla: 96, bc: 90 },
    { task: "Put the bowl on top of the cabinet", vla: 98, bc: 94 },
    { task: "Turn on the stove", vla: 100, bc: 96 },
    { task: "Open the middle drawer of the cabinet", vla: 88, bc: 86 },
    { task: "Put the wine bottle on top of the cabinet", vla: 98, bc: 96 },
    { task: "Open the top drawer and put the bowl inside", vla: 62, bc: 72 }
  ];
  var libero = document.getElementById("libero-chart");
  if (libero) {
    var grid = libero.querySelector(".viz-grid");
    var rowsHost = libero.querySelector(".viz-rows");
    var tipL = Tooltip(grid);
    LIBERO.forEach(function (t) {
      var row = el("div", "viz-row");
      row.appendChild(el("div", "viz-label", t.task));
      var track = el("div", "viz-track");
      LIBERO_SERIES.forEach(function (s) {
        var bar = el("div", "viz-bar");
        bar.style.setProperty("--w", t[s.key] + "%");
        bar.style.setProperty("--c", s.color);
        bar.tabIndex = 0;
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", s.name + ", " + t.task + ": " + t[s.key] + "% success");
        bar._task = t;
        track.appendChild(bar);
      });
      row.appendChild(track);
      row.appendChild(el("div", "viz-delta", fmtDelta(t.vla - t.bc)));
      rowsHost.appendChild(row);
    });
    function showLibero(bar, cx, cy) {
      var t = bar._task;
      tipL.show(function (tip) {
        tip.appendChild(el("div", "tt-title", t.task));
        LIBERO_SERIES.forEach(function (s) { ttRow(tip, s.color, fmtPct(t[s.key]), s.name); });
      }, cx, cy, bar);
    }
    grid.addEventListener("pointermove", function (e) {
      var bar = e.target.closest && e.target.closest(".viz-bar");
      if (bar) showLibero(bar, e.clientX, e.clientY); else tipL.hide();
    });
    grid.addEventListener("pointerleave", tipL.hide);
    grid.addEventListener("focusin", function (e) { if (e.target.classList.contains("viz-bar")) showLibero(e.target); });
    grid.addEventListener("focusout", tipL.hide);
    var rows = LIBERO.map(function (t) { return [t.task, t.vla + "%", t.bc + "%", fmtDelta(t.vla - t.bc)]; });
    rows.push(["Mean (500 episodes)", "91.0%", "85.0%", "+6.0 pp"]);
    buildTable(libero.querySelector(".table-wrap"), ["Task", "VLA", "Baseline", "Δ"], rows);
  }

  // ---------- Before / after slider ----------
  Array.prototype.forEach.call(document.querySelectorAll(".compare"), function (cmp) {
    var input = cmp.querySelector("input[type=range]");
    if (!input) return;
    function update() { cmp.style.setProperty("--pos", input.value + "%"); }
    input.addEventListener("input", update);
    update();
  });

  // ---------- Videos: play when visible, respect reduced motion ----------
  var previews = document.querySelectorAll(".project-preview");
  var motionButton = document.querySelector(".preview-motion");
  var previewsPaused = !!reduceMotion;
  function updatePreviewMotion() {
    Array.prototype.forEach.call(previews, function (v) {
      v.dataset.motionPaused = String(previewsPaused);
      if (previewsPaused) v.pause();
      else { var play = v.play(); if (play && play.catch) play.catch(function () {}); }
    });
    if (motionButton) {
      motionButton.textContent = previewsPaused ? "Play previews ▷" : "Pause previews Ⅱ";
      motionButton.setAttribute("aria-label", (previewsPaused ? "Play" : "Pause") + " project video previews");
    }
  }
  if (motionButton) motionButton.addEventListener("click", function () { previewsPaused = !previewsPaused; updatePreviewMotion(); });
  updatePreviewMotion();
  var videos = document.querySelectorAll("video");
  if (reduceMotion) {
    Array.prototype.forEach.call(videos, function (v) { if (!v.classList.contains("project-preview")) v.controls = true; });
  } else if ("IntersectionObserver" in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && v.dataset.motionPaused !== "true") {
          if (v.preload === "none") v.preload = "auto";
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.35 });
    Array.prototype.forEach.call(videos, function (v) { vo.observe(v); });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
