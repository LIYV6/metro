// =====
// 内容加载
// 职责：
//   1. 从 JSON5 文件加载页面数据（含缓存比对 + 自动刷新）
//   2. 根据数据动态生成导航栏与内容 section
//   3. 处理导航点击、URL hash 同步、浏览器前进/后退
//   4. XSS 安全净化（DOMPurify 白名单）

// 数据模型（page-*.json5）：
//   navGroups[]  — 父导航分组（children 数组控制子导航，空数组则显示空白）
//   articles{}   — 每篇文章的 type/title/navLabel/content 等
// =====

// 调试配置
// =====
const LOADER_DEBUG_CONFIG = {
    ENABLE_LOADER_LOGS: false,   // 总开关
    ENABLE_CACHE_LOGS: false,    // 缓存
    ENABLE_REFRESH_LOGS: false,  // 自动刷新
    ENABLE_RENDER_LOGS: false    // 渲染
};
// =====
// 日志函数
// =====
/** 按模块开关的调试日志 @param {string} level @param {...*} args */
function debugLog(level, ...args) {
    if (!LOADER_DEBUG_CONFIG.ENABLE_LOADER_LOGS) return;

    const msg = args[0] || '';
    const isCache   = msg.includes('缓存') || msg.includes('cache');
    const isRefresh = msg.includes('刷新') || msg.includes('refresh');
    const isRender  = msg.includes('渲染') || msg.includes('render') || msg.includes('容器');

    if (isCache   && !LOADER_DEBUG_CONFIG.ENABLE_CACHE_LOGS)   return;
    if (isRefresh && !LOADER_DEBUG_CONFIG.ENABLE_REFRESH_LOGS) return;
    if (isRender  && !LOADER_DEBUG_CONFIG.ENABLE_RENDER_LOGS)  return;

    const p = ['[Loader]', ...args];
    switch (level) {
        case 'info':    console.log(...p); break;
        case 'warn':    console.warn(...p); break;
        case 'error':   console.error(...p); break;
        case 'success': console.log('%c\u2713', 'color:#4caf50;font-weight:bold', ...p); break;
        default:        console.log(...p);
    }
}
// =====
// Mustache 模板（对应 page-*.json5 中 article.type 字段）
// 标题装饰线颜色 → 见 assets/css/base.css 中 :root 的 --accent-line-color
// =====
const Templates = {
    article: `
<header class="card-header">
    <h2 class="card-title">{{title}}</h2>
    {{#date}}{{#author}}<div class="card-meta"><span class="meta-date">发布于{{date}}</span><span class="meta-author">作者：{{author}}</span></div>{{/author}}{{/date}}
    {{#date}}{{^author}}<div class="card-meta"><span class="meta-date">发布于{{date}}</span></div>{{/author}}{{/date}}
    {{^date}}{{#author}}<div class="card-meta"><span class="meta-author">作者：{{author}}</span></div>{{/author}}{{/date}}
</header>
<div class="card-body">{{{content}}}</div>`,
    statement: `
<header class="card-header">
    <h3 class="card-title">{{title}}</h3>
    {{#date}}<div class="card-meta meta-date"><span class="meta-date">最后更新时间：{{date}}</span></div>{{/date}}
</header>
<div class="card-body">{{{content}}}</div>`,
    news: `
<header class="card-header">
    <h2 class="card-title">{{title}}</h2>
    {{#date}}{{#author}}<div class="card-meta"><span class="meta-date">{{date}}报道</span><span class="meta-author">记者：{{author}}</span></div>{{/author}}{{/date}}
    {{#date}}{{^author}}<div class="card-meta"><span class="meta-date">{{date}}报道</span></div>{{/author}}{{/date}}
    {{^date}}{{#author}}<div class="card-meta"><span class="meta-author">记者：{{author}}</span></div>{{/author}}{{/date}}
</header>
<div class="card-body">{{{content}}}</div>`
};

// =====
// 页面运行时状态
// =====
const pageState = {
    globalConfig: null,
    currentPageData: null,
    currentHash: '',
    currentAutoRefreshEnabled: null,
    currentAutoRefreshInterval: null,
    refreshTimer: null,
    pageId: window.PAGE_ID || 'index',
    globalConfigUrl: '../assets/data/global.json5',
    groupPopstateBound: false
};

// =====
// 安全 / 工具函数
// =====

