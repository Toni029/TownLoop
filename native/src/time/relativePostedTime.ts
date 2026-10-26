/** Elapsed time from original submission; never use an update/completion timestamp. */
export function relativePostedTime(createdAt: number, now = Date.now(), recent = 'Just listed'): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 'Date unavailable';
  const elapsed = Math.max(0, now - createdAt), hour = 3_600_000, day = 24 * hour;
  if (elapsed < hour) return recent;
  if (elapsed <= 12 * hour) {
    const hours = Math.floor(elapsed / hour);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (elapsed < day) return 'Posted today';
  if (elapsed < 2 * day) return 'Posted yesterday';
  const days = Math.floor(elapsed / day);
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Posted a week ago' : `Posted ${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? 'Posted a month ago' : `Posted ${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? 'Posted a year ago' : `Posted ${years} years ago`;
}
