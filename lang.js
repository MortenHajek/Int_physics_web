/* ── CS/EN language switch ────────────────────────────────────────────────
   Loaded in <head> WITHOUT defer so the stored choice lands on <html>
   before first paint (no flash of the wrong language).
   Markup contract: bilingual content is duplicated in sibling elements
   carrying lang="en" / lang="cs"; styles.css hides the inactive one via
   html[data-lang]. The switch itself is any .lang-switch element holding
   buttons with data-lang-btn="en" / "cs".
   The language also travels in the URL (?lang=en) — internal links are
   rewritten to carry it, so navigation keeps the language even where
   localStorage does not span pages (file:// in some browsers).           */
(function () {
    'use strict';

    var KEY  = 'pp-lang';
    var root = document.documentElement;

    /* URL parameter wins over a stored preference, which wins over the
       default. The course is Czech, so a first-time visitor gets Czech. */
    var lang = 'cs';
    var m = /[?&]lang=(cs|en)(?:&|$)/.exec(window.location.search);
    if (m) {
        lang = m[1];
    } else {
        try { lang = localStorage.getItem(KEY) || 'cs'; } catch (e) { /* storage unavailable */ }
    }
    if (lang !== 'en') lang = 'cs';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* storage unavailable */ }

    function apply(l) {
        root.setAttribute('data-lang', l);
        root.setAttribute('lang', l);
    }
    apply(lang);

    /* Internal page link = relative href to an .html file (not http:,
       mailto:, or a pure #anchor). */
    function isInternal(href) {
        return !!href && !/^[a-z][a-z0-9+.-]*:/i.test(href) &&
               href.charAt(0) !== '#' && /\.html($|[?#])/i.test(href);
    }

    /* Return href with the lang param set (cs) or stripped (en),
       preserving any other query params and the #hash. */
    function withLang(href, l) {
        var hash = '';
        var i = href.indexOf('#');
        if (i !== -1) { hash = href.slice(i); href = href.slice(0, i); }
        var path = href, query = '';
        var j = href.indexOf('?');
        if (j !== -1) { path = href.slice(0, j); query = href.slice(j + 1); }
        var params = query ? query.split('&').filter(function (p) {
            return p.indexOf('lang=') !== 0 && p !== '';
        }) : [];
        if (l === 'en') params.push('lang=en');   /* only the non-default needs carrying */
        return path + (params.length ? '?' + params.join('&') : '') + hash;
    }

    function rewriteLinks() {
        document.querySelectorAll('a[href]').forEach(function (a) {
            var href = a.getAttribute('href');
            if (isInternal(href)) a.setAttribute('href', withLang(href, lang));
        });
    }

    function syncButtons() {
        document.querySelectorAll('.lang-switch [data-lang-btn]').forEach(function (btn) {
            btn.classList.toggle('on', btn.getAttribute('data-lang-btn') === lang);
        });
    }

    function set(l) {
        lang = l;
        apply(l);
        try { localStorage.setItem(KEY, l); } catch (e) { /* storage unavailable */ }
        /* Keep the address bar in step so reload/back preserves the choice. */
        try {
            history.replaceState(null, '',
                withLang(window.location.pathname.split('/').pop() || 'index.html', l)
                + window.location.hash);
        } catch (e) { /* file:// in some browsers */ }
        syncButtons();
        rewriteLinks();
        /* Sims that draw text into a canvas listen for this to redraw. */
        document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } }));
    }

    document.addEventListener('DOMContentLoaded', function () {
        syncButtons();
        rewriteLinks();
        document.querySelectorAll('.lang-switch [data-lang-btn]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                set(btn.getAttribute('data-lang-btn'));
            });
        });
    });
}());
