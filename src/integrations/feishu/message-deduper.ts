export class FeishuMessageDeduper {
  private readonly ttlMs: number;
  private readonly seen = new Map<string, number>();

  constructor(ttlMs = 5 * 60_000) {
    this.ttlMs = ttlMs;
  }

  shouldProcess(messageId?: string): boolean {
    if (!messageId) {
      return true;
    }

    const now = Date.now();
    this.prune(now);
    const previous = this.seen.get(messageId);
    if (previous && previous > now) {
      return false;
    }

    this.seen.set(messageId, now + this.ttlMs);
    return true;
  }

  private prune(now: number): void {
    for (const [messageId, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(messageId);
      }
    }
  }
}