/** HTML 实体转义（DOMPurify 不可用时的降级方案） */
function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** XSS 净化：DOMPurify 白名单 + escapeHtml 降级 */
function sanitizeContent(html, rules) {
    if (!html || typeof html !== 'string') return '';
    const defaults = {
        allowedTags: ['p','br','b','strong','i','em','a'],
        allowedAttr: ['href','target','title'],
        forbidAttr:  ['onerror','onload','onclick','onmouseover']
    };
    const cfg = { ...defaults, ...(rules || {}) };
    if (window.DOMPurify) {
        return window.DOMPurify.sanitize(html, {
            ALLOWED_TAGS:            cfg.allowedTags,
            ALLOWED_ATTR:            cfg.allowedAttr,
            FORBID_ATTR:             cfg.forbidAttr,
            ADD_ATTR:                ['target="_blank"','rel="noopener noreferrer"'],
            ALLOW_UNKNOWN_PROTOCOLS: false
        });
    }
    return escapeHtml(html);
}

/** 时间间隔解析：支持 '5s' / '2m' / '1h' / '1d' 或毫秒数 */
function parseIntervalToMs(input) {
    if (input == null) return 0;
    if (typeof input === 'number' && !isNaN(input)) return input;
    if (typeof input === 'string') {
        const m = input.trim().toLowerCase().match(/^(\d+)\s*(ms|s|m|h|d)?$/);
        if (!m) return 0;
        const v = parseInt(m[1], 10);
        const u = m[2] || 'ms';
        switch (u) {
            case 'ms': return v;
            case 's':  return v * 1000;
            case 'm':  return v * 60000;
            case 'h':  return v * 3600000;
            case 'd':  return v * 86400000;
            default:   return v;
        }
    }
    return 0;
}

/** 异步加载 JSON5 文件 */
async function fetchJsonData(url) {
    try {
        const res = await fetch(`${url}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return JSON5.parse(await res.text());
    } catch (e) {
        debugLog('error', `JSON5 加载失败: ${url}`, e);
        return null;
    }
}

// =====
// 渲染引擎
// =====

/** 核心渲染：Mustache 模板 + 安全净化 */
function renderArticle(tplText, data, securityRules) {
    if (!data || typeof data !== 'object') return '';

    const d = { ...data };
    const ctx = {
        title:   escapeHtml(d.title || ''),
        date:    escapeHtml(d.date || ''),
        author:  escapeHtml(d.author || ''),
        content: d.content || ''
    };

    // 图片占位符 {{img:id}}
    if (d.images && typeof d.images === 'object') {
        Object.keys(d.images).forEach(id => {
            const img = d.images[id];
            if (!img || !img.src) { ctx.content = ctx.content.replace(`{{img:${id}}}`, ''); return; }
            const tag = `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt||'')}" title="${escapeHtml(img.title||'')}" width="${escapeHtml(img.width||'100%')}" loading="lazy">`;
            ctx.content = ctx.content.replace(`{{img:${id}}}`, tag);
        });
    }
    ctx.content = ctx.content.replace(/{{img:[\w-]+?}}/g, '');
    ctx.content = sanitizeContent(ctx.content, securityRules);

    return Mustache.render(tplText, ctx);
}

// =====
// 内容注入调度
// =====
/**
 * 根据页面类型分发渲染：
 *   有 navGroups  → 多层级导航
 *   其它          → DOM ID 匹配（index 等）
 */
function injectAllArticles() {
    if (!pageState.globalConfig || !pageState.currentPageData) {
        debugLog('warn', 'injectAll: 全局配置或页面数据为空');
        return;
    }
    const articles = pageState.currentPageData.articles;
    if (!articles || typeof articles !== 'object') {
        debugLog('warn', 'injectAll: articles 缺失');
        return;
    }
    debugLog('info', `渲染页面，共 ${Object.keys(articles).length} 篇文章`);

    const sec = pageState.globalConfig.security;

    // 多层级导航
    if (pageState.currentPageData.navGroups) {
        buildNavGroupPage(articles, sec);
        return;
    }
    // DOM ID 匹配
    Object.keys(articles).forEach(key => {
        try {
            const art = articles[key];
            const el = document.getElementById(key);
            if (!el) { debugLog('warn', `容器 #${key} 不存在`); return; }

            el.innerHTML = '';
            const w = document.createElement(art.semanticTag || 'div');
            if (art.wrapperClass) w.className = art.wrapperClass;
            if (!el.id) w.id = key;
            w.innerHTML = renderArticle((Templates[art.type] || Templates.article), art, sec);
            el.appendChild(w);
        } catch (e) { debugLog('error', `渲染 #${key} 失败`, e); }
    });
    debugLog('info', '渲染完成');
}

