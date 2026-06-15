// ==================== 方向描述 / 环形线路判断服务 ====================
import { getStationNameForDisplay } from './nameService.js';

/**
 * 判断是否为环形线路
 * 检查首尾站点是否相同
 * @param {Object} route - 路线对象
 * @returns {boolean} 是否为环形线路
 */
const isCircularRoute = (route) => {
    const st = route && route.forwardStations ? route.forwardStations : [];
    if (st.length < 3) return false;
    const first = st[0];
    const last = st[st.length - 1];
    return first && last && first.nameCn === last.nameCn && first.nameEn === last.nameEn;
};

/**
 * 获取路线的方向描述
 * 生成"起点-终点方向"或"起点 - 中间点 - 终点"格式
 * @param {Object} route - 路线对象
 * @param {boolean} preferThreePoint - 是否优先使用三点描述
 * @returns {string} 方向描述文本
 */
const getRouteDirectionDescriptor = (route, preferThreePoint = false) => {
    const stations = Array.isArray(route?.forwardStations) ? route.forwardStations.slice() : [];
    if (stations.length === 0) return '';

    if (stations.length > 1) {
        const first = stations[0];
        const last = stations[stations.length - 1];
        if (first?.nameCn === last?.nameCn && first?.nameEn === last?.nameEn) {
            stations.pop();
        }
    }

    const names = stations.map(getStationNameForDisplay).filter(Boolean);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];

    const uniqueNames = [];
    names.forEach(name => {
        if (!uniqueNames.includes(name)) uniqueNames.push(name);
    });
    const start = uniqueNames[0];
    const end = uniqueNames[uniqueNames.length - 1];

    if (preferThreePoint || route?.nameCn?.includes('電車') || route?.nameEn?.includes('LITRAM')) {
        const middle = uniqueNames[Math.floor(uniqueNames.length / 2)];
        if (middle && middle !== start && middle !== end) {
            return `${start} <--> ${middle} <--> ${end}`;
        }
    }

    return `${start} <--> ${end}`;
};

// 使用"内环/外环"命名规则的路线集合
const INNER_OUTER_LOOP_ROUTES = new Set(['β线', '城湾铁路环线', '北环', '城线']);

/**
 * 获取环形线路的方向标签
 * 根据线路名称和方向返回特定的标签（如"北环内圈"）
 * @param {Object} route - 路线对象
 * @param {string} directionKey - 方向键（forward/reverse）
 * @param {Array} stations - 站点数组
 * @returns {string} 方向标签
 */
const getCircularDirectionLabel = (route, directionKey, stations) => {
    const routeNames = [route?.nameCn].filter(Boolean);
    for (const routeName of routeNames) {
        if (INNER_OUTER_LOOP_ROUTES.has(routeName)) {
            return directionKey === 'forward' ? '内环' : '外环';
        }
    }

    const stationNames = (Array.isArray(stations) ? stations : [])
        .slice(0, Math.min(3, stations?.length || 0))
        .map(s => s.nameCn)
        .filter(Boolean)
        .join('，');
    if ((stations?.length || 0) > 3) {
        return `${stationNames}方向`;
    }
    return stationNames;
};

export { isCircularRoute, getRouteDirectionDescriptor, getCircularDirectionLabel };