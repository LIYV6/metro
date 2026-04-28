// noinspection LanguageDetectionInspection

// let routesData = [];
// const NORTH_LOOP_TEMPLATE = {
//     top: ['十二机场', '北角', '圣堡北', '群星花园', '东户街', '钟楼道', '红霞'],
//     right: ['滨堡', '东菇大街', '东城邻里中心'],
//     bottom: ['丽都', '洞天', '无想山', '坡平', '刘子坝', '暗城', '史蒂夫广场', '漂椰街'],
//     left: ['桃深潭', '天然公园'],
//     shared: ['洞天', '无想山', '坡平', '刘子坝', '暗城', '史蒂夫广场', '漂椰街']
// };

// function isHighSpeedLine(nameRaw, mode) {
//     if (mode === 'HIGH_SPEED') return true;
//     if (mode === 'BOAT' || mode === 'AIRPLANE' || mode === 'CABLE_CAR' || mode === 'CABLECAT') return false;
//     if (!nameRaw) return false;
//
//     // Metro lines (contain "号线" or "Line") are NOT high speed
//     if (nameRaw.includes('号线') || nameRaw.includes('Line')) {
//         return false;
//     }
//
//     // T1/T2/T3 lines are T-colo lines (metro branches), NOT high speed
//     if (/^T[1-3]$/i.test(nameRaw) || /^T[1-3]线$/i.test(nameRaw)) {
//         return false;
//     }
//
//     // High speed patterns: G, D, C, X, OG, Z, T, HS, AS, IG, IL etc. followed by numbers
//     // Examples: G71, D44, C44, X10, OG5, Z20, T99, HS10, AS2, IG3, IL1
//     if (/HIGH_SPEED|高铁|高速|Express/i.test(nameRaw)) return true;
//     if (/\b[A-Z]{1,2}\d+\b/i.test(nameRaw)) return true;
//
//     return false;
// }


/**
 * 判断是否为高铁/高速铁路线路
 * @param {string} nameRaw - 线路原始名称
 * @param {string} mode - 交通模式
 * @param {string} routeType - 路线类型
 * @returns {boolean} 是否为高铁线路
 */
function isHighSpeedLineEx(nameRaw, mode, routeType) {
    const modeText = String(mode || '').trim().toUpperCase();
    const typeText = String(routeType || '').trim().toUpperCase();
    if (modeText === 'HIGH_SPEED' || typeText === 'HIGH_SPEED') return true;
    if (modeText === 'BOAT' || modeText === 'AIRPLANE' || modeText === 'CABLE_CAR' || modeText === 'CABLECAT') return false;
    if (!nameRaw) return false;

    const rawName = String(nameRaw).trim();
    if (typeText !== 'HIGH_SPEED' && (rawName.includes('\u53f7\u7ebf') || rawName.includes('Line'))) {
        return false;
    }
    if (/HIGH_SPEED|\u9ad8\u94c1|\u9ad8\u901f|\u9ad8\u901f\u94c1\u8def|Express/i.test(rawName)) return true;
    return /\b[A-Z]{1,2}\d+\b/i.test(rawName);
}

/**
 * 获取交通模式的中文标签
 * @param {string} mode - 交通模式代码
 * @param {Object} transferObj - 换乘对象
 * @returns {string} 中文模式标签（地铁、高铁、轮船等）
 */
function getModeLabel(mode, transferObj) {
    const m = String(mode || '').trim();
    const nameRaw = String(
        transferObj?.nameRaw || transferObj?.nameAll || transferObj?.nameCn || transferObj?.nameEn || transferObj?.name || ''
    );
    
    if (m === 'BOAT' || nameRaw.includes('轮船') || nameRaw.toLowerCase().includes('boat')) {
        return '轮船';
    }
    
    if (m === 'AIRPLANE' || nameRaw.includes('飞机') || nameRaw.toLowerCase().includes('airplane')) {
        return '飞机';
    }
    
    if (m === 'CABLE_CAR' || m === 'CABLECAT') {
        return '索道/缆车';
    }

    if (isHighSpeedLineEx(nameRaw, m, transferObj?.type)) {
        return '高铁/高速铁路';
    }

    if (m === 'TRAIN' || m === 'NORMAL') {
        return '地铁';
    }

    const modeMap = {
        'LIGHT_RAIL': '轻轨'
    };
    return modeMap[m] || '地铁';
}



/**
 * 清理线路名称中的方向后缀
 * 移除“方向”、“往XXX”等后缀信息
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
function cleanDirectionSuffix(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;
    const parts = raw.split('||').map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0];
    return raw.replace(/(方向|往.*$|To\s+.*$)/i, '').trim();
}

/**
 * 获取换乘名称（中文）
 * @param {Object} transfer - 换乘对象
 * @returns {string} 清理后的中文名称
 */
function getTransferNameByLang(transfer) {
    return cleanDirectionSuffix(transfer.nameCn || transfer.name || '');
}

/**
 * 判断是否为环形线路
 * 检查首尾站点是否相同
 * @param {Object} route - 路线对象
 * @returns {boolean} 是否为环形线路
 */
