// ==================== 换乘徽章渲染器 ====================
import { escapeJsString } from './templates.js';
import { cleanDirectionSuffix, getTransferNameByLang } from '../services/nameService.js';
import { buildStationTransferModel } from '../services/transferService.js';

/**
 * 获取高铁换乘提示信息
 * @param {Object} station - 站点对象
 * @returns {string} 换乘提示文本
 */
const getHighSpeedTransferHint = (station) => {
    const nearby = Array.isArray(station.nearbyTransfers) ? station.nearbyTransfers : [];
    const target = nearby.find(item => item && item.mode === 'HIGH_SPEED');
    // if (target && target.targetStationCn)
        // return `往${target.targetStationCn}换乘铁路`;
    return '可换乘铁路';
};

/**
 * 构建普通换乘徽章
 */
const buildNormalTransferBadges = (normalTransfers, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) => {
    let html = '';
    const uniqueTransferMap = new Map();

    normalTransfers.forEach(transfer => {
        const transferName = cleanDirectionSuffix(getTransferNameByLang(transfer));
        if (!transferName) return;

        const transferColor = transfer.color || '#607d8b';
        const transferMode = transfer.mode || 'TRAIN';
        const transferPlatform = transfer.platformName || '';
        const key = `${transferName}|${transferColor}|${transferMode}`;

        if (!uniqueTransferMap.has(key)) {
            uniqueTransferMap.set(key, {
                name: transferName,
                color: transferColor,
                title: cleanDirectionSuffix(transfer.nameAll || transfer.nameRaw || transferName),
                mode: transferMode,
                platformName: transferPlatform
            });
        }
    });

    Array.from(uniqueTransferMap.values()).forEach(transfer => {
        const transferName = escapeJsString(transfer.name);
        const transferTitle = escapeJsString(transfer.title || transfer.name);
        const pBadge = transfer.platformName
            ? `<span style="background:rgba(0,0,0,0.2); border-radius:2px; padding:0 4px; margin-left:4px; font-size:10px;">站台 ${transfer.platformName}</span>`
            : '';
        const transferPayload = [{
            name: transfer.name, nameRaw: transfer.name, nameAll: transfer.name,
            nameCn: transfer.name, nameEn: transfer.name,
            color: transfer.color, mode: transfer.mode,
            platformName: transfer.platformName
        }];
        const payload = encodeURIComponent(JSON.stringify(transferPayload));
        html += `<div class="transfer-link-item direct-item" title="${transferTitle}" style="--tc:${transfer.color};" onclick="showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${payload}', '${safeExitsData}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${transferName}${pBadge}</span></div>`;
    });

    return html;
};

/**
 * 构建高铁换乘徽章
 */
const buildHighSpeedBadge = (station, highSpeedTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) => {
    const hsData = encodeURIComponent(JSON.stringify(highSpeedTransfers));
    const payload = hasNearby ? safeMergedPayload : hsData;
    const hsText = escapeJsString(getHighSpeedTransferHint(station));
    return `<div class="transfer-link-item summary-item hs-item" onclick="showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${payload}', '${safeExitsData}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${hsText}</span></div>`;
};

/**
 * 构建其他模式（轮船/飞机）换乘徽章
 */
const buildModeTransferBadge = (modeLabel, transfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) => {
    const modeData = encodeURIComponent(JSON.stringify(transfers));
    const payload = hasNearby ? safeMergedPayload : modeData;
    const text = `可换乘${modeLabel}`;
    return `<div class="transfer-link-item summary-item other-mode-transfer" onclick="showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${payload}', '${safeExitsData}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${text}</span></div>`;
};

/**
 * 构建换乘徽章 HTML（主入口）
 */
const buildTransferBadgesHTML = (station, transferModel, currentRoute, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) => {
    const { hasHighSpeed, hasBoat, hasAirplane, normalTransfers, highSpeedTransfers, boatTransfers, airTransfers } = transferModel;
    const hasNearby = station.nearbyTransfers && station.nearbyTransfers.length > 0;

    if (!normalTransfers.length && !hasHighSpeed && !hasBoat && !hasAirplane && !hasNearby) {
        return '';
    }

    let badgesHTML = '<div class="transfer-badges side-unified">';

    if (normalTransfers.length > 0) {
        badgesHTML += buildNormalTransferBadges(normalTransfers, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }

    if (hasHighSpeed) {
        badgesHTML += buildHighSpeedBadge(station, highSpeedTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }

    if (hasBoat) {
        badgesHTML += buildModeTransferBadge('轮船', boatTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }

    if (hasAirplane) {
        badgesHTML += buildModeTransferBadge('飞机', airTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }

    badgesHTML += '</div>';
    return badgesHTML;
};

export {
    buildTransferBadgesHTML,
    buildNormalTransferBadges,
    buildHighSpeedBadge,
    buildModeTransferBadge,
    getHighSpeedTransferHint
};