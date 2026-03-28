import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

declare var lucide: any;

@Injectable({
    providedIn: 'root'
})
export class IconService {
    private refreshSubject = new Subject<void>();

    constructor(private ngZone: NgZone) {
        // Use debouncing to batch multiple refresh requests into one execution
        this.refreshSubject.pipe(
            debounceTime(50)
        ).subscribe(() => {
            this.executeRefresh();
        });
    }

    /**
     * Request an icon refresh. Multiple calls within 50ms will be batched.
     */
    refreshIcons() {
        this.refreshSubject.next();
    }

    private executeRefresh() {
        this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
                if (typeof lucide !== 'undefined') {
                    try {
                        // PRE-CLEANUP: Remove orphaned Lucide SVGs.
                        // When lucide replaces <i> with <svg>, Angular's *ngIf loses
                        // track of the node. On re-render, Angular creates a new <i>
                        // but orphaned <svg>s stay. Remove them before creating new ones.
                        const pendingIcons = document.querySelectorAll('i[data-lucide]');
                        pendingIcons.forEach(icon => {
                            const parent = icon.parentElement;
                            if (parent) {
                                // Remove ALL lucide SVGs from the parent to prevent duplicates
                                // when toggling between two different icon names (e.g., eye/eye-off)
                                parent.querySelectorAll('svg.lucide').forEach(svg => svg.remove());
                            }
                        });

                        // Create fresh icons from all pending <i data-lucide> elements
                        lucide.createIcons();

                        // POST-CLEANUP: Some Lucide CDN versions leave the original <i>
                        // alongside the new <svg>. Remove leftover <i> tags so the next
                        // call doesn't create yet another SVG from the same placeholder.
                        const leftoverIcons = document.querySelectorAll('i[data-lucide]');
                        leftoverIcons.forEach(icon => {
                            const parent = icon.parentElement;
                            const iconName = icon.getAttribute('data-lucide');
                            if (parent && iconName) {
                                const hasSvg = parent.querySelector(`svg.lucide-${iconName}`);
                                if (hasSvg) {
                                    icon.remove();
                                }
                            }
                        });
                    } catch (error) {
                        console.error('Error refreshing Lucide icons:', error);
                    }
                }
            }, 0);
        });
    }
}
