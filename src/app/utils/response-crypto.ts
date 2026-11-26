import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';

// Counterpart of cctv-server/src/middleware/responseEncryption.js
// Wire format: { encrypted: base64( iv[16] | ciphertext | hmac[32] ) }
const encKey = CryptoJS.SHA256(environment.responseKey);
const macKey = CryptoJS.SHA256('mac:' + environment.responseKey);

export const isEncryptedPayload = (body: unknown): body is { encrypted: string } =>
    !!body && typeof body === 'object' && typeof (body as any).encrypted === 'string' && Object.keys(body as object).length === 1;

export function decryptPayload<T = any>(encrypted: string): T {
    const all = CryptoJS.enc.Base64.parse(encrypted);
    const words = all.words;
    const total = all.sigBytes;
    const slice = (from: number, to: number) =>
        CryptoJS.lib.WordArray.create(
            // byte-aligned slice (all offsets here are multiples of 4 except the tail, handled via sigBytes)
            words.slice(from / 4, Math.ceil(to / 4)), to - from);

    const iv = slice(0, 16);
    const mac = slice(total - 32, total);
    const body = slice(16, total - 32);

    const expected = CryptoJS.HmacSHA256(iv.clone().concat(body.clone()), macKey);
    if (expected.toString() !== mac.toString()) throw new Error('Response integrity check failed');

    const plain = CryptoJS.AES.decrypt({ ciphertext: body } as any, encKey, {
        iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
    });
    return JSON.parse(plain.toString(CryptoJS.enc.Utf8));
}

/** Reads a fetch() response body as JSON, decrypting it when the server encrypted it. */
export async function readJson<T = any>(response: Response): Promise<T> {
    const body = await response.json();
    return isEncryptedPayload(body) ? decryptPayload<T>(body.encrypted) : body;
}

// --- Request envelope (counterpart of cctv-server/src/middleware/requestGateway.js) ---
const reqEncKey = CryptoJS.SHA256('req-enc:' + environment.responseKey);
const reqMacKey = CryptoJS.SHA256('req-mac:' + environment.responseKey);

export function encryptRequest(payload: unknown): string {
    const iv = CryptoJS.lib.WordArray.random(16);
    const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(payload), reqEncKey, {
        iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
    }).ciphertext;
    const mac = CryptoJS.HmacSHA256(iv.clone().concat(ciphertext.clone()), reqMacKey);
    return iv.clone().concat(ciphertext).concat(mac).toString(CryptoJS.enc.Base64);
}

/** fetch() through the encrypted gateway (used for login/refresh/logout, which bypass HttpClient). */
export function gatewayFetch(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`${environment.apiUrl}/gw`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted: encryptRequest({ m: method, u: '/api' + path, b: body ?? null, t: Date.now() }) })
    });
}