function isCircularRoute(route) {
    const st = route && route.forwardStations ? route.forwardStations : [];
    if (st.length < 3) return false;
    const first = st[0];
    const last = st[st.length - 1];
    return first && last && first.nameCn === last.nameCn && first.nameEn === last.nameEn;
}

/**
 * 加载路线数据并初始化页面
 * 从 routes_data.json 获取数据，渲染路线并初始化事件监听器
 */
async function loadRoutesData() {
    try {
        console.log('Loading routes data...');
        const timestamp = Date.now();
        const response = await fetch(`../assets/data/routes_data.json?v=${timestamp}`);
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            document.getElementById('routesContainer').innerHTML = 
                '<p style="text-align: center; padding: 40px; color: #ff5252;">' +
                '加载数据失败，服务器返回错误。<br>' +
                'Failed to load data. Server returned an error.' +
                '<br><small>Status: ' + response.status + '</small>' +
                '</p>';
            return;
        }
        routesData = await response.json();
        console.log('Routes data loaded, rendering...');
        renderRoutes();
        console.log('Routes rendered, initializing event listeners...');
        initializeEventListeners();
        console.log('Initialization complete');
    } catch (error) {
        console.error('Error loading routes:', error);
        document.getElementById('routesContainer').innerHTML = 
            '<p style="text-align: center; padding: 40px; color: #ff5252;">' +
            '加载数据失败，请确保 routes_data.json 文件存在。<br>' +
            'Failed to load data. Please ensure routes_data.json exists.' +
            '<br><small>' + error.message + '</small>' +
            '</p>';
    }
}

// function isRouteExcluded(route, options = {}) {
//     const routeNameRaw = route.nameRaw || route.nameAll || route.nameCn || route.nameEn || route.fullName || '';
//     if (options.noHighSpeed && isHighSpeedLineEx(routeNameRaw, route.mode, route.type)) return true;
//     if (options.noBoat && route.mode === 'BOAT') return true;
//     if (options.noAirplane && route.mode === 'AIRPLANE') return true;
//     return false;
// }
// function isTransferExcluded(transfer, options = {}) {
//     const transferNameRaw = transfer.nameRaw || transfer.nameAll || transfer.nameCn || transfer.nameEn || transfer.lineName || transfer.name || '';
//     if (options.noHighSpeed && isHighSpeedLineEx(transferNameRaw, transfer.mode, transfer.type)) return true;
//     if (options.noBoat && transfer.mode === 'BOAT') return true;
//     if (options.noAirplane && transfer.mode === 'AIRPLANE') return true;
//     return false;
// }
// function findStationRecordByName(nameCn) {
//     for (let route of routesData) {
//         const lists = [route.forwardStations, route.reverseStations];
//         for (let list of lists) {
//             if (!list) continue;
//             const match = list.find(station => station.nameCn === nameCn);
//             if (match) return match;
//         }
//     }
//     return null;
// }


//
// /**
//  * 获取站点的唯一换乘徽章列表
//  * 去重后返回站点的所有换乘线路信息
//  * @param {Object} station - 站点对象
//  * @returns {Array} 换乘徽章数组 [{name, color}]
//  */
// function getUniqueTransferBadges(station) {
//     const transferModel = buildStationTransferModel(station);
//     const source = [
//         ...transferModel.normalTransfers,
//         ...transferModel.highSpeedTransfers,
//         ...transferModel.boatTransfers,
//         ...transferModel.airTransfers
//     ];
//     const items = [];
//     source.forEach(transfer => {
//         const name = cleanDirectionSuffix(getTransferNameByLang(transfer));
//         if (!name) return;
//         if (!items.some(item => item.name === name && item.color === (transfer.color || '#607d8b'))) {
//             items.push({ name, color: transfer.color || '#607d8b' });
//         }
//     });
//     return items;
// }



// function captureRouteViewState() {
//     const expandedContentIds = Array.from(document.querySelectorAll('.route-content.expanded')).map(node => node.id);
//     const directionSelections = {};
//
//     document.querySelectorAll('.direction-selector').forEach(selector => {
//         if (!selector.id) return;
//         const activeButton = selector.querySelector('.direction-btn.active');
//         directionSelections[selector.id] = activeButton?.dataset.dir || 'forward';
//     });
//
//     return {
//         scrollY: window.scrollY || document.documentElement.scrollTop || 0,
//         expandedContentIds,
//         directionSelections
//     };
// }

/**
 * 调度路线重绘
 * 使用 requestAnimationFrame 优化性能
 */
function scheduleRouteRedraw() {
    requestAnimationFrame(() => requestAnimationFrame(redrawVisibleLines));
}

// function restoreRouteViewState(state) {
//     if (!state) return;
//
//     state.expandedContentIds.forEach(contentId => {
//         const content = document.getElementById(contentId);
//         if (content) content.classList.add('expanded');
//     });
//
//     Object.entries(state.directionSelections || {}).forEach(([selectorId, direction]) => {
//         const match = selectorId.match(/^selector-(\d+)-(\d+)$/);
//         if (!match) return;
//         selectDirection(selectorId, direction, Number(match[1]), Number(match[2]));
//     });
//
//     scheduleRouteRedraw();
//     requestAnimationFrame(() => {
//         window.scrollTo({ top: state.scrollY, behavior: 'auto' });
//     });
// }

