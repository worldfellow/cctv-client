/**
 * Sends the browser straight to the countdown page. A full redirect is used (instead of a router
 * navigation) so route guards or failing components can't override it.
 */
export function redirectToRateLimit(wait: number, back?: string, blocked = false): void {
    if (window.location.pathname.startsWith('/too-many-requests')) return;
    const target = back ?? (window.location.pathname + window.location.search);
    // Remember when the limit ends and where the user was, so a reload keeps the same countdown
    try { localStorage.setItem('rateLimit', JSON.stringify({ endAt: Date.now() + wait * 1000, back: target, blocked })); } catch { /* ignore */ }
    const params = new URLSearchParams({ wait: String(wait), back: target });
    if (blocked) params.set('blocked', '1');
    window.location.replace(`/too-many-requests?${params.toString()}`);
}

/** Seconds to wait from a 429 body or Retry-After header (defaults to 60). */
export function retryAfterSeconds(body: any, header: string | null | undefined): number {
    return Number(body?.retryAfter) || parseInt(header || '', 10) || 60;
}
