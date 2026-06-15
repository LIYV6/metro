// ==================== 线路排序服务 ====================
import { cleanLineDisplayName } from './nameService.js';
import { getRouteCategorySortOrder } from './modeService.js';
import { CHAR_PRIORITY, CATEGORY_ORDER } from '../core/constants.js';

/**
 * 获取单个字符的类型
 * @param {string} ch - 单个字符
 * @returns {string} 字符类型: 'greek' | 'letter' | 'digit' | 'chinese' | 'other'
 */
const getCharType = (ch) => {
    if (/[\u0370-\u03FF\u1F00-\u1FFF\u2211]/.test(ch)) return 'greek';
    if (/[a-zA-Z]/.test(ch)) return 'letter';
    if (/[0-9]/.test(ch)) return 'digit';
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) return 'chinese';
    return 'other';
};

/**
 * 从字符串指定位置提取连续数字，返回 [数值, 数字长度]
 * @param {string} str - 字符串
 * @param {number} start - 起始位置
 * @returns {[number, number]} [数值, 长度]
 */
const extractNumber = (str, start) => {
    let end = start;
    while (end < str.length && /[0-9]/.test(str[end])) end++;
    return [parseInt(str.substring(start, end), 10), end - start];
};

/**
 * 根据线路大类获取字符类型优先级
 * @param {string} charType - 字符类型
 * @param {number} category - 线路大类序号
 * @returns {number} 优先级（越小越高）
 */
const getCharPriorityByCategory = (charType, category) => {
    const priority = CHAR_PRIORITY[category];
    return priority ? (priority[charType] ?? (category === CATEGORY_ORDER.RAILWAY ? 3 : 2)) : 0;
};

/**
 * 在同大类内按线路名称逐位比较
 * @param {string} nameA - 线路名称A
 * @param {string} nameB - 线路名称B
 * @param {number} category - 线路大类序号
 * @returns {number} 负数A在前，正数B在前
 */
const compareRouteName = (nameA, nameB, category) => {
    let i = 0, j = 0;
    while (i < nameA.length && j < nameB.length) {
        const chA = nameA[i];
        const chB = nameB[j];

        const isDigitA = /[0-9]/.test(chA);
        const isDigitB = /[0-9]/.test(chB);

        if (isDigitA && isDigitB) {
            const [numA, lenA] = extractNumber(nameA, i);
            const [numB, lenB] = extractNumber(nameB, j);
            if (numA !== numB) return numA - numB;
            i += lenA;
            j += lenB;
            continue;
        }

        const typeA = getCharType(chA);
        const typeB = getCharType(chB);

        const priorityA = getCharPriorityByCategory(typeA, category);
        const priorityB = getCharPriorityByCategory(typeB, category);

        if (priorityA !== priorityB) return priorityA - priorityB;

        if (typeA === 'greek' || typeA === 'letter' || typeA === 'digit') {
            if (chA !== chB) return chA.localeCompare(chB);
        } else if (typeA === 'chinese') {
            const cmp = chA.localeCompare(chB, 'zh-CN');
            if (cmp !== 0) return cmp;
        } else {
            if (chA !== chB) return chA.localeCompare(chB);
        }
        i++;
        j++;
    }
    return nameA.length - nameB.length;
};

/**
 * 线路排序比较函数（入口）
 * 先按大类排序，同一大类内逐位比较名称
 * @param {Object} routeA - 线路A
 * @param {Object} routeB - 线路B
 * @returns {number} 比较结果
 */
const routeSortCompare = (routeA, routeB) => {
    const catA = getRouteCategorySortOrder(routeA);
    const catB = getRouteCategorySortOrder(routeB);

    if (catA !== catB) return catA - catB;

    const nameA = cleanLineDisplayName(routeA.nameCn || '');
    const nameB = cleanLineDisplayName(routeB.nameCn || '');

    return compareRouteName(nameA, nameB, catA);
};

export { routeSortCompare, compareRouteName, getCharType, extractNumber };