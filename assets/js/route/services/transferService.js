// ==================== 换乘模型构建服务 ====================
import { isHighSpeedLine } from './highSpeedService.js';

/**
 * 构建站点换乘模型
 * 将站点的换乘信息按类型分类（普通、高铁、轮船、飞机）
 * @param {Object} station - 站点对象
 * @returns {Object} 包含各类换乘信息的对象
 */
const buildStationTransferModel = (station) => {
    let hasHighSpeed = false;
    let hasBoat = false;
    let hasAirplane = false;
    const normalTransfers = [];
    const highSpeedTransfers = [];
    const boatTransfers = [];
    const airTransfers = [];

    if (station.transfers && station.transfers.length > 0) {
        station.transfers.forEach(transfer => {
            // 先根据 mode 字段做显式判断（避免被名称推测误判为高铁）
            const modeText = String(transfer.mode || '').trim();
            if (modeText === 'BOAT') {
                hasBoat = true;
                boatTransfers.push(transfer);
            } else if (modeText === 'AIRPLANE') {
                hasAirplane = true;
                airTransfers.push(transfer);
            } else if (modeText === 'CABLE_CAR' || modeText === 'CABLECAT') {
                // 索道/缆车按普通换乘处理
                normalTransfers.push(transfer);
            } else {
                // mode 不明确时，用名称推测是否为高铁
                const isHighSpeed = (modeText === 'HIGH_SPEED') ||
                    (transfer.type === 'HIGH_SPEED') ||
                    isHighSpeedLine(transfer.nameCn, transfer.mode, transfer.type);

                if (isHighSpeed) {
                    hasHighSpeed = true;
                    highSpeedTransfers.push(transfer);
                } else {
                    normalTransfers.push(transfer);
                }
            }
        });
    }
    return {
        hasHighSpeed, hasBoat, hasAirplane,
        normalTransfers, highSpeedTransfers,
        boatTransfers, airTransfers
    };
};

export { buildStationTransferModel };