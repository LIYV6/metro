// loader.js 全功能+动态自动刷新+JSON5支持版
// assets/js/loader.js
//新增：将模板移到JS内部，支持反引号多行字符串
const Templates = {
//=====文章模板=====
    article: `
<header class="card-header">
    <h2 class="card-title">{{title}}</h2>
    <!--时间作者-->
    {{#date}}{{#author}}
        <div class="card-meta">
            <span class="meta-date">发布于{{date}}</span>
            <span class="meta-author">作者：{{author}}</span>
        </div>
    {{/author}}{{/date}}
    <!--时间-->
    {{#date}}{{^author}}
        <div class="card-meta">
            <span class="meta-date">发布于{{date}}</span>
        </div>
    {{/author}}{{/date}}
    <!--作者-->
    {{^date}}{{#author}}
        <div class="card-meta">
            <span class="meta-author">作者：{{author}}</span>
        </div>
    {{/author}}{{/date}}
</header>
<div class="card-body">{{{content}}}</div>
    `,
    // =====声明模板=====
    statement: `
<header class="card-header">
    <h3 class="card-title">{{title}}</h3>
    <!--更新时间-->
    {{#date}}
        <div class="card-meta meta-date">
            <span class="meta-date">最后更新时间：{{date}}</span>
        </div>
    {{/date}}
</header>
<div class="card-body">{{{content}}}</div>
    `,
    //=====新闻模板=====
    news: `
<header class="card-header">
    <h2 class="card-title">{{title}}</h2>
    <!--时间记者-->
    {{#date}}{{#author}}
        <div class="card-meta">
            <span class="meta-date">{{date}}报道</span>
            <span class="meta-author">记者：{{author}}</span>
        </div>
    {{/author}}{{/date}}
    <!--时间-->
    {{#date}}{{^author}}
        <div class="card-meta">
            <span class="meta-date">{{date}}报道</span>
        </div>
    {{/author}}{{/date}}
    <!--记者-->
    {{^date}}{{#author}}
        <div class="card-meta">
            <span class="meta-author">记者：{{author}}</span>
        </div>
    {{/author}}{{/date}}
</header>
<div class="card-body">{{{content}}}</div>
    `,
//   banner: `
//   <div class="banner">{{content}}</div>
//   `
};

class MultiPageLoader {
    constructor() {
        this.globalConfig = null;
        this.currentPageData = null;
        this.currentHash = '';
        this.currentAutoRefreshEnabled = null;
        this.currentAutoRefreshInterval = null;
        this.refreshTimer = null;

        this.pageId = window.PAGE_ID || 'index';
        this.globalConfigUrl = '../assets/data/global.json5';

        this.init();
    }

    // ========== 工具函数：安全转义 ==========
    escapeHtml(str) {
        if (!str || typeof str !== 'string') return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ========== 工具函数：深层取值（支持条件渲染） ==========
    getValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    // ========== 工具函数：XSS安全净化 ==========
    // ========== 工具函数：XSS安全净化（默认白名单，安全+支持格式） ==========
    sanitizeContent(html, rules) {
        if (!html || typeof html !== 'string') return "";
        const defaultRules = {
            //只允许安全的排版标签（段落、换行、加粗、链接）
            allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'a'],
            allowedAttr: ['href', 'target', 'title'],
            forbidAttr: ['onerror', 'onload', 'onclick', 'onmouseover']
        };
        const finalRules = { ...defaultRules, ...(rules || {}) };
        let purified = html;
        if (window.DOMPurify) {
            purified = window.DOMPurify.sanitize(purified, {
                ALLOWED_TAGS: finalRules.allowedTags,
                ALLOWED_ATTR: finalRules.allowedAttr,
                FORBID_ATTR: finalRules.forbidAttr,
                ADD_ATTR: ['target="_blank"', 'rel="noopener noreferrer"'],
                ALLOW_UNKNOWN_PROTOCOLS: false
            });
        } else {
            purified = this.escapeHtml(purified);
        }
        return purified;
    }

    // ========== 工具函数：解析间隔（支持字符串单位如 5s, 2m, 1h, 1d 或数字（默认为毫秒）） ==========
    parseIntervalToMs(input) {
        if (input == null) return 0;
        if (typeof input === 'number' && !isNaN(input)) return input;
        if (typeof input === 'string') {
            const m = input.trim().toLowerCase().match(/^(\d+)\s*(ms|s|m|h|d)?$/);
            if (!m) return 0;
            const v = parseInt(m[1], 10);
            const unit = m[2] || 'ms';
            switch (unit) {
                case 'ms': return v;
                case 's': return v * 1000;
                case 'm': return v * 60 * 1000;
                case 'h': return v * 60 * 60 * 1000;
                case 'd': return v * 24 * 60 * 60 * 1000;
                default: return v;
            }
        }
        return 0;
    }

