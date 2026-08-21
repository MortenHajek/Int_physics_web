/* cards/electrostatics-2.js — Potential of a charged disc, built up by integration
 *
 * Pattern mirrors the other cards/*.js:
 *   mount(canvas) — called once with the card's <canvas> element.
 *
 * A uniformly charged disc (surface density σₑ) drawn in perspective, with the
 * field point P on its axis at height z. A ring element sweeps outward from the
 * centre to the rim and back again, so the card loops continuously like the
 * others on the wall. The swept part of the disc fills in behind the ring, the
 * distance r from the live ring to P is drawn, and the running potential is
 * read out, reaching the closed form at full radius:
 *
 *   φ(P) = σₑ/2ε₀ · (√(z² + R²) − z)
 *
 * Read the return sweep as the disc radius shrinking again — φ(R) responding to
 * R — rather than as un-integrating.
 *
 * The drawing's own z/R pixel ratio is fed back into the physics, so the number
 * on screen always belongs to the geometry actually being shown.
 *
 * The disc is the case the lecturer builds up in week 5 (ring → annulus → disc)
 * and the one the topic page's slice-and-sum sandbox integrates.
 */
(function () {
    'use strict';

    const PERIOD_MS = 8200;
    const OUT_END   = 0.42;    /* sweep out to the rim   */
    const HOLD_END  = 0.55;    /* dwell on the finished value, then sweep back */

    const EPS0  = 8.8541878128e-12;
    const SIGMA = 1.0e-7;      /* C/m² — surface charge density */
    const R_M   = 0.10;        /* m    — disc radius            */
    const KY    = 0.34;        /* perspective foreshortening    */
    const Z_R   = 0.85;        /* z / R — how far P sits above the disc */

    /* The eq-chip is opaque and sits bottom-left; the drawing stays clear of it. */
    const CHIP_H     = 78;
    const CHIP_W     = 240;
    const TOP_MARGIN = 16;
    const SHIFT_X    = 0.15;   /* nudge the composition right … */
    const SHIFT_Y    = 0.15;   /* … and down, as far as the chip allows */

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()                || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()           || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()          || '#7A6A52',
            paper: s.getPropertyValue('--paper').trim()              || '#F8F3E5',
            acc:   s.getPropertyValue('--c-electrostatics-2').trim() || '#7a2868',
        };
    }

    function hexToRgb(hex) {
        const h = hex.replace('#', '');
        const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        return {
            r: parseInt(v.slice(0, 2), 16),
            g: parseInt(v.slice(2, 4), 16),
            b: parseInt(v.slice(4, 6), 16),
        };
    }
    function rgba(hex, a) {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r},${g},${b},${a})`;
    }
    function smoothstep(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    }
    /* Czech decimal comma, matching the rest of the site */
    function dec(str) {
        return document.documentElement.getAttribute('data-lang') === 'cs'
            ? String(str).replace(/\./g, ',')
            : String(str);
    }

    const MONO  = '"JetBrains Mono", ui-monospace, monospace';
    const SERIF = '"Source Serif 4", Georgia, serif';

    function mount(canvas) {
        const ctx = canvas.getContext('2d');
        let W = 0, H = 0;
        let col = colours();

        function resize() {
            const dpr  = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            W = rect.width;
            H = rect.height;
            canvas.width  = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            col = colours();
        }
        resize();
        new ResizeObserver(resize).observe(canvas);

        function ellipsePath(cx, cy, rx) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, rx * KY, 0, 0, Math.PI * 2);
        }

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const u = ((ts - t0) % PERIOD_MS) / PERIOD_MS;

            /* out → dwell → back: a closed loop, no fade or reset */
            let s;
            if (u < OUT_END)       s = smoothstep(u / OUT_END);
            else if (u < HOLD_END) s = 1;
            else                   s = 1 - smoothstep((u - HOLD_END) / (1 - HOLD_END));

            /* ── Geometry ────────────────────────────────────────────────
               The disc is sized to the tallest it can be while clearing the
               equation chip, then nudged right and as far down as that allows. */
            const bottomLimit = H - 14 - CHIP_H - 10;
            const Rp   = Math.min(W * 0.38, (bottomLimit - TOP_MARGIN) / (Z_R + KY));
            const zGap = Rp * Z_R;
            const cx   = Math.min(W * (0.50 + SHIFT_X), W - Rp - 12);
            const cy   = Math.max(TOP_MARGIN + zGap,
                                  Math.min(H * (0.48 + SHIFT_Y), bottomLimit - Rp * KY));
            const pY   = cy - zGap;
            const rx   = Rp * s;

            /* ── Physics, tied to the pixel geometry on screen ───────────── */
            const z   = R_M * (zGap / Rp);
            const rho = s * R_M;
            const phi = SIGMA / (2 * EPS0) * (Math.hypot(z, rho) - z);

            ctx.clearRect(0, 0, W, H);

            /* ── The z axis, drawn as a labelled dimension ───────────────── */
            ctx.save();
            ctx.strokeStyle = col.soft;
            ctx.globalAlpha = 0.75;
            ctx.lineWidth   = 1;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(cx, pY);
            ctx.lineTo(cx, cy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(cx - 5, pY); ctx.lineTo(cx + 5, pY);
            ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
            ctx.stroke();
            ctx.font         = '11px ' + SERIF;
            ctx.fillStyle    = col.soft;
            ctx.textAlign    = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText('z', cx - 9, (pY + cy) / 2);
            ctx.restore();

            /* ── The disc: faint body, ink rim ───────────────────────────── */
            ctx.save();
            ellipsePath(cx, cy, Rp);
            ctx.fillStyle = rgba(col.acc, 0.12);
            ctx.fill();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.3;
            ctx.stroke();
            ctx.restore();

            /* ── Swept-so-far part of the disc, in flat accent ───────────── */
            if (rx > 1.5) {
                ctx.save();
                ellipsePath(cx, cy, rx);
                ctx.fillStyle = rgba(col.acc, 0.88);
                ctx.fill();
                ctx.strokeStyle = col.ink;
                ctx.lineWidth   = 1.8;
                ellipsePath(cx, cy, rx);
                ctx.stroke();
                ctx.restore();
            }

            /* ── Distance r from the live ring to P ──────────────────────── */
            ctx.save();
            ctx.globalAlpha = 0.75;
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(cx + rx, cy);
            ctx.lineTo(cx, pY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font         = '11px ' + SERIF;
            ctx.fillStyle    = col.soft;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('r', cx + rx / 2 + 6, (cy + pY) / 2);
            ctx.restore();

            /* ── P, a solid dot on the axis ──────────────────────────────── */
            ctx.save();
            ctx.fillStyle = col.ink;
            ctx.beginPath();
            ctx.arc(cx, pY, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font         = '12px ' + SERIF;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('P', cx + 9, pY);
            ctx.restore();

            /* ── The running value of the integral ───────────────────────
               Bottom-right, opposite the equation chip, so the card reads
               "formula … result" along its bottom edge. The top-left corner is
               out of bounds: .card .accent-tab is a 40x40 square at z-index 10. */
            ctx.save();
            ctx.textBaseline = 'middle';
            const valTxt = dec(phi.toFixed(1)) + ' V';
            ctx.font = '600 15px ' + MONO;
            const wVal = ctx.measureText(valTxt).width;
            ctx.font = '11px ' + MONO;
            const wLab = ctx.measureText('φ(P) =').width;

            if (W - 32 - (wVal + 7 + wLab) > CHIP_W) {
                /* room to sit beside the chip */
                const xr = W - 16, yr = H - 30;
                ctx.textAlign = 'right';
                ctx.font      = '600 15px ' + MONO;
                ctx.fillStyle = col.acc;
                ctx.fillText(valTxt, xr, yr);
                ctx.font      = '11px ' + MONO;
                ctx.fillStyle = col.faint;
                ctx.fillText('φ(P) =', xr - wVal - 7, yr);
            } else {
                /* narrow card: use the top strip, clear of the accent tab */
                const xl = 52, yr = 22;
                ctx.textAlign = 'left';
                ctx.font      = '11px ' + MONO;
                ctx.fillStyle = col.faint;
                ctx.fillText('φ(P) =', xl, yr);
                ctx.font      = '600 15px ' + MONO;
                ctx.fillStyle = col.acc;
                ctx.fillText(valTxt, xl + wLab + 7, yr);
            }
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        document.addEventListener('langchange', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-electrostatics-2');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
