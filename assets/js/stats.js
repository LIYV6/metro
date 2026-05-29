// ==================== 首页功能模块 ====================
// 包含：数据统计面板 + 滚动揭示动画
// ================================================

// ==================== 统一调试配置 ====================
const STATS_DEBUG_CONFIG = {
    // 全局调试开关：true 启用所有调试日志，false 关闭
    enabled: false,
    
    // 模块级开关
    modules: {
        stats: true,        // 数据统计模块日志
        scrollReveal: true  // 滚动动画模块日志
    }
};

/**
 * 统一调试日志函数
 * @param {string} module - 模块名称 ('stats' | 'scrollReveal')
 * @param {...*} args - 日志内容
 */
function debugLog(module, ...args) {
    if (!STATS_DEBUG_CONFIG.enabled) return;
    if (!STATS_DEBUG_CONFIG.modules[module]) return;
    
    const prefix = `[${module === 'stats' ? 'Stats' : 'Scroll'}]`;
    console.log(prefix, ...args);
}
// ================================================

// ==================== 数据统计模块 ====================
const statsCache = {
    data: null,
    timestamp: null,
    isLoading: false,
    isLoaded: false
};

// 统计模块配置
const STATS_CONFIG = {
    enableCache: true,
    cacheDuration: 24 * 60 * 60 * 1000
};

/**
 * 检查缓存是否有效
 */
function isCacheValid() {
    if (!STATS_CONFIG.enableCache) return false;
    
    if (!statsCache.data || !statsCache.timestamp) return false;
    const now = Date.now();
    return (now - statsCache.timestamp) < STATS_CONFIG.cacheDuration;
}

/**
 * 从缓存获取数据
 */
function getCachedData() {
    if (isCacheValid()) {
        debugLog('stats', '使用缓存数据');
        return statsCache.data;
    }
    return null;
}

/**
 * 保存数据到缓存
 */
function setCacheData(data) {
    if (!STATS_CONFIG.enableCache) {
        debugLog('stats', '缓存已禁用，跳过保存');
        return;
    }
    
    statsCache.data = data;
    statsCache.timestamp = Date.now();
    statsCache.isLoaded = true;
    debugLog('stats', '数据已缓存');
}

/**
 * 加载统计数据（带缓存机制）
 */
async function loadStats() {
    if (statsCache.isLoading) {
        debugLog('stats', '数据加载中，请稍候...');
        return;
    }
    
    const cachedData = getCachedData();
    if (cachedData) {
        updateDisplay(cachedData.routeCount, cachedData.stationCount);
        return;
    }
    
    statsCache.isLoading = true;
    
    try {
        debugLog('stats', '正在加载数据库...');
        
        // 配置 SQL.js（使用本地 wasm 文件）
        const config = { 
            locateFile: filename => `assets/js/libs/${filename}` 
        };
        
        const SQL = await initSqlJs(config);
        
        // 加载数据库文件
        const response = await fetch('assets/data/metro.db');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const db = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
        debugLog('stats', '数据库加载成功！');
        
        const routesRes = db.exec("SELECT COUNT(*) as count FROM routes");
        const routeCount = routesRes[0].values[0][0];
        
        const stationsRes = db.exec("SELECT COUNT(DISTINCT nameCn) as count FROM stations");
        const stationCount = stationsRes[0].values[0][0];
        
        debugLog('stats', `线路数: ${routeCount}, 站点数: ${stationCount}`);
        
        // 保存到缓存
        setCacheData({ routeCount, stationCount });
        
        // 更新页面显示
        updateDisplay(routeCount, stationCount);
        
    } catch (error) {
        console.error('[Stats] 数据加载失败:', error);
        showFallbackData();
    } finally {
        statsCache.isLoading = false;
    }
}

/**
 * 更新页面显示
 */
function updateDisplay(routeCount, stationCount) {
    const routesEl = document.getElementById('stat-routes');
    const stationsEl = document.getElementById('stat-stations');
    const safetyEl = document.getElementById('stat-safety');
    
    if (routesEl) animateNumber(routesEl, routeCount);
    if (stationsEl) animateNumber(stationsEl, stationCount);
    if (safetyEl) animateNumber(safetyEl, 100, '%');
}

/**
 * 显示降级数据
 */
function showFallbackData() {
    const routesEl = document.getElementById('stat-routes');
    const stationsEl = document.getElementById('stat-stations');
    const safetyEl = document.getElementById('stat-safety');
    if (routesEl) routesEl.textContent = '219';
    if (stationsEl) stationsEl.textContent = '411';
    if (safetyEl) safetyEl.textContent = '100%';
}

/**
 * 数字递增动画
 */
function animateNumber(element, targetNumber, suffix = '') {
    const duration = 1000;
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentNumber = Math.floor(easedProgress * targetNumber);
        
        element.textContent = currentNumber + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = targetNumber + suffix;
        }
    }
    
    update();
}

/**
 * 初始化数据统计观察者
 */
function initStatsObserver() {
    const statsPanel = document.querySelector('.stats-panel');
    if (!statsPanel) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadStats();
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.3
    });
    
    observer.observe(statsPanel);
}

// ================================================
// ==================== 滚动揭示动画模块 ===============
// ================================================

/**
 * 初始化滚动揭示动画
 */
function initScrollReveal() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    
    if (!animatedElements.length) {
        debugLog('scrollReveal', '未找到需要动画的元素');
        return;
    }
    
    debugLog('scrollReveal', `找到 ${animatedElements.length} 个动画元素`);
    
    let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    let isScrollingDown = true;
    
    // 监听滚动方向
    window.addEventListener('scroll', () => {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        isScrollingDown = currentScrollTop > lastScrollTop;
        lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
    }, { passive: true });
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && isScrollingDown) {
                debugLog('scrollReveal', `触发动画:`, entry.target);
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    animatedElements.forEach(el => observer.observe(el));
}

// ==================== 初始化入口 ===================
document.addEventListener('DOMContentLoaded', () => {
    debugLog('stats', 'DOM 加载完成，初始化模块...');
    
    // 初始化数据统计
    initStatsObserver();
    
    // 初始化滚动动画
    initScrollReveal();
    
    debugLog('stats', '所有模块初始化完成');
});
