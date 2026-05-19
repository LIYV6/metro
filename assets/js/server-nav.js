/**
 * server-nav.js - 乘客服务页面导航交互
 * 作用：实现无跳动的锚点切换，并同步左侧导航高亮状态
 */

document.addEventListener('DOMContentLoaded', () => {
    // 标记 JS 已加载，允许内容显示
    document.body.classList.add('js-loaded');

    const navLinks = document.querySelectorAll('.server-nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // 1. 阻止浏览器默认的锚点跳转（消除跳动）

            const targetId = link.getAttribute('href').substring(1);
            
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

    // 初始化：确保页面加载时根据当前 Hash 正确显示内容和高亮
    const initPageState = () => {
        // 针对不同页面设置不同的默认 Hash
        let defaultHash = '#passenger-rule';
        if (window.PAGE_ID === 'moreinfo') {
            defaultHash = '#lyrail';
        } else if (window.PAGE_ID === 'info') {
            defaultHash = '#construction-trends';
        }

        const hash = window.location.hash || defaultHash;
        const targetId = hash.substring(1);
        
        // 1. 激活对应的内容章节
        document.querySelectorAll('.server-section').forEach(section => {
            section.classList.remove('is-active');
        });
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('is-active');
        } else {
            // 如果找不到目标（比如 loader 还没注入），默认显示第一个
            const firstSection = document.querySelector('.server-section');
            if (firstSection) {
                firstSection.classList.add('is-active');
            }
        }

        // 2. 激活对应的导航链接
        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === hash);
        });
    };

    // 立即执行一次初始化
    initPageState();
    // 监听 Hash 变化（处理浏览器后退/前进按钮）
    window.addEventListener('popstate', initPageState);
});
