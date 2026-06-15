// ==================== 站点详情渲染器 ====================
import { escapeHtml, escapeJsString } from './templates.js';
import { cleanLineDisplayName } from '../services/nameService.js';
import { getModeLabel } from '../services/modeService.js';
import { getStationGlobalInfo } from '../services/stationService.js';
import { debugLog } from '../core/debug.js';
import { getContrastColors } from '../core/contrast.js';

/**
 * 核心函数：渲染站点详情到指定容器
 * 统一处理站内线路、就近换乘、出口信息
 * @param {string} nameCn - 站点中文名
 * @param {string} nameEn - 站点英文名
 * @param {Array} transfers - 已解析的换乘列表
 * @param {Array} exits - 已解析的出口列表
 * @param {string} containerId - 目标容器ID
 */
const renderStationDetails = (nameCn, nameEn, transfers, exits, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[renderStationDetails] Container not found:', containerId);
        return;
    }

    // 处理站内线路信息
    const stationLines = [];
    if (transfers && transfers.length > 0) {
        const seen = new Set();
        const normalTransfers = transfers.filter(t => t && !t.isNearby);

        normalTransfers.forEach(t => {
            const rawName = String(t.nameRaw || t.nameAll || t.nameCn || t.nameEn || t.name || '');
            const cleanedName = cleanLineDisplayName(rawName);
            const color = String(t.color || '');
            const mode = t.mode || 'TRAIN';
            const key = `${cleanedName}::${color}`;

            if (!seen.has(key)) {
                seen.add(key);
                stationLines.push({
                    name: cleanedName,
                    color: t.color || '#607d8b',
                    mode: mode
                });
            }
        });
    }

    const renderGroup = (title, list) => {
        let html = `<div class="tooltip-section"><strong class="tooltip-section-title">${title}</strong>`;

        if (list.length === 0) {
            html += '<div class="tooltip-section-empty">无</div>';
        } else {
            html += '<div class="tooltip-lines-container">';
            list.forEach(item => {
                const modeLabelText = getModeLabel(item.mode, item);
                const modeLabel = modeLabelText ? ` [${modeLabelText}]` : '';
                const tColor = item.color || '#999';
                const contrast = getContrastColors(tColor);
                const lineNameForClick = escapeJsString(encodeURIComponent(item.name));

                html += `<span class="tooltip-line-badge" style="--line-color: ${tColor}; --route-text-color: ${contrast.text}; --route-text-shadow: ${contrast.shadow};" onclick="openLineDetail('${lineNameForClick}')" title="点击查看线路详情">${item.name}${modeLabel}</span>`;
            });
            html += '</div>';
        }
        html += '</div>';
        return html;
    };

    let transferHTML = '';
    transferHTML += renderGroup('站内线路：', stationLines);

    // 处理就近换乘
    const nearbyTransfers = (transfers || []).filter(t => t && t.isNearby);

    const renderNearbyGroup = (title, list) => {
        let html = `<div class="tooltip-section"><strong class="tooltip-section-title">${title}</strong>`;

        if (list.length === 0) {
            html += '<div class="tooltip-section-empty">无</div>';
        } else {
            html += '<div class="tooltip-nearby-container">';
            list.forEach(t => {
                const targetName = (t.targetStationCn || t.lineName || '');
                const targetInfo = getStationGlobalInfo(t.targetStationCn || targetName, t.targetStationEn);
                let targetEn = t.targetStationEn || '';
                let targetTransfers = [];
                let targetExits = [];
                if (targetInfo) {
                    if (targetInfo.nameEn) targetEn = targetInfo.nameEn;
                    if (targetInfo.transfers) targetTransfers = targetInfo.transfers;
                    if (targetInfo.nearbyTransfers) {
                        targetInfo.nearbyTransfers.forEach(nt => {
                            targetTransfers.push({ ...nt, isNearby: true });
                        });
                    }
                    if (targetInfo.exits) targetExits = targetInfo.exits;
                }

                const transfersJsonEscaped = escapeJsString(encodeURIComponent(JSON.stringify(targetTransfers)));
                const exitsJsonEscaped = escapeJsString(encodeURIComponent(JSON.stringify(targetExits)));

                html += `<a class="tooltip-nearby-link" onclick="showStationInfo(this, '${escapeJsString(t.targetStationCn || targetName)}', '${escapeJsString(targetEn)}', '${transfersJsonEscaped}', '${exitsJsonEscaped}', '${containerId}')" title="查看 ${targetName} 站的所有线路"><i class="fas fa-info-circle"></i>${targetName}</a>`;
            });
            html += '</div>';
        }
        html += '</div>';
        return html;
    };

    transferHTML += renderNearbyGroup('就近换乘的车站', nearbyTransfers);

    // 出口信息
    let exitHTML = '';
    if (exits && exits.length > 0) {
        exitHTML = '<div class="exit-section">';
        exitHTML += '<div class="exit-section-title">出口信息 (Exits)</div>';
        exitHTML += '<div class="exits-grid">';
        exits.forEach(exit => {
            const exitName = escapeHtml(exit.name || '');
            const destinations = exit.destinations || [];
            exitHTML += '<div class="exit-card">';
            exitHTML += `<div class="exit-name">${exitName}</div>`;
            if (destinations.length > 0) {
                exitHTML += '<div class="exit-destinations">';
                destinations.forEach(dest => {
                    const destText = escapeHtml(dest);
                    exitHTML += `<div class="exit-destination-item">${destText}</div>`;
                });
                exitHTML += '</div>';
            }
            exitHTML += '</div>';
        });
        exitHTML += '</div></div>';
    }

    const subHTML = (nameEn && nameEn !== nameCn) ? `<div class="tooltip-subtitle">${nameEn}</div>` : '';

    // 从当前激活的线路卡片获取线路色，用于tooltip标题渐变色
    const routeContent = document.getElementById('route-content-unified');
    const routeColor = routeContent ? (routeContent.style.getPropertyValue('--route-color').trim() || '#1a1a1a') : '#1a1a1a';
    const contrast = getContrastColors(routeColor);

    container.innerHTML = `
        <div class="tooltip-header" style="--route-color: ${routeColor}; --route-text-color: ${contrast.text}; --route-text-shadow: ${contrast.shadow};">
            <div class="tooltip-title">${nameCn}</div>
            ${subHTML}
        </div>
        ${exitHTML}
        ${transferHTML}
    `;

    container.style.display = 'block';

    debugLog('stationInfo', '[renderStationDetails] shown for:', nameCn, 'container:', containerId, 'transfers:', transfers?.length || 0, 'exits:', exits?.length || 0);
};