    // ========== 核心渲染引擎（直接用 Mustache 库） ==========
    // ========== 核心渲染引擎（安全+支持格式+无标签源码） ==========
    render(tplText, data, securityRules) {
        if (!data || typeof data !== 'object') return "";
        const renderData = { ...data };

        const safeData = {
            title: this.escapeHtml(renderData.title || ''),
            date: this.escapeHtml(renderData.date || ''),
            author: this.escapeHtml(renderData.author || ''),
            content: renderData.content || ''  // ✅ 正文不转义！
        };

        // 图片占位符处理
        const hasValidImages = renderData.images && typeof renderData.images === 'object';
        if (hasValidImages) {
            Object.keys(renderData.images).forEach(imgId => {
                const imgConfig = renderData.images[imgId];
                if (!imgConfig || !imgConfig.src) {
                    safeData.content = safeData.content.replace(`{{img:${imgId}}}`, '');
                    return;
                }
                const src = this.escapeHtml(imgConfig.src);
                const alt = this.escapeHtml(imgConfig.alt || '');
                const title = this.escapeHtml(imgConfig.title || '');
                const width = this.escapeHtml(imgConfig.width || '100%');
                const imgTag = `<img src="${src}" alt="${alt}" title="${title}" width="${width}" loading="lazy">`;
                safeData.content = safeData.content.replace(`{{img:${imgId}}}`, imgTag);
            });
        }
        safeData.content = safeData.content.replace(/{{img:[\w-]+?}}/g, '');

        //核心：只做安全净化，保留格式，不显示标签源码
        safeData.content = this.sanitizeContent(safeData.content, securityRules);

        // Mustache渲染
        return Mustache.render(tplText, safeData);
    }
    // ========== 内容注入（多容器容错）injectAll 函数读取本地 Templates==========
    injectAll() {
        if (!this.globalConfig || !this.currentPageData) return;

        const templates = Templates;
        const slots = this.currentPageData.slots;
        const content = this.currentPageData.content;
        const securityRules = this.globalConfig.security;

        if (!slots || typeof slots !== 'object') return;

        Object.keys(slots).forEach(containerId => {
            try {
                const slotConfig = slots[containerId];
                const container = document.getElementById(containerId);

                if (!container || !slotConfig.dataKey) {
                    console.warn(`容器[${containerId}]不存在或无dataKey，已自动忽略`);
                    return;
                }

                container.innerHTML = '';
                const dataKeys = Array.isArray(slotConfig.dataKey) ? slotConfig.dataKey : [slotConfig.dataKey];

                dataKeys.forEach(key => {
                    const itemData = content[key];
                    if (!itemData) {
                        console.warn(`内容key[${key}]不存在，已自动忽略`);
                        return;
                    }

                    const tagName = slotConfig.semanticTag || 'div';
                    const wrapper = document.createElement(tagName);
                    if (slotConfig.wrapperClass) wrapper.className = slotConfig.wrapperClass;
                    wrapper.id = key;
                    
                    const tpl = templates[itemData.type] || templates.article;
                    wrapper.innerHTML = this.render(tpl, itemData, securityRules);
                    container.appendChild(wrapper);
                });
            } catch (e) {
                console.error(`容器[${containerId}]渲染失败，已自动跳过`, e);
            }
        });
    }

