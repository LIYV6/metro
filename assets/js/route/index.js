// ==================== 线路服务入口文件 ====================
// 统一引导启动流程
import state from './core/state.js';
import { debugLog } from './core/debug.js';
import { loadDatabase } from './data/database.js';
import { buildIndexes } from './data/indexer.js';
import { assembleRouteData } from './data/assembler.js';
import { renderRoutes } from './rendering/routeRenderer.js';
import { renderStationBlocks } from './rendering/stationBlockRenderer.js';
import { initializeEventListeners } from './controllers/eventController.js';

/**
 * 加载路线数据并初始化页面
 * 从 metro.db 获取数据，渲染路线并初始化事件监听器
 */
const loadRoutesData = async () => {
    try {
        // 1. 加载数据库
        const tables = await loadDatabase();

        // 2. 构建索引
        const indexes = buildIndexes(tables);

        // 3. 组装路线数据
        const routesData = assembleRouteData(tables, indexes);
        state.routesData = routesData;

        debugLog('render', `已加载 ${routesData.length} 条线路数据，开始渲染...`);

        // 4. 渲染界面
        renderRoutes();
        renderStationBlocks();

        // 5. 初始化事件监听
        initializeEventListeners();

    } catch (error) {
        console.error('数据库加载失败:', error);
        const container = document.getElementById('routesContainer');
        if (container) {
            container.innerHTML =
                `<p style="text-align: center; padding: 40px; color: #ff5252;">数据库加载失败。<br><small>${error.message}</small></p>`;
        }
    }
};

// ===== DOM 加载完成后启动 =====
document.addEventListener('DOMContentLoaded', () => {
    loadRoutesData();

    // 检查URL参数，自动切换到对应分类或地图视图
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const tab = urlParams.get('tab');
    const map = urlParams.get('map');

    // 处理tab参数
    if (tab && !window.location.hash) {
        setTimeout(() => {
            history.replaceState(null, null, `#${tab}`);
            window.dispatchEvent(new Event('hashchange'));
        }, 500);
    }

    // 处理地图参数
    if (tab === 'route-map' && map) {
        setTimeout(() => {
            const mapBtn = document.querySelector(`.map-nav-item[data-map="${map}"]`);
            if (mapBtn) {
                mapBtn.click();
            }
        }, 600);
    }

    // 处理分类参数
    if (category) {
        setTimeout(() => {
            const targetTab = document.querySelector(`.category-tab[data-category="${category}"]`);
            if (targetTab) {
                targetTab.click();
            }
        }, 800);
    }
});
