/* cards/kinematics.js — Projectile mini-animation for the particle-motion card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * A ball is thrown at a fixed angle and flies a parabola drawn from the exact
 * kinematic equations — no integration, so it is stable at any frame rate.
 * Strobe marks sit at equal time intervals along the path: their crowding
 * near the apex is the horizontal-vs-vertical story told without a word, since
 * the horizontal spacing never changes while the vertical spacing collapses.
 * The live velocity is drawn as a resultant with its two component legs.
 *
 *   y = y₀ + v₀ᵧt − ½gt²
 */
(function () {
    'use strict';

    const LAUNCH_X  = 0.12;
    const LAND_X    = 0.82;
    const GROUND_Y  = 0.56;
    const ANGLE_DEG = 40;
    const BALL_R    = 7;
    const PERIOD_MS = 9000;
    const VEL_SCALE = 28;      // px for the largest velocity component
    const STROBES   = 11;      // equal-time marks along the flight

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()          || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()     || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()    || '#7A6A52',
            acc:   s.getPropertyValue('--c-kinematics').trim() || '#7a3c1a',
            paper: s.getPropertyValue('--paper').trim()        || '#F8F3E5',
        };
    }

    /* Fit a parabola that leaves (lx, ly) at ANGLE_DEG and lands at landX
       after exactly PERIOD_MS. Everything downstream is closed form. */
    function buildPhysics(lx, landX) {
        const T  = PERIOD_MS;
        const vx = (landX - lx) / T;
        const vy = vx * Math.tan(ANGLE_DEG * Math.PI / 180);
        const g  = 2 * vy / T;
        return { vx, vy, g, T };
    }

    function ballPos(t, lx, ly, p) {
        return { x: lx + p.vx * t, y: ly - p.vy * t + 0.5 * p.g * t * t };
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        if (len < 3) return;
        const ux = dx / len, uy = dy / len;
        const hl = Math.min(9, len * 0.34), hw = hl * 0.46;
        ctx.save();
        ctx.strokeStyle = color; ctx.fillStyle = color;
        ctx.lineWidth = lw || 1.6; ctx.lineCap = 'round'; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        ctx.lineTo(x2 - ux * hl * 0.6, y2 - uy * hl * 0.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw);
        ctx.lineTo(x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    function mount(canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        let W = 0, H = 0, col = colours();

        function resize() {
            const rect = canvas.getBoundingClientRect();
            W = rect.width; H = rect.height;
            canvas.width  = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        new ResizeObserver(resize).observe(canvas);

        function drawGround(groundY) {
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();
            ctx.globalAlpha = 0.42; ctx.lineWidth = 0.9;
            for (let x = -10; x < W + 10; x += 9) {
                ctx.beginPath();
                ctx.moveTo(x, groundY); ctx.lineTo(x - 7, groundY + 7);
                ctx.stroke();
            }
            ctx.restore();
        }

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const tF = (ts - t0) % PERIOD_MS;

            const groundY = GROUND_Y * H;
            const lx = LAUNCH_X * W, ly = groundY;
            const landX = LAND_X * W;
            const p = buildPhysics(lx, landX);
            const pos = ballPos(tF, lx, ly, p);

            ctx.clearRect(0, 0, W, H);

            drawGround(groundY);

            /* ── The whole arc, faint ─────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.acc; ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.20; ctx.setLineDash([4, 5]);
            ctx.beginPath();
            for (let i = 0; i <= 70; i++) {
                const q = ballPos(i / 70 * p.T, lx, ly, p);
                i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
            }
            ctx.stroke();
            ctx.restore();

            /* ── Strobe marks — equal time, unequal spacing ───────────────── */
            ctx.save();
            ctx.setLineDash([]);
            for (let i = 1; i < STROBES; i++) {
                const tk = i / STROBES * p.T;
                const q  = ballPos(tk, lx, ly, p);
                const passed = tk <= tF;
                ctx.globalAlpha = passed ? 0.55 : 0.20;
                ctx.fillStyle = passed ? col.acc : col.faint;
                ctx.beginPath(); ctx.arc(q.x, q.y, passed ? 2.4 : 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            /* ── Apex tick, where vᵧ = 0 ─────────────────────────────────── */
            const apex = ballPos(p.T / 2, lx, ly, p);
            ctx.save();
            ctx.strokeStyle = col.faint; ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1.1; ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(apex.x - 11, apex.y); ctx.lineTo(apex.x + 11, apex.y);
            ctx.stroke();
            ctx.restore();

            /* ── Velocity: resultant plus its two component legs ──────────── */
            const vxNow = p.vx;
            const vyNow = -(p.vy - p.g * tF);          // canvas y grows downward
            const sc    = VEL_SCALE / Math.max(Math.abs(vxNow), Math.abs(p.vy));
            const vxPx  = vxNow * sc, vyPx = vyNow * sc;

            ctx.save();
            ctx.strokeStyle = col.faint; ctx.globalAlpha = 0.6;
            ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(pos.x + vxPx, pos.y); ctx.lineTo(pos.x + vxPx, pos.y + vyPx);
            ctx.moveTo(pos.x, pos.y + vyPx); ctx.lineTo(pos.x + vxPx, pos.y + vyPx);
            ctx.stroke();
            ctx.restore();

            drawArrow(ctx, pos.x, pos.y, pos.x + vxPx, pos.y, col.ink, 1.5);
            if (Math.abs(vyPx) > 3) {
                drawArrow(ctx, pos.x, pos.y, pos.x, pos.y + vyPx, col.ink, 1.5);
            }
            drawArrow(ctx, pos.x, pos.y, pos.x + vxPx, pos.y + vyPx, col.acc, 2.1);

            /* ── Ball ─────────────────────────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = col.acc;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, BALL_R, 0, Math.PI * 2); ctx.fill();
            const grad = ctx.createRadialGradient(pos.x - 2, pos.y - 2, 1, pos.x, pos.y, BALL_R);
            grad.addColorStop(0, 'rgba(255,255,255,0.34)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, BALL_R, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            /* ── Launch and landing marks ─────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = col.ink; ctx.globalAlpha = 0.34;
            ctx.beginPath(); ctx.arc(lx, groundY, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(landX, groundY, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-kinematics');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