// function normalizeStationSearchText(text) {
//     return String(text || '')
//         .trim()
//         .toLowerCase()
//         .replace(/\s+/g, '')
//         .replace(/(railwaystation|station)$/, '')
//         .replace(/(\u8f66\u7ad9|\u7ad9)$/, '');
// }

/**
 * 移除线路名称中的支线后缀
 * 如“（支线1）”、“ (Branch 2)”等
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
/**
 * 移除线路名称中的支线后缀
 * 如“（支线1）”、“ (Branch 2)”等
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
function stripBranchSuffix(text) {
    let value = String(text || '').trim();
    value = value.replace(/\s*\(支线\d+\)\s*$/i, '').trim();
    value = value.replace(/\s*\(Branch\s*\d+\)\s*$/i, '').trim();
    if (value.includes(' (鏀嚎')) value = value.split(' (鏀嚎')[0].trim();
    if (value.includes(' (閺€顖滃殠')) value = value.split(' (閺€顖滃殠')[0].trim();
    if (value.includes(' (Branch')) value = value.split(' (Branch')[0].trim();
    return value;
}

/**
 * 获取站点显示名称
 * 优先返回中文名，其次英文名
 * @param {Object} station - 站点对象
 * @returns {string} 站点名称
 */
function getStationNameForDisplay(station) {
    if (!station) return '';
    return station.nameCn || station.nameEn || '';
}

/**
 * 获取路线的方向描述
 * 生成“起点-终点方向”或“起点 - 中间点 - 终点”格式
 * @param {Object} route - 路线对象
 * @param {boolean} preferThreePoint - 是否优先使用三点描述
 * @returns {string} 方向描述文本
 */
/**
 * 获取路线的方向描述
 * 生成“起点-终点方向”或“起点 - 中间点 - 终点”格式
 * @param {Object} route - 路线对象
 * @param {boolean} preferThreePoint - 是否优先使用三点描述
 * @returns {string} 方向描述文本
 */
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

/**
 * 获取环形线路的方向标签
 * 根据线路名称和方向返回特定的标签（如“北环内圈”）
 * @param {Object} route - 路线对象
 * @param {string} directionKey - 方向键（forward/reverse）
 * @param {Array} stations - 站点数组
 * @returns {string} 方向标签
 */
function getCircularDirectionLabel(route, directionKey, stations) {
    const routeNames = [route?.nameCn].filter(Boolean);
    for (const routeName of routeNames) {
        if (routeName === '北环') {
            return directionKey === 'forward' ? '北环内圈' : '北环外圈';
        }
        if (routeName === '城线') {
            return directionKey === 'forward' ? '城线外圈' : '城线内圈';
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
}

/**
 * 规范化路线基础名称（V2版本）
 * 结合清理方向后缀和移除支线后缀
 * @param {string} rawName - 原始名称
 * @returns {string} 规范化后的名称
 */
function normalizeRouteBaseNameV2(rawName) {
    return stripBranchSuffix(cleanDirectionSuffix(rawName || '')).trim();
}

/**
 * 规范化路线基础名称（旧版本）
 * @param {string} rawName - 原始名称
 * @returns {string} 规范化后的名称
 */
// function normalizeRouteBaseName(rawName) {
//     let baseName = cleanDirectionSuffix(rawName || '');
//     if (baseName.includes(' (支线')) baseName = baseName.split(' (支线')[0];
//     if (baseName.includes(' (鏀嚎')) baseName = baseName.split(' (鏀嚎')[0];
//     if (baseName.includes(' (Branch')) baseName = baseName.split(' (Branch')[0];
//     return baseName.trim();
// }

/**
 * 渲染所有路线到页面
 * 创建统一展示区域，按线路分组路线，生成线路选择器的色块
 */
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
        const baseCn = normalizeRouteBaseNameV2(route.nameCn || route.fullName || '');
        const baseEn = normalizeRouteBaseNameV2(route.nameEn || route.fullName || '');
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

/**
 * 创建线路选择器中的色块元素
 * @param {Object} route - 路线对象
 * @param {number} groupIndex - 线路组索引
 * @returns {HTMLElement} 线路色块 DOM 元素
 */
function createLineBlock(route, groupIndex) {
    const block = document.createElement('div');
    block.className = 'line-block';
    block.style.backgroundColor = route.color || '#607d8b';
    block.dataset.groupIndex = groupIndex;
    block.dataset.mode = route.mode;
    block.dataset.type = route.type;
    
    // Strip branch part from name
    let displayCn = stripBranchSuffix(cleanDirectionSuffix(route.nameCn || ''));
    let displayEn = stripBranchSuffix(cleanDirectionSuffix(route.nameEn || ''));
    
    const tooltipText = displayCn === displayEn || !displayEn ? displayCn : `${displayCn} / ${displayEn}`;
    
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

/**
 * 选择并显示指定线路
 * 高亮对应的色块，在统一展示区渲染该线路的站点信息
 * @param {number} groupIndex - 线路组索引
 */
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

/**
 * 在统一展示区渲染线路详情
 * 包括线路标题、方向选择器、站点列表等
 * @param {Object} primaryRoute - 主路线对象
 * @param {Array} branches - 分支路线数组
 * @param {number} groupIndex - 线路组索引
 */
function renderRouteInUnifiedDisplay(primaryRoute, branches, groupIndex) {
    const container = document.getElementById('unifiedRouteDisplay');
    if (!container) return;
    
    // Strip branch part from name for the header
    let displayCn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameCn));
    let displayEn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameEn));
    
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


