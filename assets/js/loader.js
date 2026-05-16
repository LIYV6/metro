// loader.js 全功能+动态自动刷新+JSON5支持版
// assets/js/loader.js
//新增：将模板移到JS内部，支持反引号多行字符串

// ========== 调试配置 ==========
const DEBUG_CONFIG = {
    ENABLE_LOADER_LOGS: false,        // 是否开启 loader 模块日志
    ENABLE_CACHE_LOGS: false,        // 是否开启缓存相关日志
    ENABLE_REFRESH_LOGS: false,      // 是否开启自动刷新日志
    ENABLE_RENDER_LOGS: false        // 是否开启渲染过程日志
};

// ========== 统一日志管理函数 ==========
/**统一的调试日志输出函数
 * @param {string} level - 日志级别 ('info' | 'warn' | 'error' | 'success')
 * @param {...*} args - 日志内容（支持多个参数）*/
function debugLog(level, ...args) {
    // 如果全局关闭日志，直接返回
    if (!DEBUG_CONFIG.ENABLE_LOADER_LOGS) return;
    
    // 根据具体类型检查是否开启
    const message = args[0] || '';
    const isCacheRelated = message.includes('缓存') || message.includes('cache');
    const isRefreshRelated = message.includes('刷新') || message.includes('refresh');
    const isRenderRelated = message.includes('渲染') || message.includes('render') || message.includes('容器');
    
    if (isCacheRelated && !DEBUG_CONFIG.ENABLE_CACHE_LOGS) return;
    if (isRefreshRelated && !DEBUG_CONFIG.ENABLE_REFRESH_LOGS) return;
    if (isRenderRelated && !DEBUG_CONFIG.ENABLE_RENDER_LOGS) return;
    
    // 添加统一前缀
    const prefix = '[Loader]';
    const formattedArgs = [prefix, ...args];
    
    // 根据级别调用对应的 console 方法
    switch (level) {
        case 'info':
            console.log(...formattedArgs);
            break;
        case 'warn':
            console.warn(...formattedArgs);
            break;
        case 'error':
            console.error(...formattedArgs);
            break;
        case 'success':
            console.log('%c✓', 'color: #4caf50; font-weight: bold;', ...formattedArgs);
            break;
        default:
            console.log(...formattedArgs);
    }
}

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
        if (!this.globalConfig || !this.currentPageData) {
            debugLog('warn', 'injectAll: globalConfig 或 currentPageData 为空');
            return;
        }

        debugLog('info', '开始渲染页面，slots:', Object.keys(this.currentPageData.slots || {}));

        const templates = Templates;
        const slots = this.currentPageData.slots;
        const content = this.currentPageData.content;
        const securityRules = this.globalConfig.security;

        if (!slots || typeof slots !== 'object') {
            debugLog('warn', 'injectAll: slots 不存在或不是对象');
            return;
        }

        Object.keys(slots).forEach(containerId => {
            try {
                const slotConfig = slots[containerId];
                const container = document.getElementById(containerId);

                if (!container) {
                    debugLog('warn', `容器[${containerId}]不存在，已自动忽略`);
                    return;
                }
                
                if (!slotConfig.dataKey) {
                    debugLog('warn', `容器[${containerId}]无dataKey，已自动忽略`);
                    return;
                }

                debugLog('info', `正在渲染容器: ${containerId}, dataKey:`, slotConfig.dataKey);
                container.innerHTML = '';
                const dataKeys = Array.isArray(slotConfig.dataKey) ? slotConfig.dataKey : [slotConfig.dataKey];

                dataKeys.forEach(key => {
                    const itemData = content[key];
                    if (!itemData) {
                        debugLog('warn', `内容key[${key}]不存在，已自动忽略`);
                        return;
                    }

                    debugLog('info', `渲染内容项: ${key}, type: ${itemData.type}`);
                    const tagName = slotConfig.semanticTag || 'div';
                    const wrapper = document.createElement(tagName);
                    if (slotConfig.wrapperClass) wrapper.className = slotConfig.wrapperClass;
                    wrapper.id = key;
                    
                    const tpl = templates[itemData.type] || templates.article;
                    wrapper.innerHTML = this.render(tpl, itemData, securityRules);
                    container.appendChild(wrapper);
                    debugLog('success', `已渲染 ${key} 到容器 ${containerId}`);
                });
            } catch (e) {
                debugLog('error', `容器[${containerId}]渲染失败，已自动跳过`, e);
            }
        });
        
        debugLog('info', '所有容器渲染完成');
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
            debugLog('error', `加载JSON5失败: ${url}`, e);
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
            debugLog('info', '已停止旧的自动刷新定时器');
        }

        // 更新当前状态
        this.currentAutoRefreshEnabled = newEnabled;
        this.currentAutoRefreshInterval = newInterval;

        // 启动新定时器（如果开启）
        if (newEnabled) {
            // 解析间隔（支持 '5s','2m','1h','1d'）
            const ms = this.parseIntervalToMs(newInterval);
            this.currentAutoRefreshInterval = ms;
            debugLog('info', `已启动自动刷新，间隔: ${ms}ms`);
            this.startRefreshLoop();
        } else {
            debugLog('info', '已关闭自动刷新');
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
                    debugLog('info', `页面[${this.pageId}]数据已更新，自动重渲染`);
                    this.currentPageData = pageData;
                    this.injectAll();
                    // 缓存此次页面数据到 localStorage
                    try {
                        localStorage.setItem(`pagecache:${this.pageId}`, JSON.stringify(pageData));
                        debugLog('info', '已将页面数据写入本地缓存');
                    } catch (e) {
                        debugLog('warn', '写入本地缓存失败', e);
                    }
                    this.currentHash = hashStr;
                }
            } catch (e) {
                debugLog('error', '刷新循环异常', e);
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
            debugLog('info', `开始初始化页面: ${this.pageId}`);
            
            // 1. 首次加载全局配置
            this.globalConfig = await this.fetchJson(this.globalConfigUrl);
            if (!this.globalConfig) {
                debugLog('error', '全局配置加载失败，终止渲染');
                return;
            }
            debugLog('info', '全局配置加载成功', this.globalConfig);

            // 2. 初始化自动刷新（支持关闭时使用本地缓存）
            const initialEnabled = this.globalConfig.autoRefresh?.enabled ?? true;
            const initialIntervalRaw = this.globalConfig.autoRefresh?.interval ?? 3000;
            const initialInterval = this.parseIntervalToMs(initialIntervalRaw);

            debugLog('info', `自动刷新状态: enabled=${initialEnabled}, interval=${initialIntervalRaw}`);

            if (!initialEnabled) {
                debugLog('info', '自动刷新已关闭，尝试使用本地缓存或重新请求数据');
                
                // 检查数据文件是否有更新
                const dataUrl = `${this.globalConfig.system.dataBasePath}page-${this.pageId}.json5`;
                debugLog('info', `正在检查数据文件: ${dataUrl}`);
                
                try {
                    // 先尝试从服务器获取最新数据
                    const freshPageData = await this.fetchJson(dataUrl);
                    
                    if (freshPageData) {
                        debugLog('info', '从服务器获取到最新数据');
                        const freshHash = JSON.stringify(freshPageData);
                        
                        // 检查是否有本地缓存
                        const cached = localStorage.getItem(`pagecache:${this.pageId}`);
                        let shouldUseCache = false;
                        
                        if (cached) {
                            try {
                                const cachedData = JSON.parse(cached);
                                const cachedHash = JSON.stringify(cachedData);
                                
                                // 比较哈希值，如果相同则使用缓存
                                if (freshHash === cachedHash) {
                                    debugLog('info', '数据未变化，使用本地缓存');
                                    shouldUseCache = true;
                                } else {
                                    debugLog('info', '检测到数据更新，将使用新数据并更新缓存');
                                }
                            } catch (e) {
                                debugLog('warn', '解析缓存失败，将使用新数据', e);
                            }
                        }
                        
                        if (shouldUseCache && cached) {
                            // 使用缓存
                            const pageData = JSON.parse(cached);
                            this.currentPageData = pageData;
                            this.injectAll();
                            this.currentHash = JSON.stringify(pageData);
                            debugLog('info', '使用本地缓存渲染页面');
                        } else {
                            // 使用新数据
                            debugLog('info', '数据加载成功，内容keys:', Object.keys(freshPageData.content || {}));
                            this.currentPageData = freshPageData;
                            this.injectAll();
                            this.currentHash = freshHash;
                            
                            // 更新缓存
                            try { 
                                localStorage.setItem(`pagecache:${this.pageId}`, JSON.stringify(freshPageData)); 
                                debugLog('info', '已将最新数据写入本地缓存');
                            } catch(e){
                                debugLog('warn', '写入本地缓存失败', e);
                            }
                        }
                    } else {
                        // 服务器请求失败，尝试使用缓存
                        debugLog('warn', '服务器数据加载失败，尝试使用本地缓存');
                        const cached = localStorage.getItem(`pagecache:${this.pageId}`);
                        if (cached) {
                            const pageData = JSON.parse(cached);
                            this.currentPageData = pageData;
                            this.injectAll();
                            this.currentHash = JSON.stringify(pageData);
                            debugLog('info', '使用本地缓存渲染页面（服务器请求失败）');
                        } else {
                            debugLog('error', '无本地缓存且服务器请求失败，无法渲染页面');
                        }
                    }
                } catch (e) {
                    debugLog('warn', '数据加载异常，尝试使用本地缓存', e);
                    // 异常情况下使用缓存
                    const cached = localStorage.getItem(`pagecache:${this.pageId}`);
                    if (cached) {
                        try {
                            const pageData = JSON.parse(cached);
                            this.currentPageData = pageData;
                            this.injectAll();
                            this.currentHash = JSON.stringify(pageData);
                            debugLog('info', '使用本地缓存渲染页面（异常情况）');
                        } catch (parseError) {
                            debugLog('error', '缓存解析失败', parseError);
                        }
                    }
                }
            } else {
                debugLog('info', '自动刷新已开启，将启动刷新循环');
            }

            // 启动自动刷新或保持关闭
            this.updateAutoRefresh(initialEnabled, initialInterval);
            debugLog('info', '初始化完成');
        } catch (e) {
            debugLog('error', '初始化失败', e);
        }
    }
}

// 页面加载完成后启动
document.addEventListener('DOMContentLoaded', () => new MultiPageLoader());
