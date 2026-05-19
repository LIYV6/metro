// ==================== 统一调试配置 ====================
const ROUTE_DEBUG_CONFIG = {
    // 全局调试开关：true 启用所有调试日志，false 关闭
    enabled: false,
    
    // 模块级开关
    modules: {
        database: true,      // 数据库加载相关日志
        render: true,        // 渲染过程日志
        transfer: true,      // 换乘逻辑日志
        stationInfo: true    // 站点信息日志
    }
};

/**
 * 统一调试日志函数
 * @param {string} module - 模块名称 ('database' | 'render' | 'transfer' | 'stationInfo')
 * @param {...*} args - 日志内容
 */
function debugLog(module, ...args) {
    if (!ROUTE_DEBUG_CONFIG.enabled) return;
    if (!ROUTE_DEBUG_CONFIG.modules[module]) return;
    
    const prefix = `[Route-${module}]`;
    console.log(prefix, ...args);
}
// ================================================

// 判断是否为高铁/高速铁路线路。优先级：mode字段 → type字段 → 名称特征（兜底）
// @param {string} nameRaw - 线路原始名称
// @param {string} mode - 交通模式
// @param {string} routeType - 路线类型
// @returns {boolean} 是否为高铁线路
function isHighSpeedLineEx(nameRaw, mode, routeType) {
    const modeText = String(mode || '').trim().toUpperCase();
    const typeText = String(routeType || '').trim().toUpperCase();
    
    // 1. 非轨道列车，直接返回false（飞机、轮船、缆车）
    if (modeText === 'AIRPLANE' || modeText === 'BOAT' || modeText === 'CABLE_CAR' || modeText === 'CABLECAT') {
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
}

// 获取交通模式的中文标签。优先级：mode字段 → type字段 → 名称特征（辅助）
// @param {string} mode - 交通模式代码
// @param {Object} transferObj - 换乘对象
// @returns {string} 中文模式标签（地铁、高铁、轮船等）
function getModeLabel(mode, transferObj) {
    const m = String(mode || '').trim();
    const nameRaw = String(
        transferObj?.nameRaw || transferObj?.nameAll || transferObj?.nameCn || transferObj?.nameEn || transferObj?.name || ''
    );
    
    // 1. 优先根据mode字段判断
    if (m === 'BOAT') return '轮船';
    if (m === 'AIRPLANE') return '飞机';
    if (m === 'CABLE_CAR' || m === 'CABLECAT') return '缆车';
    if (m === 'LIGHT_RAIL') return '轻轨';
    
    // 2. 高铁判断（优先级高于名称关键词，防止“机场快线-飞机接驳”等误判）
    if (isHighSpeedLineEx(nameRaw, m, transferObj?.type)) {
        return '铁路';
    }

    // 3. 默认地铁（mode为TRAIN或NORMAL时）
    if (m === 'TRAIN' || m === 'NORMAL') {
        return '地铁';
    }

    // 4. mode/type都不明确时，才用名称关键词辅助判断（兜底逻辑）
    if (nameRaw) {
        const lowerName = nameRaw.toLowerCase();
        if (lowerName.includes('轮船') || lowerName.includes('boat') || lowerName.includes('ship')) return '轮船';
        if (lowerName.includes('飞机') || lowerName.includes('airplane') || lowerName.includes('flight')) return '飞机';
        if (lowerName.includes('缆车') || lowerName.includes('索道') || lowerName.includes('cable')) return '缆车';
    }

    // 5. 其他未知模式，默认地铁
    return '地铁';
}

// 清理线路名称中的方向后缀。移除"方向"、"往XXX"等后缀信息
// @param {string} text - 原始文本
// @returns {string} 清理后的文本
function cleanDirectionSuffix(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;
    const parts = raw.split('||').map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0];
    return raw.replace(/(方向|往.*$|To\s+.*$)/i, '').trim();
}

// 获取换乘名称（中文）
// @param {Object} transfer - 换乘对象
// @returns {string} 清理后的中文名称
function getTransferNameByLang(transfer) {
    return cleanDirectionSuffix(transfer.nameCn || transfer.name || '');
}

// 判断是否为环形线路。检查首尾站点是否相同
// @param {Object} route - 路线对象
// @returns {boolean} 是否为环形线路
function isCircularRoute(route) {
    const st = route && route.forwardStations ? route.forwardStations : [];
    if (st.length < 3) return false;
    const first = st[0];
    const last = st[st.length - 1];
    return first && last && first.nameCn === last.nameCn && first.nameEn === last.nameEn;
}

let db = null; // 全局数据库实例
let routesData = []; // 保持全局变量名不变，兼容后续逻辑

// 加载路线数据并初始化页面。从 metro.db 获取数据，渲染路线并初始化事件监听器
async function loadRoutesData() {
    try {
        debugLog('database', '正在初始化 SQL.js...');
        // const config = { locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}` };
        const config = { locateFile: filename => `../assets/js/libs/${filename}` };
        const SQL = await initSqlJs(config);
        
        debugLog('database', '正在加载 metro.db...');
        const response = await fetch('../assets/data/metro.db');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        db = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
        debugLog('database', '数据库加载成功！');

        // 1. 获取所有线路基础信息
        const routesRes = db.exec("SELECT * FROM routes");
        const routesCols = routesRes[0].columns;
        const routesVals = routesRes[0].values;

        // 2. 获取所有站点信息
        const stationsRes = db.exec("SELECT * FROM stations");
        const stationsCols = stationsRes[0].columns;
        const stationsVals = stationsRes[0].values;

        // 3. 获取所有换乘信息
        const transfersRes = db.exec("SELECT * FROM transfers");
        const transfersCols = transfersRes[0].columns;
        const transfersVals = transfersRes[0].values;

        // 4. 获取所有出口信息
        const exitsRes = db.exec("SELECT * FROM exits");
        const exitsCols = exitsRes[0].columns;
        const exitsVals = exitsRes[0].values;

        // 5. 获取所有就近换乘信息
        const nearbyRes = db.exec("SELECT * FROM nearby_transfers");
        const nearbyCols = nearbyRes[0].columns;
        const nearbyVals = nearbyRes[0].values;

        // 辅助函数：将 SQL 结果行转为对象
        const toObj = (cols, row) => {
            let obj = {};
            cols.forEach((c, i) => {
                let v = row[i];
                if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
                    try { v = JSON.parse(v); } catch(e) {}
                }
                obj[c] = v;
            });
            return obj;
        };

        // 建立 station_id -> station_nameCn 的映射（用于解决反向站点关联问题）
        const stationIdToName = {};
        stationsVals.forEach(row => {
            const s = toObj(stationsCols, row);
            stationIdToName[s.id] = s.nameCn;
        });

        // 1. 建立站点索引 (按 route_id 分组)
        const stationsByRoute = {};
        stationsVals.forEach(row => {
            const s = toObj(stationsCols, row);
            if (!stationsByRoute[s.route_id]) stationsByRoute[s.route_id] = { forward: [], reverse: [] };
            const dir = s.direction === 'reverse' ? 'reverse' : 'forward';
            stationsByRoute[s.route_id][dir].push(s);
        });

        // 2. 建立换乘索引 (按 station_id 分组)
        const transfersByStationId = {};
        transfersVals.forEach(row => {
            const t = toObj(transfersCols, row);
            if (!transfersByStationId[t.station_id]) transfersByStationId[t.station_id] = [];
            transfersByStationId[t.station_id].push(t);
        });

        // 新增：按站点名称建立换乘索引（解决反向站点 id 不同问题）
        const transfersByStationName = {};
        transfersVals.forEach(row => {
            const t = toObj(transfersCols, row);
            const stationName = stationIdToName[t.station_id];
            if (stationName) {
                if (!transfersByStationName[stationName]) transfersByStationName[stationName] = [];
                transfersByStationName[stationName].push(t);
            }
        });

        // 3. 建立就近换乘索引 (按 station_id 分组)
        const nearbyByStationId = {};
        nearbyVals.forEach(row => {
            const n = toObj(nearbyCols, row);
            if (!nearbyByStationId[n.station_id]) nearbyByStationId[n.station_id] = [];
            nearbyByStationId[n.station_id].push(n);
        });

        // 新增：按站点名称建立就近换乘索引
        const nearbyByStationName = {};
        nearbyVals.forEach(row => {
            const n = toObj(nearbyCols, row);
            const stationName = stationIdToName[n.station_id];
            if (stationName) {
                if (!nearbyByStationName[stationName]) nearbyByStationName[stationName] = [];
                nearbyByStationName[stationName].push(n);
            }
        });

        // 4. 建立出口索引 (关键点：需要按 station_id 和 exit_name 二次聚合)
        const exitsByStationId = {};
        exitsVals.forEach(row => {
            const e = toObj(exitsCols, row);
            const sId = e.station_id;
            if (!exitsByStationId[sId]) exitsByStationId[sId] = {};
            
            // 如果该出口名还没记录，初始化数组
            if (!exitsByStationId[sId][e.exit_name]) {
                exitsByStationId[sId][e.exit_name] = [];
            }
            // 将目的地加入数组 (过滤空值)
            if (e.destination) {
                exitsByStationId[sId][e.exit_name].push(e.destination);
            }
        });
        // 新增：按站点名称建立出口索引
        const exitsByStationName = {};
        exitsVals.forEach(row => {
            const e = toObj(exitsCols, row);
            // exits 表可能不直接包含站点名，需要靠 stations 表关联，这里假设 exits 通过 station_id 关联
            // 我们在组装时通过 name 匹配更稳妥。先留空，在 injectRelated 中动态匹配。
        });

        // 组装最终数据
        routesData = routesVals.map(row => {
            const route = toObj(routesCols, row);
            // 兼容原代码可能使用的 index 字段
            route.index = route.index_val; 
            
            const stData = stationsByRoute[route.id] || { forward: [], reverse: [] };
            
            // 注入相关数据
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

                let rawExitsMap = exitsByStationId[s.id] || {};
                
                const formattedExits = Object.keys(rawExitsMap).map(name => ({
                    name: name,
                    destinations: rawExitsMap[name]
                }));

                return {
                    ...s,
                    transfers: rawTransfers,
                    exits: formattedExits,
                    nearbyTransfers: rawNearby
                };
            });

            route.forwardStations = injectRelated(stData.forward);
            route.reverseStations = injectRelated(stData.reverse);
            return route;
        });

        // 暴露给控制台调试
        window.metroDB = db;
        window.routesData = routesData;

        debugLog('render', `已加载 ${routesData.length} 条线路数据，开始渲染...`);
        renderRoutes();
        renderStationBlocks(); // 渲染站点色块
        initializeEventListeners();

    } catch (error) {
        console.error('数据库加载失败:', error);
        document.getElementById('routesContainer').innerHTML = 
            '<p style="text-align: center; padding: 40px; color: #ff5252;">数据库加载失败。<br><small>' + error.message + '</small></p>';
    }
}

