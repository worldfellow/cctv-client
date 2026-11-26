import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { encryptRequest } from '../utils/response-crypto';

// Requests the browser makes directly: static uploads and the video stream
const DIRECT = /\/(uploads|stream)(\/|\?|$)/;

const toBase64 = (file: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
});

/** Turns a FormData body into text fields plus base64 files, so it can travel inside the encrypted envelope. */
async function serializeForm(form: FormData) {
    const fields: Record<string, string> = {};
    const files: { field: string; name: string; type: string; data: string }[] = [];
    for (const [key, value] of Array.from((form as any).entries()) as [string, FormDataEntryValue][]) {
        if (typeof value === 'string') fields[key] = value;
        else files.push({ field: key, name: value.name, type: value.type, data: await toBase64(value) });
    }
    return { fields, files };
}

/**
 * Wraps every API call into `POST /api/gw` with an encrypted body, so the network tab shows neither
 * endpoint names, query parameters, request bodies nor uploaded files.
 * The server unwraps it (middleware/requestGateway.js).
 */
export const gatewayInterceptor: HttpInterceptorFn = (req, next) => {
    const isApi = req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');
    if (!isApi || DIRECT.test(req.url) || req.url.startsWith(`${environment.apiUrl}/gw`)) return next(req);
    if (req.body instanceof Blob || req.body instanceof ArrayBuffer) return next(req);

    const base = req.url.startsWith(environment.apiUrl) ? environment.apiUrl : '/api';
    const query = req.params.toString();
    const path = '/api' + req.url.slice(base.length) + (query ? (req.url.includes('?') ? '&' : '?') + query : '');

    const send = (body: unknown, files?: unknown[]) => next(req.clone({
        method: 'POST',
        url: `${environment.apiUrl}/gw`,
        params: undefined,
        body: { encrypted: encryptRequest({ m: req.method, u: path, b: body ?? null, t: Date.now(), ...(files ? { f: files } : {}) }) }
    }));

    if (req.body instanceof FormData) {
        return from(serializeForm(req.body)).pipe(switchMap(({ fields, files }) => send(fields, files)));
    }
    return send(req.body);
};