/**
 * 转义 JavaScript 字符串
 * 处理反斜杠、单引号和换行符
 * @param {*} value - 要转义的值
 * @returns {string} 转义后的字符串
 */
function escapeJsString(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ');
}

/**
 * 获取高铁换乘提示信息
 * @param {Object} station - 站点对象
 * @returns {string} 换乘提示文本
 */
function getHighSpeedTransferHint(station) {
    const nearby = Array.isArray(station.nearbyTransfers) ? station.nearbyTransfers : [];
    const target = nearby.find(item => item && item.mode === 'HIGH_SPEED');
    if (target && target.targetStationCn) return `往${target.targetStationCn}换乘铁路`;
    return '可换乘铁路';
}

/**
 * 生成站点的 HTML 结构
 * 包括站点名称、换乘徽章、点击事件等
 * @param {Object} station - 站点对象
 * @returns {string} 站点 HTML 字符串
 */
function createStationHTML(station) {
    const transferModel = buildStationTransferModel(station);
    const { hasHighSpeed, hasBoat, hasAirplane, normalTransfers, highSpeedTransfers, boatTransfers, airTransfers } = transferModel;
    
    const isTransfer = station.isTransfer;
    const hasNearby = station.nearbyTransfers && station.nearbyTransfers.length > 0;
    const dotClass = isTransfer || hasHighSpeed || hasBoat || hasAirplane || hasNearby ? 'station-dot transfer' : 'station-dot';
    
    let badgesHTML = '';
    
    const safeNameCn = escapeJsString(station.nameCn);
    const safeNameEn = escapeJsString(station.nameEn || '');
    const stationEnAll = station.nameEnAll || station.nameEn || '';
    const allTransfersData = encodeURIComponent(JSON.stringify(station.transfers || []));
    const showMergedPayload = hasNearby;
    const mergedPayload = showMergedPayload
        ? encodeURIComponent(JSON.stringify(mergeTransfersWithNearby(station)))
        : allTransfersData;
    const transferSideClass = 'side-unified';

    if (normalTransfers.length > 0 || hasHighSpeed || hasBoat || hasAirplane || (station.nearbyTransfers && station.nearbyTransfers.length > 0)) {
        badgesHTML = `<div class="transfer-badges ${transferSideClass}">`;
        if (station.nearbyTransfers && station.nearbyTransfers.length > 0) {
            station.nearbyTransfers.forEach(nearby => {
                const messageCnRaw = nearby.messageCn || `往${nearby.targetStationCn}站转乘${nearby.lineName}`;
                const displayText = escapeJsString(`临近 · ${messageCnRaw}`);
                const payload = showMergedPayload
                    ? mergedPayload
                    : encodeURIComponent(JSON.stringify([{name: nearby.lineName, mode: nearby.mode, color: nearby.color || '#607d8b'}]));
                badgesHTML += `<div class="transfer-link-item nearby-item" style="--tc:${nearby.color || '#607d8b'};" onclick="event.stopPropagation(); showStationInfo(this.closest('.station-item'), '${safeNameCn}', '${safeNameEn}', '${payload}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${displayText}</span></div>`;
            });
        }
        if (normalTransfers.length > 0) {
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
                badgesHTML += `<div class="transfer-link-item direct-item" title="${transferTitle}" style="--tc:${transfer.color};" onclick="event.stopPropagation(); showStationInfo(this.closest('.station-item'), '${safeNameCn}', '${safeNameEn}', '${payload}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${transferName}${pBadge}</span></div>`;
            });
        }
        if (hasHighSpeed) {
            const hsData = encodeURIComponent(JSON.stringify(highSpeedTransfers));
            const payload = showMergedPayload ? mergedPayload : hsData;
            const hsText = escapeJsString(getHighSpeedTransferHint(station));
            badgesHTML += `<div class="transfer-link-item summary-item hs-item" onclick="event.stopPropagation(); showStationInfo(this.closest('.station-item'), '${safeNameCn}', '${safeNameEn}', '${payload}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${hsText}</span></div>`;
        }
        if (hasBoat) {
            const boatData = encodeURIComponent(JSON.stringify(boatTransfers));
            const payload = showMergedPayload ? mergedPayload : boatData;
            const boatText = '可换乘轮船';
            badgesHTML += `<div class="transfer-link-item summary-item other-mode-transfer" onclick="event.stopPropagation(); showStationInfo(this.closest('.station-item'), '${safeNameCn}', '${safeNameEn}', '${payload}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${boatText}</span></div>`;
        }
        if (hasAirplane) {
            const airData = encodeURIComponent(JSON.stringify(airTransfers));
            const payload = showMergedPayload ? mergedPayload : airData;
            const airText = '可换乘飞机';
            badgesHTML += `<div class="transfer-link-item summary-item other-mode-transfer" onclick="event.stopPropagation(); showStationInfo(this.closest('.station-item'), '${safeNameCn}', '${safeNameEn}', '${payload}')"><span class="transfer-link-dot"></span><span class="transfer-link-line"></span><span class="transfer-link-dot transfer-link-dot-end"></span><span class="transfer-link-text">${airText}</span></div>`;
        }
        badgesHTML += '</div>';
    }
    
    return `
        <div class="station-item" data-cn="${safeNameCn}" data-en="${safeNameEn}" onclick="showStationInfo(this, '${safeNameCn}', '${safeNameEn}', '${mergedPayload}')">
            ${badgesHTML ? `<div class="transfer-badges-container ${transferSideClass}">${badgesHTML}</div>` : ''}
            <div class="${dotClass}"></div>
            <div class="station-info">
                <div class="station-name">${station.nameCn}</div>
                <div class="station-name-en">${stationEnAll}</div>
            </div>
        </div>
    `;
}