// 调度路线重绘。使用 requestAnimationFrame 优化性能
function scheduleRouteRedraw() {
    requestAnimationFrame(() => requestAnimationFrame(redrawVisibleLines));
}

// 移除线路名称中的支线后缀。如"（支线1）"、" (Branch 2)"等
// @param {string} text - 原始文本
// @returns {string} 清理后的文本
function stripBranchSuffix(text) {
    let value = String(text || '').trim();
    value = value.replace(/\s*\(支线\d+\)\s*$/i, '').trim();
    value = value.replace(/\s*\(Branch\s*\d+\)\s*$/i, '').trim();
    if (value.includes(' (鏀嚎')) value = value.split(' (鏀嚎')[0].trim();
    if (value.includes(' (閺€顖滃殠')) value = value.split(' (閺€顖滃殠')[0].trim();
    if (value.includes(' (Branch')) value = value.split(' (Branch')[0].trim();
    return value;
}

// 统一清理线路显示名称。移除方向、支线、英文名等后缀，只保留纯中文线路名
// 处理格式："1号线|Line 1||To 丽都" → "1号线"
// @param {string} rawName - 原始名称
// @returns {string} 清理后的纯线路名
function cleanLineDisplayName(rawName) {
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
}

// 格式化路线显示名称（双语）。同时处理中英文，返回清理后的名称对象
// @param {Object} route - 路线对象
// @returns {Object} {cn: string, en: string, tooltip: string}
function formatRouteDisplayName(route) {
    const cn = cleanLineDisplayName(route.nameCn || '');
    const en = cleanLineDisplayName(route.nameEn || '');
    const tooltip = cn === en || !en ? cn : `${cn} / ${en}`;
    return { cn, en, tooltip };
}

// 获取站点显示名称。优先返回中文名，其次英文名
// @param {Object} station - 站点对象
// @returns {string} 站点名称
function getStationNameForDisplay(station) {
    if (!station) return '';
    return station.nameCn || station.nameEn || '';
}

// 获取路线的方向描述。生成"起点-终点方向"或"起点 - 中间点 - 终点"格式
// @param {Object} route - 路线对象
// @param {boolean} preferThreePoint - 是否优先使用三点描述
// @returns {string} 方向描述文本
function getRouteDirectionDescriptor(route, preferThreePoint = false) {
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
            return `${start} - ${middle} - ${end}`;
        }
    }

    return `${start}-${end}方向`;
}