/**
 * 显示站点信息提示框
 * 点击站点时显示换乘信息和出口信息
 * @param {HTMLElement} element - 被点击的站点元素
 * @param {string} nameCn - 站点中文名
 * @param {string} nameEn - 站点英文名
 * @param {string} transfersJsonEscaped - URL编码的换乘信息JSON
 * @param {string} exitsJsonEscaped - URL编码的出口信息JSON
 * @param {string} tooltipId - tooltip容器ID
 */
const showStationInfo = (element, nameCn, nameEn, transfersJsonEscaped, exitsJsonEscaped, tooltipId = 'tooltip') => {
    let transfers = [];
    try { transfers = JSON.parse(decodeURIComponent(transfersJsonEscaped)); } catch (e) { /* ignore */ }

    let exits = [];
    try { exits = exitsJsonEscaped ? JSON.parse(decodeURIComponent(exitsJsonEscaped)) : []; } catch (e) { /* ignore */ }

    renderStationDetails(nameCn, nameEn, transfers, exits, tooltipId);
};

/**
 * 显示错误提示的工具函数
 * @param {HTMLElement} tooltip - Tooltip元素
 * @param {string} message - 错误消息
 */
const showErrorTooltip = (tooltip, message) => {
    if (!tooltip) return;
    tooltip.innerHTML = `
        <div class="tooltip-error">
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        </div>
    `;
    tooltip.style.display = 'block';
    setTimeout(() => {
        tooltip.style.display = 'none';
    }, 2000);
};

export { renderStationDetails, showStationInfo, showErrorTooltip };