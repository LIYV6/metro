// ==================== 名称处理服务 ====================

/**
 * 清理线路名称中的方向后缀
 * 移除"方向"、"往XXX"等后缀信息
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
const cleanDirectionSuffix = (text) => {
    const raw = String(text || '').trim();
    if (!raw) return raw;
    const parts = raw.split('||').map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0];
    return raw.replace(/(方向|往.*$|To\s+.*$)/i, '').trim();
};

/**
 * 获取换乘名称（中文）
 * @param {Object} transfer - 换乘对象
 * @returns {string} 清理后的中文名称
 */
const getTransferNameByLang = (transfer) => {
    return cleanDirectionSuffix(transfer.nameCn || transfer.name || '');
};

/**
 * 移除线路名称中的支线后缀
 * 如"（支线1）"、" (Branch 2)"等
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
const stripBranchSuffix = (text) => {
    let value = String(text || '').trim();
    value = value.replace(/\s*\(支线\d+\)\s*$/i, '').trim();
    value = value.replace(/\s*\(Branch\s*\d+\)\s*$/i, '').trim();
    if (value.includes(' (鏀嚎')) value = value.split(' (鏀嚎')[0].trim();
    if (value.includes(' (閺€顖滃殠')) value = value.split(' (閺€顖滃殠')[0].trim();
    if (value.includes(' (Branch')) value = value.split(' (Branch')[0].trim();
    return value;
};

/**
 * 统一清理线路显示名称
 * 移除方向、支线、英文名等后缀，只保留纯中文线路名
 * 处理格式："1号线|Line 1||To 丽都" → "1号线"
 * @param {string} rawName - 原始名称
 * @returns {string} 清理后的纯线路名
 */
const cleanLineDisplayName = (rawName) => {
    if (!rawName) return '';
    // 1. 先清理方向后缀（处理 || 分割）
    let name = cleanDirectionSuffix(rawName);

    // 2. 再按 | 分割，只保留第一部分（去除英文名），例如 "1号线|Line 1" → "1号线"
    const nameParts = name.split('|').map(p => p.trim()).filter(Boolean);
    if (nameParts.length > 0) {
        name = nameParts[0];
    }

    // 3. 清理支线后缀
    name = stripBranchSuffix(name);

    return name.trim();
};

/**
 * 规范化路线基础名称（V2版本）
 * 结合清理方向后缀和移除支线后缀
 * @param {string} rawName - 原始名称
 * @returns {string} 规范化后的名称
 */
const normalizeRouteBaseNameV2 = (rawName) => {
    return stripBranchSuffix(cleanDirectionSuffix(rawName || '')).trim();
};

/**
 * 格式化路线显示名称（双语）
 * 同时处理中英文，返回清理后的名称对象
 * @param {Object} route - 路线对象
 * @returns {Object} {cn: string, en: string, tooltip: string}
 */
const formatRouteDisplayName = (route) => {
    const cn = cleanLineDisplayName(route.nameCn || '');
    const en = cleanLineDisplayName(route.nameEn || '');
    const tooltip = cn === en || !en ? cn : `${cn} / ${en}`;
    return { cn, en, tooltip };
};

/**
 * 获取站点显示名称
 * 优先返回中文名，其次英文名
 * @param {Object} station - 站点对象
 * @returns {string} 站点名称
 */
const getStationNameForDisplay = (station) => {
    if (!station) return '';
    return station.nameCn || station.nameEn || '';
};

export {
    cleanDirectionSuffix,
    getTransferNameByLang,
    stripBranchSuffix,
    cleanLineDisplayName,
    normalizeRouteBaseNameV2,
    formatRouteDisplayName,
    getStationNameForDisplay
};