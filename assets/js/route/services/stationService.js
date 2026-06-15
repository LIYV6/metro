// ==================== 站点全局信息查询与收集服务 ====================
import state from '../core/state.js';
import { debugLog } from '../core/debug.js';

/**
 * 从所有线路中收集唯一站点
 * @returns {Array} 去重后的站点数组
 */
const collectUniqueStations = () => {
    const stationMap = new Map();
    const routesData = state.routesData;

    routesData.forEach(route => {
        const processStations = (stations) => {
            if (!stations || !Array.isArray(stations)) return;

            stations.forEach(station => {
                const key = station.nameCn;
                if (!stationMap.has(key)) {
                    stationMap.set(key, {
                        nameCn: station.nameCn,
                        nameEn: station.nameEn || '',
                        nameEnAll: station.nameEnAll || '',
                        transfers: station.transfers || [],
                        nearbyTransfers: station.nearbyTransfers || [],
                        exits: station.exits || [],
                        lines: []
                    });
                }

                const stationInfo = stationMap.get(key);
                const existingLine = stationInfo.lines.find(l =>
                    l.mode === route.mode && l.nameCn === route.nameCn && l.color === route.color
                );

                if (!existingLine) {
                    stationInfo.lines.push({
                        mode: route.mode,
                        type: route.type || '',
                        nameCn: route.nameCn,
                        nameEn: route.nameEn,
                        color: route.color,
                        platformName: station.platformName || ''
                    });
                } else if (station.platformName && !existingLine.platformName) {
                    existingLine.platformName = station.platformName;
                }
            });
        };

        processStations(route.forwardStations);
        processStations(route.reverseStations);
    });

    return Array.from(stationMap.values());
};

/**
 * 确保就近换乘的双向对称性
 * 如果A站的nearbyTransfers包含B站，那么B站的nearbyTransfers也应该包含A站
 * @param {Object} station - 当前站点对象
 * @param {string} currentStationName - 当前站点名称
 */
const ensureBidirectionalNearbyTransfers = (station, currentStationName) => {
    if (!station || !station.nearbyTransfers || station.nearbyTransfers.length === 0) {
        return;
    }

    debugLog('transfer', '[ensureBidirectional] Checking bidirectional nearby transfers for:', currentStationName);

    const routesData = state.routesData;

    station.nearbyTransfers.forEach(nearby => {
        const targetName = nearby.targetStationCn || nearby.lineName || '';
        const targetEn = nearby.targetStationEn || '';

        if (!targetName) return;

        let foundTargetStation = null;
        let foundTargetRoute = null;
        let foundTargetList = null;

        for (const route of routesData) {
            const checkList = (list) => {
                if (!list) return false;
                const target = list.find(s => {
                    const nameMatch = s.nameCn === targetName;
                    const enMatch = !targetEn || s.nameEn === targetEn || s.nameEnAll === targetEn;
                    return nameMatch && enMatch;
                });
                if (target) {
                    foundTargetStation = target;
                    foundTargetRoute = route;
                    foundTargetList = list;
                    return true;
                }
                return false;
            };

            if (checkList(route.forwardStations) || checkList(route.reverseStations)) {
                break;
            }
        }

        if (!foundTargetStation) {
            debugLog('transfer', `[ensureBidirectional] Target station not found in routesData: ${targetName}`);
            return;
        }

        if (!foundTargetStation.nearbyTransfers) {
            foundTargetStation.nearbyTransfers = [];
        }

        const hasReverseLink = foundTargetStation.nearbyTransfers.some(nt => {
            const ntTarget = nt.targetStationCn || nt.lineName || '';
            return ntTarget === currentStationName;
        });

        if (!hasReverseLink) {
            debugLog('transfer', `[ensureBidirectional] Adding reverse link: ${targetName} -> ${currentStationName}`);

            const reverseNearby = {
                targetStationCn: currentStationName,
                targetStationEn: station.nameEn || '',
                lineName: nearby.lineName || '',
                mode: nearby.mode || 'TRAIN',
                color: nearby.color || '#607d8b',
                messageCn: `往${currentStationName}站转乘${nearby.lineName || ''}`,
                messageEn: `Transfer to ${currentStationName} via ${nearby.lineName || ''}`,
                isSynthesized: true
            };

            foundTargetStation.nearbyTransfers.push(reverseNearby);
            debugLog('transfer', '[ensureBidirectional] ✓ Symmetric link established');
        } else {
            debugLog('transfer', `[ensureBidirectional] ✓ Reverse link already exists: ${targetName} -> ${currentStationName}`);
        }
    });
};

/**
 * 获取站点的全局信息
 * 在所有路线中查找站点并返回其详细信息
 * @param {string} stationName - 站点名称
 * @param {string} stationEn - 站点英文名（可选，用于精确匹配）
 * @returns {Object|null} 站点全局信息
 */
