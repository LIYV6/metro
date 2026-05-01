/* multiline-nav.js
   目标：在启用 .main-nav.multiline-nav 时，自动计算导航换行并将行数/行高写入 CSS 变量：
     --nav-rows, --nav-row-height, --header-height
   兼容性：脚本通过 resize 与 MutationObserver 触发重新计算；使用 debounce 降低重排频率。
*/
(function () {
    'use strict';

    function q(sel) { return document.querySelector(sel); }

    function debounce(fn, wait) {
        var t = null;
        return function () {
            var a = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(null, a); }, wait || 120);
        };
    }

    function waitForSelector(selector, cb, timeout) {
        timeout = typeof timeout === 'number' ? timeout : 3000;
        if (document.querySelector(selector)) return cb();
        var obs = null; var done = false;
        var timer = setTimeout(function () { if (obs) try { obs.disconnect(); } catch (e) {} if (!done) { done = true; cb(); } }, timeout);
        try {
            obs = new MutationObserver(function () { if (document.querySelector(selector)) { if (done) return; done = true; clearTimeout(timer); try { obs.disconnect(); } catch (e) {} cb(); } });
            obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        } catch (e) { clearTimeout(timer); cb(); }
    }

    function applyMultiRows() {
        var nav = q('.main-nav.multiline-nav');
        if (!nav) return;
        var navList = nav.querySelector('.nav-list');
        if (!navList) return;
        var items = Array.prototype.slice.call(navList.children || []);
        if (!items.length) {
            nav.style.setProperty('--nav-rows', '1');
            try { document.documentElement.style.setProperty('--nav-rows', '1'); } catch (e) {}
            return;
        }

        var computed = window.getComputedStyle(navList);
        var gap = 12;
        try { var gapRaw = computed.getPropertyValue('gap') || computed.getPropertyValue('column-gap') || ''; if (gapRaw) gap = parseFloat(gapRaw) || gap; } catch (e) {}
        var navWidth = Math.max(120, navList.clientWidth || nav.clientWidth || window.innerWidth);

        var rows = 1;
        try {
            var lineW = 0;
            for (var i = 0; i < items.length; i++) {
                var w = items[i].getBoundingClientRect().width || 80;
                if (lineW === 0) { lineW = w; }
                else {
                    if (lineW + gap + w <= navWidth + 0.5) { lineW += gap + w; }
                    else { rows++; lineW = w; }
                }
            }
        } catch (e) {
            rows = Math.max(1, Math.ceil(items.length / Math.max(1, Math.floor(navWidth / 80))));
        }

        nav.style.setProperty('--nav-rows', String(rows));
        try { document.documentElement.style.setProperty('--nav-rows', String(rows)); } catch (e) {}

        var rowH = 64;
        try {
            var navInner = nav.querySelector('.nav-inner');
            var navListRect = navList.getBoundingClientRect();
            var innerRect = navInner ? navInner.getBoundingClientRect() : null;
            var totalH = navListRect.height || (innerRect && innerRect.height) || 0;
            if (totalH > 0) rowH = Math.max(24, Math.round(totalH / Math.max(1, rows)));
            else {
                var sample = items[0];
                var rect = sample.getBoundingClientRect();
                rowH = Math.max(32, rect.height || 64);
            }
            var niStyle = navInner ? window.getComputedStyle(navInner) : null;
            var vPad = 0;
            if (niStyle) { var pt = parseFloat(niStyle.paddingTop) || 0; var pb = parseFloat(niStyle.paddingBottom) || 0; vPad = pt + pb; }
            rowH = Math.round(rowH + vPad / Math.max(1, rows));
        } catch (e) { rowH = parseFloat(getComputedStyle(nav).getPropertyValue('--nav-row-height')) || 64; }

        nav.style.setProperty('--nav-row-height', String(Math.round(rowH)) + 'px');
        nav.style.height = 'auto';

        try {
            var headerH = Math.round(rows * rowH) || 64;
            document.documentElement.style.setProperty('--header-height', headerH + 'px');
            try { nav.style.setProperty('--header-height', headerH + 'px'); } catch (e) {}
            try { document.body.style.paddingTop = headerH + 'px'; } catch (e) {}
            try { document.documentElement.style.setProperty('--nav-row-height', Math.round(rowH) + 'px'); } catch (e) {}
        } catch (e) {}

        var perLine = Math.max(1, Math.ceil(items.length / Math.max(1, rows)));
        try { window.dispatchEvent(new CustomEvent('multiline-nav:change', { detail: { rows: rows, perLine: perLine, gap: gap } })); } catch (e) {}

        try { requestAnimationFrame(function () { setTimeout(debouncedApply, 120); }); } catch (e) {}
    }

    var debouncedApply = debounce(applyMultiRows, 120);

    waitForSelector('.main-nav.multiline-nav', function () {
        debouncedApply();
        try {
            var links = Array.prototype.slice.call(document.querySelectorAll('.main-nav.multiline-nav .nav-list a')) || [];
            var curPath = (window.location.pathname || window.location.href).replace(/\\/g, '/');
            links.forEach(function (a) {
                try {
                    var href = a.getAttribute('href') || '';
                    var tmp = document.createElement('a'); tmp.href = href;
                    var targetPath = (tmp.pathname || '').replace(/\\/g, '/');
                    if (targetPath && curPath.indexOf(targetPath) !== -1) a.classList.add('active'); else a.classList.remove('active');
                    a.addEventListener('click', function () { links.forEach(function (el) { el.classList.remove('active'); }); try { a.classList.add('active'); } catch (e) {} }, false);
                } catch (e) {}
            });
        } catch (e) {}
        window.addEventListener('resize', debouncedApply);
        try {
            var navListEl = q('.main-nav.multiline-nav .nav-list');
            if (navListEl && window.MutationObserver) { var mo = new MutationObserver(debouncedApply); mo.observe(navListEl, { childList: true, subtree: false }); }
        } catch (e) {}
    }, 3000);

})();