// =====
// 多层级导航
// =====

function buildNavGroupPage(articles, sec) {
    const groups = pageState.currentPageData.navGroups;
    const sc = document.querySelector('.content-area');
    const pnl = document.querySelector('.parent-nav-list');
    const snl = document.querySelector('.child-nav-list');
    if (!sc || !pnl || !snl) return;
    debugLog('info', '构建多层级导航页面');

    // 为容器自动添加 id（若 HTML 未设置）
    if (!pnl.parentNode.id) pnl.parentNode.id = 'parent-nav';
    if (!snl.parentNode.id) snl.parentNode.id = 'child-nav';

    // 1. 生成所有 section
    sc.innerHTML = '';
    Object.keys(articles).forEach(key => {
        const art = articles[key];
        if (!art) return;
        const section = document.createElement('section');
        section.className = 'content-section';
        section.id = key;
        if (art.parentGroup) section.dataset.parentGroup = art.parentGroup;
        const w = document.createElement(art.semanticTag || 'div');
        if (art.wrapperClass) w.className = art.wrapperClass;
        w.innerHTML = renderArticle((Templates[art.type] || Templates.article), art, sec);
        section.appendChild(w);
        sc.appendChild(section);
    });

    // 2. 生成父导航（始终横向滚动）
    pnl.innerHTML = '';
    groups.forEach(g => {
        const li = document.createElement('li');
        li.className = 'parent-nav-item';
        const a = document.createElement('a');
        a.className = 'parent-nav-link';
        a.href = '#';
        a.textContent = g.label;
        a.dataset.groupId = g.id;
        a.addEventListener('click', e => { e.preventDefault(); onParentNavClick(g, articles, pnl); });
        li.appendChild(a);
        pnl.appendChild(li);
    });

    // 3. 确定初始分组（URL hash 优先）
    let initGroup = groups[0];
    const initHash = window.location.hash;
    if (initHash) {
        const section = document.getElementById(initHash.substring(1));
        if (section) {
            const pg = section.dataset.parentGroup;
            const found = pg ? groups.find(g => g.id === pg) : groups.find(g => g.id === initHash.substring(1));
            if (found) initGroup = found;
        }
    }
    pnl.querySelector(`[data-group-id="${initGroup.id}"]`)?.classList.add('active');

    // 4. 构建子导航
    buildSubNavList(initGroup, articles, snl);

    // 5. 激活 hash 对应的内容
    if (initHash) {
        const tk = initHash.substring(1);
        const link = snl.querySelector(`[href="#${tk}"]`);
        if (link) {
            link.classList.add('active');
            document.getElementById(tk)?.classList.add('is-active');
        }
        // 空 children 分组且有 hash：section 不激活，自然空白
    } else if (initGroup.children && initGroup.children.length > 0) {
        snl.querySelector('.child-nav-link')?.click();
    }
    // 初始分组 children 为空：不激活任何 section，自然空白

    // 6. 浏览器前进/后退
    if (!pageState.groupPopstateBound) {
        pageState.groupPopstateBound = true;
        window.addEventListener('popstate', () => {
            const h = window.location.hash;
            if (!h) return;
            const tk = h.substring(1);
            const section = document.getElementById(tk);
            if (!section) return;
            const pg = section.dataset.parentGroup;
            const tg = pg ? groups.find(g => g.id === pg) : groups.find(g => g.id === tk);
            if (!tg) return;

            pnl.querySelectorAll('.parent-nav-link').forEach(a => a.classList.remove('active'));
            pnl.querySelector(`[data-group-id="${tg.id}"]`)?.classList.add('active');
            buildSubNavList(tg, articles, snl);

            const link = snl.querySelector(`[href="#${tk}"]`);
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('is-active'));

            if (tg.children && tg.children.length > 0) {
                if (link) {
                    snl.querySelectorAll('.child-nav-link').forEach(a => a.classList.remove('active'));
                    link.classList.add('active');
                }
                section.classList.add('is-active');
            }
            // 空 children 分组：不激活 section，自然空白
        });
    }

    document.body.classList.add('js-loaded');
}

