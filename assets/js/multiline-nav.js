/*multiline-nav.js功能：可选的多行顶部导航布局与 JS 支持模板
  功能模板包含：
  - 当导航项溢出单行时，按宽度自动分成多行（使用 CSS flex-wrap），并在必要时调整 header 高度。
  - 提供可选的 JS：动态计算每行显示项数、调整底部背景范围、以及在窗口大小变化时做平滑过渡。
Active multiline-nav JS
   当前实现行为：
   - 自动计算导航行数并写入 CSS 变量 --nav-rows 与 --nav-row-height
   - 使用精确的逐项累加算法确定真实换行（支持任意行数：2行、3行或更多）
   - 测量单行高度并将根变量 --header-height 更新为 rows * rowHeight
       （同时同步设置 document.body.style.paddingTop 以确保页面主体即时下移，避免被 header 覆盖）
   - 使用 debounce、MutationObserver 与短延迟的二次测量策略以应对字体/图片加载引起的重排
   - 注意：原先的 mobile-nav.js 已被移除，移动端横向滑动逻辑默认被禁用；若需恢复，请在 CSS 中解除注释并加入相应的滚动渐变绑定。
*/
(function () {
    'use strict';

    function q(sel) { return document.querySelector(sel); }

    function debounce(fn, wait) {
        var t = null; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, wait || 120); };
    }

    function waitForSelector(selector, cb, timeout) {
        timeout = typeof timeout === 'number' ? timeout : 3000;
        var el = document.querySelector(selector);
        if (el) return cb();
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
        if (!items.length) { nav.style.setProperty('--nav-rows', 1); return; }

        // 更精确的换行计算：逐项累加宽度（包含 gap），按 navList 实际宽度换行以得到真实行数
        var computed = window.getComputedStyle(navList);
        var gap = 12;
        try { var gapRaw = computed.getPropertyValue('gap') || computed.getPropertyValue('column-gap') || ''; if (gapRaw) gap = parseFloat(gapRaw) || gap; } catch (e) {}
        var navWidth = Math.max(120, navList.clientWidth || nav.clientWidth || window.innerWidth);

        var rows = 1;
        try {
            var lineW = 0;
            var used = 0;
            for (var i = 0; i < items.length; i++) {
                var w = items[i].getBoundingClientRect().width || 80;
                // 如果当前行为空，放入当前项（不加入 gap）
                if (lineW === 0) {
                    lineW = w; used = 1;
                } else {
                    // 预估加入 gap 后的宽度
                    if (lineW + gap + w <= navWidth + 0.5) { // +0.5 容忍子像素
                        lineW += gap + w; used++;
                    } else {
                        // 换行
                        rows++;
                        lineW = w; used = 1;
                    }
                }
            }
        } catch (e) { rows = Math.max(1, Math.ceil(items.length / Math.max(1, Math.floor(navWidth / 80)))); }

        // 设置 CSS 变量供样式使用
        nav.style.setProperty('--nav-rows', String(rows));
        // 测量单行高度（优先使用第一个可测元素的高度），并考虑 nav-inner 的上下内边距
        var rowH = 64;
        try {
            var sample = items[0];
            var rect = sample.getBoundingClientRect();
            // 尽量测量文本行高或项高度
            rowH = Math.max(32, rect.height || 64);
            // 读取 nav-inner 垂直 padding
            var navInner = nav.querySelector('.nav-inner');
            var niStyle = navInner ? window.getComputedStyle(navInner) : null;
            var vPad = 0;
            if (niStyle) {
                var pt = parseFloat(niStyle.paddingTop) || 0;
                var pb = parseFloat(niStyle.paddingBottom) || 0;
                // 单行高度应包含一行内容高度与 nav-inner 的垂直内边距分摊
                vPad = pt + pb;
            }
            // 将最终单行高度写入（加上内边距的平均分配 / 行数近似）
            // 为简单处理，将单行高度设为内容高度（rowH） + navInner 垂直内边距的平均值（这里使用 full vPad）
            rowH = rowH + vPad / Math.max(1, rows);
        } catch (e) { rowH = parseFloat(getComputedStyle(nav).getPropertyValue('--nav-row-height')) || 64; }

        nav.style.setProperty('--nav-row-height', String(Math.round(rowH)) + 'px');
        nav.style.height = 'auto';

        // 更新根变量 --header-height 为 rows * rowH，保证 body padding-top 同步
        try {
            var headerH = Math.round(rows * rowH) || 64;
            document.documentElement.style.setProperty('--header-height', headerH + 'px');
            // 立即同步设置 body 的 padding-top，以保证视觉上页面内容立刻下移，避免在某些布局或浏览器中被覆盖
            try { document.body.style.paddingTop = headerH + 'px'; } catch (e) {}
        } catch (e) {}

        // 派发事件，供页面其他部分监听
        try { window.dispatchEvent(new CustomEvent('multiline-nav:change', { detail: { rows: rows, perLine: perLine, gap: gap } })); } catch (e) {}

        // 为了应对字体或图片加载引起的重排，短时延后再次测量以稳定高度（双测量策略）
        try {
            requestAnimationFrame(function () { setTimeout(debouncedApply, 120); });
        } catch (e) {}
    }

    var debouncedApply = debounce(applyMultiRows, 120);

    waitForSelector('.main-nav.multiline-nav', function () {
        // 初始运行
        debouncedApply();
        // 自动高亮：基于当前 URL 的 pathname 或点击时即时高亮
        try {
            var links = Array.prototype.slice.call(document.querySelectorAll('.main-nav.multiline-nav .nav-list a')) || [];
            var curPath = (window.location.pathname || window.location.href).replace(/\\/g, '/');
            links.forEach(function (a) {
                try {
                    var href = a.getAttribute('href') || '';
                    var tmp = document.createElement('a'); tmp.href = href;
                    var targetPath = (tmp.pathname || '').replace(/\\/g, '/');
                    if (targetPath && curPath.indexOf(targetPath) !== -1) {
                        a.classList.add('active');
                    } else {
                        a.classList.remove('active');
                    }

                    // 点击时即时设置 active
                    a.addEventListener('click', function () {
                        links.forEach(function (el) { el.classList.remove('active'); });
                        try { a.classList.add('active'); } catch (e) {}
                    }, false);
                } catch (e) {}
            });
        } catch (e) {}
        // resize 监听
        window.addEventListener('resize', debouncedApply);
        // 若页面里会动态添加/移除 nav 项，监听子节点变化
        try {
            var navList = q('.main-nav.multiline-nav .nav-list');
            if (navList && window.MutationObserver) {
                var mo = new MutationObserver(debouncedApply);
                mo.observe(navList, { childList: true, subtree: false });
            }
        } catch (e) {}
    }, 3000);

})();
