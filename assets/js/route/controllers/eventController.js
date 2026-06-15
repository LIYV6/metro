// ==================== 事件绑定调度器 ====================
import { initRouteTabSwitcher } from './tabController.js';
import { selectLine, filterRoutes, openLineDetail } from './routeController.js';
import { selectStation } from './stationController.js';
import { selectDirection } from './directionController.js';
import { toggleBranch } from '../rendering/stationListRenderer.js';
import { renderStationBlocks } from '../rendering/stationBlockRenderer.js';
import { showStationInfo } from '../rendering/stationDetailRenderer.js';
import { scheduleRouteRedraw } from '../rendering/canvasRenderer.js';
import { collectUniqueStations } from '../services/stationService.js';

/**
 * 初始化所有事件监听器
 * 包括分类标签、返回顶部按钮、窗口resize等
 */
const initializeEventListeners = () => {
    // 初始化Tab切换功能
    initRouteTabSwitcher();

    // 线路信息 - 分类过滤标签
    document.querySelectorAll('.category-tabs .category-tab[data-category]').forEach(tab => {
        tab.addEventListener('click', function () {
            this.closest('.category-tabs').querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            filterRoutes();
        });
    });

    // 线路块点击事件委托
    const lineBlocksContainer = document.getElementById('lineBlocksContainer');
    if (lineBlocksContainer) {
        lineBlocksContainer.addEventListener('click', (e) => {
            const block = e.target.closest('.line-block');
            if (block && block.dataset.groupIndex !== undefined) {
                selectLine(parseInt(block.dataset.groupIndex));
            }
        });
    }

    // 车站信息 - 分类过滤标签
    document.querySelectorAll('#station-info-subnav .category-tab[data-station-category]').forEach(tab => {
        tab.addEventListener('click', function () {
            this.closest('.category-tabs').querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const category = this.dataset.stationCategory;
            renderStationBlocks(category);

            const stationTooltip = document.getElementById('station-tooltip');
            if (stationTooltip) {
                stationTooltip.innerHTML = '<div class="empty-state"><p>请点击上方站点色块查看详情</p></div>';
            }
        });
    });

    // 站点色块点击事件委托
    const stationBlocksContainer = document.getElementById('stationBlocksContainer');
    if (stationBlocksContainer) {
        stationBlocksContainer.addEventListener('click', (e) => {
            const block = e.target.closest('.station-block');
            if (block && block.dataset.stationName) {
                const stationName = block.dataset.stationName;
                const uniqueStations = collectUniqueStations();
                const station = uniqueStations.find(s => s.nameCn === stationName);
                if (station) {
                    selectStation(station);
                }
            }
        });
    }

    // Back to top
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        window.onscroll = () => {
            if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
                backToTopBtn.style.display = 'block';
            } else {
                backToTopBtn.style.display = 'none';
            }
        };

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 窗口 resize 重绘
    window.addEventListener('resize', scheduleRouteRedraw);

    // 暴露全局函数（保持与内联 onclick 的兼容性）
    window.selectDirection = selectDirection;
    window.selectLine = selectLine;
    window.toggleBranch = toggleBranch;
    window.showStationInfo = showStationInfo;
    window.openLineDetail = openLineDetail;

    // Auto-select first line and station after rendering
    setTimeout(() => {
        const firstBlock = document.querySelector('.line-block');
        if (firstBlock) {
            const groupIndex = firstBlock.dataset.groupIndex;
            selectLine(parseInt(groupIndex));
        }

        const firstStationBlock = document.querySelector('.station-block');
        if (firstStationBlock) {
            const stationName = firstStationBlock.dataset.stationName;
            const uniqueStations = collectUniqueStations();
            const firstStation = uniqueStations.find(s => s.nameCn === stationName);
            if (firstStation) {
                selectStation(firstStation);
            }
        }
    }, 300);
};

export { initializeEventListeners };