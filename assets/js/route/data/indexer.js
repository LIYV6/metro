// ==================== 数据索引构建器 ====================
import { toObj } from './database.js';

/**
 * 构建所有数据索引
 * @param {Object} tables - 从数据库加载的原始表数据
 * @returns {Object} 包含所有索引的对象
 */
const buildIndexes = (tables) => {
    const { routes, stations, transfers, exits, nearby } = tables;

    // 建立 station_id -> station_nameCn 的映射
    const stationIdToName = {};
    stations.values.forEach(row => {
        const s = toObj(stations.columns, row);
        stationIdToName[s.id] = s.nameCn;
    });

    // 1. 建立站点索引 (按 route_id 分组)
    const stationsByRoute = {};
    stations.values.forEach(row => {
        const s = toObj(stations.columns, row);
        if (!stationsByRoute[s.route_id]) stationsByRoute[s.route_id] = { forward: [], reverse: [] };
        const dir = s.direction === 'reverse' ? 'reverse' : 'forward';
        stationsByRoute[s.route_id][dir].push(s);
    });

    // 2. 建立换乘索引 (按 station_id 分组)
    const transfersByStationId = {};
    transfers.values.forEach(row => {
        const t = toObj(transfers.columns, row);
        if (!transfersByStationId[t.station_id]) transfersByStationId[t.station_id] = [];
        transfersByStationId[t.station_id].push(t);
    });

    // 按站点名称建立换乘索引（解决反向站点 id 不同问题）
    const transfersByStationName = {};
    transfers.values.forEach(row => {
        const t = toObj(transfers.columns, row);
        const stationName = stationIdToName[t.station_id];
        if (stationName) {
            if (!transfersByStationName[stationName]) transfersByStationName[stationName] = [];
            transfersByStationName[stationName].push(t);
        }
    });

    // 3. 建立就近换乘索引 (按 station_id 分组)
    const nearbyByStationId = {};
    nearby.values.forEach(row => {
        const n = toObj(nearby.columns, row);
        if (!nearbyByStationId[n.station_id]) nearbyByStationId[n.station_id] = [];
        nearbyByStationId[n.station_id].push(n);
    });

    // 按站点名称建立就近换乘索引
    const nearbyByStationName = {};
    nearby.values.forEach(row => {
        const n = toObj(nearby.columns, row);
        const stationName = stationIdToName[n.station_id];
        if (stationName) {
            if (!nearbyByStationName[stationName]) nearbyByStationName[stationName] = [];
            nearbyByStationName[stationName].push(n);
        }
    });

    // 4. 建立出口索引 (按 station_id 和 exit_name 二次聚合)
    const exitsByStationId = {};
    exits.values.forEach(row => {
        const e = toObj(exits.columns, row);
        const sId = e.station_id;
        if (!exitsByStationId[sId]) exitsByStationId[sId] = {};

        if (!exitsByStationId[sId][e.exit_name]) {
            exitsByStationId[sId][e.exit_name] = [];
        }
        if (e.destination) {
            exitsByStationId[sId][e.exit_name].push(e.destination);
        }
    });

    return {
        stationIdToName,
        stationsByRoute,
        transfersByStationId,
        transfersByStationName,
        nearbyByStationId,
        nearbyByStationName,
        exitsByStationId
    };
};
export { buildIndexes };