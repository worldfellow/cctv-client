import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

const ACCESS_KEY = 'kc_token';
const REFRESH_KEY = 'kc_refreshToken';
const ID_KEY = 'kc_idToken';

export interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
}

/**
 * Holds the tokens issued by the backend's /auth/keycloak-login endpoint.
 * The browser never talks to Keycloak; the token is only decoded locally.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
    get token(): string | null {
        return this.readValid() ? localStorage.getItem(ACCESS_KEY) : null;
    }

    get isAuthenticated(): boolean {
        return this.readValid() !== null;
    }

    get tokenParsed(): any {
        return this.readValid();
    }

    setTokens(tokens: TokenResponse): void {
        localStorage.setItem(ACCESS_KEY, tokens.access_token);
        if (tokens.refresh_token) localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
        if (tokens.id_token) localStorage.setItem(ID_KEY, tokens.id_token);
    }

    clear(): void {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(ID_KEY);
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

    /** Decoded access token, or null when missing, malformed or expired. */
    private readValid(): any {
        try {
            const token = localStorage.getItem(ACCESS_KEY);
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.exp && payload.exp * 1000 < Date.now()) return null;
            return payload;
        } catch {
            return null;
        }
    }
}
