import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, defer, from, switchMap, throwError } from 'rxjs';
import { CctvService } from '../services/cctv.service';
import { AuthSessionService } from '../services/auth-session.service';
import { environment } from '../../environments/environment';

const isApiCall = (url: string) => url.startsWith(environment.apiUrl) || url.startsWith('/api');
// Login/refresh/logout endpoints don't use the bearer token and must never trigger a refresh
const isAuthEndpoint = (url: string) => /\/auth\/(keycloak-login|login|refresh|logout)\b/.test(url);

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/** Adds the bearer token; renews it first when it has expired (e.g. tab was asleep). */
export const bearerInterceptor: HttpInterceptorFn = (req, next) => {
    const session = inject(AuthSessionService);
    if (!isApiCall(req.url) || isAuthEndpoint(req.url) || req.headers.has('Authorization')) {
        return next(req);
    }
    if (session.token || session.sessionLost) {
        return next(withToken(req, session.token));
    }
    return defer(() => from(session.ensureValidToken())).pipe(
        switchMap(() => next(withToken(req, session.token)))
    );
};

/** On 401: refresh the token once and retry; log out only when the session can't be renewed. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const cctvService = inject(CctvService);
    const session = inject(AuthSessionService);
    const router = inject(Router);

    const logout = () => {
        console.warn('Session expired. Logging out...');
        cctvService.clearAuth();
        session.clear();
        router.navigate(['/login']);
    };

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status !== 401 || !isApiCall(req.url) || isAuthEndpoint(req.url)) {
                return throwError(() => error);
            }
            if (session.sessionLost) {
                logout();
                return throwError(() => error);
            }
            return from(session.refresh()).pipe(
                switchMap((ok) => {
                    if (!ok) {
                        // Refresh token rejected -> log out. Still present -> temporary server/network problem, keep the session.
                        if (session.sessionLost) logout();
                        return throwError(() => error);
                    }
                    // Retry once with the new token; a second 401 is passed on without another refresh
                    return next(withToken(req, session.token)).pipe(
                        catchError((retryError: HttpErrorResponse) => {
                            if (retryError.status === 401) logout();
                            return throwError(() => retryError);
                        })
                    );
                })
            );
        })
    );
};
