/* ============================================================
   mobile.js — the one thing about a phone screen that CSS cannot do.

   A sandbox pins two overlays onto its canvas: the equation badge
   (.canvas-formula-badge, bottom-left) and on some pages an instruction
   line (.sim-hint, bottom-right). On a desktop canvas those corners are
   kept clear; on a phone the canvas is a third as wide while the overlays
   are not, and they land on axis labels, floors and dimension lines.
   CSS cannot move an element out of its parent, so below 640px both are
   lifted out of the .canvas-wrap and set directly under the picture —
   the equation as a strip (.eq-strip), the hint as a caption line under
   it (.hint-strip), both styled in styles.css. A comment node marks where
   each came from, and they go back when the screen widens again — a
   phone turned on its side.

   The canvas keeps its size (styles.css grows the panel by the strip),
   and every sim already watches its wrap with a ResizeObserver, so no
   sim needs to know this happened.
   ============================================================ */
(function () {
    'use strict';
    var mq = window.matchMedia('(max-width: 640px)');
    var moved = [];

    function lift(el, after, cls) {
        var mark = document.createComment(cls);
        el.parentNode.insertBefore(mark, el);
        after.parentNode.insertBefore(el, after.nextSibling);
        el.classList.add(cls);
        moved.push([el, mark, cls]);
        return el;
    }

    function apply() {
        if (mq.matches) {
            if (moved.length) return;
            var wraps = document.querySelectorAll('.canvas-panel > .canvas-wrap');
            for (var i = 0; i < wraps.length; i++) {
                var wrap = wraps[i], last = wrap;
                var badge = wrap.querySelector(':scope > .canvas-formula-badge');
                var hint  = wrap.querySelector(':scope > .sim-hint');
                if (badge) last = lift(badge, last, 'eq-strip');
                if (hint)  lift(hint, last, 'hint-strip');
            }
        } else {
            while (moved.length) {
                var m = moved.pop();
                m[1].parentNode.replaceChild(m[0], m[1]);
                m[0].classList.remove(m[2]);
            }
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);

    /* ── Labels stay on the canvas ──
       Sims place their labels beside the thing they name, in pixels, and on a
       desktop canvas there is room either side. At phone width a label that
       sits near the edge runs off it and loses its end (a unit, a sign, the
       last word). While the screen is narrow, text drawn in an unrotated frame
       is slid back inside the canvas by exactly its overhang — fillText and
       strokeText get the same shift, so a halo stays under its text. Text in
       a rotated frame, and text wider than the canvas itself, are left alone. */
    var narrow = mq.matches;
    function track() { narrow = mq.matches; }
    if (mq.addEventListener) mq.addEventListener('change', track);
    else if (mq.addListener) mq.addListener(track);

    var proto = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (!proto || !proto.getTransform) return;
    var PAD = 3;   /* CSS px kept between a label and the edge */
    ['fillText', 'strokeText'].forEach(function (name) {
        var draw = proto[name];
        proto[name] = function (text, x, y, maxWidth) {
            if (narrow && this.canvas && this.canvas.width > 0) {
                var t = this.getTransform();
                if (t.b === 0 && t.c === 0 && t.a > 0) {
                    var w = this.measureText(text).width;
                    if (maxWidth !== undefined && w > maxWidth) w = maxWidth;
                    var a = this.textAlign, rtl = this.direction === 'rtl';
                    var left = a === 'center' ? x - w / 2
                             : (a === 'right' || (a === 'end' && !rtl) || (a === 'start' && rtl)) ? x - w
                             : x;
                    var lo = PAD * t.a, hi = this.canvas.width - PAD * t.a;
                    var L = t.a * left + t.e, R = L + t.a * w;
                    if (R - L <= hi - lo) {
                        if (R > hi) x -= (R - hi) / t.a;
                        else if (L < lo) x += (lo - L) / t.a;
                    }
                }
            }
            return maxWidth === undefined ? draw.call(this, text, x, y)
                                          : draw.call(this, text, x, y, maxWidth);
        };
    });
}());