// 获取环形线路的方向标签。根据线路名称和方向返回特定的标签（如"北环内圈"）
// @param {Object} route - 路线对象
// @param {string} directionKey - 方向键（forward/reverse）
// @param {Array} stations - 站点数组
// @returns {string} 方向标签
function getCircularDirectionLabel(route, directionKey, stations) {
    const routeNames = [route?.nameCn].filter(Boolean);
    for (const routeName of routeNames) {
        // 定义使用"内环/外环"命名规则的路线集合
        const innerOuterLoopRoutes = new Set(['β线', '城湾铁路环线','北环','城线']);

        if (innerOuterLoopRoutes.has(routeName)) {
            return directionKey === 'forward' ? '内环' : '外环';
        }
        // if (routeName === 'β线')
        //     return directionKey === 'forward' ? '内环' : '外环';

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
}

// 规范化路线基础名称（V2版本）。结合清理方向后缀和移除支线后缀
// @param {string} rawName - 原始名称
// @returns {string} 规范化后的名称
function normalizeRouteBaseNameV2(rawName) {
    return stripBranchSuffix(cleanDirectionSuffix(rawName || '')).trim();
}

// 渲染所有路线到页面。创建统一展示区域，按线路分组路线，生成线路选择器的色块
function renderRoutes() {
    const container = document.getElementById('routesContainer');
    const lineBlocksContainer = document.getElementById('lineBlocksContainer');
    
    // Clear containers
    container.innerHTML = '';
    if (lineBlocksContainer) {
        lineBlocksContainer.innerHTML = '';
    }
    
    // Create a unified display area
    const unifiedDisplay = document.createElement('div');
    unifiedDisplay.id = 'unifiedRouteDisplay';
    unifiedDisplay.className = 'route-card';
    unifiedDisplay.style.display = 'none'; // Initially hidden
    container.appendChild(unifiedDisplay);
    
    // Group routes by normalized line identity, avoid splitting same line by remark text
    const groupedRoutes = {};
    routesData.forEach(route => {
        const baseCn = normalizeRouteBaseNameV2(route.nameCn || '');
        const baseEn = normalizeRouteBaseNameV2(route.nameEn || '');
        const groupKey = `${route.color || ''}::${baseCn}::${baseEn}`;
        
        if (!groupedRoutes[groupKey]) {
            groupedRoutes[groupKey] = [];
        }
        groupedRoutes[groupKey].push(route);
    });

    // Store grouped routes for later use
    window.groupedRoutesData = groupedRoutes;

    Object.keys(groupedRoutes).forEach((groupKey, groupIndex) => {
        const routes = groupedRoutes[groupKey];
        const primaryRoute = routes[0]; // use the first route as representative
        
        // Create line block for selector
        if (lineBlocksContainer) {
            const lineBlock = createLineBlock(primaryRoute, groupIndex);
            lineBlocksContainer.appendChild(lineBlock);
        }
    });
}

// 创建线路选择器中的色块元素
// @param {Object} route - 路线对象
// @param {number} groupIndex - 线路组索引
// @returns {HTMLElement} 线路色块 DOM 元素
function createLineBlock(route, groupIndex) {
    const block = document.createElement('div');
    block.className = 'line-block';
    block.style.backgroundColor = route.color || '#607d8b';
    block.dataset.groupIndex = groupIndex;
    block.dataset.mode = route.mode;
    block.dataset.type = route.type;
    
    // 使用统一的名称格式化函数
    const { cn: displayCn, tooltip: tooltipText } = formatRouteDisplayName(route);
    
    // Add line name label to the block
    const label = document.createElement('div');
    label.className = 'line-block-label';
    label.textContent = displayCn;
    block.appendChild(label);
    
    const tooltip = document.createElement('div');
    tooltip.className = 'line-block-tooltip';
    tooltip.textContent = tooltipText;
    
    block.appendChild(tooltip);
    
    block.addEventListener('click', () => selectLine(groupIndex));
    
    return block;
}

// 选择并显示指定线路。高亮对应的色块，在统一展示区渲染该线路的站点信息
// @param {number} groupIndex - 线路组索引
function selectLine(groupIndex) {
    // Remove active class from all blocks
    document.querySelectorAll('.line-block').forEach(block => {
        block.classList.remove('active');
    });
    
    // Add active class to selected block
    const selectedBlock = document.querySelector(`.line-block[data-group-index="${groupIndex}"]`);
    if (selectedBlock) {
        selectedBlock.classList.add('active');
    }
    
    // Get the route data for this group
    const groupedRoutes = window.groupedRoutesData;
    const groupKey = Object.keys(groupedRoutes)[groupIndex];
    if (!groupKey) return;
    
    const routes = groupedRoutes[groupKey];
    const primaryRoute = routes[0];
    
    // Show the unified display area
    const unifiedDisplay = document.getElementById('unifiedRouteDisplay');
    if (!unifiedDisplay) return;
    
    unifiedDisplay.style.display = '';
    
    // Render the route content in the unified display
    renderRouteInUnifiedDisplay(primaryRoute, routes, groupIndex);
}

// 在统一展示区渲染线路详情。包括线路标题、方向选择器、站点列表等
// @param {Object} primaryRoute - 主路线对象
// @param {Array} branches - 分支路线数组
// @param {number} groupIndex - 线路组索引
function renderRouteInUnifiedDisplay(primaryRoute, branches, groupIndex) {
    const container = document.getElementById('unifiedRouteDisplay');
    if (!container) return;
    
    // 使用统一的名称格式化函数
    const { cn: displayCn, en: displayEn } = formatRouteDisplayName(primaryRoute);
    
    // Line names overview defaults to showing all languages
    let titleHtml = `<h2>${displayCn} <span style="font-size: 0.7em; color: rgba(255,255,255,0.7); font-weight: normal; margin-left: 6px;">${displayEn}</span></h2>`;
    if (displayCn === displayEn || !displayEn) {
        titleHtml = `<h2>${displayCn}</h2>`;
    }

    let branchesHTML = '';
    branches.forEach((route, branchIndex) => {
        const hasReverse = route.reverseStations && route.reverseStations.length > 0 && !route.autoReverse;
        const circular = isCircularRoute(route);
        
        let branchLabelText = getRouteDirectionDescriptor(route, branches.length > 2) || '交路/支线 ' + (branchIndex + 1);
        
        // Task 4: 3号线快线
        if (displayCn === '3号线快线') {
            if (route.nameCn.includes('鏀嚎2') || route.nameCn.includes('支线2')) {
                branchLabelText = '3号线快线(二期)';
            } else {
                branchLabelText = '3号线快线(一期)';
            }
        }
        
        // Task 5: 9号线, 鯉城電車
        if (displayCn === '9号线' || displayCn.includes('電車') || displayCn.includes('电车')) {
            if (route.forwardStations && route.forwardStations.length > 0) {
                const st = route.forwardStations;
                const getName = (s) => s.nameCn;
                const start = getName(st[0]);
                const end = getName(st[st.length - 1]);
                let mid = '';
                if (st.length > 2) {
                    mid = ' -> ' + getName(st[Math.floor(st.length / 2)]);
                }
                branchLabelText = getRouteDirectionDescriptor(route, true) || `${start}${mid} -> ${end}`;
            }
        }
        
        // If only one route with reverse, use direction selector instead of branch label
        const useDirectionSelector = branches.length === 1 && hasReverse;
        let branchLabel = (!useDirectionSelector)
            ? `<div class="branch-label">${branchLabelText}</div>`
            : '';
        
        let directionLabelForward = '';
        let directionLabelReverse = '';

        if (route.forwardStations && route.forwardStations.length > 0) {
            const st = route.forwardStations;
            if (circular) {
                directionLabelForward = getCircularDirectionLabel(route, 'forward', st);
            } else {
                const endStation = st[st.length - 1];
                const endName = endStation.nameCn;
                directionLabelForward = `往${endName}方向`;
            }
        }

        if (hasReverse && route.reverseStations && route.reverseStations.length > 0) {
            const st = route.reverseStations;
            if (circular) {
                directionLabelReverse = getCircularDirectionLabel(route, 'reverse', st);
            } else {
                const endStation = st[st.length - 1];
                const endName = endStation.nameCn;
                directionLabelReverse = `往${endName}方向`;
            }
        }
        
        // Build direction selector if route has reverse
        let directionSelector = '';
        if (hasReverse) {
            const selectorId = `selector-${groupIndex}-${branchIndex}`;
            directionSelector = `
                <div class="direction-selector" id="${selectorId}">
                    <button class="direction-btn active" data-dir="forward" onclick="selectDirection('${selectorId}', 'forward', ${groupIndex}, ${branchIndex})">${directionLabelForward}</button>
                    <button class="direction-btn" data-dir="reverse" onclick="selectDirection('${selectorId}', 'reverse', ${groupIndex}, ${branchIndex})">${directionLabelReverse}</button>
                </div>
            `;
        }
        
        branchesHTML += `
            <div class="branch-container">
                ${branchLabel}
                ${directionSelector}
                <div class="station-list" id="stations-${groupIndex}-${branchIndex}-forward"></div>
                ${hasReverse ? `<div class="station-list hidden" id="stations-${groupIndex}-${branchIndex}-reverse"></div>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = `
        <div class="route-header unified-header">
            <div class="route-color" style="background: ${primaryRoute.color};"></div>
            <div class="route-title">
                ${titleHtml}
                <p></p>
            </div>
        </div>
        <div class="route-content expanded" id="route-content-unified" style="--route-color: ${primaryRoute.color};">
            ${branchesHTML}
        </div>
    `;
    
    // Render stations for all branches
    branches.forEach((route, branchIndex) => {
        renderStations(route, `${groupIndex}-${branchIndex}`);
    });
    
    requestAnimationFrame(() => {
        redrawVisibleLines();
        attachStationListScrollRedraw();
    });
}

// 转义 JavaScript 字符串。处理反斜杠、单引号和换行符
// @param {*} value - 要转义的值
// @returns {string} 转义后的字符串

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

// 转义JavaScript字符串，防止语法错误
// @param {string} value - 需要转义的字符串
// @returns {string} 转义后的字符串
function escapeJsString(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ')
        .replace(/\r/g, ' ');
}

// 获取高铁换乘提示信息
// @param {Object} station - 站点对象
// @returns {string} 换乘提示文本
function getHighSpeedTransferHint(station) {
    const nearby = Array.isArray(station.nearbyTransfers) ? station.nearbyTransfers : [];
    const target = nearby.find(item => item && item.mode === 'HIGH_SPEED');
    if (target && target.targetStationCn) return `往${target.targetStationCn}换乘铁路`;
    return '可换乘铁路';
}

// 构建换乘徽章 HTML
// @param {Object} station - 站点对象
// @param {Object} transferModel - 换乘模型
// @param {Object} currentRoute - 当前线路对象
// @param {string} safeNameCn - 转义后的中文名
// @param {string} safeNameEn - 转义后的英文名
// @param {string} safeMergedPayload - 转义后的合并数据
// @param {string} safeExitsData - 转义后的出口数据
// @returns {string} 徽章 HTML
function buildTransferBadgesHTML(station, transferModel, currentRoute, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) {
    const { hasHighSpeed, hasBoat, hasAirplane, normalTransfers, highSpeedTransfers, boatTransfers, airTransfers } = transferModel;
    const hasNearby = station.nearbyTransfers && station.nearbyTransfers.length > 0;
    
    if (!normalTransfers.length && !hasHighSpeed && !hasBoat && !hasAirplane && !hasNearby) {
        return '';
    }
    
    let badgesHTML = `<div class="transfer-badges side-unified">`;
    
    // 普通换乘徽章
    if (normalTransfers.length > 0) {
        badgesHTML += buildNormalTransferBadges(normalTransfers, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }
    
    // 高铁换乘徽章
    if (hasHighSpeed) {
        badgesHTML += buildHighSpeedBadge(station, highSpeedTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }
    
    // 轮船换乘徽章
    if (hasBoat) {
        badgesHTML += buildModeTransferBadge('轮船', boatTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }
    
    // 飞机换乘徽章
    if (hasAirplane) {
        badgesHTML += buildModeTransferBadge('飞机', airTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData);
    }
    
    badgesHTML += '</div>';
    return badgesHTML;
}

// 构建普通换乘徽章
// @param {Array} normalTransfers - 普通换乘数组
// @param {string} safeNameCn - 转义后的中文名
// @param {string} safeNameEn - 转义后的英文名
// @param {string} safeMergedPayload - 转义后的合并数据
// @param {string} safeExitsData - 转义后的出口数据
// @returns {string} 徽章 HTML
function buildNormalTransferBadges(normalTransfers, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) {
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
        const pBadge = transfer.platformName ? `<span style="background:rgba(0,0,0,0.2); border-radius:2px; padding:0 4px; margin-left:4px; font-size:10px;">站台 ${transfer.platformName}</span>` : '';
        const transferPayload = [{ name: transfer.name, nameRaw: transfer.name, nameAll: transfer.name, nameCn: transfer.name, nameEn: transfer.name, color: transfer.color, mode: transfer.mode, platformName: transfer.platformName }];
        const payload = encodeURIComponent(JSON.stringify(transferPayload));
        html += `<div class="transfer-link-item direct-item" title="${transferTitle}" style="--tc:${transfer.color};" onclick="event.stopPropagation(); showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${payload}', '${safeExitsData}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${transferName}${pBadge}</span></div>`;
    });
    
    return html;
}

// 构建高铁换乘徽章
// @param {Object} station - 站点对象
// @param {Array} highSpeedTransfers - 高铁换乘数组
// @param {boolean} hasNearby - 是否有就近换乘
// @param {string} safeNameCn - 转义后的中文名
// @param {string} safeNameEn - 转义后的英文名
// @param {string} safeMergedPayload - 转义后的合并数据
// @param {string} safeExitsData - 转义后的出口数据
// @returns {string} 徽章 HTML
function buildHighSpeedBadge(station, highSpeedTransfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) {
    const hsData = encodeURIComponent(JSON.stringify(highSpeedTransfers));
    const payload = hasNearby ? safeMergedPayload : hsData;
    const hsText = escapeJsString(getHighSpeedTransferHint(station));
    return `<div class="transfer-link-item summary-item hs-item" onclick="event.stopPropagation(); showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${payload}', '${safeExitsData}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${hsText}</span></div>`;
}

// 构建其他模式（轮船/飞机）换乘徽章
// @param {string} modeLabel - 模式标签（轮船/飞机）
// @param {Array} transfers - 换乘数组
// @param {boolean} hasNearby - 是否有就近换乘
// @param {string} safeNameCn - 转义后的中文名
// @param {string} safeNameEn - 转义后的英文名
// @param {string} safeMergedPayload - 转义后的合并数据
// @param {string} safeExitsData - 转义后的出口数据
// @returns {string} 徽章 HTML
function buildModeTransferBadge(modeLabel, transfers, hasNearby, safeNameCn, safeNameEn, safeMergedPayload, safeExitsData) {
    const modeData = encodeURIComponent(JSON.stringify(transfers));
    const payload = hasNearby ? safeMergedPayload : modeData;
    const text = `可换乘${modeLabel}`;
    return `<div class="transfer-link-item summary-item other-mode-transfer" onclick="event.stopPropagation(); showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${payload}', '${safeExitsData}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${text}</span></div>`;
}

// 生成线路的 HTML 结构。包括站点名称、换乘徽章、点击事件等
// @param {Object} station - 站点对象
// @param {Object} currentRoute - 当前线路对象（包含 nameCn, color, mode）
// @returns {string} 站点 HTML 字符串
function createStationHTML(station, currentRoute) {
    const transferModel = buildStationTransferModel(station);
    const isTransfer = station.isTransfer;
    const hasNearby = station.nearbyTransfers && station.nearbyTransfers.length > 0;
    const dotClass = isTransfer || transferModel.hasHighSpeed || transferModel.hasBoat || transferModel.hasAirplane || hasNearby ? 'station-dot transfer' : 'station-dot';

    const safeNameCn = escapeJsString(station.nameCn);
    const safeNameEn = escapeJsString(station.nameEn || '');
    const stationEnAll = station.nameEnAll || station.nameEn || '';
    
    // 构建完整的线路列表：当前线路 + 换乘线路
    const currentLineName = currentRoute ? stripBranchSuffix(cleanDirectionSuffix(currentRoute.nameCn || '')) : '';
    const currentLineInfo = currentRoute ? {
        name: currentLineName,
        nameRaw: currentLineName,
        nameAll: currentRoute.nameCn || '',
        nameCn: currentLineName,
        nameEn: currentRoute.nameEn || '',
        color: currentRoute.color || '#607d8b',
        mode: currentRoute.mode || 'TRAIN'
    } : null;
    
    // 合并当前线路和换乘线路（去重）
    const allLines = currentLineInfo ? [currentLineInfo] : [];
    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(t => {
            if (t) allLines.push(t);
        });
    }
    
    const allTransfersData = encodeURIComponent(JSON.stringify(allLines));
    // 构建包含当前线路的合并数据（用于就近换乘场景）
    const mergedTransfersWithCurrent = currentLineInfo ? [currentLineInfo] : [];
    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(t => {
            if (t) mergedTransfersWithCurrent.push(t);
        });
    }
    if (station.nearbyTransfers && station.nearbyTransfers.length > 0) {
        station.nearbyTransfers.forEach(n => {
            if (n) mergedTransfersWithCurrent.push({...n, isNearby: true});
        });
    }
    const mergedPayload = hasNearby
        ? encodeURIComponent(JSON.stringify(mergedTransfersWithCurrent))
        : allTransfersData;
    const exitsData = encodeURIComponent(JSON.stringify(station.exits || []));
    // Escape the payloads for use in HTML attributes
    const safeMergedPayload = escapeJsString(mergedPayload);
    const safeExitsData = escapeJsString(exitsData);

    // 使用独立的函数构建徽章 HTML
    const badgesHTML = buildTransferBadgesHTML(
        station, transferModel, currentRoute, 
        safeNameCn, safeNameEn, safeMergedPayload, safeExitsData
    );

    return `
        <div class="station-item" data-cn="${safeNameCn}" data-en="${safeNameEn}" onclick="showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${safeMergedPayload}', '${safeExitsData}')">
            ${badgesHTML ? `<div class="transfer-badges-container side-unified">${badgesHTML}</div>` : ''}
            <div class="${dotClass}"></div>
            <div class="station-info">
                <div class="station-name">${station.nameCn}</div>
                <div class="station-name-en">${stationEnAll}</div>
            </div>
        </div>
    `;
}

// 构建站点换乘模型。将站点的换乘信息按类型分类（普通、高铁、轮船、飞机）
// @param {Object} station - 站点对象
// @returns {Object} 包含各类换乘信息的对象
function buildStationTransferModel(station) {
    let hasHighSpeed = false;
    let hasBoat = false;
    let hasAirplane = false;
    const normalTransfers = [];
    const highSpeedTransfers = [];
    const boatTransfers = [];
    const airTransfers = [];
    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(transfer => {
            if (transfer.mode === 'HIGH_SPEED') {
                hasHighSpeed = true;
                highSpeedTransfers.push(transfer);
            } else if (transfer.mode === 'BOAT') {
                hasBoat = true;
                boatTransfers.push(transfer);
            } else if (transfer.mode === 'AIRPLANE') {
                hasAirplane = true;
                airTransfers.push(transfer);
            } else {
                normalTransfers.push(transfer);
            }
        });
    }
    return { hasHighSpeed, hasBoat, hasAirplane, normalTransfers, highSpeedTransfers, boatTransfers, airTransfers };
}

// 确保就近换乘的双向对称性。如果A站的nearbyTransfers包含B站，那么B站的nearbyTransfers也应该包含A站
// @param {Object} station - 当前站点对象
// @param {string} currentStationName - 当前站点名称
function ensureBidirectionalNearbyTransfers(station, currentStationName) {
    if (!station || !station.nearbyTransfers || station.nearbyTransfers.length === 0) {
        return;
    }
    
    if (DEBUG_CONFIG.ENABLE_BIDIRECTIONAL_LOGS) {
        debugLog('transfer', '[ensureBidirectional] Checking bidirectional nearby transfers for:', currentStationName);
    }
    
    // 遍历当前站点的所有就近换乘目标
    station.nearbyTransfers.forEach(nearby => {
        const targetName = nearby.targetStationCn || nearby.lineName || '';
        const targetEn = nearby.targetStationEn || '';
        
        if (!targetName) return;
        
        // 直接操作全局数据，为目柕站点添加反向链接
        // 注意：这里不递归调用 getStationGlobalInfo，而是直接修改 routesData
        let foundTargetStation = null;
        let foundTargetRoute = null;
        let foundTargetList = null;
        
        // 在所有路线中查找目标站点
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
            if (DEBUG_CONFIG.ENABLE_BIDIRECTIONAL_LOGS) {
                debugLog('transfer', `[ensureBidirectional] Target station not found in routesData: ${targetName}`);
            }
            return;
        }
        
        // 检查目标站点是否已经有指向当前站点的就近换乘
        if (!foundTargetStation.nearbyTransfers) {
            foundTargetStation.nearbyTransfers = [];
        }
        
        const hasReverseLink = foundTargetStation.nearbyTransfers.some(nt => {
            const ntTarget = nt.targetStationCn || nt.lineName || '';
            return ntTarget === currentStationName;
        });
        
        if (!hasReverseLink) {
            // 缺少反向链接，需要补充
            if (DEBUG_CONFIG.ENABLE_BIDIRECTIONAL_LOGS) {
                debugLog('transfer', `[ensureBidirectional] Adding reverse link: ${targetName} -> ${currentStationName}`);
            }
            
            // 构建反向的就近换乘信息
            const reverseNearby = {
                targetStationCn: currentStationName,
                targetStationEn: station.nameEn || '',
                lineName: nearby.lineName || '',
                mode: nearby.mode || 'TRAIN',
                color: nearby.color || '#607d8b',
                messageCn: `往${currentStationName}站转乘${nearby.lineName || ''}`,
                messageEn: `Transfer to ${currentStationName} via ${nearby.lineName || ''}`,
                isSynthesized: true // 标记为自动生成的
            };
            
            // 直接添加到目标站点的就近换乘列表
            foundTargetStation.nearbyTransfers.push(reverseNearby);
            
            if (DEBUG_CONFIG.ENABLE_BIDIRECTIONAL_LOGS) {
                debugLog('transfer', `[ensureBidirectional] ✓ Symmetric link established`);
            }
        } else {
            if (DEBUG_CONFIG.ENABLE_BIDIRECTIONAL_LOGS) {
                debugLog('transfer', `[ensureBidirectional] ✓ Reverse link already exists: ${targetName} -> ${currentStationName}`);
            }
        }
    });
}

