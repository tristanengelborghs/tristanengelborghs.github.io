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

  // Decorative hero graphic has an independent pause control.
  var signalToggle = document.querySelector(".signal-toggle");
  if (signalToggle) signalToggle.addEventListener("click", function () {
    var paused = document.querySelector(".hero-network").classList.toggle("is-paused");
    signalToggle.textContent = paused ? "Play animation ▷" : "Pause animation Ⅱ";
    signalToggle.setAttribute("aria-label", (paused ? "Play" : "Pause") + " animated graphic");
  });

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
