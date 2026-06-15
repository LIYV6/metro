// ==================== 站点列表渲染器 ====================
import { escapeJsString } from './templates.js';
import { stripBranchSuffix, cleanDirectionSuffix, formatRouteDisplayName } from '../services/nameService.js';
import { isCircularRoute, getRouteDirectionDescriptor, getCircularDirectionLabel } from '../services/directionService.js';
import { buildStationTransferModel } from '../services/transferService.js';
import { buildTransferBadgesHTML } from './badgeRenderer.js';
import { drawMainLine, attachStationListScrollRedraw } from './canvasRenderer.js';
import { getContrastColors } from '../core/contrast.js';

/**
 * 生成线路的 HTML 结构
 * 包括站点名称、换乘徽章、点击事件等
 * @param {Object} station - 站点对象
 * @param {Object} currentRoute - 当前线路对象
 * @returns {string} 站点 HTML 字符串
 */
const createStationHTML = (station, currentRoute) => {
    const transferModel = buildStationTransferModel(station);
    const isTransfer = station.isTransfer;
    const hasNearby = station.nearbyTransfers && station.nearbyTransfers.length > 0;
    const dotClass = isTransfer || transferModel.hasHighSpeed || transferModel.hasBoat || transferModel.hasAirplane || hasNearby
        ? 'station-dot transfer' : 'station-dot';

    const safeNameCn = escapeJsString(station.nameCn);
    const safeNameEn = escapeJsString(station.nameEn || '');
    const stationEnAll = station.nameEnAll || station.nameEn || '';

    // 构建完整的线路列表：当前线路 + 换乘线路
    const currentLineName = currentRoute ? stripBranchSuffix(cleanDirectionSuffix(currentRoute.nameCn || '')) : '';
    const currentLineInfo = currentRoute ? {
        name: currentLineName,
        nameRaw: currentLineName,
        nameAll: currentRoute.nameCn || '',
        nameCn: currentLineName,
        nameEn: currentRoute.nameEn || '',
        color: currentRoute.color || '#0004ff',
        mode: currentRoute.mode || 'TRAIN'
    } : null;

    // 合并当前线路和换乘线路（去重）
    const allLines = currentLineInfo ? [currentLineInfo] : [];
    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(t => { if (t) allLines.push(t); });
    }

    const allTransfersData = encodeURIComponent(JSON.stringify(allLines));
    const mergedTransfersWithCurrent = currentLineInfo ? [currentLineInfo] : [];
    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(t => { if (t) mergedTransfersWithCurrent.push(t); });
    }
    if (station.nearbyTransfers && station.nearbyTransfers.length > 0) {
        station.nearbyTransfers.forEach(n => { if (n) mergedTransfersWithCurrent.push({ ...n, isNearby: true }); });
    }
    const mergedPayload = hasNearby
        ? encodeURIComponent(JSON.stringify(mergedTransfersWithCurrent))
        : allTransfersData;
    const exitsData = encodeURIComponent(JSON.stringify(station.exits || []));
    const safeMergedPayload = escapeJsString(mergedPayload);
    const safeExitsData = escapeJsString(exitsData);

    const badgesHTML = buildTransferBadgesHTML(
        station, transferModel, currentRoute,
        safeNameCn, safeNameEn, safeMergedPayload, safeExitsData
    );

    return `
        <div class="station-item" data-cn="${safeNameCn}" data-en="${safeNameEn}"
            onclick="showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${safeMergedPayload}', '${safeExitsData}')">
            ${badgesHTML ? `<div class="transfer-badges-container side-unified">${badgesHTML}</div>` : ''}
            <div class="${dotClass}"></div>
            <div class="station-info">
                <div class="station-name">${station.nameCn}</div>
                <div class="station-name-en">${stationEnAll}</div>
            </div>
        </div>
    `;
};

/**
 * 渲染线路的站点列表
 * 处理正向和反向站点，支持环形线路
 * @param {Object} route - 路线对象
 * @param {string|number} index - 容器索引标识
 */