// 渲染线路的站点列表。处理正向和反向站点，支持环形线路
// @param {Object} route - 路线对象
// @param {string|number} index - 容器索引标识
function renderStations(route, index) {
    const forwardContainer = document.getElementById(`stations-${index}-forward`);
    const reverseContainer = document.getElementById(`stations-${index}-reverse`);
    const circular = isCircularRoute(route);
    const toLinearStations = (stations) => {
        const st = Array.isArray(stations) ? stations.slice() : [];
        if (circular && st.length > 1) {
            const first = st[0];
            const last = st[st.length - 1];
            if (first && last && first.nameCn === last.nameCn && first.nameEn === last.nameEn) {
                st.pop();
            }
        }
        return st;
    };
    
    if (forwardContainer && route.forwardStations) {
        const stations = toLinearStations(route.forwardStations);
        forwardContainer.innerHTML = stations.map((s) => createStationHTML(s, route)).join('');
        drawMainLine(forwardContainer);
    }
    
    if (reverseContainer && route.reverseStations) {
        const stations = toLinearStations(route.reverseStations);
        reverseContainer.innerHTML = stations.map((s) => createStationHTML(s, route)).join('');
        drawMainLine(reverseContainer);  // 补充反向主线绘制
    }
}

// 绘制主线。在站点列表中绘制连接各站点的线条
// @param {HTMLElement} container - 容器元素
function drawMainLine(container) {
    if (!container) return;
    container.querySelectorAll('.station-main-line').forEach(el => el.remove());

    const dots = container.querySelectorAll('.station-dot');
    if (dots.length < 2) return;
    const first = dots[0];
    const last = dots[dots.length - 1];
    if (first.offsetWidth === 0 || last.offsetWidth === 0) return;
    
    let firstCenter = first.offsetLeft + (first.offsetWidth / 2);
    let lastCenter = last.offsetLeft + (last.offsetWidth / 2);
    const top = first.offsetTop + (first.offsetHeight / 2) - 4;

    const line = document.createElement('div');
    line.className = 'station-main-line';
    line.style.left = `${firstCenter}px`;
    line.style.top = `${top}px`;
    line.style.width = `${Math.max(0, lastCenter - firstCenter)}px`;
    container.appendChild(line);
}

// 调整站点列表的内边距以适应徽章
// @param {HTMLElement} list - 站点列表元素
function adjustStationListPaddingForBadges(list) {
    if (!list) return;

    const computed = getComputedStyle(list);
    const basePaddingTop = parseFloat(list.dataset.basePaddingTop || computed.paddingTop || '120') || 120;
    if (!list.dataset.basePaddingTop) list.dataset.basePaddingTop = String(basePaddingTop);

    let extraTop = 0;
    const listRect = list.getBoundingClientRect();
    if (listRect.width === 0) return;

    const badges = list.querySelectorAll('.transfer-badges-container');
    badges.forEach(badge => {
        const r = badge.getBoundingClientRect();
        if (r.height > 0 && r.top < listRect.top) {
            extraTop = Math.max(extraTop, listRect.top - r.top);
        }
    });

    const targetPaddingTop = Math.ceil(basePaddingTop + extraTop + 6);
    if (extraTop > 0) {
        list.style.paddingTop = `${targetPaddingTop}px`;
    } else {
        list.style.paddingTop = `${basePaddingTop}px`;
    }
}

// 重绘所有可见的线条。遍历所有展开的路线内容并重绘线条
function redrawVisibleLines() {
    document.querySelectorAll('.station-list:not(.hidden)').forEach(list => {

        try {
            if (list.getBoundingClientRect().height > 0) {
                adjustStationListPaddingForBadges(list);
            }
        } catch (e) {}

        drawMainLine(list);
    });
}

// 附加站点列表滚动重绘事件。当站点列表滚动时自动重绘线条
function attachStationListScrollRedraw() {
    document.querySelectorAll('.station-list:not(.hidden)').forEach(list => {
        if (list.dataset.scrollRedrawAttached === '1') return;
        list.dataset.scrollRedrawAttached = '1';

        let scheduled = false;
        list.addEventListener('scroll', () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                drawMainLine(list);
            });
        }, { passive: true });
    });
}