/**
 * 构建站点换乘模型
 * 将站点的换乘信息按类型分类（普通、高铁、轮船、飞机）
 * @param {Object} station - 站点对象
 * @returns {Object} 包含各类换乘信息的对象
 */
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

/**
 * 合并站点的直接换乘和就近换乘信息
 * @param {Object} station - 站点对象
 * @returns {Array} 合并后的换乘数组
 */
function mergeTransfersWithNearby(station) {
    const mainTransfers = Array.isArray(station.transfers) ? station.transfers : [];
    const nearbyTransfers = Array.isArray(station.nearbyTransfers) ? station.nearbyTransfers : [];

    const merged = [];
    const seen = new Set();

    function keyOf(t) {
        if (!t) return '';
        const mode = String(t.mode || 'TRAIN');
        const nameRaw = String(t.nameRaw || t.nameAll || t.name || '');
        const color = String(t.color || '');
        return `${mode}::${nameRaw}::${color}`;
    }

    mainTransfers.forEach(t => {
        if (!t) return;
        const k = keyOf(t);
        if (seen.has(k)) return;
        seen.add(k);
        merged.push(t);
    });

    nearbyTransfers.forEach(n => {
        if (!n) return;
        const normalized = {
            mode: n.mode || 'TRAIN',
            color: n.color || '#607d8b',
            name: n.lineName || '',
            nameRaw: n.lineName || '',
            nameAll: n.lineName || '',
            isNearby: true,
            targetStationCn: n.targetStationCn,
            targetStationEn: n.targetStationEn
        };
        const k = keyOf(normalized) + '::nearby';
        if (seen.has(k)) return;
        seen.add(k);
        merged.push(normalized);
    });

    return merged;
}

/**
 * 渲染线路的站点列表
 * 处理正向和反向站点，支持环形线路
 * @param {Object} route - 路线对象
 * @param {string|number} index - 容器索引标识
 */
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
        forwardContainer.innerHTML = stations.map((s, i) => createStationHTML(s, i)).join('');
        drawMainLine(forwardContainer);
    }
    
    if (reverseContainer && route.reverseStations) {
        const stations = toLinearStations(route.reverseStations);
        reverseContainer.innerHTML = stations.map((s, i) => createStationHTML(s, i)).join('');
    }
}

/**
 * 绘制主线
 * 在站点列表中绘制连接各站点的线条
 * @param {HTMLElement} container - 容器元素
 */
function drawMainLine(container) {
    if (!container) return;
    container.querySelectorAll('.station-main-line').forEach(el => el.remove());
    container.querySelectorAll('.station-main-line-dual').forEach(el => el.remove());

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
    const stationItems = container.querySelectorAll('.station-item');
    const a = Array.from(stationItems).find(x => (x.dataset.cn || '').includes('洞天'));
    const b = Array.from(stationItems).find(x => (x.dataset.cn || '').includes('滨堡'));
    if (a && b) {
        const aDot = a.querySelector('.station-dot');
        const bDot = b.querySelector('.station-dot');
        if (aDot && bDot) {
            const ax = aDot.offsetLeft + (aDot.offsetWidth / 2);
            const bx = bDot.offsetLeft + (bDot.offsetWidth / 2);
            const dual = document.createElement('div');
            dual.className = 'station-main-line station-main-line-dual';
            dual.style.left = `${Math.min(ax, bx)}px`;
            dual.style.top = `${top - 2}px`;
            dual.style.height = '4px';
            dual.style.width = `${Math.abs(bx - ax)}px`;
            container.appendChild(dual);
        }
    }
}

/**
 * 调整站点列表的内边距以适应徽章
 * @param {HTMLElement} list - 站点列表元素
 */
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

/**
 * 重绘所有可见的线条
 * 遍历所有展开的路线内容并重绘线条
 */
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

/**
 * 附加站点列表滚动重绘事件
 * 当站点列表滚动时自动重绘线条
 */
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



