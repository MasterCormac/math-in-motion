# Mathematics in Motion

An interactive canvas that turns pure mathematics into living, colorful art: type a curve name (or your own parametric formula) into a glowing input box and watch the shape morph into being, then flip to Fourier Mode to see it redrawn by a chain of spinning circles. It is a small love letter to the idea that equations are not just tools — they are drawings waiting to happen.

## What it does

- **Trace Mode** — a glowing comet sweeps along the curve, leaving a fading neon trail over a faint silhouette of the whole shape.
- **Fourier Mode** — a Discrete Fourier Transform decomposes the curve into rotating circles (epicycles) that redraw it, exactly as the Fourier series promises: *any closed curve is a sum of spinning circles*.
- **Fancy formula input** — accepts preset names (`heart`, `rose`, `butterfly`, `lissajous`, `spiral`, `astroid`, `lemniscate`) **or any parametric pair** `x(t); y(t)` such as:

  ```
  16*sin(t)^3 ; 13*cos(t)-5*cos(2t)-2*cos(3t)-cos(4t)
  ```

  Optional custom range: append `| 0, 12.57`. The expression compiler is a hand-written shunting-yard parser — no `eval()`, with implicit multiplication (`2t`, `3sin(t)` all work) and friendly error messages.
- **Smooth morphing** — switching curves animates a cubic-eased transition between the old and the new shape.

## Run it

It is a pure static site — no build step, no dependencies:

- open `index.html` in any modern browser, **or**
- serve the folder: `python3 -m http.server 8000` → http://localhost:8000

## One-click deploy to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`:

1. Push this repository to GitHub (`main` branch).
2. In **Settings → Pages**, set *Source* to **GitHub Actions**.
3. Every push to `main` now auto-deploys. Your site appears at `https://<you>.github.io/<repo>/`.

## File map

| Path | Role |
|---|---|
| `index.html` | page skeleton & UI |
| `css/style.css` | dark neon theme, animated gradient input |
| `js/parser.js` | safe math-expression compiler (tokenizer → shunting-yard → RPN) |
| `js/curves.js` | library of famous parametric curves, with their stories |
| `js/fourier.js` | DFT + epicycle renderer |
| `js/main.js` | sampling, normalization, morphing, both render modes, UI wiring |

## The math, in one breath

Parametric curves draw a point `(x(t), y(t))` as `t` travels — that is how hearts, roses and butterflies come out of sines and cosines. Fourier's insight goes the other way: sample any closed loop as complex numbers, run a DFT, and you get a list of circles (radius = amplitude, speed = frequency, offset = phase) whose chained tips retrace your drawing. This page lets you feel both directions.
