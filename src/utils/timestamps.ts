export function getTimestampMillis(ts: any): number {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

export function formatTimestamp(ts: any): string {
  if (!ts) return 'Just now';
  let d: Date;
  if (typeof ts.toDate === 'function') {
    d = ts.toDate();
  } else if (ts instanceof Date) {
    d = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    d = new Date(ts);
  } else {
    return 'Just now';
  }
  if (!Number.isFinite(d.getTime())) return 'Just now';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

