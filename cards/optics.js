/* cards/optics.js — Dispersing prism mini-animation for the optics card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * A white beam enters an equilateral glass prism on its left face, refracts
 * once inside, and exits the right face as a fan of six coloured rays —
 * red, orange, yellow, green, blue, violet — fanning outward toward the
 * canvas's right edge. The whole fan (and the incoming beam) sweeps ±2°
 * sinusoidally around its mean angle over PERIOD_MS to add quiet life.
 *
 *   n₁ sin θ₁ = n₂ sin θ₂      — Snell's law
 *   (n is wavelength-dependent → dispersion)
 */
(function () {
    'use strict';

    const PERIOD_MS      = 7000;        // ms per full sweep cycle
    const PRISM_SIDE_REL = 0.32;        // side length as fraction of H
    const N_SPECTRUM     = 6;
    const SWEEP_DEG      = 2;           // ± oscillation amplitude (degrees)

    // Mean exit-fan half-spread (degrees). Rays distribute symmetrically
    // around the mean exit angle; red bends least, violet most.
    const FAN_HALF_DEG   = 9;
    const MEAN_EXIT_DEG  = 65;          // mean deflection off the right face normal
                                        // (chosen for n_glass > n_air: light bends
                                        //  toward normal entering, away exiting)

    // Six fixed spectrum colours (least → most bent: red → violet)
    const SPECTRUM = [
        '#c83820', // red
        '#d97a18', // orange
        '#d4a418', // yellow (matches the accent)
        '#3a8a50', // green
        '#2a5fa0', // blue
        '#5a3878', // violet
    ];

    // Photon-speck constants (subtle drifting dots along each ray)
    const SPECKS_PER_RAY = 3;
    const SPECK_SPEED    = 0.00012;     // normalised progress per ms

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()       || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()  || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim() || '#7A6A52',
            acc:   s.getPropertyValue('--c-optics').trim()  || '#d4a418',
            paper: s.getPropertyValue('--paper').trim()     || '#F8F3E5',
        };
    }

    function mount(canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        let W = 0, H = 0;
        let col = colours();

        function resize() {
            const rect = canvas.getBoundingClientRect();
            W = rect.width;
            H = rect.height;
            canvas.width  = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        new ResizeObserver(resize).observe(canvas);

        let t0 = null;

        // ── Prism geometry ───────────────────────────────────────────────
        // Equilateral triangle, apex pointing up. Centroid at (cx, cy).
        // Vertices:  apex (top), left-base, right-base.
        function prismVertices(cx, cy, side) {
            const h = side * Math.sqrt(3) / 2;      // triangle height
            // Centroid sits 1/3 up from base. Apex is 2/3·h above centroid;
            // base is 1/3·h below centroid.
            const apexY    = cy - (2 / 3) * h;
            const baseY    = cy + (1 / 3) * h;
            return {
                apex:  { x: cx,            y: apexY },
                left:  { x: cx - side / 2, y: baseY },
                right: { x: cx + side / 2, y: baseY },
            };
        }

        function drawPrism(v) {
            // Translucent fill (paper + a hint of saffron warmth)
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(v.apex.x,  v.apex.y);
            ctx.lineTo(v.right.x, v.right.y);
            ctx.lineTo(v.left.x,  v.left.y);
            ctx.closePath();

            // Layered fill: paper base, then a faint accent wash on top
            ctx.fillStyle = col.paper;
            ctx.globalAlpha = 0.55;
            ctx.fill();
            ctx.fillStyle = col.acc;
            ctx.globalAlpha = 0.06;
            ctx.fill();
            ctx.restore();

            // Crisp ink outline
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.6;
            ctx.lineJoin    = 'round';
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(v.apex.x,  v.apex.y);
            ctx.lineTo(v.right.x, v.right.y);
            ctx.lineTo(v.left.x,  v.left.y);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // ── Line-segment / line-segment intersection ─────────────────────
        // Returns the point along an infinite ray (px,py)+t·(dx,dy) where
        // it crosses the segment (ax,ay)→(bx,by), or null if no hit ahead.
        function rayHitSegment(px, py, dx, dy, ax, ay, bx, by) {
            const ex = bx - ax;
            const ey = by - ay;
            const denom = dx * ey - dy * ex;
            if (Math.abs(denom) < 1e-9) return null;
            const t = ((ax - px) * ey - (ay - py) * ex) / denom;
            const u = ((ax - px) * dy - (ay - py) * dx) / denom;
            if (t <= 0 || u < 0 || u > 1) return null;
            return { x: px + t * dx, y: py + t * dy, t };
        }

        // Direction unit-vector from an angle (radians, screen-space: y down)
        function dirFromAngle(angleRad) {
            return { x: Math.cos(angleRad), y: Math.sin(angleRad) };
        }

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const tCycle = (ts - t0) % PERIOD_MS;
            const phase  = (tCycle / PERIOD_MS) * 2 * Math.PI;
            const sweep  = Math.sin(phase) * (SWEEP_DEG * Math.PI / 180);

            ctx.clearRect(0, 0, W, H);

            // ── Prism placement ──────────────────────────────────────────
            const side = H * PRISM_SIDE_REL;
            const cx   = W * 0.45;
            const cy   = H * 0.55;
            const v    = prismVertices(cx, cy, side);

            // ── Incoming-beam geometry ───────────────────────────────────
            // The beam pivots slightly so its exit fan also pivots: this is
            // achieved by tilting the incoming direction by `sweep` around a
            // fixed entry point on the left face.
            // Entry sits ~40% down the left face (just above centre) so the
            // beam, now bending downward inside the glass, has room to clear
            // the prism before hitting the base.
            const entryT = 0.40;
            const entry = {
                x: v.apex.x + (v.left.x - v.apex.x) * entryT,
                y: v.apex.y + (v.left.y - v.apex.y) * entryT,
            };
            // Incoming beam arrives from below-left, slanting upward into the
            // left face. Sweep modulates its angle.
            const incomingAngle = (-15 * Math.PI / 180) + sweep;
            const incomingDir   = dirFromAngle(incomingAngle);
            const beamStart = {
                x: 0,
                y: entry.y - incomingDir.y / incomingDir.x * entry.x,
            };

            // ── Refraction inside: a single segment from entry → exit ────
            // For air → glass (n_glass > n_air), Snell bends light TOWARD
            // the normal. The left-face inward normal points down-right (~+30°
            // in screen coords), so the refracted beam inside the prism tilts
            // downward from horizontal. +10° gives a sensible exit through the
            // right face without total internal reflection.
            const internalAngle = (10 * Math.PI / 180) + sweep * 0.6;
            const internalDir   = dirFromAngle(internalAngle);
            const exitHit = rayHitSegment(
                entry.x, entry.y, internalDir.x, internalDir.y,
                v.apex.x, v.apex.y, v.right.x, v.right.y);
            const exit = exitHit
                ? { x: exitHit.x, y: exitHit.y }
                // Fallback: midpoint of right face if maths somehow fails
                : { x: (v.apex.x + v.right.x) / 2,
                    y: (v.apex.y + v.right.y) / 2 };

            // ── Incoming beam — white core with thin dark outline so it
            //    reads on the cream paper background. ─────────────────────
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            // dark outline (slightly wider)
            ctx.strokeStyle = col.soft;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth   = 3.5;
            ctx.beginPath();
            ctx.moveTo(beamStart.x, beamStart.y);
            ctx.lineTo(entry.x,     entry.y);
            ctx.stroke();
            // bright white core
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.lineWidth   = 1.6;
            ctx.beginPath();
            ctx.moveTo(beamStart.x, beamStart.y);
            ctx.lineTo(entry.x,     entry.y);
            ctx.stroke();
            ctx.restore();

            // ── Prism body (drawn over the entry beam, under the exit fan)
            drawPrism(v);

            // ── Internal refracted segment (entry → exit) ────────────────
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth   = 1.4;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(entry.x, entry.y);
            ctx.lineTo(exit.x,  exit.y);
            ctx.stroke();
            ctx.restore();

            // ── Exit fan: six coloured rays ──────────────────────────────
            // Right-face outward normal (perpendicular to the face, pointing
            // away from the prism centre).
            const faceDx = v.right.x - v.apex.x;
            const faceDy = v.right.y - v.apex.y;
            const faceLen = Math.hypot(faceDx, faceDy);
            // Outward normal: rotate face vector by +90° (and pick the side
            // that points away from cx,cy).
            let nx =  faceDy / faceLen;
            let ny = -faceDx / faceLen;
            const fmx = (v.apex.x + v.right.x) / 2;
            const fmy = (v.apex.y + v.right.y) / 2;
            if ((fmx - cx) * nx + (fmy - cy) * ny < 0) {
                nx = -nx; ny = -ny;
            }
            const normalAngle = Math.atan2(ny, nx);

            // Compute each ray's angle: mean deflection + symmetric spread.
            // Red bends least → smallest deflection; violet most.
            const meanDef = MEAN_EXIT_DEG * Math.PI / 180;
            const halfSpread = FAN_HALF_DEG * Math.PI / 180;

            // The fan should tilt downward from the normal (rays head toward
            // bottom-right corner). Sign chosen so red sits at the top of
            // the fan and violet at the bottom.
            const fanCenterAngle = normalAngle + meanDef + sweep * 1.4;

            // Draw rays in two passes: glow then crisp colour
            for (let pass = 0; pass < 2; pass++) {
                for (let i = 0; i < N_SPECTRUM; i++) {
                    const u = (N_SPECTRUM === 1)
                        ? 0
                        : (i / (N_SPECTRUM - 1)) * 2 - 1;   // -1..+1
                    const rayAngle = fanCenterAngle + u * halfSpread;
                    const dx = Math.cos(rayAngle);
                    const dy = Math.sin(rayAngle);

                    // Extend until off-canvas (use a generous param length)
                    const reach = W + H;
                    const endX  = exit.x + dx * reach;
                    const endY  = exit.y + dy * reach;

                    ctx.save();
                    ctx.lineCap  = 'round';
                    ctx.lineJoin = 'round';
                    if (pass === 0) {
                        // Soft paper glow under each ray
                        ctx.strokeStyle = col.paper;
                        ctx.globalAlpha = 0.22;
                        ctx.lineWidth   = 4;
                    } else {
                        ctx.strokeStyle = SPECTRUM[i];
                        ctx.globalAlpha = 0.92;
                        ctx.lineWidth   = 1.8;
                    }
                    ctx.beginPath();
                    ctx.moveTo(exit.x, exit.y);
                    ctx.lineTo(endX,   endY);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // ── Photon specks drifting outward along each ray ────────────
            ctx.save();
            for (let i = 0; i < N_SPECTRUM; i++) {
                const u = (N_SPECTRUM === 1)
                    ? 0
                    : (i / (N_SPECTRUM - 1)) * 2 - 1;
                const rayAngle = fanCenterAngle + u * halfSpread;
                const dx = Math.cos(rayAngle);
                const dy = Math.sin(rayAngle);
                const reach = Math.hypot(W - exit.x, H - exit.y) + 20;

                for (let k = 0; k < SPECKS_PER_RAY; k++) {
                    // Each speck has a stable phase based on (i, k); progress
                    // cycles through [0, 1) over time.
                    const seed = (i * 0.137 + k * 0.41);
                    const p    = ((ts * SPECK_SPEED) + seed) % 1;
                    const dist = p * reach;
                    const sx = exit.x + dx * dist;
                    const sy = exit.y + dy * dist;
                    // Fade in early, fade out near the canvas edge
                    const fade = Math.sin(Math.PI * p);   // 0 → 1 → 0
                    ctx.globalAlpha = 0.4 * fade;
                    ctx.fillStyle   = SPECTRUM[i];
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();

            // ── Tiny ink dots at entry & exit, for engraving precision ──
            ctx.save();
            ctx.fillStyle = col.ink;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(entry.x, entry.y, 1.4, 0, Math.PI * 2);
            ctx.arc(exit.x,  exit.y,  1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });

        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-optics');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
