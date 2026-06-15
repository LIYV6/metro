// ==================== 站点选择 / 信息展示控制器 ====================
import { debugLog } from '../core/debug.js';
import { renderStationDetails } from '../rendering/stationDetailRenderer.js';

/**
 * 选择并显示指定站点
 * 高亮对应的色块，在统一展示区渲染该站点的详细信息
 * @param {Object} station - 站点对象
 */
const selectStation = (station) => {
    debugLog('stationInfo', '[selectStation] 选中站点:', station.nameCn);

    document.querySelectorAll('.station-block').forEach(block => {
        block.classList.remove('active');
    });

    const selectedBlock = document.querySelector(`.station-block[data-station-name="${station.nameCn}"]`);
    if (selectedBlock) {
        selectedBlock.classList.add('active');
        debugLog('stationInfo', '[selectStation] 已高亮色块');
    } else {
        debugLog('stationInfo', '[selectStation] 未找到对应色块:', station.nameCn);
    }

    renderStationInfo(station);
};

/**
 * 在统一展示区渲染站点详情
 * 包括站点标题、经过线路、换乘信息、出口信息等
 * @param {Object} station - 站点对象
 */
const renderStationInfo = (station) => {
    const container = document.getElementById('station-tooltip');
    if (!container) {
        debugLog('stationInfo', '[renderStationInfo] 未找到 station-tooltip 容器');
        return;
    }

    debugLog('stationInfo', '[renderStationInfo] 开始渲染站点:', station.nameCn, '线路数:', station.lines.length);

    const allLines = station.lines.map(line => ({
        name: line.nameCn,
        nameRaw: line.nameCn,
        nameAll: line.nameCn,
        nameCn: line.nameCn,
        nameEn: line.nameEn || '',
        color: line.color,
        mode: line.mode,
        platformName: line.platformName
    }));

    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(t => { if (t) allLines.push(t); });
    }

    if (station.nearbyTransfers && station.nearbyTransfers.length > 0) {
        station.nearbyTransfers.forEach(n => { if (n) allLines.push({ ...n, isNearby: true }); });
    }

    const allTransfersData = encodeURIComponent(JSON.stringify(allLines));
    const exitsData = encodeURIComponent(JSON.stringify(station.exits || []));

    let exits = [];
    try { exits = exitsData ? JSON.parse(decodeURIComponent(exitsData)) : []; } catch (e) { /* ignore */ }

    const nameEn = station.nameEnAll || station.nameEn || '';
    renderStationDetails(station.nameCn, nameEn, allLines || [], exits, 'station-tooltip');
};

export { selectStation, renderStationInfo };