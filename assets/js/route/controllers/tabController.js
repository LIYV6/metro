// ==================== Tab 切换控制器 ====================

/**
 * 初始化Tab切换功能
 * 支持URL hash管理、浏览器前进/后退、平滑过渡
 */
const initRouteTabSwitcher = () => {
    const tabLinks = document.querySelectorAll('.category-tab[data-tab]');

    /**
     * 激活指定tab
     * @param {string} targetTab - 目标tab名称（不含#）
     */
    const activateTab = (targetTab) => {
        if (!targetTab) return;

        // 1. 更新导航激活状态
        document.querySelectorAll('.category-tab[data-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === targetTab);
        });
        document.querySelectorAll('.secondary-nav-item[data-tab]').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === targetTab);
        });

        // 2. 隐藏所有内容区域
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });

        // 3. 显示目标内容区域
        const targetContent = document.getElementById(`${targetTab}-content`);
        if (targetContent) {
            targetContent.style.display = 'block';
            targetContent.classList.add('active');
        }

        // 4. 切换子选项区域
        document.querySelectorAll('.sub-nav-content').forEach(subnav => {
            subnav.classList.remove('active');
        });
        const targetSubnav = document.getElementById(`${targetTab}-subnav`);
        if (targetSubnav) {
            targetSubnav.classList.add('active');
        }

        // 5. 特殊业务逻辑：切换tooltip显示
        const lineInfoTooltip = document.getElementById('tooltip');
        const stationInfoTooltip = document.getElementById('station-tooltip');

        if (targetTab === 'line-info') {
            if (lineInfoTooltip) lineInfoTooltip.style.display = 'block';
            if (stationInfoTooltip) stationInfoTooltip.style.display = 'none';
        } else if (targetTab === 'station-info') {
            if (stationInfoTooltip) stationInfoTooltip.style.display = 'block';
            if (lineInfoTooltip) lineInfoTooltip.style.display = 'none';
        } else {
            if (lineInfoTooltip) lineInfoTooltip.style.display = 'none';
            if (stationInfoTooltip) stationInfoTooltip.style.display = 'none';
        }
    };

    /* 处理tab点击事件 */
    const handleTabClick = (e) => {
        const tab = e.target.closest('.category-tab[data-tab]');
        if (!tab) return;

        e.preventDefault();

        const targetTab = tab.dataset.tab;

        if (history.pushState) {
            history.pushState(null, null, `#${targetTab}`);
        } else {
            window.location.hash = `#${targetTab}`;
        }

        activateTab(targetTab);
    };

    /* 处理hash变化（支持浏览器前进/后退）*/
    const handleHashChange = () => {
        const hash = window.location.hash.slice(1);

        if (hash && document.querySelector(`.category-tab[data-tab="${hash}"]`)) {
            activateTab(hash);
        } else {
            const firstTab = document.querySelector('.category-tab[data-tab]');
            if (firstTab) {
                activateTab(firstTab.dataset.tab);
            }
        }
    };

    // 绑定tab点击事件
    tabLinks.forEach(tab => {
        tab.addEventListener('click', handleTabClick);
    });

    // 监听hash变化
    window.addEventListener('hashchange', handleHashChange);

    // 页面加载时处理初始hash
    handleHashChange();
};

export { initRouteTabSwitcher };