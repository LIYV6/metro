// ==================== 交通模式判断 / 标签服务 ====================
import { MODE_LABELS } from '../core/constants.js';
import { isHighSpeedLine } from './highSpeedService.js';

/**
 * 获取线路标签
 * 优先级：mode字段 → type字段 → 名称特征（辅助）
 * @param {string} mode - 交通模式代码
 * @param {Object} transferObj - 换乘对象
 * @returns {string} 线路类型标签（地铁、高铁、轮船等）
 */
const getModeLabel = (mode, transferObj) => {
    const m = String(mode || '').trim();
    const nameRaw = String(
        transferObj?.nameRaw || transferObj?.nameAll || transferObj?.nameCn ||
        transferObj?.nameEn || transferObj?.name || ''
    );

    // 1. 优先根据mode字段判断
    switch (m) {
        case 'BOAT': return '轮船';
        case 'AIRPLANE': return '飞机';
        case 'CABLE_CAR':
        case 'CABLECAT': return '缆车';
        case 'LIGHT_RAIL': return '轻轨';
    }

    // 2. 高铁判断（优先级高于名称关键词，防止"机场快线-飞机接驳"等误判）
    if (isHighSpeedLine(nameRaw, m, transferObj?.type)) return '铁路';

    // 3. 默认地铁（mode为TRAIN或NORMAL时）
    if (m === 'TRAIN' || m === 'NORMAL') return '地铁';

    // 4. mode/type都不明确时，才用名称关键词辅助判断（兜底逻辑）
    if (nameRaw) {
        const lowerName = nameRaw.toLowerCase();
        if (lowerName.includes('轮船') || lowerName.includes('boat') || lowerName.includes('ship')) return '轮船';
        if (lowerName.includes('飞机') || lowerName.includes('airplane') || lowerName.includes('flight')) return '飞机';
        if (lowerName.includes('缆车') || lowerName.includes('索道') || lowerName.includes('cable')) return '缆车';
    }

    // 5. 其他未知模式，默认地铁
    return '地铁';
};

/**
 * 获取线路大类排序序号
 * 规则：地铁/轻轨(0) > 轮船(1) > 索道/缆车(2) > 飞机(3) > 火车/高铁/铁路(4)
 * @param {Object} route - 线路对象
 * @returns {number} 大类序号
 */
const getRouteCategorySortOrder = (route) => {
    const mode = String(route.mode || '').trim();
    const nameRaw = String(route.nameCn || '');
    const routeType = route.type || '';

    if (mode === 'LIGHT_RAIL') return 0;
    if (mode === 'BOAT') return 1;
    if (mode === 'CABLE_CAR' || mode === 'CABLECAT') return 2;
    if (mode === 'AIRPLANE') return 3;

    if (mode === 'TRAIN' || mode === 'NORMAL') {
        if (isHighSpeedLine(nameRaw, mode, routeType)) return 4; // 铁路
        return 0; // 地铁
    }

    return 0; // 默认按地铁处理
};

export { getModeLabel, getRouteCategorySortOrder };