/**
 * 切换方向
 * @param {string} groupBranchId - 组分支ID
 * @param {string} direction - 方向（forward/reverse）
 */
// function toggleDirection(groupBranchId, direction) {
//     const forwardList = document.getElementById(`stations-${groupBranchId}-forward`);
//     const reverseList = document.getElementById(`stations-${groupBranchId}-reverse`);
//
//     // Find the closest branch container to target buttons
//     const container = forwardList.closest('.branch-container');
//     const buttons = container.querySelectorAll(`.direction-btn`);
//
//     buttons.forEach(btn => btn.classList.remove('active'));
//
//     if (direction === 'forward') {
//         forwardList.classList.remove('hidden');
//         reverseList.classList.add('hidden');
//         buttons[0].classList.add('active');
//         drawMainLine(forwardList);
//     } else {
//         forwardList.classList.add('hidden');
//         reverseList.classList.remove('hidden');
//         buttons[1].classList.add('active');
//         drawMainLine(reverseList);
//     }
//     scheduleRouteRedraw();
// }

/**
 * 选择方向
 * 更新方向按钮状态并渲染对应方向的站点
 * @param {string} selectorId - 选择器ID
 * @param {string} direction - 方向
 * @param {number} groupIndex - 组索引
 * @param {number} branchIndex - 分支索引
 */
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

/**
 * 获取站点的全局信息
 * 在所有路线中查找站点并返回其详细信息
 * @param {string} stationName - 站点名称
 * @returns {Object|null} 站点全局信息
 */
function getStationGlobalInfo(stationName) {
    if (!stationName) return null;
    let foundStation = null;
    let allTransfers = [];
    let allNearbyTransfers = [];
    
    // We must collect all lines passing through this station
    // because a station might appear on multiple lines with different platform numbers
    // and each line's version of the station might have different transfers listed.
    routesData.forEach(r => {
        const check = (list) => {
            if(!list) return;
            const s = list.find(st => st.nameCn === stationName);
            if (s) {
                if (!foundStation) {
                    foundStation = { ...s }; // copy base info
                }
                
                // Add the line itself as a transfer (to show it passes through here)
                allTransfers.push({
                    mode: r.mode,
                    nameCn: r.nameCn,
                    nameEn: r.nameEn,
                    nameRaw: r.nameCn,
                    nameAll: r.nameCn,
                    color: r.color,
                    platformName: s.platformName,
                    isNearby: false
                });

                if (s.transfers) {
                    s.transfers.forEach(t => allTransfers.push({...t, isNearby: false}));
                }
                if (s.nearbyTransfers) {
                    s.nearbyTransfers.forEach(t => allNearbyTransfers.push({...t, isNearby: true}));
                }
            }
        };
        check(r.forwardStations);
        check(r.reverseStations);
    });
    
    if (foundStation) {
            // deduplicate collected transfers/lines
            const uniqueT = [];
            const seen = new Set();
            const process = (tList) => {
                tList.forEach(t => {
                    const unifiedMode = getModeLabel(t.mode, t);
                    const k = `${unifiedMode}::${t.nameRaw || t.nameCn}::${t.isNearby}::${t.platformName || ''}`;
                    if(!seen.has(k)) {
                        seen.add(k);
                        uniqueT.push(t);
                    }
                });
            };
        process(allTransfers);
        process(allNearbyTransfers);
        
        foundStation.transfers = uniqueT.filter(t => !t.isNearby);
        foundStation.nearbyTransfers = uniqueT.filter(t => t.isNearby);
        return foundStation;
    }
    return null;
}

/**
 * 对换乘信息进行排序
 * 按模式优先级排序：地铁 > 高铁 > 轮船 > 飞机 > 索道
 * @param {Array} transfersList - 换乘列表
 * @returns {Array} 排序后的换乘列表
 */
function sortTransfers(transfersList) {
    const predefinedMetro = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '16', 'S6', 'S16', 'T1', 'T2', 'T3'];
    
    function getMetroRank(name) {
        // Find exact or starting match
        for (let i = 0; i < predefinedMetro.length; i++) {
            const prefix = predefinedMetro[i];
            if (name === prefix || name === prefix + '号线' || name === prefix + '线' || name.startsWith(prefix + '号线') || name.startsWith(prefix + '线')) {
                return i;
            }
        }
        return 999;
    }

    return transfersList.sort((a, b) => {
        const modeA = getModeLabel(a.mode, a);
        const modeB = getModeLabel(b.mode, b);
        
        // Group by mode first
        if (modeA !== modeB) {
            return modeA.localeCompare(modeB, 'zh-Hans-CN');
        }
        
        const nameA = cleanDirectionSuffix(getTransferNameByLang(a)) || a.nameCn || a.nameRaw || '';
        const nameB = cleanDirectionSuffix(getTransferNameByLang(b)) || b.nameCn || b.nameRaw || '';
        
        if (modeA.includes('Metro') || modeA.includes('地铁')) {
            const rankA = getMetroRank(nameA);
            const rankB = getMetroRank(nameB);
            if (rankA !== rankB) return rankA - rankB;
            return nameA.localeCompare(nameB, 'zh-Hans-CN');
        } else if (modeA.includes('High Speed') || modeA.includes('高铁')) {
            // High speed: A->Z then numbers
            const matchA = nameA.match(/^([A-Za-z]+)(\d*)/);
            const matchB = nameB.match(/^([A-Za-z]+)(\d*)/);
            
            if (matchA && matchB) {
                const prefixA = matchA[1].toUpperCase();
                const prefixB = matchB[1].toUpperCase();
                if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
                
                const numA = matchA[2] ? parseInt(matchA[2], 10) : 0;
                const numB = matchB[2] ? parseInt(matchB[2], 10) : 0;
                return numA - numB;
            }
            return nameA.localeCompare(nameB, 'zh-Hans-CN');
        }
        
        return nameA.localeCompare(nameB, 'zh-Hans-CN');
    });
}

