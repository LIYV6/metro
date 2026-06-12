
// ==================== 统一调试配置 ====================
const FRAGMENTS_DEBUG_CONFIG = {
    // 全局调试开关
    enabled: false,
    // 模块级开关
    modules: {
        fragments: true,       // 片段加载相关日志
        mobileMenu: true       // 移动端汉堡菜单日志
    }
};

/**
 * 统一调试日志函数
 * @param {string} module - 模块名称 ('fragments')
 * @param {...*} args - 日志内容
 */
function debugLog(module, ...args) {
    if (!FRAGMENTS_DEBUG_CONFIG.enabled) return;
    if (!FRAGMENTS_DEBUG_CONFIG.modules[module]) return;
    
    const prefix = `[Fragments-${module}]`;
    console.log(prefix, ...args);
}

(function () {
    'use strict';

    // 捕获当前文件的 debugLog，防止被后加载脚本覆盖
    const _debugLog = debugLog;

    // ---------- 默认配置（可通过构造器覆盖） ----------
    const DEFAULT_CONFIG = {
        // 占位符定义：键为片段名，值包含 selector 与 candidates（相对路径数组或生成函数）
        placeholders: {
            header: {
                    selector: '[data-include="header"]',
                    // 根据页面路径优先级生成候选路径：views 页面优先尝试上级目录
                    candidates: function () {
                        const p = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '';
                        if (p.indexOf('/views/') !== -1) {
                            return ['../partials/header.html', 'partials/header.html', '../../partials/header.html', '/partials/header.html'];
                        }
                        return ['partials/header.html', '../partials/header.html', '../../partials/header.html', '/partials/header.html'];
                    }
                },
                footer: {
                    selector: '[data-include="footer"]',
                    candidates: function () {
                        const p = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '';
                        if (p.indexOf('/views/') !== -1) {
                            return ['../partials/footer.html', 'partials/footer.html', '../../partials/footer.html', '/partials/footer.html'];
                        }
                        return ['partials/footer.html', '../partials/footer.html', '../../partials/footer.html', '/partials/footer.html'];
                    }
                }
        },
        // 去重选择器数组（保留首次出现的元素）
        dedupeSelectors: ['.site-header', '.main-footer'],
        // 在哪些注入容器内修复链接（query selector）
        linkFixContainers: ['.site-header', '.main-footer'],
        // 视图目录下常见文件名，linkFix 时会对匹配的相对链接前缀 'views/'
        viewFilenames: ['info.html','route.html','server.html', 'moreinfo.html'],
        // fetch 缓存策略，默认为 browser default
        fetchCache: 'default', // 可选 'no-store','no-cache','reload','force-cache','only-if-cached'
        // 是否将加载结果暴露为 window.__fragmentsLoaded（保持兼容），可关闭以避免全局污染
        exposeGlobalPromise: true,
        // 是否把构造函数挂到 window 用于调试/扩展
        exposeConstructor: false,
        // 运行时机：'dom-ready' 表示在 DOMContentLoaded 时运行（若已完成则立即运行）
        runOn: 'dom-ready',
        // 错误回调：(err, context) => void
        onError: function (err /*, context */) { _debugLog('fragments', '错误:', err); }
    };

    // ---------- 小型工具函数 ----------
    function isString(v) { return typeof v === 'string'; }
    function toArrayLike(nodeList) { return Array.prototype.slice.call(nodeList || []); }

    // 安全 querySelectorAll
    function qAll(selector, root = document) {
        try { return toArrayLike(root.querySelectorAll(selector)); } catch (e) { return []; }
    }

    // 使用 fetch 获取文本，发生任何错误则抛出
    async function fetchText(url, cache = 'default', signal) {
        const res = await fetch(url, { cache: cache, signal });
        if (!res.ok) throw new Error('Failed to fetch: ' + url + ' (status ' + res.status + ')');
        return await res.text();
    }

    // 依次尝试多个候选 URL（顺序），返回第一个成功的内容；若全部失败则抛错
    // candidates: [string] 或函数返回该数组
    async function tryLoadFromCandidates(candidates, cache, onError) {
        const list = isString(candidates) ? [candidates] : (typeof candidates === 'function' ? candidates() : (candidates || []));
        if (!list || !list.length) {
            const err = new Error('No candidates provided');
            onError && onError(err);
            throw err;
        }

        for (let i = 0; i < list.length; i++) {
            const url = list[i];
            try {
                const txt = await fetchText(url, cache);
                return { url: url, text: txt };
            } catch (err) {
                // 把每次失败传递给回调，但继续尝试下一个候选
                try { onError && onError(err, { url }); } catch (e) {}
                // continue
            }
        }
        const finalErr = new Error('All candidates failed');
        onError && onError(finalErr);
        throw finalErr;
    }

    // 将 html 字符串替换占位符元素（保持 DOM 节点引用稳定）
    function replacePlaceholder(el, html) {
        if (!el || !html) return null;
        const container = document.createElement('div');
        container.innerHTML = html;
        const nodes = toArrayLike(container.childNodes);
        const parent = el.parentNode;
        if (!parent) return null;
        // insert before placeholder then remove placeholder
        nodes.forEach(n => parent.insertBefore(n.cloneNode(true), el));
        parent.removeChild(el);
        return nodes;
    }

    // 去重：对于每个 selector 保留第一个匹配元素，移除其余
    function dedupeElements(selectors) {
        if (!Array.isArray(selectors)) return;
        selectors.forEach(sel => {
            try {
                const items = qAll(sel);
                if (items.length > 1) {
                    items.slice(1).forEach(i => i.parentNode && i.parentNode.removeChild(i));
                }
            } catch (e) { /* ignore per-selector errors */ }
        });
    }

    // 修复注入片段内的相对链接：支持相对路径和绝对路径的自动转换
    function fixRelativeLinks(containers, filenames) {
        try {
            const path = location.pathname || '';
            const isInViews = path.indexOf('/views/') !== -1;
            // 将文件名数组转换为查找集合
            const nameSet = Array.isArray(filenames) 
                ? filenames.reduce((set, name) => { set[name] = true; return set; }, {})
                : {};
            
            containers.forEach(containerSel => {
                qAll(containerSel).forEach(root => {
                    qAll('a', root).forEach(a => {
                        try {
                            const href = a.getAttribute('href');
                            if (!href) return;
                            // 跳过外部链接、锚点、已经是绝对路径的链接
                            if (/^(https?:)?\/\//i.test(href)) return;
                            if (href.startsWith('#')) return;
                            
                            // 如果是简单文件名（如 info.html）且在 views 目录外，添加 views/ 前缀
                            if (!isInViews && !href.startsWith('/') && !href.startsWith('./') && !href.startsWith('../')) {
                                const name = href.split('?')[0].split('#')[0];
                                if (nameSet[name]) {
                                    a.setAttribute('href', 'views/' + href);
                                }
                            }
                            // 如果在 views 目录内且链接以 /views/ 开头，转换为相对路径
                            else if (isInViews && href.startsWith('/views/')) {
                                const relativePath = href.substring(7); // 去掉 '/views/'
                                a.setAttribute('href', relativePath);
                            }
                        } catch (e) { /* per-link ignore */ }
                    });
                });
            });
        } catch (e) { /* ignore overall link-fix errors */ }
    }

    // 管理 loading state（已统一由 page-loading-overlay 处理）
    
    // ⭐ 新增：创建和移除页面loading遮罩
    let _loadingSlowTimer = null;
    let _loadingVerySlowTimer = null;

    function createPageLoadingOverlay() {
        // 如果已经存在，直接返回
        if (document.querySelector('.page-loading-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'page-loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">加载中...</div>';
        document.body.appendChild(overlay);
        
        // 添加body的loading类，隐藏main内容
        document.body.classList.add('is-loading');
        
        // 超过5秒提示加载缓慢
        _loadingSlowTimer = setTimeout(function() {
            const textEl = document.querySelector('.page-loading-overlay .loading-text');
            if (textEl) textEl.textContent = '加载缓慢，请耐心等待';
        }, 5000);

        // 超过15秒提示尝试刷新
        _loadingVerySlowTimer = setTimeout(function() {
            const textEl = document.querySelector('.page-loading-overlay .loading-text');
            if (textEl) textEl.textContent = '加载超时，请尝试刷新页面或换用更好的网络重试';
        }, 15000);
        
        // ⭐ 尝试设置 padding-top（如果 header 已加载）
        setBodyPaddingTop();
    }
    
    // ⭐ 新增：设置 body 的 padding-top
    function setBodyPaddingTop() {
        const header = document.querySelector('.site-header');
        if (header) {
            // 强制重排确保获取到正确的高度
            void header.offsetHeight;
            const headerHeight = header.getBoundingClientRect().height;
            if (headerHeight > 0) {
                document.body.style.paddingTop = headerHeight + 'px';
                _debugLog('fragments', '设置 padding-top:', headerHeight + 'px');
            }
        }
    }
    
    function removePageLoadingOverlay() {
        clearTimeout(_loadingSlowTimer);
        clearTimeout(_loadingVerySlowTimer);

        const overlay = document.querySelector('.page-loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            // 等待动画完成后移除元素
            setTimeout(function() {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
        
        // 移除body的loading类，显示main内容
        document.body.classList.remove('is-loading');
    }

    // ⭐ 新增：导航链接自动高亮功能
    function highlightActiveNav() {
        try {
            const navLinks = document.querySelectorAll('.nav-link');
            if (!navLinks || navLinks.length === 0) return;
            
            // 获取当前页面路径
            const curPath = (window.location.pathname || window.location.href).replace(/\\/g, '/');
            
            navLinks.forEach(function(a) {
                try {
                    const href = a.getAttribute('href') || '';
                    if (!href) return;
                    
                    // 创建临时 <a> 元素来解析路径
                    const tmp = document.createElement('a');
                    tmp.href = href;
                    const targetPath = (tmp.pathname || '').replace(/\\/g, '/');
                    
                    // 判断当前 URL 是否包含目标路径
                    if (targetPath && curPath.indexOf(targetPath) !== -1) {
                        a.classList.add('active');
                    } else {
                        a.classList.remove('active');
                    }
                    
                    // 点击时更新激活状态
                    a.addEventListener('click', function() {
                        navLinks.forEach(function(el) { el.classList.remove('active'); });
                        a.classList.add('active');
                    }, false);
                } catch (e) {
                    // 忽略单个链接的错误
                }
            });
        } catch (e) {
            _debugLog('fragments', '导航高亮失败:', e);
        }
    }

    // ---------- FragmentLoader 类（对外 API） ----------
    class FragmentLoader {
        constructor(options = {}) {
            this.config = Object.assign({}, DEFAULT_CONFIG, options || {});
            // 深合并 placeholders
            this.config.placeholders = Object.assign({}, DEFAULT_CONFIG.placeholders, options.placeholders || {});
            this._loadedPromise = null;
        }

        // 加载并注入所有占位符
        async load() {
            if (this._loadedPromise) return this._loadedPromise;
            const cfg = this.config;
            
            // ⭐ 创建页面loading遮罩
            createPageLoadingOverlay();

            this._loadedPromise = (async () => {
                const tasks = [];
                try {
                    Object.keys(cfg.placeholders).forEach(key => {
                        const ph = cfg.placeholders[key];
                        try {
                            const el = document.querySelector(ph.selector);
                            if (!el) return; // 占位符不存在
                            const task = (async () => {
                                try {
                                    const result = await tryLoadFromCandidates(ph.candidates, cfg.fetchCache, cfg.onError);
                                    if (result && result.text) {
                                        replacePlaceholder(el, result.text);
                                    }
                                } catch (err) {
                                    // 将错误抛给上层处理或回调
                                    cfg.onError && cfg.onError(err, { placeholder: key });
                                }
                            })();
                            tasks.push(task);
                        } catch (e) { cfg.onError && cfg.onError(e, { placeholder: key }); }
                    });

                    await Promise.all(tasks);

                    // 后处理：去重与修复链接
                    try { dedupeElements(cfg.dedupeSelectors); } catch (e) { cfg.onError && cfg.onError(e, { step: 'dedupe' }); }
                    try { fixRelativeLinks(cfg.linkFixContainers, cfg.viewFilenames); } catch (e) { cfg.onError && cfg.onError(e, { step: 'fixLinks' }); }

                    // ⭐ 新增：导航链接自动高亮
                    try { highlightActiveNav(); } catch (e) { cfg.onError && cfg.onError(e, { step: 'highlightNav' }); }
                    
                    // ⭐ header/footer 加载完成后，重新设置 padding-top
                    setBodyPaddingTop();

                    // 等待一帧以便样式重算（单层 rAF 即可）
                    await new Promise(r => requestAnimationFrame(r));

                    // ⭐ 注意：不在这里移除loading遮罩，等待window.load事件
                    // 这样可以确保loader.js等异步内容也加载完成
                    return true;
                } catch (err) {
                    // 出错时也要移除loading遮罩，避免一直转圈
                    removePageLoadingOverlay();
                    cfg.onError && cfg.onError(err, { step: 'overall' });
                    throw err;
                }
            })();

            return this._loadedPromise;
        }
    }

    // 将类或实例按配置暴露到全局（可选）以保持兼容与扩展性
    function bootDefault() {
        try {
            const defaultLoader = new FragmentLoader();
            if (defaultLoader.config.exposeConstructor && typeof window !== 'undefined') {
                window.FragmentLoader = FragmentLoader;
            }
            // 保持与旧版兼容：暴露全局 Promise（可关闭）
            if (defaultLoader.config.exposeGlobalPromise && typeof window !== 'undefined') {
                try {
                    if (!window.__fragmentsLoaded) window.__fragmentsLoaded = defaultLoader.load();
                } catch (e) { /* ignore */ }
            } else {
                // 不暴露全局时仍然自动加载但不写入全局变量
                defaultLoader.load().catch(() => {});
            }
            
            // ⭐ 监听窗口大小变化，动态调整padding-top
            window.addEventListener('resize', function() {
                clearTimeout(window.__resizeTimer);
                window.__resizeTimer = setTimeout(function() {
                    setBodyPaddingTop();
                }, 100);
            });
            
            // ⭐ 等待所有资源加载完成后才隐藏loading遮罩
            // 这样可以确保loader.js等异步内容也加载完成
            if (document.readyState === 'complete') {
                // 如果已经加载完成，延迟一点再隐藏（给其他脚本执行时间）
                setTimeout(function() {
                    removePageLoadingOverlay();
                }, 300);
            } else {
                // 否则等待window.load事件
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        removePageLoadingOverlay();
                    }, 300);
                });
            }
        } catch (e) { _debugLog('fragments', '错误:', e); }
    }

    // ---------- 运行时时机 ----------
    if (DEFAULT_CONFIG.runOn === 'dom-ready') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootDefault, { once: true });
        } else {
            // 已经 ready，立即启动
            bootDefault();
        }
    } else {
        // 未来可扩展其他生命周期选项
        bootDefault();
    }

    // ========== 移动端汉堡菜单（从 mobile-menu.js 合并） ==========
    let _menuOpen = false;
    let _menuPanel = null;
    let _menuOverlay = null;
    let _menuToggleBtn = null;
    let _populating = false; // 填充锁，防止并发轮询导致重复菜单
    const _isViewsPage = /\/views\//.test(location.pathname); // 标记当前是否在 views 目录下

    /**
     * 将导航链接填充到移动端菜单列表
     * @param {HTMLUListElement} ul - 目标 <ul>
     * @param {NodeList} navLinks - .main-nav .nav-list a 集合
     */
    function _fillMenuItems(ul, navLinks) {
        for (let i = 0; i < navLinks.length; i++) {
            const link = navLinks[i];
            const li = document.createElement('li');
            li.className = 'mobile-nav-item';

            const a = document.createElement('a');
            a.href = link.href;
            // 在非 views 页面时，修正相对路径（header.html 中的 href 基于_views/解析，导致缺少 views/ 前缀）
            if (!_isViewsPage && !a.pathname.includes('/views/') && !a.pathname.endsWith('index.html')) {
                a.href = 'views/' + link.getAttribute('href');
            }
            a.innerHTML = link.innerHTML;
            a.className = link.className || '';

            a.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const targetUrl = this.href;
                closeMobileMenu();
                setTimeout(function() { window.location.href = targetUrl; }, 150);
            }, false);

            li.appendChild(a);
            ul.appendChild(li);
        }
    }

    function createMobileMenu() {
        _menuOverlay = document.createElement('div');
        _menuOverlay.className = 'mobile-nav-overlay';
        _menuOverlay.setAttribute('aria-hidden', 'true');

        _menuPanel = document.createElement('nav');
        _menuPanel.className = 'mobile-nav-panel';
        _menuPanel.setAttribute('aria-hidden', 'true');

        const ul = document.createElement('ul');
        ul.className = 'mobile-nav-list';
        _menuPanel.appendChild(ul);

        document.body.appendChild(_menuOverlay);
        document.body.appendChild(_menuPanel);

        return { panel: _menuPanel, overlay: _menuOverlay, list: ul };
    }

    function populateMobileMenu(ul) {
        if (ul.children.length > 0 || _populating) return; // 已有内容或正在填充，跳过
        _populating = true;
        let retries = 0;
        const maxRetries = 15;
        function tryPopulate() {
            const navLinks = document.querySelectorAll('.main-nav .nav-list a');
            if (navLinks && navLinks.length > 0) {
                _populating = false;
                _debugLog('mobileMenu', '✅ 菜单填充成功，' + navLinks.length + ' 项，耗时 ' + (retries * 100) + 'ms');
                _fillMenuItems(ul, navLinks);
            } else if (retries < maxRetries) {
                retries++;
                setTimeout(tryPopulate, 100);
            } else {
                _populating = false;
                _debugLog('mobileMenu', '⚠️ 移动端菜单填充超时：导航链接未找到');
            }
        }
        tryPopulate();
    }

    function openMobileMenu() {
        if (_menuOpen) return;
        // 防御性填充：用户点击时 header 必然已加载，作为最后兜底
        const ul = _menuPanel && _menuPanel.querySelector('.mobile-nav-list');
        if (ul && ul.children.length === 0) {
            const navLinks = document.querySelectorAll('.main-nav .nav-list a');
            if (navLinks && navLinks.length > 0) {
                _fillMenuItems(ul, navLinks);
                _debugLog('mobileMenu', 'ℹ️ 移动端菜单通过 openMobileMenu 兜底填充成功');
            }
        }
        _menuOpen = true;

        _menuPanel.classList.add('active');
        _menuPanel.setAttribute('aria-hidden', 'false');
        _menuOverlay.classList.add('active');
        _menuOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (_menuToggleBtn) {
            _menuToggleBtn.classList.add('active');
            _menuToggleBtn.setAttribute('aria-expanded', 'true');
            _menuToggleBtn.setAttribute('aria-label', '关闭导航菜单');
        }
    }

    function closeMobileMenu() {
        if (!_menuOpen) return;
        _menuOpen = false;

        if (_menuToggleBtn) {
            _menuToggleBtn.classList.remove('active');
            _menuToggleBtn.setAttribute('aria-expanded', 'false');
            _menuToggleBtn.setAttribute('aria-label', '打开导航菜单');
        }

        _menuPanel.classList.remove('active');
        _menuPanel.setAttribute('aria-hidden', 'true');
        _menuOverlay.classList.remove('active');
        _menuOverlay.setAttribute('aria-hidden', 'true');

        void _menuPanel.offsetHeight;
        _menuPanel.classList.add('closing');

        const onAnimEnd = function() {
            _menuPanel.classList.remove('closing');
            _menuPanel.removeEventListener('animationend', onAnimEnd);
            document.body.style.overflow = '';
        };
        _menuPanel.addEventListener('animationend', onAnimEnd);

        setTimeout(function() {
            document.body.style.overflow = '';
            _menuPanel.classList.remove('closing');
        }, 600);
    }

    function toggleMobileMenu() {
        if (_menuOpen) { closeMobileMenu(); } else { openMobileMenu(); }
    }

    function initMobileMenu() {
        try {
            const menu = createMobileMenu();
            _menuPanel = menu.panel;
            _menuOverlay = menu.overlay;
            populateMobileMenu(menu.list);

            // 等待 header 加载后绑定按钮
            let retryCount = 0;
            const maxRetries = 10;
            function tryBind() {
                _menuToggleBtn = document.querySelector('.nav-toggle');
                if (_menuToggleBtn) {
                    _menuToggleBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleMobileMenu();
                    }, false);
                    // 确保菜单项已填充
                    const ul = _menuPanel.querySelector('.mobile-nav-list');
                    if (ul && ul.children.length === 0) populateMobileMenu(ul);
                } else if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(tryBind, 200);
                } else {
                    _debugLog('mobileMenu', '⚠️ 汉堡按钮绑定超时：.nav-toggle 未找到');
                }
            }
            tryBind();

            _menuOverlay.addEventListener('click', function(e) { e.preventDefault(); closeMobileMenu(); }, false);
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeMobileMenu();
            }, false);
            document.addEventListener('click', function(e) {
                if (!_menuOpen || !e.target) return;
                if (_menuPanel.contains(e.target) || (_menuToggleBtn && _menuToggleBtn.contains(e.target))) return;
                closeMobileMenu();
            }, false);
        } catch (e) { _debugLog('mobileMenu', '移动端菜单初始化失败:', e); }
    }

    // DOM 就绪后初始化移动端菜单
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileMenu, { once: true });
    } else {
        initMobileMenu();
    }

    // 暴露接口
    window.__MOBILE_MENU = { open: openMobileMenu, close: closeMobileMenu, toggle: toggleMobileMenu };

    // 可选：将 FragmentLoader 类暴露在 window 下（仅当配置要求时）
    // 注意：此处不默认暴露以避免污染全局命名空间。

})();
