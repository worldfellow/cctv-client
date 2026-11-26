import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, throwError } from 'rxjs';
import { decryptPayload, isEncryptedPayload } from '../utils/response-crypto';

/** Decrypts JSON bodies (successes and errors) that the server encrypted. Blobs/other types pass through. */
export const decryptInterceptor: HttpInterceptorFn = (req, next) =>
    next(req).pipe(
        map(event => {
            if (event instanceof HttpResponse && isEncryptedPayload(event.body)) {
                return event.clone({ body: decryptPayload(event.body.encrypted) });
            }
            return event;
        }),
        catchError((error: HttpErrorResponse) => {
            if (isEncryptedPayload(error.error)) {
                let decrypted: unknown = error.error;
                try { decrypted = decryptPayload(error.error.encrypted); } catch { /* keep as is */ }
                return throwError(() => new HttpErrorResponse({
                    error: decrypted, headers: error.headers, status: error.status,
                    statusText: error.statusText, url: error.url ?? undefined
                }));
            }
            return throwError(() => error);
        })
    );
