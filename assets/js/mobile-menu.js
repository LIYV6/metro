/**
 * mobile-menu.js - 移动端汉堡菜单功能
 * 作用：提供移动端导航菜单的展开/收起和页面跳转功能
 * 注意：移动端导航链接的隐藏由 CSS @media (max-width: 768px) 控制，JS 不再操作
 */

(function () {
    'use strict';

    let menuOpen = false;
    let panel = null;
    let overlay = null;
    let toggleBtn = null;

    // 创建菜单面板
    function createMenu() {
        // 创建遮罩层
        overlay = document.createElement('div');
        overlay.className = 'mobile-nav-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        
        // 创建菜单面板
        panel = document.createElement('nav');
        panel.className = 'mobile-nav-panel';
        panel.setAttribute('aria-hidden', 'true');
        
        const ul = document.createElement('ul');
        ul.className = 'mobile-nav-list';
        panel.appendChild(ul);
        
        document.body.appendChild(overlay);
        document.body.appendChild(panel);
        
        return { panel: panel, overlay: overlay, list: ul };
    }

    // 填充菜单项
    function populateMenu(ul) {
        // 等待一小段时间确保header已加载
        setTimeout(function() {
            // 获取header中的导航链接
            const navLinks = document.querySelectorAll('.main-nav .nav-list a');
            console.log('找到导航链接数量:', navLinks.length);
            
            if (!navLinks || navLinks.length === 0) {
                console.warn('未找到导航链接，请检查header是否加载');
                return;
            }
            
            for (let i = 0; i < navLinks.length; i++) {
                const link = navLinks[i];
                const li = document.createElement('li');
                li.className = 'mobile-nav-item';
                
                const a = document.createElement('a');
                a.href = link.href; // 直接使用原始href
                a.innerHTML = link.innerHTML;
                a.className = link.className || '';
                
                console.log('添加菜单项:', link.textContent.trim(), '->', link.href);
                
                // 点击事件 - 直接跳转
                a.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const targetUrl = this.href;
                    console.log('跳转到:', targetUrl);
                    
                    // 关闭菜单
                    closeMenu();
                    
                    // 延迟跳转，让动画开始
                    setTimeout(function() {
                        // 使用 replace 而不是 href，避免历史记录堆积
                        window.location.href = targetUrl;
                    }, 150);
                }, false);
                
                li.appendChild(a);
                ul.appendChild(li);
            }
            
            console.log('菜单项填充完成，共', navLinks.length, '项');
        }, 100); // 延迟100ms确保header加载
    }

    // 打开菜单
    function openMenu() {
        if (menuOpen) return;
        menuOpen = true;
        
        panel.classList.add('active');
        panel.setAttribute('aria-hidden', 'false');
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        
        // 禁止body滚动
        document.body.style.overflow = 'hidden';
        
        // 将汉堡按钮变为"X"
        if (toggleBtn) {
            toggleBtn.querySelector('span').textContent = '✕';
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.setAttribute('aria-label', '关闭导航菜单');
        }
        
        console.log('菜单已打开');
    }

    // 关闭菜单
    function closeMenu() {
        if (!menuOpen) return;
        menuOpen = false;
        
        console.log('开始关闭菜单');
        
        // 将图标恢复为汉堡菜单
        if (toggleBtn) {
            toggleBtn.querySelector('span').textContent = '≡';
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.setAttribute('aria-label', '打开导航菜单');
        }
        
        // 先移除 active 类
        panel.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        
        // 强制浏览器重排，确保 transform-origin 生效
        void panel.offsetHeight;
        
        // 添加 closing 类触发自定义动画
        panel.classList.add('closing');
        console.log('已添加 closing 类');
        
        // 监听动画结束
        const onAnimEnd = function() {
            console.log('animationend 事件触发');
            panel.classList.remove('closing');
            panel.removeEventListener('animationend', onAnimEnd);
            document.body.style.overflow = '';
        };
        panel.addEventListener('animationend', onAnimEnd);
        
        // 超时恢复（防止动画未触发）
        setTimeout(function() {
            document.body.style.overflow = '';
            panel.classList.remove('closing');
        }, 600);
        
        console.log('菜单已关闭');
    }

    // 切换菜单
    function toggleMenu() {
        if (menuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    // 初始化
    function init() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup, false);
        } else {
            setup();
        }
    }

    function setup() {
        try {
            // 创建菜单结构
            const menu = createMenu();
            panel = menu.panel;
            overlay = menu.overlay;
            const ul = menu.list;
            
            // 填充菜单项
            populateMenu(ul);
            
            console.log('移动端菜单结构已创建');
            
            // 等待header加载完成后绑定按钮
            bindToggleAfterHeaderLoaded();
            
            // 点击遮罩层关闭
            overlay.addEventListener('click', function(e) {
                e.preventDefault();
                closeMenu();
            }, false);
            
            // ESC键关闭
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' || e.keyCode === 27) {
                    closeMenu();
                }
            }, false);
            
            // 点击菜单外部关闭
            document.addEventListener('click', function(e) {
                if (!menuOpen) return;
                
                const target = e.target;
                if (!target) return;
                
                // 如果点击的是菜单内部或按钮，不关闭
                if (panel.contains(target) || (toggleBtn && toggleBtn.contains(target))) {
                    return;
                }
                
                closeMenu();
            }, false);
            
            console.log('移动端菜单初始化完成');
            
        } catch (e) {
            console.error('移动端菜单初始化失败:', e);
        }
    }

    // 等待header加载后绑定按钮
    function bindToggleAfterHeaderLoaded() {
        let retryCount = 0;
        const maxRetries = 10; // 最多重试10次
        
        function tryBind() {
            // 尝试查找按钮
            toggleBtn = document.querySelector('.nav-toggle');
            
            if (toggleBtn) {
                // 找到了，直接绑定
                bindToggleButton();
                console.log('汉堡按钮已找到并绑定');
                
                // 重新填充菜单（确保header完全加载）
                const ul = panel.querySelector('.mobile-nav-list');
                if (ul && ul.children.length === 0) {
                    populateMenu(ul);
                }
            } else {
                retryCount++;
                console.log('等待header加载... (第' + retryCount + '次)');
                
                if (retryCount < maxRetries) {
                    // 继续重试
                    setTimeout(tryBind, 200); // 每200ms重试一次
                } else {
                    console.warn('超时：未找到汉堡按钮（已重试' + maxRetries + '次）');
                }
            }
        }
        
        // 立即尝试第一次
        tryBind();
    }
    
    // 绑定按钮事件
    function bindToggleButton() {
        if (!toggleBtn) return;
        
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('汉堡按钮被点击');
            toggleMenu();
        }, false);
    }

    // 启动
    init();
    
    // 暴露接口（可选）
    window.__MOBILE_MENU = {
        open: openMenu,
        close: closeMenu,
        toggle: toggleMenu
    };

})();
