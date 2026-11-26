import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { redirectToRateLimit, retryAfterSeconds } from '../utils/rate-limit-redirect';

/** On HTTP 429 (server rate limit, or the client's five-failures limit) go straight to the countdown page. */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) =>
    next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 429) {
                redirectToRateLimit(retryAfterSeconds(error.error, error.headers?.get('Retry-After')), undefined, !!error.error?.clientBlocked);
            }
            return throwError(() => error);
        })
    );
