/**
 * 기술적 지표 계산 (순수 함수).
 * 입력은 오래된 값 → 최신 값 순서의 종가 배열을 가정한다.
 * LLM 은 계산하지 않고, 여기서 계산한 값을 입력으로 받는다.
 */

/**
 * 단순 이동평균. 최근 window 개의 평균. 데이터가 부족하면 null.
 * @param {number[]} closes  오래된→최신
 * @param {number} window
 * @returns {number|null}
 */
export const movingAverage = (closes, window) => {
  if (window <= 0 || closes.length < window) return null;
  const slice = closes.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / window;
};

/**
 * 기간 수익률. 최근값 / period 이전값 - 1. 부족하면 null.
 * @param {number[]} closes
 * @param {number} period
 * @returns {number|null}
 */
export const periodReturn = (closes, period) => {
  if (period <= 0 || closes.length < period + 1) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - period];
  if (prev === 0) return null;
  return last / prev - 1;
};

/**
 * RSI (Wilder). 기본 14기간. 데이터 부족하면 null.
 * @param {number[]} closes
 * @param {number} [period=14]
 * @returns {number|null}
 */
export const rsi = (closes, period = 14) => {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  // 초기 평균
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  // Wilder 평활
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

/**
 * 일간 수익률의 표준편차(변동성). 부족하면 null.
 * @param {number[]} closes
 * @param {number} [window=20]
 * @returns {number|null}
 */
export const volatility = (closes, window = 20) => {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(-(window + 1));
  const rets = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] !== 0) rets.push(slice[i] / slice[i - 1] - 1);
  }
  if (rets.length === 0) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance);
};

/**
 * 최근 고점 대비 낙폭. 0 이하(예: -0.1 = -10%). 빈 배열이면 0.
 * @param {number[]} closes
 * @returns {number}
 */
export const drawdownFromHigh = (closes) => {
  if (closes.length === 0) return 0;
  const peak = Math.max(...closes);
  if (peak <= 0) return 0;
  const last = closes[closes.length - 1];
  return last / peak - 1;
};

/**
 * 종가 시계열에서 모든 기본 지표를 한 번에 계산한다.
 * @param {number[]} closes  오래된→최신
 */
export const computeIndicators = (closes) => ({
  ma_20: movingAverage(closes, 20),
  ma_60: movingAverage(closes, 60),
  ma_120: movingAverage(closes, 120),
  rsi: rsi(closes, 14),
  volatility: volatility(closes, 20),
  drawdown_from_high: drawdownFromHigh(closes),
  return_5d: periodReturn(closes, 5),
  return_20d: periodReturn(closes, 20),
  return_60d: periodReturn(closes, 60),
});
