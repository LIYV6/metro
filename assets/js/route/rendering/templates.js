// ==================== 模板工具 / DOM 转义函数 ====================

/**
 * 转义 HTML 字符串，防止 XSS
 * @param {*} value - 要转义的值
 * @returns {string} 转义后的 HTML 安全字符串
 */
const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
};

/**
 * 转义 JavaScript 字符串，防止语法错误
 * @param {string} value - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
const escapeJsString = (value) => {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ')
        .replace(/\r/g, ' ');
};

export { escapeHtml, escapeJsString };