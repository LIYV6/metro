// ==================== 路线数据组装器 ====================
import { toObj } from './database.js';

/**
 * 组装最终的路线数据结构
 * 将 routes 与 stations、transfers、nearby、exits 关联
 * @param {Object} tables - 原始表数据
 * @param {Object} indexes - 预构建的索引
 * @returns {Array} 完整的路线数据数组
 */
const assembleRouteData = (tables, indexes) => {
    const {
        stationsByRoute,
        transfersByStationId,
        transfersByStationName,
        nearbyByStationId,
        nearbyByStationName,
        exitsByStationId
    } = indexes;

    const { routes } = tables;

    // 注入关联数据的工具函数
    const injectRelated = (list) => list.map(s => {
        // 优先按 id 查找，若为空则按 nameCn 查找（解决正反方向 id 不同问题）
        let rawTransfers = transfersByStationId[s.id];
        if (!rawTransfers || rawTransfers.length === 0) {
            rawTransfers = transfersByStationName[s.nameCn] || [];
        }

        let rawNearby = nearbyByStationId[s.id];
        if (!rawNearby || rawNearby.length === 0) {
            rawNearby = nearbyByStationName[s.nameCn] || [];
        }

        const rawExitsMap = exitsByStationId[s.id] || {};

        const formattedExits = Object.keys(rawExitsMap).map(name => ({
            name,
            destinations: rawExitsMap[name]
        }));

        return {
            ...s,
            transfers: rawTransfers,
            exits: formattedExits,
            nearbyTransfers: rawNearby
        };
    });

    return routes.values.map(row => {
        const route = toObj(routes.columns, row);
        // 兼容原代码可能使用的 index 字段
        route.index = route.index_val;

        const stData = stationsByRoute[route.id] || { forward: [], reverse: [] };

        route.forwardStations = injectRelated(stData.forward);
        route.reverseStations = injectRelated(stData.reverse);
        return route;
    });
};

export { assembleRouteData };