/** 父导航点击：切换分组 + 构建子导航 */
function onParentNavClick(group, articles, pnl) {
    const snl = document.querySelector('.child-nav-list');
    if (!snl) return;
    pnl.querySelectorAll('.parent-nav-link').forEach(a => a.classList.remove('active'));
    pnl.querySelector(`[data-group-id="${group.id}"]`)?.classList.add('active');
    buildSubNavList(group, articles, snl);

    if (group.children && group.children.length > 0) {
        snl.querySelector('.child-nav-link')?.click();
    } else {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('is-active'));
        if (history.pushState) history.pushState(null, null, `#${group.id}`);
    }
}

/** 构建子导航列表（左侧垂直样式） */
function buildSubNavList(group, articles, snl) {
    snl.innerHTML = '';

    if (group.children && group.children.length > 0) {
        group.children.forEach(k => {
            const art = articles[k];
            if (art) snl.appendChild(makeNavLi(k, art.navLabel || k, snl));
        });
    }

    const panel = document.getElementById('child-nav');
    if (panel) panel.style.display = (group.children && group.children.length > 0) ? '' : 'none';
}

// =====
// 导航通用函数
// =====

/** 创建 <li><a class="child-nav-link"> 并绑定事件 */
function makeNavLi(key, label, navList) {
    const li = document.createElement('li');
    li.className = 'child-nav-item';
    const a = document.createElement('a');
    a.className = 'child-nav-link';
    a.href = `#${key}`;
    a.textContent = label;
    a.dataset.targetKey = key;
    bindNavClick(a, navList);
    li.appendChild(a);
    return li;
}

/** 导航点击事件（含触摸拖动检测：防止横向滑动时误触） */
function bindNavClick(linkElement, navList) {
    let dragging = false, sx = 0;

    linkElement.addEventListener('touchstart', e => { sx = e.touches[0].clientX; dragging = false; }, { passive: true });
    linkElement.addEventListener('touchmove', e => { if (Math.abs(e.touches[0].clientX - sx) > 10) dragging = true; }, { passive: true });
    linkElement.addEventListener('click', e => {
        if (dragging) { e.preventDefault(); return; }
        e.preventDefault();
        switchToSection(linkElement.dataset.targetKey, navList);
    });
}

/** 根据 URL hash 或第一项激活导航 */
function activateNavItem(navList) {
    const h = window.location.hash;
    let tk = null;
    if (h) {
        const sec = document.getElementById(h.substring(1));
        if (sec) tk = h.substring(1);
    }
    if (!tk) {
        const first = navList.querySelector('a[data-target-key]');
        if (first) tk = first.dataset.targetKey;
    }
    if (tk) {
        switchToSection(tk, navList);
        if (!h && history.replaceState) history.replaceState(null, null, `#${tk}`);
    }
}

/** 切换显示指定 section，同步导航高亮和历史记录 */
function switchToSection(targetKey, navList) {
    if (navList) {
        navList.querySelectorAll('a[data-target-key]').forEach(a => a.classList.remove('active'));
        queryNavLink(navList, targetKey, a => a.classList.add('active'));
    }
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('is-active'));
    document.getElementById(targetKey)?.classList.add('is-active');
    if (history.pushState) history.pushState(null, null, `#${targetKey}`);
}

/** 在 navList 中按 data-target-key 查找链接并执行回调 */
function queryNavLink(navList, key, fn) {
    const link = navList.querySelector(`[data-target-key="${key}"]`);
    if (link) fn(link);
}

// =====
// 自动刷新
// =====

/** 刷新开关控制 */
function updateAutoRefresh(enabled, interval) {
    if (pageState.currentAutoRefreshEnabled === enabled && pageState.currentAutoRefreshInterval === interval) return;

    if (pageState.refreshTimer) { clearTimeout(pageState.refreshTimer); pageState.refreshTimer = null; }

    pageState.currentAutoRefreshEnabled = enabled;
    pageState.currentAutoRefreshInterval = interval;

    if (enabled) {
        pageState.currentAutoRefreshInterval = parseIntervalToMs(interval);
        debugLog('info', `自动刷新已启动，间隔 ${pageState.currentAutoRefreshInterval}ms`);
        startRefreshLoop();
    } else {
        debugLog('info', '自动刷新已关闭');
    }
}