// 选择方向。更新方向按钮状态并渲染对应方向的站点
// @param {string} selectorId - 选择器ID
// @param {string} direction - 方向
// @param {number} groupIndex - 组索引
// @param {number} branchIndex - 分支索引
function selectDirection(selectorId, direction, groupIndex, branchIndex) {
    const selector = document.getElementById(selectorId);
    if (!selector) return;
    
    const buttons = selector.querySelectorAll('.direction-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const forwardList = document.getElementById(`stations-${groupIndex}-${branchIndex}-forward`);
    const reverseList = document.getElementById(`stations-${groupIndex}-${branchIndex}-reverse`);
    
    if (direction === 'forward') {
        buttons[0].classList.add('active');
        forwardList.classList.remove('hidden');
        reverseList.classList.add('hidden');
        drawMainLine(forwardList);
    } else {
        buttons[1].classList.add('active');
        forwardList.classList.add('hidden');
        reverseList.classList.remove('hidden');
        drawMainLine(reverseList);
    }
    scheduleRouteRedraw();
}

// 获取站点的全局信息。在所有路线中查找站点并返回其详细信息
// @param {string} stationName - 站点名称
// @param {string} stationEn - 站点英文名（可选，用于精确匹配）
// @returns {Object|null} 站点全局信息
function getStationGlobalInfo(stationName, stationEn) {
    if (!stationName) return null;
    let foundStation = null;
    let allTransfers = [];
    let allNearbyTransfers = [];
    let allExits = [];
    
    // 评分系统：为每个匹配的站点打分，选择最高分的
    let bestMatchScore = -1;
    let bestMatchStation = null;
    let bestMatchTransfers = [];
    let bestMatchNearbyTransfers = [];
    let bestMatchExits = [];
    let bestMatchAddedLines = new Map();
    
    // We must collect all lines passing through this station
    // because a station might appear on multiple lines with different platform numbers
    // and each line's version of the station might have different transfers listed.
    routesData.forEach(r => {
        const check = (list) => {
            if(!list) return;
            // Find ALL stations with matching Chinese name
            const matchedStations = list.filter(st => st.nameCn === stationName);
            
            matchedStations.forEach(s => {
                // 计算匹配分数
                let score = 0;
                
                // 1. 中文名匹配（基础分）
                if (s.nameCn === stationName) {
                    score += 10;
                }
                
                // 2. 英文名精确匹配（高分）
                if (stationEn && s.nameEn) {
                    if (s.nameEn === stationEn || s.nameEnAll === stationEn) {
                        score += 50; // 完全匹配英文名
                    } else if (s.nameEn.toLowerCase().includes(stationEn.toLowerCase()) || 
                               stationEn.toLowerCase().includes(s.nameEn.toLowerCase())) {
                        score += 30; // 部分匹配
                    }
                }
                
                // 3. 如果没有提供英文名，但有多个同名站点，优先选择普通地铁而非高铁
                // （因为用户通常先接触地铁站）
                if (!stationEn && matchedStations.length > 1) {
                    const currentRouteMode = r.mode || 'TRAIN';
                    if (currentRouteMode === 'TRAIN') {
                        score += 5; // 地铁优先
                    }
                }
                
                // 如果当前站点得分更高，更新最佳匹配
                if (score > bestMatchScore) {
                    // 保存之前的状态
                    bestMatchScore = score;
                    bestMatchStation = { ...s }; // copy base info
                    bestMatchTransfers = [];
                    bestMatchNearbyTransfers = [];
                    bestMatchExits = [];
                    bestMatchAddedLines = new Map();
                    
                    foundStation = bestMatchStation;
                    allTransfers = bestMatchTransfers;
                    allNearbyTransfers = bestMatchNearbyTransfers;
                    allExits = bestMatchExits;
                } else if (score === bestMatchScore && score > 0) {
                    // 分数相同，合并信息（可能是同一站点在不同线路上的定义）
                    foundStation = foundStation || { ...s };
                } else {
                    // 分数较低，跳过
                    return;
                }
                
                // 构建线路的唯一标识（模式+名称+颜色）
                const lineKey = `${r.mode}::${r.nameCn}::${r.color}`;
                
                // 检查是否已经添加过这条线路
                if (!bestMatchAddedLines.has(lineKey)) {
                    // 第一次遇到这条线路，添加
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
                    // 已存在，但有platformName则更新（保留更完整的信息）
                    const existing = bestMatchAddedLines.get(lineKey);
                    if (s.platformName && !existing.platformName) {
                        existing.platformName = s.platformName;
                    }
                }

                // 添加站点的transfers数组中的换乘信息
                if (s.transfers) {
                    s.transfers.forEach(t => {
                        const transferKey = `${t.mode}::${t.nameRaw || t.nameCn}::${t.color}`;
                        if (!bestMatchAddedLines.has(transferKey)) {
                            bestMatchTransfers.push({...t, isNearby: false});
                            bestMatchAddedLines.set(transferKey, t);
                        }
                    });
                }
                
                if (s.nearbyTransfers) {
                    s.nearbyTransfers.forEach(t => bestMatchNearbyTransfers.push({...t, isNearby: true}));
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
        // 使用最佳匹配的收集结果
        allTransfers = bestMatchTransfers;
        allNearbyTransfers = bestMatchNearbyTransfers;
        allExits = bestMatchExits;
        
        if (DEBUG_CONFIG.ENABLE_STATION_INFO_LOGS) {
            debugLog('stationInfo', '[getStationGlobalInfo] Matched station:', {
                nameCn: foundStation.nameCn,
                nameEn: foundStation.nameEn,
                matchScore: bestMatchScore,
                transfersCount: allTransfers.length,
                nearbyCount: allNearbyTransfers.length
            });
        }
        
        // 由于在收集阶段已经做了智能去重，这里只需做最后的清理
        const uniqueT = [];
        const seen = new Set();
        
        allTransfers.forEach(t => {
            // 统一去重逻辑：只依赖名称+颜色，不依赖模式标签
            // 避免同一条线路因mode定义不同而被重复添加
            const nameKey = t.nameRaw || t.nameCn || '';
            const colorKey = t.color || '';
            const k = `${nameKey}::${colorKey}`;
            
            if(!seen.has(k)) {
                seen.add(k);
                uniqueT.push(t);
            }
        });
        
        // 同样处理nearbyTransfers
        const uniqueNearby = [];
        const seenNearby = new Set();
        allNearbyTransfers.forEach(t => {
            const targetName = t.targetStationCn || t.nameCn || '';
            // 排除指向自身的就近换乘
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
        // 如果A是B的就近换乘，那么B也应该是A的就近换乘
        ensureBidirectionalNearbyTransfers(foundStation, stationName);
        
        // Deduplicate exits by name, but merge destinations from all occurrences
        const uniqueExits = [];
        const exitMap = new Map(); // Map<exitName, exitObject>
        allExits.forEach(e => {
            const key = e.name || '';
            if (!exitMap.has(key)) {
                // Create new exit entry
                const newExit = {
                    name: e.name,
                    destinations: [...(e.destinations || [])]
                };
                exitMap.set(key, newExit);
                uniqueExits.push(newExit);
            } else {
                // Merge destinations into existing exit
                const existingExit = exitMap.get(key);
                if (e.destinations && e.destinations.length > 0) {
                    // Use Set to avoid duplicate destinations
                    const destSet = new Set(existingExit.destinations);
                    e.destinations.forEach(dest => destSet.add(dest));
                    existingExit.destinations = Array.from(destSet);
                }
            }
        });
        foundStation.exits = uniqueExits;
        
        return foundStation;
    }
    return null;
}


// 显示站点信息提示框。点击站点时显示换乘信息和出口信息
// @param {HTMLElement} element - 被点击的站点元素
// @param {string} nameCn - 站点中文名
// @param {string} nameEn - 站点英文名
// @param {string} transfersJsonEscaped - URL编码的换乘信息JSON
// @param {string} exitsJsonEscaped - URL编码的出口信息JSON
// @param {string} tooltipId - tooltip容器ID，默认为'tooltip'
function showStationInfo(element, nameCn, nameEn, transfersJsonEscaped, exitsJsonEscaped, tooltipId = 'tooltip') {
    if (window.event) window.event.stopPropagation();
    
    const tooltip = document.getElementById(tooltipId);
    if (!tooltip) {
        console.error('[showStationInfo] Tooltip element not found:', tooltipId);
        return;
    }
    
    let transfers = [];
    try {
        transfers = JSON.parse(decodeURIComponent(transfersJsonEscaped));
    } catch (e) {
        console.warn('[showStationInfo] Failed to parse transfers data:', e.message);
        console.warn('Raw data:', transfersJsonEscaped);
    }

    let exits = [];
    try {
        exits = exitsJsonEscaped ? JSON.parse(decodeURIComponent(exitsJsonEscaped)) : [];
    } catch (e) {
        console.warn('[showStationInfo] Failed to parse exits data:', e.message);
        console.warn('Raw data:', exitsJsonEscaped);
    }

    let transferHTML = '';
    
    // 处理站内线路信息（始终显示）
    // transfers 数组的第一个元素就是当前线路，后面是换乘线路
    const stationLines = [];
    
    if (transfers && transfers.length > 0) {
        const seen = new Set();
        const lineModeMap = new Map(); // 记录每条线路首次遇到的mode
        
        transfers.forEach(t => {
            if (!t || t.isNearby) return; // 跳过就近换乘
            
            // 使用清理后的名称
            const rawName = String(t.nameRaw || t.nameAll || t.nameCn || t.nameEn || t.name || '');
            const cleanedName = cleanLineDisplayName(rawName);
            const color = String(t.color || '');
            const mode = t.mode || 'TRAIN';
            const unifiedMode = getModeLabel(mode, t);
            
            // 关键修复：只用名称+颜色去重，不依赖mode
            // 因为同一条线路在数据中可能有不同的mode定义
            const key = `${cleanedName}::${color}`;
            
            if (DEBUG_CONFIG.ENABLE_TRANSFER_LOGS) {
                console.log('Transfer:', {
                    rawName: rawName,
                    cleanedName: cleanedName,
                    mode: mode,
                    type: t.type,
                    unifiedMode: unifiedMode,
                    color: color,
                    key: key,
                    isFirstOccurrence: !seen.has(key)
                });
            }
            
            if (!seen.has(key)) {
                // 第一次遇到这条线路，记录它的mode
                seen.add(key);
                lineModeMap.set(key, { mode: mode, unifiedMode: unifiedMode });
                if (DEBUG_CONFIG.ENABLE_TRANSFER_LOGS) {
                    console.log(' 添加:', cleanedName, '[', unifiedMode, ']');
                }
                stationLines.push({
                    name: cleanedName,
                    color: t.color || '#607d8b',
                    mode: mode
                });
            } else {
                // 已经见过这条线路，检查mode是否一致
                const firstMode = lineModeMap.get(key);
                if (firstMode.mode !== mode) {
                    if (DEBUG_CONFIG.ENABLE_TRANSFER_LOGS) {
                        console.warn(' 跳过重复（mode冲突）:', cleanedName, 
                            '首次mode:', firstMode.unifiedMode, 
                            '当前mode:', unifiedMode);
                    }
                } else {
                    if (DEBUG_CONFIG.ENABLE_TRANSFER_LOGS) {
                        console.warn(' 跳过重复:', cleanedName, '[', unifiedMode, ']');
                    }
                }
            }
        });
    }

    const renderGroup = (title, list) => {
        let html = `<div class="tooltip-section"><strong class="tooltip-section-title">${title}</strong>`;
        
        if (list.length === 0) {
            html += `<div class="tooltip-section-empty">无</div>`;
        } else {
            html += `<div class="tooltip-lines-container">`;
            list.forEach(item => {
                const modeLabelText = getModeLabel(item.mode, item);
                const modeLabel = modeLabelText ? ` [${modeLabelText}]` : '';
                const tColor = item.color || '#999';
                const lineNameForClick = escapeJsString(encodeURIComponent(item.name));
                
                html += `<span class="tooltip-line-badge" style="--line-color: ${tColor};" onclick="openLineDetail('${lineNameForClick}')" title="点击查看线路详情">${item.name}${modeLabel}</span>`;
            });
            html += '</div>';
        }
        html += '</div>';
        return html;
    };

    // 显示站内线路
    transferHTML += renderGroup('站内线路：', stationLines);
    
    // 处理就近换乘
    const nearbyTransfers = [];
    if (transfers && transfers.length > 0) {
        transfers.forEach(t => {
            if (t && t.isNearby) {
                nearbyTransfers.push(t);
            }
        });
    }
    
    const renderNearbyGroup = (title, list) => {
        let html = `<div class="tooltip-section"><strong class="tooltip-section-title">${title}</strong>`;
        
        if (list.length === 0) {
            html += `<div class="tooltip-section-empty">无</div>`;
        } else {
            html += `<div class="tooltip-nearby-container">`;
            list.forEach(t => {
                const targetName = (t.targetStationCn || t.lineName || '');
                
                // 传入英文名以精确匹配站点（区分同名但不同类型的站点）
                const targetInfo = getStationGlobalInfo(t.targetStationCn || targetName, t.targetStationEn);
                let targetEn = t.targetStationEn || '';
                let targetTransfers = [];
                let targetExits = [];
                if (targetInfo) {
                    if (targetInfo.nameEn) targetEn = targetInfo.nameEn;
                    if (targetInfo.transfers) targetTransfers = targetInfo.transfers;
                    if (targetInfo.nearbyTransfers) {
                        targetInfo.nearbyTransfers.forEach(nt => {
                            targetTransfers.push({ ...nt, isNearby: true });
                        });
                    }
                    if (targetInfo.exits) targetExits = targetInfo.exits;
                }
                
                const transfersJsonEscaped = escapeJsString(encodeURIComponent(JSON.stringify(targetTransfers)));
                const exitsJsonEscaped = escapeJsString(encodeURIComponent(JSON.stringify(targetExits)));
                
                html += `<a class="tooltip-nearby-link" onclick="showStationInfo(this, '${escapeJsString(t.targetStationCn || targetName)}', '${escapeJsString(targetEn)}', '${transfersJsonEscaped}', '${exitsJsonEscaped}')" title="查看 ${targetName} 站的所有线路"><i class="fas fa-info-circle"></i>${targetName}</a>`;
            });
            html += '</div>';
        }
        html += '</div>';
        return html;
    };
    
    transferHTML += renderNearbyGroup('就近换乘的车站', nearbyTransfers);

    // Render exit information
    let exitHTML = '';
    if (exits && exits.length > 0) {
        exitHTML = '<div class="exit-section">';
        exitHTML += '<div class="exit-section-title">出口信息 (Exits)</div>';
        exitHTML += '<div class="exits-grid">';
        exits.forEach(exit => {
            const exitName = escapeHtml(exit.name || '');
            const destinations = exit.destinations || [];
            exitHTML += '<div class="exit-card">';
            exitHTML += `<div class="exit-name">${exitName}</div>`;
            if (destinations.length > 0) {
                exitHTML += '<div class="exit-destinations">';
                destinations.forEach(dest => {
                    const destText = escapeHtml(dest);
                    exitHTML += `<div class="exit-destination-item">${destText}</div>`;
                });
                exitHTML += '</div>';
            }
            exitHTML += '</div>';
        });
        exitHTML += '</div></div>';
    }

    const titleMain = nameCn;
    const titleSub = nameEn;
    const subHTML = (titleSub && titleSub !== titleMain) ? `<div class="tooltip-subtitle">${titleSub}</div>` : '';

    // Always show tooltip, even if no transfers or exits
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <div class="tooltip-title">${titleMain}</div>
            ${subHTML}
        </div>
        ${exitHTML}
        ${transferHTML}
    `;

    tooltip.style.display = 'block';
    
    if (DEBUG_CONFIG.ENABLE_STATION_INFO_LOGS) {
        console.log('Tooltip shown for:', nameCn, 'transfers:', transfers?.length || 0, 'exits:', exits?.length || 0);
    }
}

// 打开线路详情页。从站点信息框中点击换乘线路时跳转到对应线路
// @param {string} lineNameEncoded - URL编码的线路名称
function openLineDetail(lineNameEncoded) {
    const lineName = decodeURIComponent(lineNameEncoded);
    
    // Close both tooltips
    const lineInfoTooltip = document.getElementById('tooltip');
    const stationInfoTooltip = document.getElementById('station-tooltip');
    if (lineInfoTooltip) {
        lineInfoTooltip.style.display = 'none';
    }
    if (stationInfoTooltip) {
        stationInfoTooltip.style.display = 'none';
    }
    
    // Find the matching route in groupedRoutesData
    const groupedRoutes = window.groupedRoutesData;
    if (!groupedRoutes) {
        console.error('[openLineDetail] Route data not loaded (groupedRoutesData is undefined)');
        showErrorTooltip(tooltip, `数据未加载，请刷新页面`);
        return;
    }
    
    let targetGroupIndex = null;
    let bestMatchScore = -1; // 用于记录最佳匹配分数
    
    // Search through all groups to find a match
    const groupKeys = Object.keys(groupedRoutes);
    for (let i = 0; i < groupKeys.length; i++) {
        const routes = groupedRoutes[groupKeys[i]];
        if (routes && routes.length > 0) {
            const primaryRoute = routes[0];
            const routeNameCn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameCn || ''));
            const routeNameEn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameEn || ''));
            const routeMode = primaryRoute.mode;
            
            // 计算匹配分数
            let score = 0;
            
            // 1. 精确匹配（最高优先级）
            if (routeNameCn === lineName) {
                score = 100;
            } else if (routeNameEn && routeNameEn.toLowerCase() === lineName.toLowerCase()) {
                score = 95;
            }
            // 2. 完全包含匹配（次高优先级）
            else if (routeNameCn.includes(lineName) && lineName.length >= routeNameCn.length * 0.8) {
                score = 80;
            } else if (routeNameEn && routeNameEn.toLowerCase().includes(lineName.toLowerCase()) && lineName.length >= routeNameEn.length * 0.8) {
                score = 75;
            }
            // 3. 部分匹配（最低优先级，仅在无更好匹配时使用）
            else if (routeNameCn.includes(lineName)) {
                score = 50;
            } else if (routeNameEn && routeNameEn.toLowerCase().includes(lineName.toLowerCase())) {
                score = 45;
            }
            
            // 如果找到匹配，检查是否有更好的匹配
            if (score > 0) {
                // 如果是第一次找到匹配，或者当前匹配分数更高，则更新目标
                if (targetGroupIndex === null || score > bestMatchScore) {
                    targetGroupIndex = i;
                    bestMatchScore = score;
                }
                // 如果分数相同，优先选择地铁模式（避免高铁T线误匹配）
                else if (score === bestMatchScore) {
                    const currentRoute = groupedRoutes[groupKeys[targetGroupIndex]][0];
                    // 如果当前最佳是高铁，而新匹配是地铁，则选择地铁
                    if (currentRoute.mode === 'HIGH_SPEED' && routeMode === 'TRAIN') {
                        targetGroupIndex = i;
                        bestMatchScore = score;
                    }
                }
            }
        }
    }
    
    if (targetGroupIndex !== null) {
        // Select the line (this will show it in the unified display)
        selectLine(targetGroupIndex);
    } else {
        console.warn('[openLineDetail] Line not found:', lineName);
        // Show a friendly error message
        showErrorTooltip(lineInfoTooltip, `未找到线路 "${lineName}"`);
    }
}

// 显示错误提示的工具函数
// @param {HTMLElement} tooltip - Tooltip元素
// @param {string} message - 错误消息
function showErrorTooltip(tooltip, message) {
    if (!tooltip) return;
    tooltip.innerHTML = `
        <div class="tooltip-error">
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        </div>
    `;
    tooltip.style.display = 'block';
    setTimeout(() => {
        tooltip.style.display = 'none';
    }, 2000);
}

// 根据分类过滤线路。支持按地铁、高铁、轮船、飞机、索道等类型筛选
function filterRoutes() {
    // 只查找带有 data-category 属性的激活分类标签
    const activeCategoryElement = document.querySelector('.category-tab[data-category].active');
    const activeCategory = activeCategoryElement ? activeCategoryElement.dataset.category : 'all';
    
    // Filter line blocks in the selector
    let firstMatchGroupIndex = null;
    document.querySelectorAll('.line-block').forEach((block) => {
        const mode = block.dataset.mode;
        const type = block.dataset.type;
        const groupIndex = block.dataset.groupIndex;
        
        let matchesCategory = true;
        if (activeCategory !== 'all') {
            if (activeCategory === 'HIGH_SPEED' || activeCategory === 'NORMAL') {
                matchesCategory = type === activeCategory && mode === 'TRAIN';
            } else {
                matchesCategory = mode === activeCategory;
            }
        }

        if (matchesCategory) {
            block.style.display = '';
            // Remember the first matching block
            if (firstMatchGroupIndex === null) {
                firstMatchGroupIndex = groupIndex;
            }
        } else {
            block.style.display = 'none';
            block.classList.remove('active');
        }
    });
    
    // Hide the unified display when switching categories
    const unifiedDisplay = document.getElementById('unifiedRouteDisplay');
    if (unifiedDisplay) {
        unifiedDisplay.style.display = 'none';
    }
    
    // Auto-select the first matching line
    if (firstMatchGroupIndex !== null) {
        selectLine(parseInt(firstMatchGroupIndex));
    }
}

// ========== Tab切换管理器（参考server-nav.js实现） ==========
/**
 * 初始化Tab切换功能
 * 支持URL hash管理、浏览器前进/后退、平滑过渡
 */
function initRouteTabSwitcher() {
    const tabLinks = document.querySelectorAll('.category-tab[data-tab]');
    
    /**
     * 激活指定tab
     * @param {string} targetTab - 目标tab名称（不含#）
     */
    function activateTab(targetTab) {
        if (!targetTab) return;
        
        // 1. 更新导航激活状态（同时处理category-tab和secondary-nav-item）
        document.querySelectorAll('.category-tab[data-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === targetTab);
        });
        document.querySelectorAll('.secondary-nav-item[data-tab]').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === targetTab);
        });
        
        // 2. 隐藏所有内容区域
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });
        
        // 3. 显示目标内容区域
        const targetContent = document.getElementById(`${targetTab}-content`);
        if (targetContent) {
            targetContent.style.display = 'block';
            targetContent.classList.add('active');
        }
        
        // 4. 切换子选项区域
        document.querySelectorAll('.sub-nav-content').forEach(subnav => {
            subnav.classList.remove('active');
        });
        const targetSubnav = document.getElementById(`${targetTab}-subnav`);
        if (targetSubnav) {
            targetSubnav.classList.add('active');
        }
        
        // 5. 特殊业务逻辑：切换tooltip显示
        const lineInfoTooltip = document.getElementById('tooltip');
        const stationInfoTooltip = document.getElementById('station-tooltip');
        
        if (targetTab === 'line-info') {
            // 线路信息页面：显示line tooltip，隐藏station tooltip
            if (lineInfoTooltip) lineInfoTooltip.style.display = 'block';
            if (stationInfoTooltip) stationInfoTooltip.style.display = 'none';
        } else if (targetTab === 'station-info') {
            // 车站信息页面：显示station tooltip，隐藏line tooltip
            if (stationInfoTooltip) stationInfoTooltip.style.display = 'block';
            if (lineInfoTooltip) lineInfoTooltip.style.display = 'none';
        } else {
            // 其他页面：隐藏所有tooltip
            if (lineInfoTooltip) lineInfoTooltip.style.display = 'none';
            if (stationInfoTooltip) stationInfoTooltip.style.display = 'none';
        }
    }
    
    /**
     * 处理tab点击事件
     */
    function handleTabClick(e) {
        const tab = e.target.closest('.category-tab[data-tab]');
        if (!tab) return;
        
        // 阻止默认跳转（避免页面滚动）
        e.preventDefault();
        
        const targetTab = tab.dataset.tab;
        
        // 更新URL hash（不触发滚动）
        if (history.pushState) {
            history.pushState(null, null, `#${targetTab}`);
        } else {
            window.location.hash = `#${targetTab}`;
        }
        
        // 激活对应tab
        activateTab(targetTab);
    }
    
    /**
     * 处理hash变化（支持浏览器前进/后退）
     */
    function handleHashChange() {
        // 获取当前hash（去掉#）
        const hash = window.location.hash.slice(1);
        
        // 如果有hash且对应tab存在，激活该tab
        if (hash && document.querySelector(`.category-tab[data-tab="${hash}"]`)) {
            activateTab(hash);
        } else {
            // 否则激活第一个tab
            const firstTab = document.querySelector('.category-tab[data-tab]');
            if (firstTab) {
                activateTab(firstTab.dataset.tab);
            }
        }
    }
    
    // 绑定tab点击事件
    tabLinks.forEach(tab => {
        tab.addEventListener('click', handleTabClick);
    });
    
    // 监听hash变化（支持浏览器前进/后退）
    window.addEventListener('hashchange', handleHashChange);
    
    // 页面加载时处理初始hash
    handleHashChange();
}

// 初始化所有事件监听器。包括分类标签、返回顶部按钮等
function initializeEventListeners() {
    // 初始化Tab切换功能（支持URL hash管理）
    initRouteTabSwitcher();
    
    // 原有的分类过滤标签
    document.querySelectorAll('.category-tabs .category-tab[data-category]').forEach(tab => {
        tab.addEventListener('click', function() {
            // 只移除当前容器内的分类标签active状态
            this.closest('.category-tabs').querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            filterRoutes();
        });
    });
    
    // 车站信息的分类过滤标签
    document.querySelectorAll('#station-info-subnav .category-tab[data-station-category]').forEach(tab => {
        tab.addEventListener('click', function() {
            // 只移除当前容器内的分类标签active状态
            this.closest('.category-tabs').querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const category = this.dataset.stationCategory;
            renderStationBlocks(category);
            
            // 清空tooltip显示
            const stationTooltip = document.getElementById('station-tooltip');
            if (stationTooltip) {
                stationTooltip.innerHTML = '<div class="empty-state"><p>请点击上方站点色块查看详情</p></div>';
            }
        });
    });

    // Back to top functionality
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        window.onscroll = function() {
            if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
                backToTopBtn.style.display = "block";
            } else {
                backToTopBtn.style.display = "none";
            }
        };
        
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // Auto-select first line after rendering
    setTimeout(() => {
        const firstBlock = document.querySelector('.line-block');
        if (firstBlock) {
            const groupIndex = firstBlock.dataset.groupIndex;
            selectLine(parseInt(groupIndex));
        }
        
        // Auto-select first station after rendering
        const firstStationBlock = document.querySelector('.station-block');
        if (firstStationBlock) {
            const stationName = firstStationBlock.dataset.stationName;
            const uniqueStations = collectUniqueStations();
            const firstStation = uniqueStations.find(s => s.nameCn === stationName);
            if (firstStation) {
                selectStation(firstStation);
            }
        }
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    loadRoutesData();
    
    // 检查URL参数，自动切换到对应分类或地图视图
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const tab = urlParams.get('tab');
    const map = urlParams.get('map');
    
    // 处理tab参数：通过hash切换tab（优先使用hash）
    if (tab && !window.location.hash) {
        // 如果URL中有tab参数但没有hash，设置hash
        setTimeout(() => {
            history.replaceState(null, null, `#${tab}`);
            // 触发hashchange事件
            window.dispatchEvent(new Event('hashchange'));
        }, 500);
    }
    
    // 处理地图参数：切换到线路图tab并选择对应地图
    if (tab === 'route-map' && map) {
        setTimeout(() => {
            // 选择对应地图
            const mapBtn = document.querySelector(`.map-nav-item[data-map="${map}"]`);
            if (mapBtn) {
                mapBtn.click();
            }
        }, 600);
    }
    
    // 处理分类参数：切换到对应线路分类
    if (category) {
        setTimeout(() => {
            const targetTab = document.querySelector(`.category-tab[data-category="${category}"]`);
            if (targetTab) {
                targetTab.click();
            }
        }, 800);
    }
});
window.addEventListener('resize', scheduleRouteRedraw);


// ========== 车站信息功能 ==========

// 收集所有唯一站点。从所有线路中提取不重复的站点
function collectUniqueStations() {
    const stationMap = new Map(); // 使用Map来去重，key为站点中文名
    
    routesData.forEach(route => {
        const processStations = (stations) => {
            if (!stations || !Array.isArray(stations)) return;
            
            stations.forEach(station => {
                const key = station.nameCn;
                if (!stationMap.has(key)) {
                    // 第一次遇到这个站点，保存完整信息
                    stationMap.set(key, {
                        nameCn: station.nameCn,
                        nameEn: station.nameEn || '',
                        nameEnAll: station.nameEnAll || '',
                        transfers: station.transfers || [],
                        nearbyTransfers: station.nearbyTransfers || [],
                        exits: station.exits || [],
                        lines: [] // 记录经过该站点的所有线路
                    });
                }
                
                // 添加当前线路到站点的线路列表
                const stationInfo = stationMap.get(key);
                const lineKey = `${route.mode}::${route.nameCn}::${route.color}`;
                
                // 检查是否已经添加过这条线路
                const existingLine = stationInfo.lines.find(l => 
                    l.mode === route.mode && l.nameCn === route.nameCn && l.color === route.color
                );
                
                if (!existingLine) {
                    stationInfo.lines.push({
                        mode: route.mode,
                        type: route.type || '', // 保存type字段
                        nameCn: route.nameCn,
                        nameEn: route.nameEn,
                        color: route.color,
                        platformName: station.platformName || ''
                    });
                } else if (station.platformName && !existingLine.platformName) {
                    // 更新站台信息
                    existingLine.platformName = station.platformName;
                }
            });
        };
        
        processStations(route.forwardStations);
        processStations(route.reverseStations);
    });
    
    return Array.from(stationMap.values());
}

// 显示站点色块容器的loading动画
function showStationBlocksLoading() {
    const container = document.getElementById('stationBlocksContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="station-blocks-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载站点数据...</div>
        </div>
    `;
}

// 隐藏站点色块容器的loading动画
function hideStationBlocksLoading() {
    const container = document.getElementById('stationBlocksContainer');
    if (!container) return;
    
    const loadingElement = container.querySelector('.station-blocks-loading');
    if (loadingElement) {
        loadingElement.remove();
    }
}

// 渲染站点色块容器。在页面上显示所有站点的色块
// @param {string} category - 线路类型过滤（可选）
function renderStationBlocks(category = 'all') {
    const container = document.getElementById('stationBlocksContainer');
    if (!container) return;
    
    // 显示loading动画
    showStationBlocksLoading();
    
    // 使用setTimeout让loading动画有机会显示
    setTimeout(() => {
        const uniqueStations = collectUniqueStations();
        
        // 按站点名称排序（中文拼音顺序）
        uniqueStations.sort((a, b) => a.nameCn.localeCompare(b.nameCn, 'zh-CN'));
        
        container.innerHTML = '';
        
        let visibleCount = 0;
        uniqueStations.forEach((station, index) => {
            // 根据线路类型过滤
            if (category !== 'all') {
                const hasMatchingLine = station.lines.some(line => {
                    if (category === 'HIGH_SPEED' || category === 'NORMAL') {
                        // 地铁和铁路都需要 mode === 'TRAIN'，然后检查type
                        return line.mode === 'TRAIN' && (line.type === category || line.type === '');
                    }
                    return line.mode === category;
                });
                
                if (!hasMatchingLine) return; // 跳过不匹配的站点
            }
            
            const block = createStationBlock(station, visibleCount);
            container.appendChild(block);
            visibleCount++;
        });
        
        // 隐藏loading动画
        hideStationBlocksLoading();
        
        // 如果没有匹配的站点，显示提示
        if (visibleCount === 0) {
            container.innerHTML = '<div class="empty-state"><p>该分类下暂无站点</p></div>';
        }
    }, 100);
}

// 创建单个站点色块元素
// @param {Object} station - 站点对象
// @param {number} index - 索引
// @returns {HTMLElement} 站点色块元素
function createStationBlock(station, index) {
    const block = document.createElement('div');
    block.className = 'station-block';
    block.dataset.stationName = station.nameCn;
    block.dataset.index = index;
    
    // 根据经过线路数量设置颜色深浅
    const lineCount = station.lines.length;
    const hue = (index * 137.508) % 360; // 黄金角度分布，确保颜色区分度
    const saturation = 60 + (lineCount * 5); // 线路越多，饱和度越高
    const lightness = 45 + (lineCount * 2); // 线路越多，亮度越高
    
    block.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    
    // 添加站点名称标签
    const label = document.createElement('div');
    label.className = 'station-block-label';
    label.textContent = station.nameCn;
    block.appendChild(label);
    
    // 创建tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'station-block-tooltip';
    
    // 构建tooltip内容
    let tooltipText = `${station.nameCn}\n`;
    if (station.nameEnAll) {
        tooltipText += `${station.nameEnAll}\n`;
    }
    tooltipText += `经过线路: ${lineCount}条`;
    
    tooltip.textContent = tooltipText;
    block.appendChild(tooltip);
    
    // 添加点击事件
    block.addEventListener('click', () => selectStation(station));
    
    return block;
}

// 选择并显示指定站点。高亮对应的色块，在统一展示区渲染该站点的详细信息
// @param {Object} station - 站点对象
function selectStation(station) {
    // Remove active class from all blocks
    document.querySelectorAll('.station-block').forEach(block => {
        block.classList.remove('active');
    });
    
    // Add active class to selected block
    const selectedBlock = document.querySelector(`.station-block[data-station-name="${station.nameCn}"]`);
    if (selectedBlock) {
        selectedBlock.classList.add('active');
    }
    
    // 渲染站点详细信息
    renderStationInfo(station);
}

// 在统一展示区渲染站点详情。包括站点标题、经过线路、换乘信息、出口信息等
// @param {Object} station - 站点对象
function renderStationInfo(station) {
    const container = document.getElementById('station-tooltip');
    if (!container) return;
    
    // 构建完整的线路列表用于showStationInfo
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
    
    // 合并换乘线路
    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(t => {
            if (t) allLines.push(t);
        });
    }
    
    // 合并就近换乘
    if (station.nearbyTransfers && station.nearbyTransfers.length > 0) {
        station.nearbyTransfers.forEach(n => {
            if (n) allLines.push({...n, isNearby: true});
        });
    }
    
    const allTransfersData = encodeURIComponent(JSON.stringify(allLines));
    const exitsData = encodeURIComponent(JSON.stringify(station.exits || []));
    
    // 直接渲染站点信息到tooltip容器
    renderStationTooltip(station, allLines, exitsData);
}

// 渲染站点信息到tooltip容器。与showStationInfoForStationPage类似，但直接渲染到容器
// @param {Object} station - 站点对象
// @param {Array} allLines - 所有线路列表
// @param {string} exitsData - 出口数据
function renderStationTooltip(station, allLines, exitsData) {
    const container = document.getElementById('station-tooltip');
    if (!container) return;
    
    let exits = [];
    try {
        exits = exitsData ? JSON.parse(decodeURIComponent(exitsData)) : [];
    } catch (e) {
        console.warn('[renderStationTooltip] Failed to parse exits data:', e.message);
    }

    let transferHTML = '';
    
    // 处理站内线路信息（始终显示）
    const stationLines = [];
    
    if (allLines && allLines.length > 0) {
        const seen = new Set();
        const lineModeMap = new Map();
        
        allLines.forEach(t => {
            if (!t || t.isNearby) return;
            
            const rawName = String(t.nameRaw || t.nameAll || t.nameCn || t.nameEn || t.name || '');
            const cleanedName = cleanLineDisplayName(rawName);
            const color = String(t.color || '');
            const mode = t.mode || 'TRAIN';
            const unifiedMode = getModeLabel(mode, t);
            const key = `${cleanedName}::${color}`;
            
            if (!seen.has(key)) {
                seen.add(key);
                lineModeMap.set(key, { mode: mode, unifiedMode: unifiedMode });
                stationLines.push({
                    name: cleanedName,
                    color: t.color || '#607d8b',
                    mode: mode,
                    platformName: t.platformName || ''
                });
            }
        });
    }

    const renderGroup = (title, list) => {
        let html = `<div class="tooltip-section"><strong class="tooltip-section-title">${title}</strong>`;
        
        if (list.length === 0) {
            html += `<div class="tooltip-section-empty">无</div>`;
        } else {
            html += `<div class="tooltip-lines-container">`;
            list.forEach(item => {
                const modeLabelText = getModeLabel(item.mode, item);
                const modeLabel = modeLabelText ? ` [${modeLabelText}]` : '';
                const tColor = item.color || '#999';
                const platformBadge = item.platformName ? `<span style="background:rgba(0,0,0,0.2); border-radius:2px; padding:0 4px; margin-left:4px; font-size:10px;">站台 ${item.platformName}</span>` : '';
                const lineNameForClick = escapeJsString(encodeURIComponent(item.name));
                
                html += `<span class="tooltip-line-badge" style="--line-color: ${tColor};" onclick="openLineDetail('${lineNameForClick}')" title="点击查看线路详情">${item.name}${platformBadge}${modeLabel}</span>`;
            });
            html += '</div>';
        }
        html += '</div>';
        return html;
    };

    transferHTML += renderGroup('站内线路：', stationLines);
    
    const nearbyTransfers = [];
    if (allLines && allLines.length > 0) {
        allLines.forEach(t => {
            if (t && t.isNearby) {
                nearbyTransfers.push(t);
            }
        });
    }
    
    const renderNearbyGroup = (title, list) => {
        let html = `<div class="tooltip-section"><strong class="tooltip-section-title">${title}</strong>`;
        
        if (list.length === 0) {
            html += `<div class="tooltip-section-empty">无</div>`;
        } else {
            html += `<div class="tooltip-nearby-container">`;
            list.forEach(t => {
                const targetName = (t.targetStationCn || t.lineName || '');
                const targetInfo = getStationGlobalInfo(t.targetStationCn || targetName, t.targetStationEn);
                let targetEn = t.targetStationEn || '';
                let targetTransfers = [];
                let targetExits = [];
                if (targetInfo) {
                    if (targetInfo.nameEn) targetEn = targetInfo.nameEn;
                    if (targetInfo.transfers) targetTransfers = targetInfo.transfers;
                    if (targetInfo.nearbyTransfers) {
                        targetInfo.nearbyTransfers.forEach(nt => {
                            targetTransfers.push({ ...nt, isNearby: true });
                        });
                    }
                    if (targetInfo.exits) targetExits = targetInfo.exits;
                }
                
                const transfersJsonEscaped = escapeJsString(encodeURIComponent(JSON.stringify(targetTransfers)));
                const exitsJsonEscaped = escapeJsString(encodeURIComponent(JSON.stringify(targetExits)));
                
                html += `<a class="tooltip-nearby-link" onclick="showStationInfo(this, '${escapeJsString(t.targetStationCn || targetName)}', '${escapeJsString(targetEn)}', '${transfersJsonEscaped}', '${exitsJsonEscaped}', 'station-tooltip')" title="查看 ${targetName} 站的所有线路"><i class="fas fa-info-circle"></i>${targetName}</a>`;
            });
            html += '</div>';
        }
        html += '</div>';
        return html;
    };
    
    transferHTML += renderNearbyGroup('就近换乘的车站', nearbyTransfers);

    let exitHTML = '';
    if (exits && exits.length > 0) {
        exitHTML = '<div class="exit-section">';
        exitHTML += '<div class="exit-section-title">出口信息 (Exits)</div>';
        exitHTML += '<div class="exits-grid">';
        exits.forEach(exit => {
            const exitName = escapeHtml(exit.name || '');
            const destinations = exit.destinations || [];
            exitHTML += '<div class="exit-card">';
            exitHTML += `<div class="exit-name">${exitName}</div>`;
            if (destinations.length > 0) {
                exitHTML += '<div class="exit-destinations">';
                destinations.forEach(dest => {
                    const destText = escapeHtml(dest);
                    exitHTML += `<div class="exit-destination-item">${destText}</div>`;
                });
                exitHTML += '</div>';
            }
            exitHTML += '</div>';
        });
        exitHTML += '</div></div>';
    }

    const titleMain = station.nameCn;
    const titleSub = station.nameEnAll || station.nameEn || '';
    const subHTML = (titleSub && titleSub !== titleMain) ? `<div class="tooltip-subtitle">${titleSub}</div>` : '';

    container.innerHTML = `
        <div class="tooltip-header">
            <div class="tooltip-title">${titleMain}</div>
            ${subHTML}
        </div>
        ${exitHTML}
        ${transferHTML}
    `;

    container.style.display = 'block';
}

