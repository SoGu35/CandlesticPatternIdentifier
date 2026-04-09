// US market holidays (extend as needed)
export const US_MARKET_HOLIDAYS = new Set([
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29',
  '2024-05-27', '2024-06-19', '2024-07-04', '2024-09-02',
  '2024-11-28', '2024-11-29', '2024-12-25',
  '2025-01-01', '2025-01-09', '2025-01-20', '2025-02-17',
  '2025-04-18', '2025-05-26', '2025-06-19', '2025-07-04',
  '2025-09-01', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
]);

function secondSundayOfMarch(year: number): Date {
  const march1 = new Date(Date.UTC(year, 2, 1));
  const dow = march1.getUTCDay();
  const firstSunday = dow === 0 ? 1 : 8 - dow;
  return new Date(Date.UTC(year, 2, firstSunday + 7));
}

function firstSundayOfNovember(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const dow = nov1.getUTCDay();
  const firstSunday = dow === 0 ? 1 : 8 - dow;
  return new Date(Date.UTC(year, 10, firstSunday));
}

export function isEasternDST(date: Date): boolean {
  const year = date.getUTCFullYear();
  return date >= secondSundayOfMarch(year) && date < firstSundayOfNovember(year);
}

export interface TradingDayBounds {
  start: string;  // ISO with Z (market open in UTC)
  end: string;    // ISO with Z (market close in UTC)
  label: string;  // 'YYYY-MM-DD'
}

/**
 * Returns the regular-session UTC bounds for a given calendar date.
 * Handles DST: 13:30–20:00 UTC during EDT, 14:30–21:00 during EST.
 */
export function tradingDayBounds(date: Date): TradingDayBounds {
  const dateStr = date.toISOString().slice(0, 10);
  const dst = isEasternDST(date);
  const open = dst ? 'T13:30:00Z' : 'T14:30:00Z';
  const close = dst ? 'T20:00:00Z' : 'T21:00:00Z';
  return { start: `${dateStr}${open}`, end: `${dateStr}${close}`, label: dateStr };
}

export function isTradingDay(date: Date): boolean {
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !US_MARKET_HOLIDAYS.has(date.toISOString().slice(0, 10));
}

/**
 * Random past trading day within the last year (used by Practice mode).
 */
export function pickRandomTradingDay(): TradingDayBounds {
  const todayMs = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;

  for (let attempt = 0; attempt < 60; attempt++) {
    const offsetMs = Math.floor(Math.random() * (oneYearMs - 86400000)) + 86400000;
    const candidate = new Date(todayMs - offsetMs);
    if (!isTradingDay(candidate)) continue;
    return tradingDayBounds(candidate);
  }

  // Fallback to a known good date
  return { start: '2024-10-15T13:30:00Z', end: '2024-10-15T20:00:00Z', label: '2024-10-15' };
}

/**
 * Returns the most recent `count` completed US trading days, ending strictly
 * BEFORE today (so today's in-progress session isn't included). Sorted oldest
 * to newest.
 */
export function getRecentTradingDays(count: number): TradingDayBounds[] {
  const results: TradingDayBounds[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - 1); // start from yesterday

  // Safety bound: walk back at most ~3× count days to skip weekends/holidays
  for (let i = 0; results.length < count && i < count * 4 + 20; i++) {
    if (isTradingDay(cursor)) {
      results.push(tradingDayBounds(new Date(cursor)));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return results.reverse();
}
