/* cards/electrostatics-1.js — Coulomb's-law mini-animation
 *
 * Two stationary point charges (+Q on the left, −Q on the right) with a
 * classic textbook field-line portrait flowing from + to −. Small
 * arrowheads ride each field line at constant speed to indicate the
 * direction of E, fading in and out at the ends of their travel.
 *
 *   F = k · Q₁Q₂ / r²
 */
(function () {
    'use strict';

    const PERIOD_MS       = 3500;   // ms per arrowhead full traversal of a line
    const N_LINES         = 6;      // total field lines (3 above + 3 below the axis)
    const ARROWS_PER_LINE = 3;
    const CHARGE_R        = 10;     // px
    const ARROW_SIZE      = 4.5;    // px (half-length of the triangular arrowhead)
    const LINE_WIDTH      = 1.4;
    const LINE_ALPHA      = 0.55;
    const SAMPLES         = 64;     // polyline samples per field line (for arc-length)
    const ARROW_FADE      = 0.12;   // frac of travel over which arrowheads fade in/out

    // 0→1→0 envelope over a 0..1 travel parameter, so arrowheads fade in
    // when created and fade out before removal instead of popping.
    function popFade(u) {
        return Math.max(0, Math.min(1, u / ARROW_FADE, (1 - u) / ARROW_FADE));
    }

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()                || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()           || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()          || '#7A6A52',
            paper: s.getPropertyValue('--paper').trim()              || '#F8F3E5',
            acc:   s.getPropertyValue('--c-electrostatics-1').trim() || '#3D2E8A',
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

        // ── Build polyline samples for one field line ────────────────────
        // Cubic Bézier from + → − with control points pushed perpendicular
        // to the axis by `bulge`. `signedBulge < 0` arches upward.
        function sampleLine(p0, p1, signedBulge) {
            // perpendicular unit vector to the connecting axis
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny =  dx / len;

            // Control points sit 1/3 and 2/3 along the axis, pushed perpendicular
            const c1x = p0.x + dx * 0.33 + nx * signedBulge;
            const c1y = p0.y + dy * 0.33 + ny * signedBulge;
            const c2x = p0.x + dx * 0.66 + nx * signedBulge;
            const c2y = p0.y + dy * 0.66 + ny * signedBulge;

            // Sample the Bézier into points + cumulative arc length
            const pts = new Array(SAMPLES + 1);
            const cum = new Array(SAMPLES + 1);
            let totalLen = 0;
            for (let i = 0; i <= SAMPLES; i++) {
                const u  = i / SAMPLES;
                const iu = 1 - u;
                const x = iu*iu*iu * p0.x
                        + 3 * iu*iu * u * c1x
                        + 3 * iu * u*u * c2x
                        + u*u*u * p1.x;
                const y = iu*iu*iu * p0.y
                        + 3 * iu*iu * u * c1y
                        + 3 * iu * u*u * c2y
                        + u*u*u * p1.y;
                pts[i] = { x, y };
                if (i > 0) {
                    totalLen += Math.hypot(x - pts[i-1].x, y - pts[i-1].y);
                }
                cum[i] = totalLen;
            }
            // Avoid degenerate zero-length lines
            return { pts, cum, total: totalLen || 1 };
        }

        // Linear-interpolated point + tangent at arc-length s along a line
        function pointAt(line, s) {
            const { pts, cum, total } = line;
            const target = Math.max(0, Math.min(total, s));
            // Binary search for the segment containing `target`
            let lo = 0, hi = pts.length - 1;
            while (lo < hi - 1) {
                const mid = (lo + hi) >> 1;
                if (cum[mid] <= target) lo = mid;
                else hi = mid;
            }
            const segLen = cum[hi] - cum[lo] || 1;
            const t = (target - cum[lo]) / segLen;
            const a = pts[lo], b = pts[hi];
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            const tx = (b.x - a.x) / segLen;
            const ty = (b.y - a.y) / segLen;
            return { x, y, tx, ty };
        }

        function drawFieldLine(line) {
            const { pts } = line;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.stroke();
        }

        function drawArrowhead(x, y, tx, ty) {
            // Triangle pointing along (tx, ty)
            const ax = x + tx * ARROW_SIZE;
            const ay = y + ty * ARROW_SIZE;
            const bx = x - tx * ARROW_SIZE * 0.6 + (-ty) * ARROW_SIZE * 0.7;
            const by = y - ty * ARROW_SIZE * 0.6 + ( tx) * ARROW_SIZE * 0.7;
            const cx = x - tx * ARROW_SIZE * 0.6 - (-ty) * ARROW_SIZE * 0.7;
            const cy = y - ty * ARROW_SIZE * 0.6 - ( tx) * ARROW_SIZE * 0.7;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.lineTo(cx, cy);
            ctx.closePath();
            ctx.fill();
        }

        function drawCharge(x, y, sign) {
            // Soft outer dashed ring (near-field marker)
            ctx.save();
            ctx.strokeStyle = sign > 0 ? col.acc : col.ink;
            ctx.globalAlpha = 0.22;
            ctx.lineWidth   = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.arc(x, y, CHARGE_R + 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Filled ball
            ctx.save();
            ctx.fillStyle = sign > 0 ? col.acc : col.ink;
            ctx.beginPath();
            ctx.arc(x, y, CHARGE_R, 0, Math.PI * 2);
            ctx.fill();

            // Subtle radial highlight (energy.js idiom)
            const grad = ctx.createRadialGradient(
                x - 2.4, y - 2.6, 0.5,
                x, y, CHARGE_R);
            grad.addColorStop(0, 'rgba(255,255,255,0.40)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, CHARGE_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Glyph
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1.8;
            ctx.lineCap     = 'round';
            const g = CHARGE_R * 0.45;
            ctx.beginPath();
            ctx.moveTo(x - g, y);
            ctx.lineTo(x + g, y);
            if (sign > 0) {
                ctx.moveTo(x, y - g);
                ctx.lineTo(x, y + g);
            }
            ctx.stroke();
            ctx.restore();
        }

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const phase = ((ts - t0) % PERIOD_MS) / PERIOD_MS;   // 0..1

            // ── Charge positions ─────────────────────────────────────────
            const cy   = H * 0.50;
            const posX = W * 0.33;
            const negX = W * 0.77;

            // Endpoints sit at the geometric centre of each charge — the
            // ball is drawn last and covers the inner portion of the curve.
            const p0 = { x: posX, y: cy };
            const p1 = { x: negX, y: cy };

            // ── Build the field lines (top set + mirrored bottom set) ────
            const axisLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            const half    = N_LINES / 2;     // = 3
            const lines   = [];
            // Bulges scale with axis length so proportions hold at any width
            const bulgeStep = axisLen * 0.22;
            for (let i = 0; i < half; i++) {
                const bulge = bulgeStep * (i + 1);   // 1·k, 2·k, 3·k
                lines.push(sampleLine(p0, p1, -bulge));   // upward arch
                lines.push(sampleLine(p0, p1,  bulge));   // downward arch
            }

            ctx.clearRect(0, 0, W, H);

            // ── Field lines ──────────────────────────────────────────────
            ctx.save();
            ctx.strokeStyle = col.acc;
            ctx.globalAlpha = LINE_ALPHA;
            ctx.lineWidth   = LINE_WIDTH;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            for (const ln of lines) drawFieldLine(ln);
            ctx.restore();

            // ── Arrowheads sliding along each line ───────────────────────
            ctx.save();
            ctx.fillStyle = col.acc;
            for (const ln of lines) {
                for (let k = 0; k < ARROWS_PER_LINE; k++) {
                    // Even spacing along the loop, with an interior margin
                    // sized to clear the (now centre-anchored) charge balls.
                    const margin = 0.15;
                    const u = (phase + k / ARROWS_PER_LINE) % 1;
                    const uClamped = margin + u * (1 - 2 * margin);
                    const s = uClamped * ln.total;
                    const { x, y, tx, ty } = pointAt(ln, s);
                    ctx.globalAlpha = 0.92 * popFade(u);
                    drawArrowhead(x, y, tx, ty);
                }
            }
            ctx.restore();

            // ── Charges (drawn last so they cover line endpoints) ────────
            drawCharge(posX, cy, +1);
            drawCharge(negX, cy, -1);

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-electrostatics-1');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
