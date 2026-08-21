/* cards/thermo.js — Engine piston / gas mini-animation for the thermodynamics card
 *
 * Slider-crank mechanism: rotating crankshaft + flywheel drives the piston
 * via a connecting rod. Gas colour lerps cool-blue→hot-orange as the gas is
 * compressed adiabatically each stroke.
 *
 *   ΔU = Q − W
 */
(function () {
    'use strict';

    const PERIOD_MS        = 4800;
    const CYL_LEFT_REL     = 0.07;
    const CYL_RIGHT_REL    = 0.57;
    const CYL_TOP_REL      = 0.22;   // shifted 10% upward (was 0.32)
    const CYL_BOT_REL      = 0.66;   // shifted 10% upward (was 0.76)
    const PISTON_THICKNESS = 12;

    // Crankshaft geometry (all relative to W so proportions hold at any aspect ratio)
    const CRANK_X_REL   = 0.79;   // crankshaft centre X (fraction of W) — further right
    const CRANK_R_REL   = 0.115;  // crank-throw radius   (fraction of W)
    const CON_ROD_RATIO = 3.0;    // connecting-rod length = ratio × crank throw — longer shaft
    const FLY_R_RATIO   = 1.55;   // flywheel radius = ratio × crank radius

    // Gas colour endpoints (cold ↔ hot)
    const COLD = { r:  44, g: 110, b: 162 };
    const HOT  = { r: 204, g:  98, b:  44 };

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()      || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim() || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()|| '#7A6A52',
            acc:   s.getPropertyValue('--c-thermo').trim() || '#b05a18',
            paper: s.getPropertyValue('--paper').trim()    || '#F8F3E5',
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

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const t     = (ts - t0) % PERIOD_MS;
            const theta = (t / PERIOD_MS) * 2 * Math.PI;   // crank angle, rotates continuously

            // ── Cylinder geometry ────────────────────────────────────────
            const cyl_l  = W * CYL_LEFT_REL;
            const cyl_r  = W * CYL_RIGHT_REL;
            const cyl_t  = H * CYL_TOP_REL;
            const cyl_b  = H * CYL_BOT_REL;
            const cyl_h  = cyl_b - cyl_t;
            const cyl_cy = (cyl_t + cyl_b) / 2;

            const inner_l = cyl_l + 2;
            const inner_t = cyl_t + 2;
            const inner_h = cyl_h - 4;

            // ── Slider-crank kinematics ──────────────────────────────────
            const crankX = W * CRANK_X_REL;
            const crankY = cyl_cy;
            const R      = W * CRANK_R_REL;   // W-relative so constraint holds at any aspect ratio
            const L      = R * CON_ROD_RATIO;
            const flyR   = R * FLY_R_RATIO;

            const sinT = Math.sin(theta);
            const cosT = Math.cos(theta);

            // piston_r = right face of piston block (wrist-pin plane)
            const piston_r = crankX + R * cosT - Math.sqrt(Math.max(0, L * L - R * R * sinT * sinT));
            const piston_l = piston_r - PISTON_THICKNESS;
            const gas_w    = Math.max(2, piston_l - inner_l);

            // Crank-pin world position
            const pinX = crankX + R * cosT;
            const pinY = crankY + R * sinT;

            // Compression fraction: 0 = fully expanded, 1 = fully compressed
            const piston_r_max = crankX + R - L;     // at theta = 0
            const piston_r_min = crankX - R - L;     // at theta = π
            const gas_w_max = piston_r_max - PISTON_THICKNESS - inner_l;
            const gas_w_min = Math.max(1, piston_r_min - PISTON_THICKNESS - inner_l);
            const comp = Math.max(0, Math.min(1, (gas_w_max - gas_w) / (gas_w_max - gas_w_min)));

            // Interpolated gas colour
            const rc = (COLD.r + (HOT.r - COLD.r) * comp) | 0;
            const gc = (COLD.g + (HOT.g - COLD.g) * comp) | 0;
            const bc = (COLD.b + (HOT.b - COLD.b) * comp) | 0;
            const gasFill = `rgba(${rc},${gc},${bc},0.78)`;

            ctx.clearRect(0, 0, W, H);

            // ── Gas fill (drawn first — behind everything) ───────────────
            ctx.save();
            ctx.fillStyle = gasFill;
            ctx.fillRect(inner_l, inner_t, gas_w, inner_h);
            ctx.restore();

            // ── Flywheel disc (background layer) ─────────────────────────
            ctx.save();
            ctx.fillStyle = col.paper;
            ctx.strokeStyle = col.ink;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(crankX, crankY, flyR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Flywheel spokes (rotate with crank)
            ctx.save();
            ctx.strokeStyle = col.soft;
            ctx.lineWidth   = 1.1;
            ctx.globalAlpha = 0.55;
            for (let i = 0; i < 5; i++) {
                const a = theta + i * (2 * Math.PI / 5);
                ctx.beginPath();
                ctx.moveTo(crankX + Math.cos(a) * R * 0.3,  crankY + Math.sin(a) * R * 0.3);
                ctx.lineTo(crankX + Math.cos(a) * flyR * 0.86, crankY + Math.sin(a) * flyR * 0.86);
                ctx.stroke();
            }
            ctx.restore();

            // Flywheel hub (centre boss)
            ctx.save();
            ctx.fillStyle = col.soft;
            ctx.beginPath();
            ctx.arc(crankX, crankY, R * 0.26, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // ── Cylinder walls (on top of flywheel where they overlap) ───
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.8;
            ctx.lineCap     = 'butt';
            ctx.beginPath();
            // top wall
            ctx.moveTo(cyl_l, cyl_t);
            ctx.lineTo(cyl_r + 3, cyl_t);
            // bottom wall
            ctx.moveTo(cyl_l, cyl_b);
            ctx.lineTo(cyl_r + 3, cyl_b);
            // closed left end (head)
            ctx.moveTo(cyl_l, cyl_t);
            ctx.lineTo(cyl_l, cyl_b);
            ctx.stroke();
            ctx.restore();

            // Left-end hatching (fixed wall / cylinder head)
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth   = 0.9;
            const step = 8, hlen = 6;
            for (let y = cyl_t + 2; y < cyl_b; y += step) {
                ctx.beginPath();
                ctx.moveTo(cyl_l, y);
                ctx.lineTo(cyl_l - hlen, y - hlen);
                ctx.stroke();
            }
            ctx.restore();

            // ── Crank arm (hub → crank pin) ───────────────────────────────
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 3.8;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(crankX, crankY);
            ctx.lineTo(pinX, pinY);
            ctx.stroke();
            ctx.restore();

            // ── Connecting rod (wrist pin → crank pin) ───────────────────
            ctx.save();
            ctx.strokeStyle = col.soft;
            ctx.lineWidth   = 2.8;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            ctx.moveTo(piston_r, cyl_cy);
            ctx.lineTo(pinX, pinY);
            ctx.stroke();
            ctx.restore();

            // ── Piston block ─────────────────────────────────────────────
            ctx.save();
            ctx.fillStyle = col.ink;
            ctx.fillRect(piston_l, inner_t, PISTON_THICKNESS, inner_h);
            // highlight stripe on gas-face
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(piston_l, inner_t, 2, inner_h);
            ctx.restore();

            // ── Crank pin (big end bearing) ───────────────────────────────
            ctx.save();
            ctx.fillStyle   = col.acc;
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.1;
            ctx.beginPath();
            ctx.arc(pinX, pinY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // ── Wrist pin (small end, on piston) ─────────────────────────
            ctx.save();
            ctx.fillStyle   = col.paper;
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.arc(piston_r, cyl_cy, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-thermo');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
