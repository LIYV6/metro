// ==================== 文字-背景对比度工具 ====================
/**
 * 根据十六进制背景色计算合适的文字颜色（WCAG相对亮度标准）
 * @param {string} hexColor - 十六进制背景色，如 '#e60012'
 * @returns {{ text: string, shadow: string }} 文字颜色和对应的阴影颜色
 */
export const getContrastColors = (hexColor) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    const isLight = luminance > 0.179;
    return {
        text: isLight ? '#162033' : '#ffffff',
        shadow: isLight ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.5)'
    };
};

/**
 * 根据HSL值计算合适的文字颜色（WCAG相对亮度标准）
 * @param {number} h - 色相 (0-360)
 * @param {number} s - 饱和度 (0-100)
 * @param {number} l - 亮度 (0-100)
 * @returns {{ text: string, shadow: string }}
 */
export const getContrastColorsFromHSL = (h, s, l) => {
    const sNorm = s / 100;
    const lNorm = l / 100;
    const a = sNorm * Math.min(lNorm, 1 - lNorm);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        return lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const luminance = 0.2126 * toLinear(f(0)) + 0.7152 * toLinear(f(8)) + 0.0722 * toLinear(f(4));

    const isLight = luminance > 0.179;
    return {
        text: isLight ? '#162033' : '#ffffff',
        shadow: isLight ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.5)'
    };
};
