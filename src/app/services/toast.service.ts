import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    toasts = signal<Toast[]>([]);

    show(message: string, type: ToastType = 'info', duration: number = 3000) {
        const id = Math.random().toString(36).substring(2, 9);
        const toast: Toast = { id, message, type };

        this.toasts.update(current => [...current, toast]);

        setTimeout(() => {
            this.remove(id);
        }, duration);
    }

    remove(id: string) {
        this.toasts.update(current => current.filter(t => t.id !== id));
    }
}
