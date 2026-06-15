// ==================== 高铁/高速铁路判断服务 ====================
import { NON_RAIL_MODES } from '../core/constants.js';

/**
 * 判断是否为高铁/高速铁路线路
 * 优先级：mode字段 → type字段 → 名称特征（兜底）
 * @param {string} nameRaw - 线路原始名称
 * @param {string} mode - 交通模式
 * @param {string} routeType - 路线类型
 * @returns {boolean} 是否为高铁线路
 */
const isHighSpeedLine = (nameRaw, mode, routeType) => {
    const modeText = String(mode || '').trim().toUpperCase();
    const typeText = String(routeType || '').trim().toUpperCase();

    // 1. 非轨道列车，直接返回false（飞机、轮船、缆车）
    if (NON_RAIL_MODES.has(modeText)) {
        return false;
    }

    // 2. 当mode是TRAIN时，根据type判断（关键修复：type优先级高于名称推断）
    if (modeText === 'TRAIN') {
        if (typeText === 'HIGH_SPEED') return true;  // 高铁
        if (typeText === 'LIGHT_RAIL') return false; // 轻轨
        if (typeText === 'NORMAL') return false;     // 普通地铁
    }

    // 3. mode/type都不明确时，才用名称特征推断（兜底逻辑）
    const rawName = String(nameRaw || '').trim();
    if (!rawName) return false;

    // 名称包含"号线"或"Line" → 地铁/轻轨
    if (rawName.includes('号线') || rawName.includes('Line')) {
        return false;
    }

    // 名称包含高铁关键词 → 高铁
    if (/高铁|高速|高速铁路|Express/i.test(rawName)) {
        return true;
    }

    // 字母+数字格式（如G54、X21等）
    const match = rawName.match(/^\s*([A-Z]{1,2})\s*(\d+)\s*$/i);
    if (match) {
        const prefix = match[1].toUpperCase();
        const number = parseInt(match[2], 10);

        // T1-T20通常是地铁线路（T代表Tram/Transit）
        if (prefix === 'T' && number <= 20) {
            return false;
        }

        // S线且包含"号线"的也是地铁
        if (prefix === 'S' && (rawName.includes('号线') || rawName.includes('Line'))) {
            return false;
        }

        // 其他情况（G/C/D/X/Y/Z等）视为高铁
        return true;
    }

    return false;
};

export { isHighSpeedLine };
export default isHighSpeedLine;