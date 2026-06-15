// ==================== 线路选择器渲染器 ====================
import state from '../core/state.js';
import { debugLog } from '../core/debug.js';
import { formatRouteDisplayName, normalizeRouteBaseNameV2 } from '../services/nameService.js';
import { routeSortCompare } from '../services/sortingService.js';
import { getContrastColors } from '../core/contrast.js';

/**
 * 渲染所有路线到页面
 * 创建统一展示区域，按线路分组路线，生成线路选择器的色块
 */
const renderRoutes = () => {
    const container = document.getElementById('routesContainer');
    const lineBlocksContainer = document.getElementById('lineBlocksContainer');

    container.innerHTML = '';
    if (lineBlocksContainer) {
        lineBlocksContainer.innerHTML = '';
    }

    // Create a unified display area
    const unifiedDisplay = document.createElement('div');
    unifiedDisplay.id = 'unifiedRouteDisplay';
    unifiedDisplay.className = 'route-card';
    unifiedDisplay.style.display = 'none';
    container.appendChild(unifiedDisplay);

    // Group routes by normalized line identity
    const groupedRoutes = {};
    state.routesData.forEach(route => {
        const baseCn = normalizeRouteBaseNameV2(route.nameCn || '');
        const baseEn = normalizeRouteBaseNameV2(route.nameEn || '');
        const groupKey = `${route.color || ''}::${baseCn}::${baseEn}`;

        if (!groupedRoutes[groupKey]) {
            groupedRoutes[groupKey] = [];
        }
        groupedRoutes[groupKey].push(route);
    });

    state.groupedRoutesData = groupedRoutes;

    // 按排序规则对分组后的线路进行排序
    const sortedKeys = Object.keys(groupedRoutes).sort((keyA, keyB) => {
        const routeA = groupedRoutes[keyA][0];
        const routeB = groupedRoutes[keyB][0];
        return routeSortCompare(routeA, routeB);
    });
    state.sortedRouteKeys = sortedKeys;

    sortedKeys.forEach((groupKey, groupIndex) => {
        const routes = groupedRoutes[groupKey];
        const primaryRoute = routes[0];

        if (lineBlocksContainer) {
            const lineBlock = createLineBlock(primaryRoute, groupIndex);
            lineBlocksContainer.appendChild(lineBlock);
        }
    });

    debugLog('render', `已加载 ${state.routesData.length} 条线路数据，开始渲染...`);
};

/**
 * 创建线路选择器中的色块元素
 * @param {Object} route - 路线对象
 * @param {number} groupIndex - 线路组索引
 * @returns {HTMLElement} 线路色块 DOM 元素
 */
const createLineBlock = (route, groupIndex) => {
    const block = document.createElement('div');
    block.className = 'line-block';
    const bgColor = route.color || '#607d8b';
    block.style.backgroundColor = bgColor;
    block.dataset.groupIndex = groupIndex;
    block.dataset.mode = route.mode;
    block.dataset.type = route.type;

    const contrast = getContrastColors(bgColor);
    block.style.setProperty('--route-text-color', contrast.text);
    block.style.setProperty('--route-text-shadow', contrast.shadow);

    const { cn: displayCn, tooltip: tooltipText } = formatRouteDisplayName(route);

    const label = document.createElement('div');
    label.className = 'line-block-label';
    label.textContent = displayCn;
    block.appendChild(label);

    const tooltip = document.createElement('div');
    tooltip.className = 'line-block-tooltip';
    tooltip.textContent = tooltipText;
    block.appendChild(tooltip);

    // 使用事件委托替代内联 onclick（在 eventController 中绑定）
    block.dataset.routeGroupIndex = groupIndex;

    return block;
};

export { renderRoutes, createLineBlock };