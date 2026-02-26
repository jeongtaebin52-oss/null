export function canPublishMore(params: { liveCount: number; maxLive: number }) {
  return params.liveCount < params.maxLive;
}

export function isExpired(params: { expiresAt: Date | null; now?: Date }) {
  if (!params.expiresAt) {
    return false;
  }
  const now = params.now ?? new Date();
  return params.expiresAt.getTime() <= now.getTime();
}
