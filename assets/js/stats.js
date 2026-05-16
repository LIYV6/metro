// 首页数据统计面板
// 从 metro.db 获取线路和站点数量，更新首页展示

async function loadStats() {
    try {
        console.log('[Stats] 正在加载数据库...');
        
        // 配置 SQL.js（使用本地 wasm 文件）
        const config = { 
            locateFile: filename => `assets/js/libs/${filename}` 
        };
        
        const SQL = await initSqlJs(config);
        
        // 加载数据库文件
        const response = await fetch('assets/data/metro.db');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const db = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
        console.log('[Stats] 数据库加载成功！');
        
        // 查询线路数量
        const routesRes = db.exec("SELECT COUNT(*) as count FROM routes");
        const routeCount = routesRes[0].values[0][0];
        
        // 查询站点数量（去重后的唯一站点）
        const stationsRes = db.exec("SELECT COUNT(DISTINCT nameCn) as count FROM stations");
        const stationCount = stationsRes[0].values[0][0];
        
        console.log(`[Stats] 线路数: ${routeCount}, 站点数: ${stationCount}`);
        
        // 更新页面显示
        const routesEl = document.getElementById('stat-routes');
        const stationsEl = document.getElementById('stat-stations');
        const safetyEl = document.getElementById('stat-safety');
        
        if (routesEl) {
            animateNumber(routesEl, routeCount);
        }
        if (stationsEl) {
            animateNumber(stationsEl, stationCount);
        }
        if (safetyEl) {
            animateNumber(safetyEl, 100, '%');
        }
        
    } catch (error) {
        console.error('[Stats] 数据加载失败:', error);
        // 降级方案：显示默认值
        const routesEl = document.getElementById('stat-routes');
        const stationsEl = document.getElementById('stat-stations');
        const safetyEl = document.getElementById('stat-safety');
        if (routesEl) routesEl.textContent = '219';
        if (stationsEl) stationsEl.textContent = '411';
        if (safetyEl) safetyEl.textContent = '100%';
    }
}

// 数字递增动画
function animateNumber(element, targetNumber, suffix = '') {
    const duration = 1000; // 动画时长（毫秒）
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数让动画更自然
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

// 监听滚动，当面板进入视口时执行动画
let statsLoaded = false; // 防止重复加载

function initStatsObserver() {
    const statsPanel = document.querySelector('.stats-panel');
    if (!statsPanel) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // 当面板进入视口且未加载过时
            if (entry.isIntersecting && !statsLoaded) {
                statsLoaded = true;
                loadStats();
                observer.unobserve(entry.target); // 停止监听
            }
        });
    }, {
        threshold: 0.3 // 面板 30% 可见时触发
    });
    
    observer.observe(statsPanel);
}

// 页面加载完成后初始化监听器
document.addEventListener('DOMContentLoaded', () => {
    initStatsObserver();
});
