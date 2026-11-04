export function formatRelativeTime(modifiedAt: number, currentTime: number): string {
  if (!Number.isFinite(modifiedAt) || modifiedAt <= 0) return 'Unknown time';
  const modifiedDate = new Date(modifiedAt);
  const today = new Date(currentTime);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (modifiedAt >= today.getTime()) {
    const minutes = Math.max(0, Math.floor((currentTime - modifiedAt) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} hr ago`;
  }
  if (modifiedAt >= yesterday.getTime()) return 'Yesterday';
  const modifiedDay = new Date(modifiedAt);
  modifiedDay.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - modifiedDay.getTime()) / 86400000);
  if (days < 7) return `${days} days ago`;
  return modifiedDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(modifiedDate.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}