const renderStations = (route, index) => {
    const forwardContainer = document.getElementById(`stations-${index}-forward`);
    const reverseContainer = document.getElementById(`stations-${index}-reverse`);
    const circular = isCircularRoute(route);

    const toLinearStations = (stations) => {
        const st = Array.isArray(stations) ? stations.slice() : [];
        if (circular && st.length > 1) {
            const first = st[0];
            const last = st[st.length - 1];
            if (first && last && first.nameCn === last.nameCn && first.nameEn === last.nameEn) {
                st.pop();
            }
        }
        return st;
    };

    if (forwardContainer && route.forwardStations) {
        const stations = toLinearStations(route.forwardStations);
        forwardContainer.innerHTML = stations.map((s) => createStationHTML(s, route)).join('');
    }

    if (reverseContainer && route.reverseStations) {
        const stations = toLinearStations(route.reverseStations);
        reverseContainer.innerHTML = stations.map((s) => createStationHTML(s, route)).join('');
    }
};

/**
 * 在统一展示区渲染线路详情
 * 包括线路标题、方向选择器、站点列表等
 * @param {Object} primaryRoute - 主路线对象
 * @param {Array} branches - 分支路线数组
 * @param {number} groupIndex - 线路组索引
 */
const renderRouteInUnifiedDisplay = (primaryRoute, branches, groupIndex) => {
    const container = document.getElementById('unifiedRouteDisplay');
    if (!container) return;

    const { cn: displayCn, en: displayEn } = formatRouteDisplayName(primaryRoute);

    let titleHtml = `<h2>${displayCn} <span style="font-size: 0.7em; color: rgba(255,255,255,0.7); font-weight: normal; margin-left: 6px;">${displayEn}</span></h2>`;
    if (displayCn === displayEn || !displayEn) {
        titleHtml = `<h2>${displayCn}</h2>`;
    }

    let branchesHTML = '';
    branches.forEach((route, branchIndex) => {
        const hasReverse = route.reverseStations && route.reverseStations.length > 0 && !route.autoReverse;
        const circular = isCircularRoute(route);

        let branchLabelText = getRouteDirectionDescriptor(route, branches.length > 2) || '交路/支线 ' + (branchIndex + 1);

        // Task 4: 市域γ线
        if (displayCn === '市域γ线') {
            branchLabelText = route.nameCn.includes('支线2') ? '大站快车(双向)' : '普通车';
        }

        // Task 5: 9号线, 鯉城電車
        // if (displayCn === '9号线' || displayCn.includes('電車') || displayCn.includes('电车')) {
        //     if (route.forwardStations && route.forwardStations.length > 0) {
        //         branchLabelText = getRouteDirectionDescriptor(route, true) || '';
        //         if (!branchLabelText) {
        //             const st = route.forwardStations;
        //             const getName = (s) => s.nameCn;
        //             const start = getName(st[0]);
        //             const end = getName(st[st.length - 1]);
        //             let mid = '';
        //             if (st.length > 2) {
        //                 mid = ' <--> ' + getName(st[Math.floor(st.length / 2)]);
        //             }
        //             branchLabelText = `${start}${mid} <--> ${end}`;
        //         }
        //     }
        // }

        const stationCount = route.forwardStations ? route.forwardStations.length : 0;

        const branchLabel = `<div class="branch-label" onclick="toggleBranch(this)" role="button" aria-expanded="${branchIndex === 0}">
            <span>${branchLabelText}<span class="branch-station-count">(${stationCount}站)</span></span>
        </div>`;

        let directionLabelForward = '';
        let directionLabelReverse = '';

        if (route.forwardStations && route.forwardStations.length > 0) {
            const st = route.forwardStations;
            if (circular) {
                directionLabelForward = getCircularDirectionLabel(route, 'forward', st);
            } else {
                const endStation = st[st.length - 1];
                const endName = endStation.nameCn;
                directionLabelForward = `往${endName}`;
            }
        }

        if (hasReverse && route.reverseStations && route.reverseStations.length > 0) {
            const st = route.reverseStations;
            if (circular) {
                directionLabelReverse = getCircularDirectionLabel(route, 'reverse', st);
            } else {
                const endStation = st[st.length - 1];
                const endName = endStation.nameCn;
                directionLabelReverse = `往${endName}`;
            }
        }

        let directionSelector = '';
        if (hasReverse) {
            const selectorId = `selector-${groupIndex}-${branchIndex}`;
            directionSelector = `
                <div class="direction-selector" id="${selectorId}">
                    <button class="direction-btn active" data-dir="forward" onclick="selectDirection('${selectorId}', 'forward', ${groupIndex}, ${branchIndex})">${directionLabelForward}</button>
                    <button class="direction-btn" data-dir="reverse" onclick="selectDirection('${selectorId}', 'reverse', ${groupIndex}, ${branchIndex})">${directionLabelReverse}</button>
                </div>
            `;
        }

        const isCollapsed = branches.length > 1 && branchIndex > 0;
        branchesHTML += `
            <div class="branch-container${isCollapsed ? ' collapsed' : ''}" data-branch-index="${branchIndex}">
                ${branchLabel}
                ${directionSelector}
                <div class="station-list" id="stations-${groupIndex}-${branchIndex}-forward"></div>
                ${hasReverse ? `<div class="station-list hidden" id="stations-${groupIndex}-${branchIndex}-reverse"></div>` : ''}
            </div>
        `;
    });

    container.innerHTML = `
        <div class="route-header unified-header" style="--route-color: ${primaryRoute.color}; --route-text-color: ${getContrastColors(primaryRoute.color).text}; --route-text-shadow: ${getContrastColors(primaryRoute.color).shadow};">
            <div class="route-title">
                ${titleHtml}
                <p></p>
            </div>
        </div>
        <div class="route-content expanded" id="route-content-unified" style="--route-color: ${primaryRoute.color};">
            ${branchesHTML}
        </div>
    `;

    // Render stations for all branches
    branches.forEach((route, branchIndex) => {
        renderStations(route, `${groupIndex}-${branchIndex}`);
    });

    requestAnimationFrame(() => {
        redrawVisibleLines();
        attachStationListScrollRedraw();
    });
};

