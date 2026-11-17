import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../environments/environment';

// Renew the access token this long before it expires
const REFRESH_BEFORE_EXPIRY_MS = 60 * 1000;
// Never schedule refreshes closer together than this (protects against very short token lifespans)
const MIN_REFRESH_DELAY_MS = 10 * 1000;

export interface TokenResponse {
    access_token: string;
    id_token?: string;
}

/**
 * Holds the access token issued by the backend's /auth/keycloak-login endpoint and keeps it fresh.
 * The browser never talks to Keycloak: refresh goes through the backend's /auth/refresh proxy.
 *
 * Nothing is written to localStorage/sessionStorage. The access token lives only in memory; the refresh
 * token lives in an HttpOnly cookie set by the backend, which JavaScript cannot read. After a page reload
 * the access token is recovered by calling /auth/refresh (the browser attaches the cookie).
 *
 * - A timer renews the access token shortly before it expires, so active users are never logged out.
 * - ensureValidToken() renews on demand (page reload, API call with an expired token).
 * - Concurrent refresh requests share a single call to the backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
    private zone = inject(NgZone);
    private refreshInFlight: Promise<boolean> | null = null;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    // In-memory only (never persisted)
    private accessToken: string | null = null;
    // Set once the backend says there is no usable session cookie; avoids pointless refresh calls until the next login
    private noSession = false;

    get token(): string | null {
        return this.readValid() ? this.accessToken : null;
    }

    /** True once the backend rejected the session cookie (or the user logged out). */
    get sessionLost(): boolean {
        return this.noSession;
    }

    /** True when the in-memory access token is valid. */
    get isAuthenticated(): boolean {
        return this.readValid() !== null;
    }

    get tokenParsed(): any {
        return this.readValid();
    }

    setTokens(tokens: TokenResponse): void {
        this.accessToken = tokens.access_token;
        this.noSession = false;
        this.scheduleRefresh();
    }

    clear(): void {
        this.accessToken = null;
        this.noSession = true;
        this.cancelRefreshTimer();
    }

    /** Ends the Keycloak session on the server (best effort; also clears the cookie), then clears the in-memory token. */
    async logout(): Promise<void> {
        this.clear();
        try {
            await fetch(`${environment.apiUrl}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch {
            // Server unreachable: the in-memory token is already gone
        }
    }

    /**
     * Makes sure a valid access token is available, refreshing it when it is missing, expired or about to expire.
     * Resolves false when the session cannot be restored (user must log in again).
     */
    async ensureValidToken(minValidityMs = 0): Promise<boolean> {
        const payload = this.readValid();
        if (payload && (!payload.exp || payload.exp * 1000 - Date.now() > minValidityMs)) return true;
        if (this.noSession) return false;
        return this.refresh();
    }

    /** Asks the backend for a new access token using the HttpOnly cookie. Concurrent callers share one request. */
    refresh(): Promise<boolean> {
        if (!this.refreshInFlight) {
            this.refreshInFlight = this.doRefresh().finally(() => { this.refreshInFlight = null; });
        }
        return this.refreshInFlight;
    }

    getRole(): string {
        const roles = this.tokenParsed?.resource_access?.[environment.keycloak.clientId]?.roles;
        return roles && roles.length > 0 ? roles[0] : 'VIEWER';
    }

    /** Profile fields taken from the token claims (used when the backend profile call fails). */
    getProfileFromToken() {
        const t = this.tokenParsed;
        return {
            keycloakId: t?.sub || '',
            firstName: t?.given_name || '',
            lastName: t?.family_name || '',
            email: t?.email || '',
            mobileNo: '',
            role: this.getRole()
        };
    }

    private async doRefresh(): Promise<boolean> {
        try {
            // The refresh token is in an HttpOnly cookie; the browser attaches it
            const response = await fetch(`${environment.apiUrl}/auth/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            if (response.status === 401 || response.status === 400) {
                // No/invalid session cookie (expired, session ended, user disabled)
                this.clear();
                return false;
            }
            if (!response.ok) return false; // Server/Keycloak temporarily down: keep state, retry later
            this.setTokens(await response.json());
            return true;
        } catch (err) {
            console.warn('Token refresh failed (network):', err);
            return false;
        }
    }

    /** Schedules a background refresh shortly before the access token expires. */
    private scheduleRefresh(): void {
        this.cancelRefreshTimer();
        const token = this.accessToken;
        if (!token) return;

        const exp = this.decode(token)?.exp;
        if (!exp) return;
        const delay = Math.max(exp * 1000 - Date.now() - REFRESH_BEFORE_EXPIRY_MS, MIN_REFRESH_DELAY_MS);

        // Run outside Angular so the pending timer doesn't keep change detection / stability waiting
        this.zone.runOutsideAngular(() => {
            this.refreshTimer = setTimeout(async () => {
                const ok = await this.refresh();
                // Temporary failure (network/server down): try again shortly unless the session was rejected
                if (!ok && !this.noSession) {
                    this.refreshTimer = setTimeout(() => this.scheduleRefresh(), 30 * 1000);
                }
            }, delay);
        });
    }

    private cancelRefreshTimer(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    private decode(token: string): any {
        try {
            return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        } catch {
            return null;
        }
    }

    /** Decoded access token, or null when missing, malformed or expired. */
    private readValid(): any {
        const token = this.accessToken;
        if (!token) return null;
        const payload = this.decode(token);
        if (!payload) return null;
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        return payload;
    }
}