/**
 * 显示站点信息提示框
 * 点击站点时显示换乘信息和线路详情
 * @param {HTMLElement} element - 被点击的站点元素
 * @param {string} nameCn - 站点中文名
 * @param {string} nameEn - 站点英文名
 * @param {string} transfersJsonEscaped - URL编码的换乘信息JSON
 */
function showStationInfo(element, nameCn, nameEn, transfersJsonEscaped) {
    if (window.event) window.event.stopPropagation();
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    
    let transfers = [];
    try {
        transfers = JSON.parse(decodeURIComponent(transfersJsonEscaped));
    } catch (e) {}

    let transferHTML = '';
    if (transfers && transfers.length > 0) {
            const unique = [];
            const seen = new Set();
            transfers.forEach(t => {
                if (!t) return;
                const unifiedMode = getModeLabel(t.mode, t);
                const nameRaw = String(t.nameRaw || t.nameAll || t.nameCn || t.nameEn || t.name || '');
                const color = String(t.color || '');
                const platform = String(t.platformName || '');
                const key = `${unifiedMode}::${nameRaw}::${color}::${t.isNearby}::${platform}`;
                if (seen.has(key)) return;
                seen.add(key);
                unique.push(t);
            });

            const directTransfers = sortTransfers(unique.filter(t => !t.isNearby));
            const nearbyTransfers = sortTransfers(unique.filter(t => t.isNearby));

            const renderGroup = (title, list) => {
                if (list.length === 0) return '';
                let html = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;"><strong>${title}:</strong><div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;">`;
                list.forEach(t => {
                    const modeLabelText = getModeLabel(t.mode, t);
                    const modeLabel = modeLabelText ? ` [${modeLabelText}]` : '';
                    const tColor = t.color || '#999';
                    const transferName = cleanDirectionSuffix(getTransferNameByLang(t));
                    const pBadge = t.platformName ? `<span style="background:rgba(0,0,0,0.2); border-radius:2px; padding:0 4px; margin-left:4px; font-size:10px;">站台 ${t.platformName}</span>` : '';
                    
                    if (t.isNearby) {
                        const targetName = (t.targetStationCn || transferName);
                        
                        // Instead of navigating, call showStationInfo for the target station.
                        // We need to gather its transfers from the global routesData
                        const targetInfo = getStationGlobalInfo(t.targetStationCn || targetName);
                        let targetEn = t.targetStationEn || '';
                        let targetTransfers = [];
                        if (targetInfo) {
                            if (targetInfo.nameEn) targetEn = targetInfo.nameEn;
                            if (targetInfo.transfers) targetTransfers = targetInfo.transfers;
                            if (targetInfo.nearbyTransfers) {
                                targetInfo.nearbyTransfers.forEach(nt => {
                                    targetTransfers.push({
                                        ...nt,
                                        isNearby: true
                                    });
                                });
                            }
                        }
                        
                        const transfersJsonEscaped = encodeURIComponent(JSON.stringify(targetTransfers));
                        
                        html += `<a onclick="showStationInfo(this, '${(t.targetStationCn || targetName).replace(/'/g, "\\'")}', '${targetEn.replace(/'/g, "\\'")}', '${transfersJsonEscaped}')" title="查看 ${targetName} 站的所有线路" style="text-decoration:none; background: #e0f7fa; color: #006064; border: 1px solid #00acc1; padding: 2px 6px; border-radius: 4px; font-size: 12px; display: inline-block; cursor: pointer; transition: background 0.2s;">
                            <i class="fas fa-info-circle" style="margin-right:4px;"></i>${targetName} (${transferName})${modeLabel}
                        </a>`;
                    } else {
                        const lineNameForClick = encodeURIComponent(transferName);
                        html += `<span onclick="openLineDetail('${lineNameForClick.replace(/'/g, "\\'")}')" title="${(t.nameAll || t.nameRaw || transferName)} (点击查看线路详情)" style="background: ${tColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; display: inline-flex; align-items: center; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 6px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.2)'">${transferName}${pBadge}${modeLabel}</span>`;
                    }
                });
                html += '</div></div>';
                return html;
            };

        transferHTML += renderGroup('站内换乘', directTransfers);
        transferHTML += renderGroup('就近换乘', nearbyTransfers);
    }

    const titleMain = nameCn;
    const titleSub = nameEn;
    const subHTML = (titleSub && titleSub !== titleMain) ? `<div style="color: #666; font-size: 12px; margin-top: 2px;">${titleSub}</div>` : '';

    tooltip.innerHTML = `
        <div style="font-size: 16px; font-weight: bold; color: #1a1a1a;">${titleMain}</div>
        ${subHTML}
        ${transferHTML}
        <button onclick="document.getElementById('tooltip').style.display='none'" style="margin-top: 10px; width: 100%; padding: 5px; background: #f0f0f0; border: 1px solid #ddd; cursor: pointer; border-radius: 4px;">关闭</button>
    `;

    const rect = element.getBoundingClientRect();
    tooltip.style.display = 'block';
    
    // Position tooltip near the element
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;
    
    // Prevent going off-screen right
    if (left + 250 > window.innerWidth) {
        left = window.innerWidth - 270;
    }
    
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

