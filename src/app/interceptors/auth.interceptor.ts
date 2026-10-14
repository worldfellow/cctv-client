import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { CctvService } from '../services/cctv.service';
import { AuthSessionService } from '../services/auth-session.service';
import { environment } from '../../environments/environment';

const isApiCall = (url: string) => url.startsWith(environment.apiUrl) || url.startsWith('/api');

export const bearerInterceptor: HttpInterceptorFn = (req, next) => {
    const token = inject(AuthSessionService).token;
    if (token && isApiCall(req.url) && !req.headers.has('Authorization')) {
        req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
    return next(req);
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const cctvService = inject(CctvService);
    const session = inject(AuthSessionService);
    const router = inject(Router);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                console.warn('Unauthorized access detected (401). Logging out...');
                cctvService.clearAuth();
                session.clear();
                router.navigate(['/login']);
            }
            return throwError(() => error);
        })
    );
};
