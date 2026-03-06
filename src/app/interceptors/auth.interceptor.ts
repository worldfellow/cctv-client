import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { CctvService } from '../services/cctv.service';
import Keycloak from 'keycloak-js';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const cctvService = inject(CctvService);
    const keycloak = inject(Keycloak);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                console.warn('Unauthorized access detected (401). Logging out...');

                // Clear local storage and service state
                cctvService.clearAuth();
                localStorage.removeItem('kc_token');
                localStorage.removeItem('kc_refreshToken');
                localStorage.removeItem('kc_idToken');

                // Trigger Keycloak logout
                keycloak.logout({
                    redirectUri: window.location.origin + '/login'
                });
            }
            return throwError(() => error);
        })
    );
};
