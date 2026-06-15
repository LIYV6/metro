// ==================== Canvas 主线绘制渲染器 ====================
import { CANVAS_CONFIG } from '../core/constants.js';

/**
 * 绘制主线
 * 使用 Canvas 在相邻站点圆点之间绘制连接线
 * @param {HTMLElement} container - 容器元素
 */
const drawMainLine = (container) => {
    if (!container) return;

    const ds = Array.from(container.querySelectorAll('.station-dot'));
    if (ds.length < 2) return;
    if (ds[0].offsetWidth === 0) return;

    const containerRect = container.getBoundingClientRect();
    const scrollW = container.scrollWidth;
    const scrollH = container.scrollHeight;

    let canvas = container.querySelector(':scope > .station-main-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'station-main-canvas';
        container.insertBefore(canvas, container.firstChild);
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, scrollW) * dpr;
    canvas.height = Math.max(1, scrollH) * dpr;
    canvas.style.width = Math.max(1, scrollW) + 'px';
    canvas.style.height = Math.max(1, scrollH) + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, scrollW, scrollH);

    const routeColor = getComputedStyle(container).getPropertyValue('--route-color').trim() || '#1a1a1a';
    ctx.strokeStyle = routeColor;
    ctx.lineWidth = CANVAS_CONFIG.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    ds.forEach((dot, i) => {
        const dotRect = dot.getBoundingClientRect();
        const cx = dotRect.left - containerRect.left + container.scrollLeft + dotRect.width / 2;
        const cy = dotRect.top - containerRect.top + container.scrollTop + dotRect.height / 2;

        if (i === 0) {
            ctx.moveTo(cx, cy);
        } else {
            ctx.lineTo(cx, cy);
        }
    });

    ctx.stroke();
};

/**
 * 附加站点列表滚动重绘事件
 * 当站点列表滚动停止后重绘线条
 */
const attachStationListScrollRedraw = () => {
    document.querySelectorAll('.station-list:not(.hidden)').forEach(list => {
        if (list.dataset.scrollRedrawAttached === '1') return;
        list.dataset.scrollRedrawAttached = '1';

        let scrollTimer = null;
        list.addEventListener('scroll', () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                drawMainLine(list);
            }, CANVAS_CONFIG.scrollRedrawDelay);
        }, { passive: true });
    });
};

/**
 * 调度路线重绘（带 debounce）
 * 用于窗口 resize 场景
 */
let _routeRedrawTimer = null;
const scheduleRouteRedraw = () => {
    if (_routeRedrawTimer) clearTimeout(_routeRedrawTimer);
    _routeRedrawTimer = setTimeout(() => {
        requestAnimationFrame(() => {
            document.querySelectorAll('.station-list:not(.hidden)').forEach(list => {
                drawMainLine(list);
            });
        });
    }, CANVAS_CONFIG.resizeDebounceDelay);
};

export { drawMainLine, attachStationListScrollRedraw, scheduleRouteRedraw };