/**
 * server-nav.js - 乘客服务页面导航交互
 * 作用：实现无跳动的锚点切换，并同步左侧导航高亮状态
 */

// ==================== 统一调试配置 ====================
const SERVER_NAV_DEBUG_CONFIG = {
    // 全局调试开关：true 启用所有调试日志，false 关闭
    enabled: false,

    // 模块级开关
    modules: {
        nav: true              // 导航切换相关日志
    }
};

/**
 * 统一调试日志函数
 * @param {string} module - 模块名称 ('nav')
 * @param {...*} args - 日志内容
 */
function serverNavDebugLog(module, ...args) {
    if (!SERVER_NAV_DEBUG_CONFIG.enabled) return;
    if (!SERVER_NAV_DEBUG_CONFIG.modules[module]) return;

    const prefix = `[ServerNav-${module}]`;
    console.log(prefix, ...args);
}
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    serverNavDebugLog('nav', '初始化，找到导航链接:', document.querySelectorAll('.server-nav-link').length, '个');

    // 标记 JS 已加载，允许内容显示
    document.body.classList.add('js-loaded');

    const navLinks = document.querySelectorAll('.server-nav-link');

    navLinks.forEach(link => {
        let isDragging = false;
        let startX = 0;
        
        // 触摸开始
        link.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = false;
        }, { passive: true });
        
        // 触摸移动
        link.addEventListener('touchmove', (e) => {
            const currentX = e.touches[0].clientX;
            const diff = Math.abs(currentX - startX);
            // 如果水平移动超过10px，认为是滑动而非点击
            if (diff > 10) {
                isDragging = true;
            }
        }, { passive: true });
        
        // 点击事件
        link.addEventListener('click', (e) => {
            // 如果正在拖动，不触发点击
            if (isDragging) {
                e.preventDefault();
                return;
            }
            
            e.preventDefault(); // 1. 阻止浏览器默认的锚点跳转（消除跳动）

            const targetId = link.getAttribute('href').substring(1);
            serverNavDebugLog('nav', '切换到:', targetId);
            
            // 2. 手动更新 URL Hash（保持后退按钮可用）
            if (history.pushState) {
                history.pushState(null, null, `#${targetId}`);
            } else {
                window.location.hash = `#${targetId}`;
            }

            // 3. 手动切换内容显示（替代 CSS :target）
            document.querySelectorAll('.server-section').forEach(section => {
                section.classList.remove('is-active');
            });
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('is-active');
            }

            // 4. 同步左侧导航高亮
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // 页面加载时，根据 URL Hash 激活对应选项卡
    const hash = window.location.hash;
    if (hash) {
        serverNavDebugLog('nav', 'URL Hash 存在，激活:', hash);
        const targetLink = document.querySelector(`.server-nav-link[href="${hash}"]`);
        if (targetLink) {
            targetLink.click();
        }
    } else {
        // 默认激活第一个
        const firstLink = navLinks[0];
        if (firstLink) {
            serverNavDebugLog('nav', '无 URL Hash，激活默认第一个选项卡');
            firstLink.click();
        }
    }

    // 监听浏览器前进/后退
    window.addEventListener('popstate', () => {
        const hash = window.location.hash;
        if (hash) {
            serverNavDebugLog('nav', 'popstate 事件，激活:', hash);
            const targetLink = document.querySelector(`.server-nav-link[href="${hash}"]`);
            if (targetLink) {
                targetLink.click();
            }
        }
    });
});
