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

  // ---------- Literature: reported AUROC (from the thesis, tables 3.1-3.2 and text) ----------
  var LIT = [
    { study: "Varatharajah et al.", year: 2018, marker: "HFOs, spikes and PAC ratios", model: "SVM (RBF)", soz: 0.79 },
    { study: "Akter et al.", year: 2020, marker: "Entropy of high-frequency sub-bands", model: "Sparse LDA", soz: 0.86, note: "8 patients" },
    { study: "Wang & Li", year: 2020, marker: "Phase-amplitude coupling patterns", model: "CNN", soz: 0.88 },
    { study: "Jiang et al.", year: 2022, marker: "Directional, cross-frequency connectivity", model: "Random forest", soz: 0.94, outcome: 0.93 },
    { study: "Miao et al.", year: 2023, marker: "Low-frequency to HFO coupling", model: "SVM, CNN", soz: 0.915 },
    { study: "Balaji & Parhi", year: 2024, marker: "Graph centrality of effective connectivity", model: "SVM, MLP", soz: 0.93 },
    { study: "Dimakopoulos et al.", year: 2024, marker: "Removal of the HFO area", model: "Automated HFO detector", outcome: 0.83 },
    { study: "Chen et al.", year: 2025, marker: "Causal influence index (transfer entropy)", model: "Random forest, logistic regression", soz: 0.90 },
    { study: "Ivankovic et al.", year: 2025, marker: "Connectivity at seizure onset", model: "SVM", outcome: 0.903 },
    { study: "Pilet et al.", year: 2025, marker: "AEC, PLV, graph measures, spikes, HFOs", model: "Gaussian SVM", soz: 0.91 },
    { study: "Partamian et al.", year: 2025, marker: "DMD spectral power, theta band", model: "DMD + NNMF; SVM", soz: 0.74, outcome: 0.85 }
  ];
  var litFig = document.getElementById("lit-chart");
  if (litFig) {
    var litHost = litFig.querySelector(".lit-host");
    var tipLit = Tooltip(litHost);
    var X0 = 0.7, X1 = 1.0;
    responsive(litHost, function (W) {
      var old = litHost.querySelector("svg"); if (old) old.remove();
      var stacked = W < 520;
      var labelW = stacked ? 0 : Math.max(150, Math.min(250, W * 0.46));
      var right = 18, top = 8, rowH = stacked ? 54 : 44, axisH = 30;
      var plotW = Math.max(120, W - labelW - right - (stacked ? 8 : 0));
      var H = top + LIT.length * rowH + axisH;
      var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "viz-svg", role: "img",
        "aria-label": "Dot plot of AUROC values reported by eleven studies between 2018 and 2025, from 0.74 to 0.94" });
      function x(v) { return labelW + (stacked ? 8 : 0) + (v - X0) / (X1 - X0) * plotW; }
      [0.7, 0.8, 0.9, 1.0].forEach(function (t, i) {
        s.appendChild(svg("line", { class: "grid", x1: x(t), x2: x(t), y1: top, y2: top + LIT.length * rowH }));
        var tx = svg("text", { class: "tick", x: x(t), y: H - 8, "text-anchor": i === 0 ? "start" : (i === 3 ? "end" : "middle") }, t.toFixed(2));
        s.appendChild(tx);
      });
      LIT.forEach(function (d, i) {
        var cy = stacked ? top + i * rowH + 36 : top + i * rowH + rowH / 2;
        if (stacked) {
          s.appendChild(svg("text", { class: "row-label", x: 0, y: top + i * rowH + 16 }, d.study + " " + d.year));
        } else {
          s.appendChild(svg("text", { class: "row-label", x: 0, y: cy - 3 }, d.study + " " + d.year));
          var maxc = Math.max(12, Math.floor((labelW - 14) / 6.5));
          var sub = d.marker.length > maxc ? d.marker.slice(0, maxc - 1).replace(/[ ,]+$/, "") + "…" : d.marker;
          s.appendChild(svg("text", { class: "row-sub", x: 0, y: cy + 14 }, sub));
        }
        if (d.soz != null && d.outcome != null) {
          s.appendChild(svg("line", { class: "link", x1: x(d.soz), x2: x(d.outcome), y1: cy, y2: cy }));
        }
        [["soz", "Onset-zone localisation", "var(--series-1)"], ["outcome", "Surgical outcome", "var(--series-2)"]].forEach(function (k) {
          var v = d[k[0]];
          if (v == null) return;
          var cx = x(v);
          var mark = k[0] === "soz"
            ? svg("circle", { class: "mark", cx: cx, cy: cy, r: 6.5, fill: k[2] })
            : svg("rect", { class: "mark", x: cx - 6, y: cy - 6, width: 12, height: 12, rx: 2, fill: k[2], transform: "rotate(45 " + cx + " " + cy + ")" });
          s.appendChild(mark);
          var hit = svg("circle", { class: "hit", cx: cx, cy: cy, r: 14, tabindex: 0, role: "img",
            "aria-label": d.study + " " + d.year + ", " + k[1] + ": AUROC " + v.toFixed(v * 1000 % 10 ? 3 : 2) });
          hit._d = d; hit._k = k; hit._v = v;
          s.appendChild(hit);
        });
      });
      litHost.insertBefore(s, litHost.firstChild);
    });
    function showLit(hit, cx, cy) {
      var d = hit._d, k = hit._k, v = hit._v;
      tipLit.show(function (tip) {
        tip.appendChild(el("div", "tt-title", d.study + " (" + d.year + ")"));
        ttRow(tip, k[2], "AUROC " + v.toFixed(v * 1000 % 10 ? 3 : 2), k[1]);
        tip.appendChild(el("div", "tt-name", d.marker + " · " + d.model + (d.note ? " · " + d.note : "")));
      }, cx, cy, hit);
    }
    litHost.addEventListener("pointermove", function (e) {
      if (e.target._d) showLit(e.target, e.clientX, e.clientY); else tipLit.hide();
    });
    litHost.addEventListener("pointerleave", tipLit.hide);
    litHost.addEventListener("focusin", function (e) { if (e.target._d) showLit(e.target); });
    litHost.addEventListener("focusout", tipLit.hide);
    buildTable(litFig.querySelector(".table-wrap"), ["Study", "Year", "Biomarker", "Model", "Onset zone", "Outcome"],
      LIT.map(function (d) {
        return [d.study, String(d.year), d.marker, d.model, d.soz != null ? String(d.soz) : "–", d.outcome != null ? String(d.outcome) : "–"];
      }));
  }

  // ---------- Literature: biomarker x model map (19 studies, thesis tables 3.1-3.2) ----------
  var MAP_ROWS = ["Functional connectivity", "Directed connectivity", "Phase-amplitude coupling", "High-frequency oscillations", "Spikes and ictal patterns", "Spectral and entropy", "Evoked responses"];
  var MAP_COLS = ["SVM", "Linear & tree", "Deep learning"];
  var MAP = [
    [["Antony 2013", "Ivankovic 2025", "Pilet 2025"], [], []],
    [["Johnson 2023", "Balaji & Parhi 2024"], ["Jiang 2022", "Chen 2025"], ["Balaji & Parhi 2024", "Wang 2024"]],
    [["Varatharajah 2018", "Miao 2023"], ["Elahian 2017"], ["Wang & Li 2020", "Miao 2023"]],
    [["Varatharajah 2018", "Lai 2020", "Pilet 2025"], ["Besheli 2022"], []],
    [["Grinenko 2018", "Varatharajah 2018", "Pilet 2025"], [], []],
    [["Zhao 2023", "Partamian 2025"], ["Partamian 2025"], ["Zhao 2023", "Yan 2024"]],
    [[], [], ["Johnson 2022", "Yan 2024"]]
  ];
  var ORDINAL = ["#86b6ef", "#3987e5", "#184f95"];
  var mapFig = document.getElementById("map-chart");
  if (mapFig) {
    var mapHost = mapFig.querySelector(".map-host");
    var tipM = Tooltip(mapHost);
    responsive(mapHost, function (W) {
      var old = mapHost.querySelector("svg"); if (old) old.remove();
      var narrow = W < 560;
      var labelW = narrow ? Math.max(130, W * 0.43) : Math.max(130, Math.min(210, W * 0.42));
      var cellW = Math.max(52, (W - labelW) / MAP_COLS.length);
      var twoLine = cellW < 112;
      var headH = twoLine ? 52 : 34, gap = 2;
      var cellH = narrow ? 52 : 46;
      var H = headH + MAP_ROWS.length * cellH + 4;
      var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "viz-svg", role: "img",
        "aria-label": "Heatmap counting studies per biomarker family and model family" });
      function lines(text, max) {
        var words = text.split(" "), out = [], cur = "";
        words.forEach(function (w) {
          if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else { cur = cur ? cur + " " + w : w; }
        });
        if (cur) out.push(cur);
        return out;
      }
      function multiText(cls, x, y, parts, anchor, lh) {
        var tx = svg("text", { class: cls, x: x, y: y, "text-anchor": anchor || "start" });
        parts.forEach(function (p, k) { tx.appendChild(svg("tspan", { x: x, dy: k ? lh : 0 }, p)); });
        return tx;
      }
      MAP_COLS.forEach(function (c, j) {
        var parts = twoLine ? lines(c, 8) : [c];
        s.appendChild(multiText("group-label", labelW + j * cellW + cellW / 2, parts.length > 1 ? 18 : (twoLine ? 36 : 20), parts, "middle", 17));
      });
      MAP_ROWS.forEach(function (r, i) {
        var y = headH + i * cellH;
        var rparts = narrow ? lines(r, Math.max(10, Math.floor(labelW / 8.4))) : [r];
        s.appendChild(multiText("row-label", 0, y + cellH / 2 + 5 - (rparts.length - 1) * 8.5, rparts, "start", 17));
        MAP_COLS.forEach(function (c, j) {
          var studies = MAP[i][j], n = studies.length;
          var x = labelW + j * cellW;
          var fill = n ? ORDINAL[Math.min(n, 3) - 1] : cssVar("--cool-100") || "#f1f5f9";
          s.appendChild(svg("rect", { class: "cell", x: x + gap / 2, y: y + gap / 2, width: cellW - gap, height: cellH - gap, rx: 6, fill: fill }));
          var txt = svg("text", { class: "cell-num", x: x + cellW / 2, y: y + cellH / 2 + 5, "text-anchor": "middle",
            style: "fill:" + (n >= 2 ? "#ffffff" : (n === 1 ? "#0f172a" : "#64748b")) }, n ? String(n) : "–");
          s.appendChild(txt);
          var hit = svg("rect", { class: "hit", x: x, y: y, width: cellW, height: cellH, tabindex: 0, role: "img",
            "aria-label": r + " with " + c + ": " + n + (n === 1 ? " study" : " studies") + (n ? " (" + studies.join(", ") + ")" : "") });
          hit._m = { r: r, c: c, studies: studies };
          s.appendChild(hit);
        });
      });
      mapHost.insertBefore(s, mapHost.firstChild);
    });
    function showMap(hit, cx, cy) {
      var m = hit._m;
      tipM.show(function (tip) {
        tip.appendChild(el("div", "tt-title", m.r + " · " + m.c));
        ttRow(tip, null, m.studies.length + (m.studies.length === 1 ? " study" : " studies"), "");
        if (m.studies.length) tip.appendChild(el("div", "tt-name", m.studies.join(", ")));
      }, cx, cy, hit);
    }
    mapHost.addEventListener("pointermove", function (e) { if (e.target._m) showMap(e.target, e.clientX, e.clientY); else tipM.hide(); });
    mapHost.addEventListener("pointerleave", tipM.hide);
    mapHost.addEventListener("focusin", function (e) { if (e.target._m) showMap(e.target); });
    mapHost.addEventListener("focusout", tipM.hide);
    buildTable(mapFig.querySelector(".table-wrap"), ["Biomarker family"].concat(MAP_COLS),
      MAP_ROWS.map(function (r, i) {
        return [r].concat(MAP[i].map(function (st) { return st.length ? st.length + " (" + st.join(", ") + ")" : "–"; }));
      }));
  }

  // ---------- Decoder heatmap: the iEEG pipeline on its synthetic test cohort ----------
  var RAMP = ["#eef4fd", "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  var RAMP_RGB = RAMP.map(hexToRgb);
  function rampColor(v) {
    v = Math.max(0, Math.min(1, v));
    var p = v * (RAMP_RGB.length - 1), i = Math.min(Math.floor(p), RAMP_RGB.length - 2), f = p - i;
    var a = RAMP_RGB[i], b = RAMP_RGB[i + 1];
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," + Math.round(a[1] + (b[1] - a[1]) * f) + "," + Math.round(a[2] + (b[2] - a[2]) * f) + ")";
  }
  var decFig = document.getElementById("decoder-chart");
  if (decFig) {
    var decHost = decFig.querySelector(".decoder-host");
    var tipD = Tooltip(decHost);
    fetch("assets/data/decoder_demo.json").then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (D) {
      var empty = decHost.querySelector(".viz-empty"); if (empty) empty.remove();
      var N = D.contacts.length, T = D.times.length, F = (D.families || []).length;
      responsive(decHost, function (W) {
        var old = decHost.querySelector("svg"); if (old) old.remove();
        var labelW = 64, gapMid = F ? 22 : 0, famW = F ? Math.min(46, Math.max(26, W * 0.06)) : 0;
        var headH = F ? 74 : 12, axisH = 44;
        var mainW = Math.max(160, W - labelW - gapMid - famW * F - 6);
        var rowH = Math.max(9, Math.min(16, 460 / N));
        var H = headH + N * rowH + axisH;
        var cw = mainW / T;
        var t0 = D.times[0], t1 = D.times[T - 1];
        var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "viz-svg", role: "img",
          "aria-label": "Heatmap of per-contact scores over time around a synthetic seizure onset, with planted onset-zone contacts marked" });
        function xt(t) { return labelW + (t - t0) / (t1 - t0 || 1) * (mainW - cw) + cw / 2; }
        // time matrix
        var g = svg("g");
        for (var i = 0; i < N; i++) {
          var y = headH + i * rowH;
          for (var j = 0; j < T; j++) {
            g.appendChild(svg("rect", { x: labelW + j * cw, y: y, width: cw + 0.6, height: rowH - (rowH > 11 ? 1 : 0), fill: rampColor(D.time_matrix[i][j]) }));
          }
          var lab = svg("text", { class: "row-label", x: labelW - 8, y: y + rowH / 2 + 4, "text-anchor": "end", style: "font-size:" + Math.min(13, rowH - 1) + "px" }, D.contacts[i]);
          s.appendChild(lab);
          if (D.soz[i]) {
            var cy = y + rowH / 2, cx = 7, a = Math.min(5, rowH / 2 - 1);
            s.appendChild(svg("rect", { class: "soz-mark", x: cx - a, y: cy - 1.2, width: 2 * a, height: 2.4 }));
            s.appendChild(svg("rect", { class: "soz-mark", x: cx - 1.2, y: cy - a, width: 2.4, height: 2 * a }));
          }
        }
        s.appendChild(g);
        // onset line
        if (t0 <= 0 && t1 >= 0) {
          s.appendChild(svg("line", { class: "onset", x1: xt(0), x2: xt(0), y1: headH - 6, y2: headH + N * rowH }));
          s.appendChild(svg("text", { class: "tick", x: xt(0) + 5, y: headH - 8 }, "onset"));
        }
        // family columns
        if (F) {
          var fx0 = labelW + mainW + gapMid;
          D.families.forEach(function (f, k) {
            var fx = fx0 + k * famW;
            var tl = svg("text", { class: "tick", x: 0, y: 0, transform: "translate(" + (fx + famW / 2 + 4) + "," + (headH - 8) + ") rotate(-55)" }, f);
            s.appendChild(tl);
            for (var i2 = 0; i2 < N; i2++) {
              s.appendChild(svg("rect", { x: fx + 1, y: headH + i2 * rowH, width: famW - 2, height: rowH - (rowH > 11 ? 1 : 0), fill: rampColor(D.family_scores[i2][k]) }));
            }
          });
        }
        // time axis
        var span = t1 - t0, step = span > 60 ? 20 : (span > 24 ? 10 : 5);
        for (var t = Math.ceil(t0 / step) * step; t <= t1 + 1e-9; t += step) {
          s.appendChild(svg("text", { class: "tick", x: xt(t), y: headH + N * rowH + 18, "text-anchor": "middle" }, String(Math.round(t))));
        }
        s.appendChild(svg("text", { class: "tick", x: labelW + mainW / 2, y: H - 4, "text-anchor": "middle" }, "time from onset (s)"));
        // hit layer: one transparent rect over the whole plot, cell found from the pointer
        var hit = svg("rect", { class: "hit", x: labelW, y: headH, width: mainW + gapMid + famW * F, height: N * rowH, tabindex: 0,
          "aria-label": "Heatmap cells. Use the table below for values." });
        hit._geo = { labelW: labelW, headH: headH, rowH: rowH, cw: cw, mainW: mainW, gapMid: gapMid, famW: famW };
        s.appendChild(hit);
        decHost.insertBefore(s, decHost.firstChild);
      });
      decHost.addEventListener("pointermove", function (e) {
        var h = e.target._geo;
        if (!h) { tipD.hide(); return; }
        var r = e.target.getBoundingClientRect();
        var px = e.clientX - r.left, py = e.clientY - r.top;
        var i = Math.floor(py / h.rowH);
        if (i < 0 || i >= N) { tipD.hide(); return; }
        if (px < h.mainW) {
          var j = Math.min(T - 1, Math.max(0, Math.floor(px / h.cw)));
          tipD.show(function (tip) {
            tip.appendChild(el("div", "tt-title", D.contacts[i] + (D.soz[i] ? " · planted onset zone" : "")));
            ttRow(tip, rampColor(D.time_matrix[i][j]), D.time_matrix[i][j].toFixed(2), "score at t = " + D.times[j].toFixed(1) + " s");
          }, e.clientX, e.clientY);
        } else if (F && px > h.mainW + h.gapMid) {
          var k = Math.min(F - 1, Math.floor((px - h.mainW - h.gapMid) / h.famW));
          tipD.show(function (tip) {
            tip.appendChild(el("div", "tt-title", D.contacts[i] + (D.soz[i] ? " · planted onset zone" : "")));
            ttRow(tip, rampColor(D.family_scores[i][k]), D.family_scores[i][k].toFixed(2), D.families[k]);
          }, e.clientX, e.clientY);
        } else tipD.hide();
      });
      decHost.addEventListener("pointerleave", tipD.hide);
      var note = decFig.querySelector(".decoder-note");
      if (note && D.caption) note.textContent = D.caption;
      if (D.legend !== false) {
        var lg = el("ul", "legend");
        lg.style.marginTop = "1rem";
        var li1 = el("li"); var sc = el("span", "scale"); sc.appendChild(el("span", null, "0")); sc.appendChild(el("span", "scale__bar")); sc.appendChild(el("span", null, "1 (within recording)")); li1.appendChild(sc); lg.appendChild(li1);
        var li2 = el("li"); li2.appendChild(el("span", "sw sw--plus")); li2.appendChild(document.createTextNode("planted onset-zone contact")); lg.appendChild(li2);
        var li3 = el("li"); li3.appendChild(el("span", "sw sw--line")); li3.appendChild(document.createTextNode("seizure onset")); lg.appendChild(li3);
        decFig.insertBefore(lg, note);
      }
      if (D.table_rows && D.table_headers) {
        var det = el("details", "viz-table"); det.appendChild(el("summary", null, "Show as a table"));
        var tw = el("div", "table-wrap"); det.appendChild(tw); decFig.appendChild(det);
        buildTable(tw, D.table_headers, D.table_rows);
      }
    }).catch(function () {
      var card = document.getElementById("decoder-card");
      if (card) card.hidden = true;
    });
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
  var videos = document.querySelectorAll("video");
  if (reduceMotion) {
    Array.prototype.forEach.call(videos, function (v) { v.controls = true; });
  } else if ("IntersectionObserver" in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
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
