import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const MAX_FAILED_ATTEMPTS = 5;

// Failed-call counters live in memory only, so a page refresh gives every API its five attempts again.
const failures = new Map<string, number>();

const isApi = (url: string) => url.startsWith(environment.apiUrl) || url.startsWith('/api');
// Server/network problems count; 4xx (validation, permission, expired session) do not,
// so a user correcting a form is never locked out.
const countsAsFailure = (e: HttpErrorResponse) => e.status === 0 || e.status >= 500 || e.status === 429;

/**
 * Stops hammering an endpoint that keeps failing: after five failed calls to the same API (file
 * uploads/downloads included) further calls are refused immediately, until the page is refreshed.
 * A successful call resets that API's counter.
 */
export const retryLimitInterceptor: HttpInterceptorFn = (req, next) => {
    if (!isApi(req.url)) return next(req);
    const key = `${req.method} ${req.url.split('?')[0]}`;

    if ((failures.get(key) ?? 0) >= MAX_FAILED_ATTEMPTS) {
        return throwError(() => new HttpErrorResponse({
            status: 429,
            statusText: 'Too Many Failed Attempts',
            url: req.url,
            error: { message: 'This request failed 5 times. Please refresh the page to try again.', clientBlocked: true, retryAfter: 30 }
        }));
    }

    return next(req).pipe(
        tap({ next: event => { if ((event as any).type === 4) failures.delete(key); } }), // HttpEventType.Response
        catchError((error: HttpErrorResponse) => {
            if (countsAsFailure(error)) failures.set(key, (failures.get(key) ?? 0) + 1);
            return throwError(() => error);
        })
    );
};
