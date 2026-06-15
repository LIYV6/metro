// ==================== 站点色块渲染器 ====================
import { debugLog } from '../core/debug.js';
import { STATION_COLOR_CONFIG } from '../core/constants.js';
import { collectUniqueStations } from '../services/stationService.js';
import { getContrastColorsFromHSL } from '../core/contrast.js';

/**
 * 显示站点色块容器的loading动画
 */
const showStationBlocksLoading = () => {
    if (document.querySelector('.page-loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'page-loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">加载中...</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('is-loading');
};

/**
 * 隐藏站点色块容器的loading动画
 */
const hideStationBlocksLoading = () => {
    const overlay = document.querySelector('.page-loading-overlay');
    if (overlay) {
        overlay.remove();
    }
    document.body.classList.remove('is-loading');
};

/**
 * 创建单个站点色块元素
 * @param {Object} station - 站点对象
 * @param {number} index - 索引
 * @returns {HTMLElement} 站点色块元素
 */
const createStationBlock = (station, index) => {
    const block = document.createElement('div');
    block.className = 'station-block';
    block.dataset.stationName = station.nameCn;
    block.dataset.index = index;

    debugLog('stationInfo', '[createStationBlock] 创建站点色块:', station.nameCn, '线路数:', station.lines.length);

    const lineCount = station.lines.length;
    const hue = (index * STATION_COLOR_CONFIG.goldenAngle) % 360;
    const saturation = STATION_COLOR_CONFIG.baseSaturation + (lineCount * STATION_COLOR_CONFIG.saturationPerLine);
    const lightness = STATION_COLOR_CONFIG.baseLightness + (lineCount * STATION_COLOR_CONFIG.lightnessPerLine);

    block.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    const contrast = getContrastColorsFromHSL(hue, saturation, lightness);
    block.style.setProperty('--route-text-color', contrast.text);
    block.style.setProperty('--route-text-shadow', contrast.shadow);

    const label = document.createElement('div');
    label.className = 'station-block-label';
    label.textContent = station.nameCn;
    block.appendChild(label);

    const tooltip = document.createElement('div');
    tooltip.className = 'station-block-tooltip';
    let tooltipText = `${station.nameCn}\n`;
    if (station.nameEnAll) {
        tooltipText += `${station.nameEnAll}\n`;
    }
    tooltipText += `经过线路: ${lineCount}条`;
    tooltip.textContent = tooltipText;
    block.appendChild(tooltip);

    return block;
};

/**
 * 渲染站点色块容器
 * 在页面上显示所有站点的色块
 * @param {string} category - 线路类型过滤（可选）
 */
const renderStationBlocks = (category = 'all') => {
    const container = document.getElementById('stationBlocksContainer');
    if (!container) return;

    showStationBlocksLoading();

    setTimeout(() => {
        const uniqueStations = collectUniqueStations();

        // 按站点名称排序（中文拼音顺序）
        uniqueStations.sort((a, b) => a.nameCn.localeCompare(b.nameCn, 'zh-CN'));

        container.innerHTML = '';

        let visibleCount = 0;
        uniqueStations.forEach((station, index) => {
            if (category !== 'all') {
                const hasMatchingLine = station.lines.some(line => {
                    if (category === 'HIGH_SPEED' || category === 'NORMAL') {
                        return line.mode === 'TRAIN' && (line.type === category || line.type === '');
                    }
                    return line.mode === category;
                });

                if (!hasMatchingLine) return;
            }

            const block = createStationBlock(station, visibleCount);
            container.appendChild(block);
            visibleCount++;
        });

        hideStationBlocksLoading();

        if (visibleCount === 0) {
            container.innerHTML = '<div class="empty-state"><p>该分类下暂无站点</p></div>';
        }
    }, 100);
};

export { renderStationBlocks, createStationBlock, showStationBlocksLoading, hideStationBlocksLoading };