/**
 * 重绘所有可见的线条
 */
const redrawVisibleLines = () => {
    document.querySelectorAll('.station-list:not(.hidden)').forEach(list => {
        try {
            if (list.getBoundingClientRect().height > 0) {
                adjustStationListPaddingForBadges(list);
            }
        } catch (e) { /* ignore */ }
        drawMainLine(list);
    });
};

/**
 * 调整站点列表的内边距以适应徽章
 */
const adjustStationListPaddingForBadges = (list) => {
    if (!list) return;

    const computed = getComputedStyle(list);
    const basePaddingTop = parseFloat(list.dataset.basePaddingTop || computed.paddingTop || '120') || 120;
    if (!list.dataset.basePaddingTop) list.dataset.basePaddingTop = String(basePaddingTop);

    let extraTop = 0;
    const listRect = list.getBoundingClientRect();
    if (listRect.width === 0) return;

    const badges = list.querySelectorAll('.transfer-badges-container');
    badges.forEach(badge => {
        const r = badge.getBoundingClientRect();
        if (r.height > 0 && r.top < listRect.top) {
            extraTop = Math.max(extraTop, listRect.top - r.top);
        }
    });

    const targetPaddingTop = Math.ceil(basePaddingTop + extraTop + 6);
    if (extraTop > 0) {
        list.style.paddingTop = `${targetPaddingTop}px`;
    } else {
        list.style.paddingTop = `${basePaddingTop}px`;
    }
};

/**
 * 手风琴切换：展开/折叠分支
 */
const toggleBranch = (labelElement) => {
    const container = labelElement.closest('.branch-container');
    if (!container) return;
    const isCollapsing = !container.classList.contains('collapsed');
    container.classList.toggle('collapsed');
    labelElement.setAttribute('aria-expanded', String(!isCollapsing));

    if (isCollapsing) {
        requestAnimationFrame(() => {
            container.querySelectorAll('.station-list:not(.hidden)').forEach(list => {
                adjustStationListPaddingForBadges(list);
                drawMainLine(list);
            });
        });
    }
};

export {createStationHTML, renderStations, renderRouteInUnifiedDisplay,
    redrawVisibleLines, adjustStationListPaddingForBadges, toggleBranch};