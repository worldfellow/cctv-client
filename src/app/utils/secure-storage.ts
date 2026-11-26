import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';

/** localStorage wrapper: both the stored value and its key name are encrypted, so the Application tab shows only ciphertext. */
const secret = CryptoJS.SHA256('storage:' + environment.responseKey);

const mask = (name: string) => CryptoJS.SHA256('k:' + name + environment.responseKey).toString().slice(0, 12);

export const secureStorage = {
    get(name: string): string | null {
        try {
            const raw = localStorage.getItem(mask(name));
            if (!raw) return null;
            const all = CryptoJS.enc.Base64.parse(raw); // iv[16] | ciphertext
            const iv = CryptoJS.lib.WordArray.create(all.words.slice(0, 4), 16);
            const ciphertext = CryptoJS.lib.WordArray.create(all.words.slice(4), all.sigBytes - 16);
            const value = CryptoJS.AES.decrypt({ ciphertext } as any, secret, { iv }).toString(CryptoJS.enc.Utf8);
            return value || null;
        } catch { return null; }
    },
    set(name: string, value: string): void {
        try {
            const iv = CryptoJS.lib.WordArray.random(16);
            const ciphertext = CryptoJS.AES.encrypt(value, secret, { iv }).ciphertext;
            localStorage.setItem(mask(name), iv.clone().concat(ciphertext).toString(CryptoJS.enc.Base64));
            localStorage.removeItem('theme'); // old plaintext key
        } catch { /* storage unavailable */ }
    }
};