/** 刷新循环 */
async function startRefreshLoop() {
    const tick = async () => {
        try {
            // 每次循环前重读全局配置（可能被实时修改）
            const gCfg = await fetchJsonData(pageState.globalConfigUrl);
            if (gCfg) {
                pageState.globalConfig = gCfg;
                updateAutoRefresh(gCfg.autoRefresh?.enabled ?? true, gCfg.autoRefresh?.interval ?? 3000);
            }
            if (!pageState.currentAutoRefreshEnabled) return;

            const dataUrl = `${pageState.globalConfig.system.dataBasePath}page-${pageState.pageId}.json5`;
            const pd = await fetchJsonData(dataUrl);
            if (!pd) return;

            const h = JSON.stringify(pd);
            if (pageState.currentHash !== h) {
                debugLog('info', `[${pageState.pageId}] 数据已更新，重渲染`);
                pageState.currentPageData = pd;
                injectAllArticles();
                try { localStorage.setItem(`pagecache:${pageState.pageId}`, JSON.stringify(pd)); } catch (e) {}
                pageState.currentHash = h;
            }
        } catch (e) { debugLog('error', '刷新循环异常', e); }

        if (pageState.currentAutoRefreshEnabled) pageState.refreshTimer = setTimeout(tick, pageState.currentAutoRefreshInterval);
    };
    await tick();
}

// =====
// 初始化
// =====

/** 加载页面数据（服务器 → 缓存比对 → 降级兜底） */
async function loadPageData() {
    const url = `${pageState.globalConfig.system.dataBasePath}page-${pageState.pageId}.json5`;
    try {
        const fresh = await fetchJsonData(url);
        if (fresh) {
            const fh = JSON.stringify(fresh);
            const cached = localStorage.getItem(`pagecache:${pageState.pageId}`);

            // 缓存命中 → 使用缓存
            if (cached) {
                try {
                    if (fh === JSON.stringify(JSON.parse(cached))) {
                        pageState.currentPageData = JSON.parse(cached);
                        injectAllArticles();
                        pageState.currentHash = fh;
                        debugLog('info', '数据未变，使用缓存');
                        return;
                    }
                } catch (e) { /* 忽略 */ }
            }

            // 使用新数据
            pageState.currentPageData = fresh;
            injectAllArticles();
            pageState.currentHash = fh;
            try { localStorage.setItem(`pagecache:${pageState.pageId}`, JSON.stringify(fresh)); } catch (e) {}

        } else {
            // 服务器不可达 → 缓存兜底
            const cached = localStorage.getItem(`pagecache:${pageState.pageId}`);
            if (cached) {
                pageState.currentPageData = JSON.parse(cached);
                injectAllArticles();
                pageState.currentHash = JSON.stringify(pageState.currentPageData);
                debugLog('info', '服务器不可达，使用缓存');
            } else {
                debugLog('error', '无缓存且服务器不可达');
            }
        }
    } catch (e) {
        // 异常兜底
        const cached = localStorage.getItem(`pagecache:${pageState.pageId}`);
        if (cached) {
            try {
                pageState.currentPageData = JSON.parse(cached);
                injectAllArticles();
                pageState.currentHash = JSON.stringify(pageState.currentPageData);
                debugLog('info', '异常兜底，使用缓存');
            } catch (pe) { debugLog('error', '缓存解析失败', pe); }
        }
    }
}

/** 页面初始化入口 */
async function initPage() {
    try {
        debugLog('info', `初始化页面: ${pageState.pageId}`);

        // 1. 全局配置
        pageState.globalConfig = await fetchJsonData(pageState.globalConfigUrl);
        if (!pageState.globalConfig) { debugLog('error', '全局配置加载失败，终止'); return; }

        // 2. 刷新参数
        const en = pageState.globalConfig.autoRefresh?.enabled ?? true;
        const iv = pageState.globalConfig.autoRefresh?.interval ?? 3000;
        debugLog('info', `自动刷新: ${en}, 间隔: ${iv}`);

        // 3. 加载页面数据（关闭刷新时走缓存逻辑）
        if (!en) await loadPageData();

        // 4. 启动
        updateAutoRefresh(en, parseIntervalToMs(iv));
        debugLog('info', '初始化完成');
    } catch (e) { debugLog('error', '初始化失败', e); }
}

// =====
// 启动
// =====

document.addEventListener('DOMContentLoaded', initPage);