    // ========== 数据加载（JSON5版） ==========
    async fetchJson(url) {
        try {
            const res = await fetch(`${url}?t=${Date.now()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            // 先获取文本内容，再用JSON5解析
            const text = await res.text();
            return JSON5.parse(text);
        } catch (e) {
            console.error(`加载JSON5失败: ${url}`, e);
            return null;
        }
    }

    // ========== 动态自动刷新控制 ==========
    updateAutoRefresh(newEnabled, newInterval) {
        // 检查是否有变化
        const enabledChanged = this.currentAutoRefreshEnabled !== newEnabled;
        const intervalChanged = this.currentAutoRefreshInterval !== newInterval;

        if (!enabledChanged && !intervalChanged) return;

        // 停止旧定时器
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
            console.log("已停止旧的自动刷新定时器");
        }

        // 更新当前状态
        this.currentAutoRefreshEnabled = newEnabled;
        this.currentAutoRefreshInterval = newInterval;

        // 启动新定时器（如果开启）
        if (newEnabled) {
            // 解析间隔（支持 '5s','2m','1h','1d'）
            const ms = this.parseIntervalToMs(newInterval);
            this.currentAutoRefreshInterval = ms;
            console.log(`已启动自动刷新，间隔: ${ms}ms`);
            this.startRefreshLoop();
        } else {
            console.log("已关闭自动刷新");
            // 当自动刷新关闭时，保留最后一次缓存的数据用于页面渲染（不再轮询）
        }
    }

    // ========== 刷新循环 ==========
    async startRefreshLoop() {
        const tick = async () => {
            try {
                // 1. 每次循环前先重新读取全局配置（检查自动刷新开关/间隔是否变化）
                const newGlobalConfig = await this.fetchJson(this.globalConfigUrl);
                if (newGlobalConfig) {
                    // 更新全局配置（如果有其他变化，比如模板、安全规则）
                    this.globalConfig = newGlobalConfig;
                    // 更新自动刷新
                    const newEnabled = newGlobalConfig.autoRefresh?.enabled ?? true;
                    const newIntervalRaw = newGlobalConfig.autoRefresh?.interval ?? 3000;
                    const newInterval = this.parseIntervalToMs(newIntervalRaw);
                    this.updateAutoRefresh(newEnabled, newInterval);
                }

                // 2. 如果自动刷新已关闭，直接返回（不再继续循环）
                if (!this.currentAutoRefreshEnabled) return;

                // 3. 加载当前页面数据
                const dataUrl = `${this.globalConfig.system.dataBasePath}page-${this.pageId}.json5`;
                const pageData = await this.fetchJson(dataUrl);
                if (!pageData) return;

                // 4. 检测数据变化，有变化才重渲染
                const hashStr = JSON.stringify(pageData);
                if (this.currentHash !== hashStr) {
                    console.log(`页面[${this.pageId}]数据已更新，自动重渲染`);
                    this.currentPageData = pageData;
                    this.injectAll();
                    // 缓存此次页面数据到 localStorage
                    try {
                        localStorage.setItem(`pagecache:${this.pageId}`, JSON.stringify(pageData));
                        console.log('已将页面数据写入本地缓存');
                    } catch (e) {
                        console.warn('写入本地缓存失败', e);
                    }
                    this.currentHash = hashStr;
                }
            } catch (e) {
                console.error("刷新循环异常", e);
            }

            // 5. 下一轮循环（用当前最新的间隔）
            if (this.currentAutoRefreshEnabled) {
                this.refreshTimer = setTimeout(tick, this.currentAutoRefreshInterval);
            }
        };
        // 立即执行第一次
        await tick();
    }

    // ========== 初始化 ==========
    async init() {
        try {
            // 1. 首次加载全局配置
            this.globalConfig = await this.fetchJson(this.globalConfigUrl);
            if (!this.globalConfig) {
                console.error("全局配置加载失败，终止渲染");
                return;
            }

            // 2. 初始化自动刷新（支持关闭时使用本地缓存）
            const initialEnabled = this.globalConfig.autoRefresh?.enabled ?? true;
            const initialIntervalRaw = this.globalConfig.autoRefresh?.interval ?? 3000;
            const initialInterval = this.parseIntervalToMs(initialIntervalRaw);

            if (!initialEnabled) {
                // 优先使用本地缓存
                try {
                    const cached = localStorage.getItem(`pagecache:${this.pageId}`);
                    if (cached) {
                        const pageData = JSON.parse(cached);
                        this.currentPageData = pageData;
                        this.injectAll();
                        this.currentHash = JSON.stringify(pageData);
                        console.log('使用本地缓存渲染页面（自动刷新已关闭）');
                    } else {
                        // 若无缓存，执行一次请求获取并缓存
                        const dataUrl = `${this.globalConfig.system.dataBasePath}page-${this.pageId}.json5`;
                        const pageData = await this.fetchJson(dataUrl);
                        if (pageData) {
                            this.currentPageData = pageData;
                            this.injectAll();
                            this.currentHash = JSON.stringify(pageData);
                            try { localStorage.setItem(`pagecache:${this.pageId}`, JSON.stringify(pageData)); } catch(e){/* ignore */}
                            console.log('无本地缓存，已请求并缓存页面数据（自动刷新已关闭）');
                        }
                    }
                } catch (e) {
                    console.warn('读取本地缓存失败或解析错误', e);
                }
            }

            // 启动自动刷新或保持关闭
            this.updateAutoRefresh(initialEnabled, initialInterval);
        } catch (e) {
            console.error("初始化失败", e);
        }
    }
}

// 页面加载完成后启动
document.addEventListener('DOMContentLoaded', () => new MultiPageLoader());
