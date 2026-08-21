/* cards/circuits.js — Simple-loop circuit mini-animation for the circuits card
 *
 * Pattern mirrors cards/thermo.js / energy.js / waves.js:
 *   mount(canvas) — called once with the card's <canvas> element.
 *
 * A rectangular wire loop with a textbook battery on the left side and a
 * zigzag resistor on the right side. Twelve accent-coloured charges flow
 * clockwise around the perimeter at a constant arc-length rate. The
 * resistor's zigzag pulses gently in alpha at the rhythm of the current,
 * suggesting heat dissipation.
 *
 *   I = V / R   (Ohm)
 */
(function () {
    'use strict';

    const PERIOD_MS = 10000;  // ms for a charge to traverse the full loop
    const N_CHARGES = 12;
    const CHARGE_R  = 4;
    const WIRE_LW   = 1.6;

    // Layout (fractions of card area)
    const LOOP_LEFT_REL   = 0.15;
    const LOOP_RIGHT_REL  = 0.85;
    const LOOP_TOP_REL    = 0.22;
    const LOOP_BOTTOM_REL = 0.78;
    const CORNER_R        = 10;   // rounded-corner radius for the wire

    // Battery (left side)
    const BAT_LONG  = 11;   // half-length of long (+) plate
    const BAT_SHORT = 5.5;  // half-length of short (−) plate
    const BAT_GAP   = 6;    // horizontal gap between the two plates

    // Resistor (right side) — zigzag embedded in the wire
    const RES_HALF_H  = 7;   // peak amplitude (perpendicular offset from wire)
    const RES_PEAKS   = 5;   // number of peaks
    const RES_SPAN    = 34;  // total vertical length the zigzag occupies

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()        || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()   || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()  || '#7A6A52',
            acc:   s.getPropertyValue('--c-circuits').trim() || '#a25a28',
            paper: s.getPropertyValue('--paper').trim()      || '#F8F3E5',
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

        // ── Loop geometry → 4 straight segments (clockwise from top-left) ──
        // Returns { segs, total } where segs is an array of
        //   { x0, y0, x1, y1, len } and total is the perimeter length.
        function buildLoop() {
            const L = W * LOOP_LEFT_REL;
            const R = W * LOOP_RIGHT_REL;
            const T = H * LOOP_TOP_REL;
            const B = H * LOOP_BOTTOM_REL;
            // Inset corners by CORNER_R for the rounded look. Each straight
            // segment runs between the tangent points.
            const cr = CORNER_R;
            const segs = [
                // top: left→right
                { x0: L + cr, y0: T,      x1: R - cr, y1: T      },
                // right: top→bottom
                { x0: R,      y0: T + cr, x1: R,      y1: B - cr },
                // bottom: right→left
                { x0: R - cr, y0: B,      x1: L + cr, y1: B      },
                // left: bottom→top
                { x0: L,      y0: B - cr, x1: L,      y1: T + cr },
            ];
            let total = 0;
            for (const s of segs) {
                s.len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
                total += s.len;
            }
            return { L, R, T, B, segs, total };
        }

        // Walk perimeter by arc length d ∈ [0, total) → (x, y)
        function perimeterPoint(loop, d) {
            let rem = ((d % loop.total) + loop.total) % loop.total;
            for (const s of loop.segs) {
                if (rem <= s.len) {
                    const u = rem / s.len;
                    return {
                        x: s.x0 + (s.x1 - s.x0) * u,
                        y: s.y0 + (s.y1 - s.y0) * u,
                    };
                }
                rem -= s.len;
            }
            const last = loop.segs[loop.segs.length - 1];
            return { x: last.x1, y: last.y1 };
        }

        // Draw the rounded-rectangle wire (skipping nothing — battery and
        // resistor are drawn on top with paper-coloured covers to look "in line").
        function drawWire(loop) {
            const { L, R, T, B } = loop;
            const cr = CORNER_R;
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = WIRE_LW;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.beginPath();
            ctx.moveTo(L + cr, T);
            ctx.lineTo(R - cr, T);
            ctx.quadraticCurveTo(R, T, R, T + cr);
            ctx.lineTo(R, B - cr);
            ctx.quadraticCurveTo(R, B, R - cr, B);
            ctx.lineTo(L + cr, B);
            ctx.quadraticCurveTo(L, B, L, B - cr);
            ctx.lineTo(L, T + cr);
            ctx.quadraticCurveTo(L, T, L + cr, T);
            ctx.stroke();
            ctx.restore();
        }

        // Battery sits on the left wire, centred vertically. Two short
        // horizontal plates (perpendicular to the vertical wire), spaced by
        // BAT_GAP. Long plate (top) = +, short plate (bottom) = −, so that
        // positive current flows out of + → up the wire → clockwise round.
        function drawBattery(loop) {
            const cx  = loop.L;
            const cy  = (loop.T + loop.B) / 2;
            const yLong  = cy - BAT_GAP / 2;   // long plate above gap
            const yShort = cy + BAT_GAP / 2;   // short plate below

            // Mask the wire passing through the battery (paper-coloured gap)
            ctx.save();
            ctx.strokeStyle = col.paper;
            ctx.lineWidth   = WIRE_LW + 2.2;
            ctx.lineCap     = 'butt';
            ctx.beginPath();
            ctx.moveTo(cx, yLong  - 0.5);
            ctx.lineTo(cx, yShort + 0.5);
            ctx.stroke();
            ctx.restore();

            // Battery plates
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.8;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(cx - BAT_LONG,  yLong);
            ctx.lineTo(cx + BAT_LONG,  yLong);
            ctx.moveTo(cx - BAT_SHORT, yShort);
            ctx.lineTo(cx + BAT_SHORT, yShort);
            ctx.stroke();
            ctx.restore();

            // Tiny accent + / − tick glyphs (just short ink-coloured strokes
            // alongside the plates — no text, true to retro-textbook style)
            ctx.save();
            ctx.strokeStyle = col.acc;
            ctx.lineWidth   = 1.3;
            ctx.lineCap     = 'round';
            // + glyph to the left of the long plate
            const px = cx - BAT_LONG - 8;
            ctx.beginPath();
            ctx.moveTo(px - 2.6, yLong);
            ctx.lineTo(px + 2.6, yLong);
            ctx.moveTo(px, yLong - 2.6);
            ctx.lineTo(px, yLong + 2.6);
            ctx.stroke();
            // − glyph to the left of the short plate
            const mx = cx - BAT_SHORT - 8;
            ctx.beginPath();
            ctx.moveTo(mx - 2.6, yShort);
            ctx.lineTo(mx + 2.6, yShort);
            ctx.stroke();
            ctx.restore();
        }

        // Resistor: zigzag in the wire on the right side. Pulses subtly in
        // alpha at the rhythm of the current.
        function drawResistor(loop, pulse) {
            const cx = loop.R;
            const cy = (loop.T + loop.B) / 2;
            const y0 = cy - RES_SPAN / 2;
            const y1 = cy + RES_SPAN / 2;

            // Mask the wire behind the resistor
            ctx.save();
            ctx.strokeStyle = col.paper;
            ctx.lineWidth   = WIRE_LW + 2.2;
            ctx.lineCap     = 'butt';
            ctx.beginPath();
            ctx.moveTo(cx, y0 - 0.5);
            ctx.lineTo(cx, y1 + 0.5);
            ctx.stroke();
            ctx.restore();

            // Build the zigzag points
            const points = [];
            points.push({ x: cx, y: y0 });
            const steps = RES_PEAKS * 2;
            for (let i = 1; i <= steps; i++) {
                const u  = i / steps;
                const y  = y0 + (y1 - y0) * u;
                // Triangular wave perpendicular offset, alternating sign
                const side = (i % 2 === 1) ? 1 : -1;
                // Half-step samples produce true peaks at i odd
                const x = (i === steps) ? cx : cx + side * RES_HALF_H;
                points.push({ x, y });
            }

            // Ink zigzag
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.2;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.stroke();
            ctx.restore();

            // Accent overlay — gentle pulse alpha (0.10 .. 0.32)
            ctx.save();
            ctx.strokeStyle = col.acc;
            ctx.lineWidth   = 2.2;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.globalAlpha = 0.10 + 0.22 * pulse;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.stroke();
            ctx.restore();
        }

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const t     = (ts - t0) % PERIOD_MS;
            const phase = t / PERIOD_MS;             // 0..1 over one full traversal
            const pulse = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI * 2); // 2x per loop, smooth

            const loop = buildLoop();

            ctx.clearRect(0, 0, W, H);

            // ── Wire ────────────────────────────────────────────────────
            drawWire(loop);

            // ── Battery & resistor (drawn on top, mask their wire span) ─
            drawBattery(loop);
            drawResistor(loop, pulse);

            // ── Flowing charges ────────────────────────────────────────
            // Distribute N_CHARGES evenly by arc length; advance by phase.
            ctx.save();
            for (let i = 0; i < N_CHARGES; i++) {
                const s = ((i / N_CHARGES) + phase) % 1;
                const d = s * loop.total;
                const p = perimeterPoint(loop, d);

                // Accent-filled dot with crisp ink outline for definition
                ctx.fillStyle   = col.acc;
                ctx.strokeStyle = col.ink;
                ctx.lineWidth   = 0.9;
                ctx.beginPath();
                ctx.arc(p.x, p.y, CHARGE_R, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-circuits');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
