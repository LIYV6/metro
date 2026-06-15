// ==================== 全局状态管理（单例模式） ====================
/**
 * 全局状态管理器
 * 将所有全局变量收归此处，通过 getter/setter 统一访问
 */
class AppState {
    #db = null;
    #routesData = [];
    #groupedRoutesData = {};
    #sortedRouteKeys = [];

    constructor() {
        if (AppState.#instance) {
            return AppState.#instance;
        }
        AppState.#instance = this;
    }

    static #instance = null;

    static getInstance() {
        if (!AppState.#instance) {
            AppState.#instance = new AppState();
        }
        return AppState.#instance;
    }

    // ---- 数据库实例 ----
    get db() { return this.#db; }
    set db(value) { this.#db = value; }

    // ---- 路线数据 ----
    get routesData() { return this.#routesData; }
    set routesData(value) {
        this.#routesData = value;
        // 同步到 window 用于调试兼容
        window.routesData = value;
    }

    // ---- 分组路线数据 ----
    get groupedRoutesData() { return this.#groupedRoutesData; }
    set groupedRoutesData(value) {
        this.#groupedRoutesData = value;
        window.groupedRoutesData = value;
    }

    // ---- 排序后的路线键 ----
    get sortedRouteKeys() { return this.#sortedRouteKeys; }
    set sortedRouteKeys(value) {
        this.#sortedRouteKeys = value;
        window.sortedRouteKeys = value;
    }

    /**
     * 暴露数据库到 window（调试用）
     */
    exposeDb() {
        window.metroDB = this.#db;
    }

    /**
     * 重置所有状态
     */
    reset() {
        this.#db = null;
        this.#routesData = [];
        this.#groupedRoutesData = {};
        this.#sortedRouteKeys = [];
    }
}

const state = AppState.getInstance();

export { AppState, state };
export default state;