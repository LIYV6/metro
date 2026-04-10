/**
 * ==========================================
 * 通用数据加载与渲染系统
 * 功能：内存缓存、并发加载、渲染器分发、Loading状态
 * 模板：文章报道、声明（默认）
 * 安全：普通字段自动转义，仅content字段开放净化后的HTML
 * ==========================================
 */
const UniversalLoader = (function () {
    // ==========================================
    // 1. 配置层 (Config)
    // ==========================================
    const CONFIG = {
        basePath: '../assets/data/',   // JSON 文件基础路径
        defaultRenderer: 'notice',  // 默认渲染器（通知模板）
        slotAttribute: 'data-slot'     // 坑位属性名
    };

    // ==========================================
    // 2. 缓存层 (Cache)
    // ==========================================
    const cache = {};

    // ==========================================
    // 【配模板】固定结构、语义、规范，仅这里定义
    // ==========================================
    const Templates = {
        // 文章模板：标题 + 时间 + 作者 + 正文
        article: `
            <article class="content-card article-report">
                <header class="card-header">
                    <h2 class="card-title">{{title}}</h2>
                    <div class="card-meta">
                        {{#date}}<span class="meta-date">发布于{{date}}</span>{{/date}}
                        {{#author}}<span class="meta-author">作者：{{author}}</span>{{/author}}
                    </div>
                </header>
                <div class="card-body">
                    {{content}}
                </div>
            </article>`,

        // 声明模板（默认）：标题 + 时间 + 正文
        statement: `
            <article class="content-card statement">
                <header class="card-header">
                    <h2 class="card-title">{{title}}</h2>
                    {{#date}}<div class="card-meta meta-date">更新于{{date}}</div>{{/date}}
                </header>
                <div class="card-body">
                    {{content}}
                </div>
            </article>`,
        // 新闻模板：标题 + 时间 + 作者 + 正文
        news: `
            <article class="content-card article-report">
                <header class="card-header">
                    <h2 class="card-title">{{title}}</h2>
                    <div class="card-meta">
                        {{#date}}<span class="meta-date">{{date}}报道</span>{{/date}}
                        {{#author}}<span class="meta-author">记者：{{author}}</span>{{/author}}
                    </div>
                </header>
                <div class="card-body">
                    {{content}}
                </div>
            </article>`
    };

    // ==========================================
    // 【工具函数】普通字段 HTML 转义（安全、不解析）
    function escape(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ==========================================
    // 【工具函数】深层取值（a.b.c）
    function getValue(obj, path) {
        return path.split('.').reduce((o, k) => o?.[k], obj);
    }
    // ==========================================
    // 【核心渲染引擎】严格按安全规则处理
    // ==========================================
    function render(tplText, data) {
        let renderData = { ...data };

        // 1. 普通字段永远自动转义，禁止解析HTML
        renderData.title = escape(renderData.title);
        renderData.date = escape(renderData.date);
        if (renderData.author) renderData.author = escape(renderData.author);

        // 2. 仅 content 字段开放 HTML，并强制安全净化
        if (renderData.content) {
            renderData.content = DOMPurify.sanitize(renderData.content, {
                ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'img', 'blockquote', 'h3', 'h4'],
                ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target'],
                ADD_ATTR: ['target="_blank"', 'rel="noopener noreferrer"']
            });
        }

        // 3. 模板填充（保留数组循环能力，后续新增数组字段可直接扩展）
        return tplText
            .replace(/{{#each}}([\s\S]*?){{\/each}}/g, (_, itemTpl) =>
                (renderData.extra?.images || []).map(item => render(itemTpl, { this: escape(item) })).join('')
            )
            .replace(/{{#([\w.]+?)}}([\s\S]*?){{\/\1}}/g, (_, path, html) =>
                getValue(renderData, path) ? html : ''
            )
            .replace(/{{([\w.]+?)}}/g, (_, path) =>
                getValue(renderData, path) || ''
            );
    }
    // ==========================================
    // 【注入流程】全自动处理
    // ==========================================
    async function init() {
        const slots = Array.from(document.querySelectorAll(`[${CONFIG.slotAttribute}]`));
        if (!slots.length) return;

        // 显示加载状态
        slots.forEach(s => s.classList.add('loading'));

        // 并发加载所有JSON模块（去重）
        const modules = new Set(slots.map(s => s.getAttribute(CONFIG.slotAttribute).split('.')[0]));
        await Promise.all(Array.from(modules).map(loadModule));

        // 逐个渲染坑位
        slots.forEach(slot => {
            const [mod, key] = slot.getAttribute(CONFIG.slotAttribute).split('.');
            const data = cache[mod]?.[key];

            if (!data) {
                slot.innerHTML = '<div class="error">数据缺失,请刷新重试</div>';
                slot.classList.remove('loading');
                return;
            }

            // 优先使用数据指定的模板，否则用默认声明模板
            const tpl = Templates[data.type] || Templates[CONFIG.defaultRenderer];
            slot.innerHTML = render(tpl, data);
            slot.classList.remove('loading');
        });
    }

    // 加载模块（带内存缓存，重复请求只加载一次）
    async function loadModule(name) {
        if (cache[name]) return cache[name];
        try {
            const res = await fetch(CONFIG.basePath + name + '.json');
            const data = await res.json();
            cache[name] = data;
            return data;
        } catch (e) {
            console.error(`加载模块失败: ${name}`, e);
            cache[name] = {};
            return {};
        }
    }

    return { init };
})();

// 页面加载完成后自动启动
document.addEventListener('DOMContentLoaded', () => UniversalLoader.init());
