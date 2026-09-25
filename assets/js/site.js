(function () {
  "use strict";

  var root = document.documentElement;
  var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function effectiveTheme() {
    var set = root.getAttribute("data-theme");
    if (set === "light" || set === "dark") return set;
    return darkQuery && darkQuery.matches ? "dark" : "light";
  }

  // ---------- Theme toggle ----------
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
    });
  }

  // ---------- LIBERO-Goal chart ----------
  // Per-task success (%), 50 episodes each, seed 0. Source: robot/panda-libero/results.
  var SERIES = [
    { key: "vla", name: "VLA (SmolVLM2-500M + LoRA)", color: "var(--series-1)" },
    { key: "bc", name: "Baseline (ResNet-FiLM, 27M)", color: "var(--series-2)" }
  ];
  var TASKS = [
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

  function fmtDelta(d) {
    if (d > 0) return "+" + d + " pp";
    if (d < 0) return "−" + Math.abs(d) + " pp";
    return "0 pp";
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var chart = document.getElementById("libero-chart");
  if (chart) {
    var rowsHost = chart.querySelector(".viz-rows");
    var grid = chart.querySelector(".viz-grid");
    var tip = chart.querySelector(".viz-tooltip");

    TASKS.forEach(function (t) {
      var row = el("div", "viz-row");
      row.appendChild(el("div", "viz-label", t.task));
      var track = el("div", "viz-track");
      SERIES.forEach(function (s) {
        var bar = el("div", "viz-bar");
        bar.style.setProperty("--w", t[s.key] + "%");
        bar.style.setProperty("--c", s.color);
        bar.tabIndex = 0;
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", s.name + ", " + t.task + ": " + t[s.key] + "% success");
        bar.dataset.task = t.task;
        bar.dataset.series = s.key;
        track.appendChild(bar);
      });
      row.appendChild(track);
      row.appendChild(el("div", "viz-delta", fmtDelta(t.vla - t.bc)));
      rowsHost.appendChild(row);
    });

    function showTip(bar, clientX, clientY) {
      var t = TASKS.filter(function (x) { return x.task === bar.dataset.task; })[0];
      if (!t) return;
      tip.textContent = "";
      tip.appendChild(el("div", "tt-task", t.task));
      SERIES.forEach(function (s) {
        var r = el("div", "tt-row");
        var key = el("span", "tt-key");
        key.style.background = s.color;
        r.appendChild(key);
        r.appendChild(el("span", "tt-val", t[s.key] + "%"));
        r.appendChild(el("span", "tt-name", s.name));
        tip.appendChild(r);
      });
      var g = grid.getBoundingClientRect();
      var b = bar.getBoundingClientRect();
      var x = clientX != null ? clientX - g.left : b.right - g.left;
      var y = (clientY != null ? clientY : b.top) - g.top;
      tip.classList.add("show");
      var w = tip.offsetWidth;
      var h = tip.offsetHeight;
      var left = Math.min(Math.max(x + 14, 0), g.width - w);
      var top = y - h - 12;
      if (top < 0) top = y + 18;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }

    function hideTip() {
      tip.classList.remove("show");
    }

    grid.addEventListener("pointermove", function (e) {
      var bar = e.target.closest ? e.target.closest(".viz-bar") : null;
      if (bar) showTip(bar, e.clientX, e.clientY);
      else hideTip();
    });
    grid.addEventListener("pointerleave", hideTip);
    grid.addEventListener("focusin", function (e) {
      if (e.target.classList.contains("viz-bar")) showTip(e.target);
    });
    grid.addEventListener("focusout", hideTip);

    // Table view: the same numbers, reachable without hovering.
    var tableHost = chart.querySelector(".table-wrap");
    var table = document.createElement("table");
    var thead = table.createTHead();
    var hr = thead.insertRow();
    ["Task", "VLA", "Baseline", "Δ"].forEach(function (h) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      hr.appendChild(th);
    });
    var tbody = table.createTBody();
    TASKS.forEach(function (t) {
      var r = tbody.insertRow();
      [t.task, t.vla + "%", t.bc + "%", fmtDelta(t.vla - t.bc)].forEach(function (v, i) {
        var c = i === 0 ? document.createElement("th") : document.createElement("td");
        if (i === 0) c.scope = "row";
        c.textContent = v;
        r.appendChild(c);
      });
    });
    var tf = table.createTFoot().insertRow();
    ["Mean (500 episodes)", "91.0%", "85.0%", "+6.0 pp"].forEach(function (v, i) {
      var c = i === 0 ? document.createElement("th") : document.createElement("td");
      if (i === 0) c.scope = "row";
      c.textContent = v;
      tf.appendChild(c);
    });
    tableHost.appendChild(table);
  }

  // ---------- Before / after slider ----------
  Array.prototype.forEach.call(document.querySelectorAll(".compare"), function (cmp) {
    var input = cmp.querySelector("input[type=range]");
    if (!input) return;
    function update() {
      cmp.style.setProperty("--pos", input.value + "%");
    }
    input.addEventListener("input", update);
    update();
  });

  // ---------- Videos: play when visible, respect reduced motion ----------
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var videos = document.querySelectorAll("video");
  if (reduce) {
    Array.prototype.forEach.call(videos, function (v) {
      v.controls = true;
    });
  } else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
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
      },
      { threshold: 0.35 }
    );
    Array.prototype.forEach.call(videos, function (v) {
      io.observe(v);
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
