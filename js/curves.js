/* =========================================================================
 * curves.js — a library of famous parametric curves.
 * Each preset returns [x, y] for parameter t in `range`.
 * `scale` is a rough half-extent used by the renderer to fit the view.
 * ========================================================================= */
(function () {
  "use strict";

  var PI = Math.PI;

  window.PRESETS = [
    {
      id: "heart",
      name: "Heart Curve",
      formula: "x = 16·sin³(t) ,  y = 13·cos(t) − 5·cos(2t) − 2·cos(3t) − cos(4t)",
      range: [0, 2 * PI],
      scale: 17,
      fn: function (t) {
        var s = Math.sin(t);
        return [16 * s * s * s,
                13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
      },
      story: "A beloved parametric heart: the sine cube shapes the two lobes, while a short " +
             "Fourier-like series of cosines carves the dip and the pointed base. It is the " +
             "classic way mathematicians say ‘I love you’."
    },
    {
      id: "rose",
      name: "Seven-Petal Rose (Rhodonea)",
      formula: "r = cos(7t)  →  x = cos(7t)·cos(t) ,  y = cos(7t)·sin(t)",
      range: [0, 2 * PI],
      scale: 1.05,
      fn: function (t) {
        var r = Math.cos(7 * t);
        return [r * Math.cos(t), r * Math.sin(t)];
      },
      story: "Rhodonea curves were studied by Guido Grandi in the 1700s. With an odd k in " +
             "r = cos(kt) the rose blooms k petals; the polar radius swings negative, folding " +
             "each petal through the origin."
    },
    {
      id: "butterfly",
      name: "Temple Fay Butterfly",
      formula: "x = sin(t)·(e^cos(t) − 2cos(4t) − sin⁵(t/12)) ,  y = cos(t)·(same)",
      range: [0, 12 * PI],
      scale: 4.2,
      fn: function (t) {
        var e = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5);
        return [Math.sin(t) * e, Math.cos(t) * e];
      },
      story: "Discovered by Temple H. Fay in 1989, this transcendental curve needs twelve full " +
             "turns (t from 0 to 12π) to complete one butterfly — wings, antennae and all, " +
             "from a single formula."
    },
    {
      id: "lissajous",
      name: "Lissajous Knot 3:4",
      formula: "x = sin(3t + π/2) ,  y = sin(4t)",
      range: [0, 2 * PI],
      scale: 1.15,
      fn: function (t) {
        return [Math.sin(3 * t + PI / 2), Math.sin(4 * t)];
      },
      story: "Two perpendicular simple harmonic motions with a 3:4 frequency ratio weave this " +
             "knot. Lissajous figures appear on oscilloscopes and were once used to tune " +
             "musical instruments by eye."
    },
    {
      id: "spiral",
      name: "Archimedean Spiral",
      formula: "x = t·cos(t) ,  y = t·sin(t) ,  t ∈ [0, 6π]",
      range: [0, 6 * PI],
      scale: 19,
      fn: function (t) {
        return [t * Math.cos(t), t * Math.sin(t)];
      },
      story: "The spiral Archimedes described in 225 BC: the radius grows linearly with the " +
             "angle, so every turn adds the same width — the mathematics of rolled carpets, " +
             "watch springs and vinyl records."
    },
    {
      id: "astroid",
      name: "Astroid (Hypocycloid)",
      formula: "x = cos³(t) ,  y = sin³(t)",
      range: [0, 2 * PI],
      scale: 1.15,
      fn: function (t) {
        var c = Math.cos(t), s = Math.sin(t);
        return [c * c * c, s * s * s];
      },
      story: "The astroid is the path of a point on a small circle rolling inside one four " +
             "times its size. It is also the envelope of a ladder sliding down a wall — a curve " +
             "hiding inside everyday physics."
    },
    {
      id: "lemniscate",
      name: "Lemniscate of Bernoulli ∞",
      formula: "x = cos(t)/(1 + sin²(t)) ,  y = sin(t)·cos(t)/(1 + sin²(t))",
      range: [0, 2 * PI],
      scale: 1.15,
      fn: function (t) {
        var d = 1 + Math.sin(t) * Math.sin(t);
        return [Math.cos(t) / d, Math.sin(t) * Math.cos(t) / d];
      },
      story: "Jacob Bernoulli’s ‘ribbon’ (1694) is the infinity symbol made precise: the set " +
             "of points whose distances to two foci multiply to a constant. It sits at the " +
             "birthplace of elliptic integrals."
    }
  ];

  window.findPreset = function (query) {
    var q = query.trim().toLowerCase();
    for (var i = 0; i < window.PRESETS.length; i++) {
      if (window.PRESETS[i].id === q || window.PRESETS[i].name.toLowerCase().indexOf(q) !== -1) {
        return window.PRESETS[i];
      }
    }
    return null;
  };
})();
