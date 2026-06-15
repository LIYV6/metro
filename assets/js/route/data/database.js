// ==================== 数据库加载服务 ====================
import state from '../core/state.js';
import { debugLog } from '../core/debug.js';

/**
 * 辅助函数：将 SQL 结果行转为对象
 * @param {Array} cols - 列名数组
 * @param {Array} row - 行数据
 * @returns {Object}
 */
const toObj = (cols, row) => {
    const obj = {};
    cols.forEach((c, i) => {
        let v = row[i];
        if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
            try { v = JSON.parse(v); } catch (e) { /* ignore */ }
        }
        obj[c] = v;
    });
    return obj;
};

/**
 * 执行数据库查询并返回结果
 * @param {Object} db - SQL.js 数据库实例
 * @param {string} sql - SQL 查询语句
 * @returns {{columns: Array, values: Array}}
 */
const queryTable = (db, sql) => {
    const res = db.exec(sql);
    return {
        columns: res[0].columns,
        values: res[0].values
    };
};

/**
 * 从 metro.db 加载所有数据表
 * @returns {Promise<{
*   routes: {columns: Array, values: Array},
*   stations: {columns: Array, values: Array},
*   transfers: {columns: Array, values: Array},
*   exits: {columns: Array, values: Array},
*   nearby: {columns: Array, values: Array}
* }>}
 */
const loadDatabase = async () => {
    try {
        debugLog('database', '正在初始化 SQL.js...');
        const config = { locateFile: filename => `../assets/js/libs/${filename}` };
        const SQL = await initSqlJs(config);

        debugLog('database', '正在加载 metro.db...');
        const response = await fetch('../assets/data/metro.db');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const db = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
        state.db = db;
        state.exposeDb();
        debugLog('database', '数据库加载成功！');

        // 并行查询所有表
        const tables = {
            routes: queryTable(db, "SELECT * FROM routes"),
            stations: queryTable(db, "SELECT * FROM stations"),
            transfers: queryTable(db, "SELECT * FROM transfers"),
            exits: queryTable(db, "SELECT * FROM exits"),
            nearby: queryTable(db, "SELECT * FROM nearby_transfers")
        };

        return tables;

    } catch (error) {
        console.error('数据库加载失败:', error);
        throw error;
    }
};

export { loadDatabase, toObj, queryTable };