/**
 * 打开线路详情页
 * 从站点信息框中点击换乘线路时跳转到对应线路
 * @param {string} lineNameEncoded - URL编码的线路名称
 */
function openLineDetail(lineNameEncoded) {
    const lineName = decodeURIComponent(lineNameEncoded);
    
    // Close the tooltip first
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
    
    // Find the matching route in groupedRoutesData
    const groupedRoutes = window.groupedRoutesData;
    if (!groupedRoutes) {
        console.warn('线路数据未加载');
        return;
    }
    
    let targetGroupIndex = null;
    
    // Search through all groups to find a match
    const groupKeys = Object.keys(groupedRoutes);
    for (let i = 0; i < groupKeys.length; i++) {
        const routes = groupedRoutes[groupKeys[i]];
        if (routes && routes.length > 0) {
            const primaryRoute = routes[0];
            const routeNameCn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameCn || ''));
            const routeNameEn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameEn || ''));
            
            // Check if the line name matches (case-insensitive, partial match)
            if (routeNameCn.includes(lineName) || lineName.includes(routeNameCn) ||
                (routeNameEn && (routeNameEn.toLowerCase().includes(lineName.toLowerCase()) || lineName.toLowerCase().includes(routeNameEn.toLowerCase())))) {
                targetGroupIndex = i;
                break;
            }
        }
    }
    
    if (targetGroupIndex !== null) {
        // Select the line (this will show it in the unified display)
        selectLine(targetGroupIndex);
    } else {
        console.warn('未找到线路:', lineName);
        // Show a friendly error message
        if (tooltip) {
            tooltip.innerHTML = `
                <div style="font-size: 14px; color: #ff5252; text-align: center; padding: 10px;">
                    <i class="fas fa-exclamation-circle" style="margin-right: 5px;"></i>
                    未找到线路 "${lineName}"
                </div>
                <button onclick="document.getElementById('tooltip').style.display='none'" style="margin-top: 10px; width: 100%; padding: 5px; background: #f0f0f0; border: 1px solid #ddd; cursor: pointer; border-radius: 4px;">关闭</button>
            `;
            tooltip.style.display = 'block';
            setTimeout(() => {
                tooltip.style.display = 'none';
            }, 2000);
        }
    }
}

/**
 * 根据分类过滤线路
 * 支持按地铁、高铁、轮船、飞机、索道等类型筛选
 */
function filterRoutes() {
    const activeCategoryElement = document.querySelector('.category-tab.active');
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

/**
 * 更新线路色块的提示文本
 * 根据当前语言设置更新所有色块的tooltip
 */
// function updateLineBlockTooltips() {
//     const groupedRoutes = window.groupedRoutesData;
//     if (!groupedRoutes) return;
//
//     document.querySelectorAll('.line-block').forEach(block => {
//         const groupIndex = block.dataset.groupIndex;
//         const groupKey = Object.keys(groupedRoutes)[groupIndex];
//         if (groupKey && groupedRoutes[groupKey]) {
//             const primaryRoute = groupedRoutes[groupKey][0];
//             if (primaryRoute) {
//                 let displayCn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameCn || ''));
//                 let displayEn = stripBranchSuffix(cleanDirectionSuffix(primaryRoute.nameEn || ''));
//
//                 const tooltipText = displayCn === displayEn || !displayEn ? displayCn : `${displayCn} / ${displayEn}`;
//                 const tooltip = block.querySelector('.line-block-tooltip');
//                 if (tooltip) {
//                     tooltip.textContent = tooltipText;
//                 }
//             }
//         }
//     });
// }

/**
 * 初始化所有事件监听器
 * 包括分类标签、返回顶部按钮、tooltip关闭等
 */
function initializeEventListeners() {
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            filterRoutes();
        });
    });


    
    // Close tooltip when clicking outside
    document.addEventListener('click', function(e) {
        const tooltip = document.getElementById('tooltip');
        if (tooltip && tooltip.style.display === 'block') {
            if (!tooltip.contains(e.target) && !e.target.closest('.station-item')) {
                tooltip.style.display = 'none';
            }
        }
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
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    loadRoutesData();
});
window.addEventListener('resize', scheduleRouteRedraw);
