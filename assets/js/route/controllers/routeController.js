// ==================== 线路选择 / 过滤控制器 ====================
import state from '../core/state.js';
import { renderRouteInUnifiedDisplay } from '../rendering/stationListRenderer.js';
import { showErrorTooltip } from '../rendering/stationDetailRenderer.js';
import { cleanLineDisplayName, stripBranchSuffix, cleanDirectionSuffix } from '../services/nameService.js';

/**
 * 选择并显示指定线路
 * 高亮对应的色块，在统一展示区渲染该线路的站点信息
 * @param {number} groupIndex - 线路组索引
 */
const selectLine = (groupIndex) => {
    // Remove active class from all blocks
    document.querySelectorAll('.line-block').forEach(block => {
        block.classList.remove('active');
    });

    // Add active class to selected block
    const selectedBlock = document.querySelector(`.line-block[data-group-index="${groupIndex}"]`);
    if (selectedBlock) {
        selectedBlock.classList.add('active');
    }

    const groupedRoutes = state.groupedRoutesData;
    const sortedKeys = state.sortedRouteKeys || Object.keys(groupedRoutes);
    const groupKey = sortedKeys[groupIndex];
    if (!groupKey) return;

    const routes = groupedRoutes[groupKey];
    const primaryRoute = routes[0];

    const unifiedDisplay = document.getElementById('unifiedRouteDisplay');
    if (!unifiedDisplay) return;

    unifiedDisplay.style.display = '';

    renderRouteInUnifiedDisplay(primaryRoute, routes, groupIndex);
};

/**
 * 根据分类过滤线路
 * 支持按地铁、高铁、轮船、飞机、索道等类型筛选
 */
const filterRoutes = () => {
    const activeCategoryElement = document.querySelector('.category-tab[data-category].active');
    const activeCategory = activeCategoryElement ? activeCategoryElement.dataset.category : 'all';

    let firstMatchGroupIndex = null;
    document.querySelectorAll('.line-block').forEach((block) => {
        const mode = block.dataset.mode;
        const type = block.dataset.type;
        const groupIndex = block.dataset.groupIndex;

        let matchesCategory = true;
        if (activeCategory !== 'all') {
            if (activeCategory === 'HIGH_SPEED' || activeCategory === 'NORMAL') {
                matchesCategory = type === activeCategory && mode === 'TRAIN';
            } else {
                matchesCategory = mode === activeCategory;
            }
        }

        if (matchesCategory) {
            block.style.display = '';
            if (firstMatchGroupIndex === null) {
                firstMatchGroupIndex = groupIndex;
            }
        } else {
            block.style.display = 'none';
            block.classList.remove('active');
        }
    });

    const unifiedDisplay = document.getElementById('unifiedRouteDisplay');
    if (unifiedDisplay) {
        unifiedDisplay.style.display = 'none';
    }

    if (firstMatchGroupIndex !== null) {
        selectLine(parseInt(firstMatchGroupIndex));
    }
};

/**
 * 打开线路详情页
 * 从站点信息框中点击换乘线路时跳转到对应线路
 * @param {string} lineNameEncoded - URL编码的线路名称
 */
const openLineDetail = (lineNameEncoded) => {
    const lineName = decodeURIComponent(lineNameEncoded);

    // Close both tooltips
    const lineInfoTooltip = document.getElementById('tooltip');
    const stationInfoTooltip = document.getElementById('station-tooltip');
    if (lineInfoTooltip) {
        lineInfoTooltip.style.display = 'none';
    }
    if (stationInfoTooltip) {
        stationInfoTooltip.style.display = 'none';
    }

    const groupedRoutes = state.groupedRoutesData;
    if (!groupedRoutes) {
        console.error('[openLineDetail] Route data not loaded (groupedRoutesData is undefined)');
        showErrorTooltip(lineInfoTooltip || stationInfoTooltip, '数据未加载，请刷新页面');
        return;
    }

    let targetGroupIndex = null;
    let bestMatchScore = -1;

    const groupKeys = state.sortedRouteKeys || Object.keys(groupedRoutes);
    for (let i = 0; i < groupKeys.length; i++) {
        const routes = groupedRoutes[groupKeys[i]];
        if (routes && routes.length > 0) {
            const primaryRoute = routes[0];
            const routeNameCn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameCn || ''));
            const routeNameEn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameEn || ''));
            const routeMode = primaryRoute.mode;

            let score = 0;

            if (routeNameCn === lineName) {
                score = 100;
            } else if (routeNameEn && routeNameEn.toLowerCase() === lineName.toLowerCase()) {
                score = 95;
            } else if (routeNameCn.includes(lineName) && lineName.length >= routeNameCn.length * 0.8) {
                score = 80;
            } else if (routeNameEn && routeNameEn.toLowerCase().includes(lineName.toLowerCase()) && lineName.length >= routeNameEn.length * 0.8) {
                score = 75;
            } else if (routeNameCn.includes(lineName)) {
                score = 50;
            } else if (routeNameEn && routeNameEn.toLowerCase().includes(lineName.toLowerCase())) {
                score = 45;
            }

            if (score > 0) {
                if (targetGroupIndex === null || score > bestMatchScore) {
                    targetGroupIndex = i;
                    bestMatchScore = score;
                } else if (score === bestMatchScore) {
                    const currentRoute = groupedRoutes[groupKeys[targetGroupIndex]][0];
                    if (currentRoute.mode === 'HIGH_SPEED' && routeMode === 'TRAIN') {
                        targetGroupIndex = i;
                        bestMatchScore = score;
                    }
                }
            }
        }
    }

    if (targetGroupIndex !== null) {
        selectLine(targetGroupIndex);
    } else {
        console.warn('[openLineDetail] Line not found:', lineName);
        showErrorTooltip(lineInfoTooltip, `未找到线路 "${lineName}"`);
    }
};

export { selectLine, filterRoutes, openLineDetail };