/* =========================================================================
 * fourier.js — Discrete Fourier Transform + epicycle engine.
 *
 * Any closed curve can be approximated by a sum of rotating circles
 * (the geometric face of the Fourier series):
 *
 *        f(t) ≈ Σ  A_k · e^{i(ω_k t + φ_k)}
 *
 * Here we sample a path as complex numbers, run a DFT, keep the strongest
 * terms, and let each term spin one circle on the tip of the previous one.
 * ========================================================================= */
(function () {
  "use strict";

  /**
   * dft(points) — points: [{x, y}, ...] (complex plane samples).
   * Returns coefficients sorted by amplitude, largest first:
   *   { freq, amp, phase, re, im }
   * freq is wrapped into negative frequencies for k > N/2 so circles
   * can spin backwards — exactly what real epicycle drawings need.
   */
  function dft(points) {
    var N = points.length;
    var out = [];
    for (var k = 0; k < N; k++) {
      var re = 0, im = 0;
      for (var n = 0; n < N; n++) {
        var phi = (-2 * Math.PI * k * n) / N;
        re += points[n].x * Math.cos(phi) - points[n].y * Math.sin(phi);
        im += points[n].x * Math.sin(phi) + points[n].y * Math.cos(phi);
      }
      re /= N;
      im /= N;
      var freq = k > N / 2 ? k - N : k; // wrap to negative frequencies
      out.push({ freq: freq, amp: Math.hypot(re, im), phase: Math.atan2(im, re), re: re, im: im });
    }
    out.sort(function (a, b) { return b.amp - a.amp; });
    return out;
  }

  /**
   * EpicycleRenderer — walks the circle chain over time and records the
   * traced path. Pure math + canvas drawing; no DOM.
   */
  function EpicycleRenderer() {
    this.terms = [];       // DFT terms actually used
    this.origin = { x: 0, y: 0 };
    this.time = 0;
    this.step = 0.012;     // radians of curve-parameter per frame (in cycles)
    this.path = [];        // traced points, in canvas coords
    this.maxCycles = 1;    // restart the trail each full revolution
  }

  /** path: array of {x, y} canvas coords forming a closed loop. */
  EpicycleRenderer.prototype.setPath = function (path, termCount) {
    if (!path || path.length < 8) { this.terms = []; return; }
    // Center the path first: the DFT's DC term (freq 0) is the centroid,
    // which in canvas coords sits far from (0,0) and would draw one giant
    // circle around the corner. Subtract it, transform, add it back as origin.
    var mx = 0, my = 0, i;
    for (i = 0; i < path.length; i++) { mx += path[i].x; my += path[i].y; }
    mx /= path.length; my /= path.length;
    var centered = path.map(function (p) { return { x: p.x - mx, y: p.y - my }; });
    var coeffs = dft(centered);
    this.terms = coeffs
      .filter(function (c) { return c.freq !== 0; })
      .slice(0, Math.min(termCount || 60, coeffs.length));
    this.origin = { x: mx, y: my };
    this.path = [];
    this.time = 0;
  };

  /**
   * Advance one frame and draw.
   * ctx: CanvasRenderingContext2D; hueBase: number.
   * Returns the pen tip position {x, y}.
   */
  EpicycleRenderer.prototype.frame = function (ctx, hueBase) {
    if (!this.terms.length) return null;

    var x = this.origin.x, y = this.origin.y;
    var tau = 2 * Math.PI;

    ctx.save();
    ctx.lineWidth = 1;

    for (var i = 0; i < this.terms.length; i++) {
      var term = this.terms[i];
      var prevX = x, prevY = y;
      var angle = term.freq * tau * this.time + term.phase;
      x += term.amp * Math.cos(angle);
      y += term.amp * Math.sin(angle);

      var hue = (hueBase + i * 5) % 360;

      // circle
      ctx.beginPath();
      ctx.strokeStyle = "hsla(" + hue + ", 80%, 65%, 0.35)";
      ctx.arc(prevX, prevY, term.amp, 0, tau);
      ctx.stroke();

      // radius arm
      ctx.beginPath();
      ctx.strokeStyle = "hsla(" + hue + ", 90%, 70%, 0.85)";
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();

    // record the traced path
    this.path.push({ x: x, y: y });
    var maxLen = 1400;
    if (this.path.length > maxLen) this.path.shift();

    // when one full revolution is done, keep the path but stop growing it
    this.time += this.step;
    if (this.time >= this.maxCycles) {
      this.time -= this.maxCycles;
      this.path = [];
    }

    // draw the traced path with a hue gradient
    if (this.path.length > 1) {
      ctx.save();
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowBlur = 12;
      for (var j = 1; j < this.path.length; j++) {
        var hue2 = (hueBase + (j / this.path.length) * 120) % 360;
        ctx.strokeStyle = "hsla(" + hue2 + ", 95%, 62%, 0.9)";
        ctx.shadowColor = "hsla(" + hue2 + ", 95%, 60%, 0.8)";
        ctx.beginPath();
        ctx.moveTo(this.path[j - 1].x, this.path[j - 1].y);
        ctx.lineTo(this.path[j].x, this.path[j].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // pen tip glow
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, tau);
    ctx.fill();
    ctx.restore();

    return { x: x, y: y };
  };

  window.Fourier = { dft: dft, EpicycleRenderer: EpicycleRenderer };
})();
