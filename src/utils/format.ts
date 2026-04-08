/**
 * Returns true if the given Unix timestamp (seconds) falls on today's date
 * in the user's local timezone.
 */
export function isDataToday(timestamp: number): boolean {
  const now = new Date();
  const bar = new Date(timestamp * 1000);
  return (
    bar.getFullYear() === now.getFullYear() &&
    bar.getMonth() === now.getMonth() &&
    bar.getDate() === now.getDate()
  );
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}

export function formatScore(score: number): string {
  const sign = score > 0 ? '+' : '';
  return `${sign}${score}`;
}
