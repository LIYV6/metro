// ==================== 方向切换控制器 ====================
import { drawMainLine } from '../rendering/canvasRenderer.js';

/**
 * 选择方向
 * 更新方向按钮状态并渲染对应方向的站点
 * @param {string} selectorId - 选择器ID
 * @param {string} direction - 方向 ('forward' | 'reverse')
 * @param {number} groupIndex - 组索引
 * @param {number} branchIndex - 分支索引
 */
const selectDirection = (selectorId, direction, groupIndex, branchIndex) => {
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
        requestAnimationFrame(() => drawMainLine(forwardList));
    } else {
        buttons[1].classList.add('active');
        forwardList.classList.add('hidden');
        reverseList.classList.remove('hidden');
        requestAnimationFrame(() => drawMainLine(reverseList));
    }
};

export { selectDirection };