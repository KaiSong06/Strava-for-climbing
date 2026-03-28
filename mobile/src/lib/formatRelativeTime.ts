export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just Now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return '1 Minute Ago';
  if (diffMin < 60) return `${diffMin} Minutes Ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 Hour Ago';
  if (diffHr < 24) return `${diffHr} Hours Ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} Days Ago`;
  return new Date(isoString).toLocaleDateString();
}