const getStationGlobalInfo = (stationName, stationEn) => {
    if (!stationName) return null;
    const routesData = state.routesData;

    let foundStation = null;
    let bestMatchScore = -1;
    let bestMatchStation = null;
    let bestMatchTransfers = [];
    let bestMatchNearbyTransfers = [];
    let bestMatchExits = [];
    let bestMatchAddedLines = new Map();

    routesData.forEach(r => {
        const check = (list) => {
            if (!list) return;
            const matchedStations = list.filter(st => st.nameCn === stationName);

            matchedStations.forEach(s => {
                let score = 0;

                if (s.nameCn === stationName) {
                    score += 10;
                }

                if (stationEn && s.nameEn) {
                    if (s.nameEn === stationEn || s.nameEnAll === stationEn) {
                        score += 50;
                    } else if (s.nameEn.toLowerCase().includes(stationEn.toLowerCase()) ||
                               stationEn.toLowerCase().includes(s.nameEn.toLowerCase())) {
                        score += 30;
                    }
                }

                if (!stationEn && matchedStations.length > 1) {
                    const currentRouteMode = r.mode || 'TRAIN';
                    if (currentRouteMode === 'TRAIN') {
                        score += 5;
                    }
                }

                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatchStation = { ...s };
                    bestMatchTransfers = [];
                    bestMatchNearbyTransfers = [];
                    bestMatchExits = [];
                    bestMatchAddedLines = new Map();

                    foundStation = bestMatchStation;
                } else if (score === bestMatchScore && score > 0) {
                    foundStation = foundStation || { ...s };
                } else {
                    return;
                }

                const lineKey = `${r.mode}::${r.nameCn}::${r.color}`;

                if (!bestMatchAddedLines.has(lineKey)) {
                    const lineTransfer = {
                        mode: r.mode,
                        nameCn: r.nameCn,
                        nameEn: r.nameEn,
                        nameRaw: r.nameCn,
                        nameAll: r.nameCn,
                        color: r.color,
                        platformName: s.platformName,
                        isNearby: false
                    };
                    bestMatchTransfers.push(lineTransfer);
                    bestMatchAddedLines.set(lineKey, lineTransfer);
                } else {
                    const existing = bestMatchAddedLines.get(lineKey);
                    if (s.platformName && !existing.platformName) {
                        existing.platformName = s.platformName;
                    }
                }

                if (s.transfers) {
                    s.transfers.forEach(t => {
                        const transferKey = `${t.mode}::${t.nameRaw || t.nameCn}::${t.color}`;
                        if (!bestMatchAddedLines.has(transferKey)) {
                            bestMatchTransfers.push({ ...t, isNearby: false });
                            bestMatchAddedLines.set(transferKey, t);
                        }
                    });
                }

                if (s.nearbyTransfers) {
                    s.nearbyTransfers.forEach(t => bestMatchNearbyTransfers.push({ ...t, isNearby: true }));
                }
                if (s.exits) {
                    s.exits.forEach(e => bestMatchExits.push(e));
                }
            });
        };
        check(r.forwardStations);
        check(r.reverseStations);
    });

    if (foundStation) {
        // 去重 transfers
        const uniqueT = [];
        const seen = new Set();
        bestMatchTransfers.forEach(t => {
            const nameKey = t.nameRaw || t.nameCn || '';
            const colorKey = t.color || '';
            const k = `${nameKey}::${colorKey}`;
            if (!seen.has(k)) {
                seen.add(k);
                uniqueT.push(t);
            }
        });

        // 去重 nearbyTransfers（排除指向自身）
        const uniqueNearby = [];
        const seenNearby = new Set();
        bestMatchNearbyTransfers.forEach(t => {
            const targetName = t.targetStationCn || t.nameCn || '';
            if (targetName === stationName) return;
            const k = `${t.mode}::${targetName}::${t.color || ''}`;
            if (!seenNearby.has(k)) {
                seenNearby.add(k);
                uniqueNearby.push(t);
            }
        });

        foundStation.transfers = uniqueT;
        foundStation.nearbyTransfers = uniqueNearby;

        // 确保就近换乘的双向对称性
        ensureBidirectionalNearbyTransfers(foundStation, stationName);

        // 去重 exits
        const uniqueExits = [];
        const exitMap = new Map();
        bestMatchExits.forEach(e => {
            const key = e.name || '';
            if (!exitMap.has(key)) {
                const newExit = {
                    name: e.name,
                    destinations: [...(e.destinations || [])]
                };
                exitMap.set(key, newExit);
                uniqueExits.push(newExit);
            } else {
                const existingExit = exitMap.get(key);
                if (e.destinations && e.destinations.length > 0) {
                    const destSet = new Set(existingExit.destinations);
                    e.destinations.forEach(dest => destSet.add(dest));
                    existingExit.destinations = Array.from(destSet);
                }
            }
        });
        foundStation.exits = uniqueExits;

        debugLog('stationInfo', '[getStationGlobalInfo] Matched station:', {
            nameCn: foundStation.nameCn,
            nameEn: foundStation.nameEn,
            matchScore: bestMatchScore,
            transfersCount: foundStation.transfers.length,
            nearbyCount: (foundStation.nearbyTransfers || []).length
        });

        return foundStation;
    }
    return null;
};

export { collectUniqueStations, ensureBidirectionalNearbyTransfers, getStationGlobalInfo };