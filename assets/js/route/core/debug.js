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
const debugLog = (module, ...args) => {
    if (!ROUTE_DEBUG_CONFIG.enabled) return;
    if (!ROUTE_DEBUG_CONFIG.modules[module]) return;

    const prefix = `[Route-${module}]`;
    console.log(prefix, ...args);
};

export { ROUTE_DEBUG_CONFIG, debugLog };