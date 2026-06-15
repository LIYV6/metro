// ==================== 常量定义 ====================
export {MODE, MODE_LABELS, NON_RAIL_MODES,
    CATEGORY_ORDER, CHAR_PRIORITY, STATION_COLOR_CONFIG,
    CANVAS_CONFIG, RENDER_DELAY, DIRECTION
};

// 交通模式常量
const MODE = Object.freeze({
    TRAIN: 'TRAIN',
    BOAT: 'BOAT',
    AIRPLANE: 'AIRPLANE',
    CABLE_CAR: 'CABLE_CAR',
    CABLECAT: 'CABLECAT',
    LIGHT_RAIL: 'LIGHT_RAIL',
    NORMAL: 'NORMAL',
    HIGH_SPEED: 'HIGH_SPEED'
});

// 线路类型标签映射
const MODE_LABELS = Object.freeze({
    BOAT: '轮船',
    AIRPLANE: '飞机',
    CABLE_CAR: '缆车',
    CABLECAT: '缆车',
    LIGHT_RAIL: '轻轨',
    TRAIN: '地铁',
    NORMAL: '地铁',
    HIGH_SPEED: '铁路'
});

// 非轨道列车模式集合
const NON_RAIL_MODES = new Set(['AIRPLANE', 'BOAT', 'CABLE_CAR', 'CABLECAT']);

// 大类排序权重
const CATEGORY_ORDER = Object.freeze({
    METRO: 0,        // 地铁/轻轨
    BOAT: 1,         // 轮船
    CABLEWAY: 2,     // 索道/缆车
    AIRPLANE: 3,     // 飞机
    RAILWAY: 4       // 火车/高铁/铁路
});

// 字符类型优先级（按大类区分）
const CHAR_PRIORITY = Object.freeze({
    [CATEGORY_ORDER.METRO]:     { greek: 0, letter: 1, digit: 2, chinese: 3, other: 4 },
    [CATEGORY_ORDER.AIRPLANE]:  { chinese: 0, greek: 1, letter: 1, digit: 2, other: 2 },
    [CATEGORY_ORDER.RAILWAY]:   { chinese: 0, letter: 1, digit: 2, other: 3 }
});

// 站点颜色生成参数
const STATION_COLOR_CONFIG = Object.freeze({
    goldenAngle: 137.508,
    baseSaturation: 60,
    baseLightness: 45,
    saturationPerLine: 5,
    lightnessPerLine: 2
});

// Canvas 绘制参数
const CANVAS_CONFIG = Object.freeze({
    lineWidth: 6,
    scrollRedrawDelay: 150,
    resizeDebounceDelay: 200
});

// 渲染延迟参数
const RENDER_DELAY = Object.freeze({
    autoSelect: 300,
    tabSwitch: 500,
    mapSwitch: 600,
    categorySwitch: 800,
    stationBlocks: 100,
    errorTooltip: 2000
});

// 方向常量
const DIRECTION = Object.freeze({
    FORWARD: 'forward',
    REVERSE: 'reverse'
});