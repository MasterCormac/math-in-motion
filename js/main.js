/* =========================================================================
 * main.js — renderer, animation engine and UI wiring.
 *
 * Pipeline:
 *   input (preset name OR "x(t); y(t)")  ->  sample to N raw points
 *   -> normalize into canvas coordinates -> morph (smooth transition)
 *   -> render in one of two modes:
 *        TRACE   : a glowing comet sweeps the curve, leaving a neon trail
 *        FOURIER : DFT epicycles — circles on circles redraw the curve
 * ========================================================================= */
(function () {
  "use strict";

  var SAMPLES = 480;          // points per curve (fixed so morphing is trivial)
  var MORPH_MS = 1600;        // transition duration between curves
  var FOURIER_TERMS = 60;     // epicycles used in Fourier mode

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");

  var input = document.getElementById("formula-input");
  var renderBtn = document.getElementById("render-btn");
  var errorBox = document.getElementById("error-msg");
  var chipsBox = document.getElementById("chips");
  var infoName = document.getElementById("info-name");
  var infoFormula = document.getElementById("info-formula");
  var infoStory = document.getElementById("info-story");
  var modeTraceBtn = document.getElementById("mode-trace");
  var modeFourierBtn = document.getElementById("mode-fourier");

  /* ---------------- state ---------------- */
  var state = {
    mode: "trace",            // "trace" | "fourier"
    rawPoints: [],            // math-space points of the current curve
    current: [],              // canvas-space points actually displayed
    target: null,             // canvas-space points we are morphing toward
    morphStart: 0,
    morphFrom: [],
    hue: 320,                 // base hue, drifts slowly
    traceHead: 0,             // index of the comet head along the curve
    trail: [],                // recent head positions for the neon trail
    curveInfo: null,          // { name, formula, story }
    fourier: new window.Fourier.EpicycleRenderer(),
    fourierDirty: true,
    stars: []
  };

  /* ---------------- canvas sizing ---------------- */
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.fourierDirty = true;
    makeStars();
  }
  window.addEventListener("resize", resize);

  function makeStars() {
    state.stars = [];
    var n = Math.floor((window.innerWidth * window.innerHeight) / 16000);
    for (var i = 0; i < n; i++) {
      state.stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  /* ---------------- geometry helpers ---------------- */

  /** Sample a parametric fn over [a, b] into SAMPLES raw points. */
  function sampleCurve(fn, range) {
    var pts = [];
    var a = range[0], b = range[1];
    for (var i = 0; i < SAMPLES; i++) {
      var t = a + ((b - a) * i) / (SAMPLES - 1);
      var v = fn(t);
      if (!isFinite(v[0]) || !isFinite(v[1])) {
        throw new Error("The formula produced non-finite values in its range — try a different one.");
      }
      pts.push({ x: v[0], y: v[1] });
    }
    return pts;
  }

  /** Fit raw math points into the canvas (centered, y flipped). */
  function normalize(raw) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    var spanX = Math.max(maxX - minX, 1e-9);
    var spanY = Math.max(maxY - minY, 1e-9);

    // leave room for the control card at the top; the curve lives below it
    var W = window.innerWidth, H = window.innerHeight;
    var availW = W * 0.62;
    var availH = H * 0.44;
    var scale = Math.min(availW / spanX, availH / spanY);
    var cx = W / 2;
    var cy = H * 0.64;

    var midX = (minX + maxX) / 2;
    var midY = (minY + maxY) / 2;

    var out = new Array(raw.length);
    for (var j = 0; j < raw.length; j++) {
      out[j] = {
        x: cx + (raw[j].x - midX) * scale,
        y: cy - (raw[j].y - midY) * scale // flip y: math up == screen up
      };
    }
    return out;
  }

  function easeInOutCubic(u) {
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  }

  /* ---------------- curve switching ---------------- */

  function setCurve(raw, info) {
    state.rawPoints = raw;
    state.curveInfo = info;
    state.target = normalize(raw);
    state.morphFrom = state.current.length === SAMPLES
      ? state.current.map(function (p) { return { x: p.x, y: p.y }; })
      : null;
    state.morphStart = performance.now();
    if (!state.morphFrom) {
      state.current = state.target;
      state.target = null;
    }
    state.trail = [];
    state.fourierDirty = true;

    infoName.textContent = info.name;
    infoFormula.textContent = info.formula;
    infoStory.textContent = info.story;

    // highlight the matching chip
    var chips = chipsBox.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle("active", chips[i].dataset.id === info.id);
    }
  }

  /* ---------------- input handling ---------------- */

  function showError(msg) { errorBox.textContent = msg || ""; }

  function handleInput() {
    var text = input.value.trim();
    if (!text) { showError(""); return; }
    showError("");

    // 1) preset by name?
    var preset = window.findPreset(text);
    if (preset) {
      setCurve(sampleCurve(preset.fn, preset.range), preset);
      return;
    }

    // 2) custom parametric pair  "x(t) ; y(t)"  with optional "| a, b" range
    var range = [0, 2 * Math.PI];
    var body = text;
    var barIdx = text.indexOf("|");
    if (barIdx !== -1) {
      body = text.slice(0, barIdx).trim();
      var parts = text.slice(barIdx + 1).split(",");
      if (parts.length === 2) {
        var ra = parseFloat(parts[0]), rb = parseFloat(parts[1]);
        if (isFinite(ra) && isFinite(rb) && rb > ra) range = [ra, rb];
      }
    }

    var semi = body.indexOf(";");
    if (semi === -1) {
      showError("Unknown preset. Type a name like ‘heart’, or a parametric pair:  x(t) ; y(t)");
      return;
    }

    try {
      var fx = window.MathParser.compile(body.slice(0, semi).trim());
      var fy = window.MathParser.compile(body.slice(semi + 1).trim());
      var fn = function (t) { return [fx(t), fy(t)]; };
      var raw = sampleCurve(fn, range);
      setCurve(raw, {
        id: "__custom__",
        name: "Custom Parametric Curve",
        formula: "x(t) = " + body.slice(0, semi).trim() + "  ,  y(t) = " + body.slice(semi + 1).trim() +
                 "  ,  t ∈ [" + range[0].toFixed(2) + ", " + range[1].toFixed(2) + "]",
        story: "Your own formula, compiled by a tiny shunting-yard parser (no eval!) and drawn " +
               "point by point. Switch to Fourier Mode to see how many spinning circles your " +
               "idea is secretly made of."
      });
    } catch (err) {
      showError(err.message);
    }
  }

  renderBtn.addEventListener("click", handleInput);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleInput();
  });

  /* ---------------- chips ---------------- */

  window.PRESETS.forEach(function (p) {
    var chip = document.createElement("span");
    chip.className = "chip";
    chip.dataset.id = p.id;
    chip.textContent = p.name.split("(")[0].trim();
    chip.addEventListener("click", function () {
      input.value = p.id;
      handleInput();
    });
    chipsBox.appendChild(chip);
  });

  /* ---------------- mode toggle ---------------- */

  function setMode(mode) {
    state.mode = mode;
    modeTraceBtn.classList.toggle("active", mode === "trace");
    modeFourierBtn.classList.toggle("active", mode === "fourier");
    state.fourierDirty = true;
  }
  modeTraceBtn.addEventListener("click", function () { setMode("trace"); });
  modeFourierBtn.addEventListener("click", function () { setMode("fourier"); });

  /* ---------------- renderers ---------------- */

  function drawBackground(now) {
    var W = window.innerWidth, H = window.innerHeight;
    var g = ctx.createRadialGradient(W / 2, H * 0.62, 60, W / 2, H * 0.62, Math.max(W, H) * 0.75);
    g.addColorStop(0, "#10142a");
    g.addColorStop(1, "#070912");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    for (var i = 0; i < state.stars.length; i++) {
      var s = state.stars[i];
      var tw = 0.35 + 0.3 * Math.sin(now / 900 + s.tw);
      ctx.fillStyle = "rgba(180, 195, 255, " + tw.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** TRACE mode: comet + fading neon trail along the displayed points. */
  function drawTrace(points) {
    if (!points || points.length < 2) return;

    // faint full silhouette so the whole shape is always readable
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.strokeStyle = "hsla(" + state.hue + ", 60%, 60%, 0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // advance the comet
    state.traceHead = (state.traceHead + 1.6) % points.length;
    var idx = Math.floor(state.traceHead);
    var head = points[idx];
    state.trail.push({ x: head.x, y: head.y });
    if (state.trail.length > 160) state.trail.shift();

    // neon trail
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var j = 1; j < state.trail.length; j++) {
      var u = j / state.trail.length;
      var hue = (state.hue + u * 90) % 360;
      ctx.strokeStyle = "hsla(" + hue + ", 95%, " + (45 + u * 20) + "%, " + (u * 0.95) + ")";
      ctx.lineWidth = 0.8 + u * 3.2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "hsla(" + hue + ", 95%, 60%, 0.9)";
      ctx.beginPath();
      ctx.moveTo(state.trail[j - 1].x, state.trail[j - 1].y);
      ctx.lineTo(state.trail[j].x, state.trail[j].y);
      ctx.stroke();
    }
    ctx.restore();

    // comet head
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 24;
    ctx.shadowColor = "hsl(" + state.hue + ", 100%, 70%)";
    ctx.beginPath();
    ctx.arc(head.x, head.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- main loop ---------------- */

  var lastTime = performance.now();

  function frame(now) {
    var dt = Math.min(now - lastTime, 50);
    lastTime = now;
    state.hue = (state.hue + dt * 0.012) % 360;

    drawBackground(now);

    // morph interpolation
    var points = state.current;
    if (state.target) {
      var u = Math.min((now - state.morphStart) / MORPH_MS, 1);
      var e = easeInOutCubic(u);
      for (var i = 0; i < SAMPLES; i++) {
        var a = state.morphFrom[i], b = state.target[i];
        state.current[i] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      }
      if (u >= 1) {
        state.current = state.target;
        state.target = null;
        state.fourierDirty = true;
      }
      points = state.current;
    }

    if (state.mode === "trace") {
      drawTrace(points);
    } else {
      if (state.fourierDirty) {
        state.fourier.setPath(points, FOURIER_TERMS);
        state.fourierDirty = false;
      }
      state.fourier.frame(ctx, state.hue);
    }

    requestAnimationFrame(frame);
  }

  /* ---------------- boot ---------------- */

  resize();
  var heart = window.findPreset("heart");
  setCurve(sampleCurve(heart.fn, heart.range), heart);
  input.value = "heart";
  requestAnimationFrame(frame);
})();
