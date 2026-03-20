import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CctvService } from '../../services/cctv.service';
import { IconService } from '../../services/icon.service';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-screenshot-gallery',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './screenshot-gallery.component.html',
    styleUrl: './screenshot-gallery.component.scss'
})
export class ScreenshotGalleryComponent implements OnInit, OnDestroy, AfterViewInit {
    screenshots: any[] = [];
    filteredScreenshots: any[] = [];
    isLoading: boolean = true;
    searchTerm: string = '';

    // Pagination
    currentPage: number = 1;
    totalPages: number = 1;
    totalItems: number = 0;
    pageSize: number = 10;

    // Advanced Filters
    filterCollege: string = '';
    filterStartDate: string = '';
    filterEndDate: string = '';
    filterCameraName: string = '';

    colleges: any[] = [];
    selectedScreenshot: any | null = null;
    serverBaseUrl: string = environment.apiUrl;
    protected Math = Math;

    // Selection State
    selectedScreenshotIds: Set<string> = new Set();
    isDeleting: boolean = false;
    showDeleteConfirmModal: boolean = false;
    showDeleteErrorModal: boolean = false;
    deleteErrorMessage: string = '';

    private destroy$ = new Subject<void>();
    private filterSubject = new Subject<void>();

    constructor(
        private cctvService: CctvService,
        private http: HttpClient,
        private iconService: IconService
    ) { }

    ngOnInit(): void {
        this.loadColleges();
        this.loadScreenshots();

        // Setup debounced filtering
        this.filterSubject.pipe(
            debounceTime(400),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.loadScreenshots(1);
        });
    }

    loadColleges(): void {
        this.cctvService.getAllActiveColleges().pipe(takeUntil(this.destroy$)).subscribe({
            next: (data) => {
                this.colleges = data;
            },
            error: (err) => {
                console.error('Failed to load colleges:', err);
            }
        });
    }

    ngAfterViewInit(): void {
        this.refreshIcons();
    }

    ngOnDestroy(): void {
        this.toggleBodyClass(false); // Cleanup on navigate away
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadScreenshots(page: number = 1): void {
        this.isLoading = true;
        this.currentPage = page;

        const params = {
            page: this.currentPage,
            limit: this.pageSize,
            collegeName: this.filterCollege,
            cameraName: this.filterCameraName,
            startDate: this.filterStartDate,
            endDate: this.filterEndDate
        };

        this.cctvService.getScreenshots(params)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (res) => {
                    this.screenshots = res.screenshots;
                    this.filteredScreenshots = res.screenshots; // Direct mapping since server filters
                    this.totalItems = res.totalItems;
                    this.totalPages = res.totalPages;
                    this.currentPage = res.currentPage;

                    this.isLoading = false;
                    this.refreshIcons();
                },
                error: (err) => {
                    console.error('Failed to load screenshots:', err);
                    this.isLoading = false;
                }
            });
    }

    filterScreenshots(): void {
        // Reset to first page and trigger debounced load
        this.filterSubject.next();
    }

    changePage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.loadScreenshots(page);
        }
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.filterCollege = '';
        this.filterStartDate = '';
        this.filterEndDate = '';
        this.filterCameraName = '';
        this.filterScreenshots();
    }

    openLightbox(screenshot: any): void {
        this.selectedScreenshot = screenshot;
        this.toggleBodyClass(true);
    }

    closeLightbox(): void {
        this.selectedScreenshot = null;
        this.toggleBodyClass(false);
    }

    getFullImageUrl(path: string): string {
        return `${this.serverBaseUrl}${path}`;
    }

    triggerDownload(url: string): void {
        // Use HttpClient to fetch as blob to avoid navigation
        this.http.get(url, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                const fileName = url.split('/').pop() || 'screenshot.png';
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            },
            error: (err) => {
                console.error('Failed to download image:', err);
                // Fallback to direct link if blob fails (might be CORS issue)
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank'; // Use _blank as fallback to avoid current page navigation
                const fileName = url.split('/').pop() || 'screenshot.png';
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    }

    // Selection Methods
    toggleSelection(event: Event, id: string): void {
        event.stopPropagation();
        const newSelection = new Set(this.selectedScreenshotIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        this.selectedScreenshotIds = newSelection;
    }

    isAllSelected(): boolean {
        return this.filteredScreenshots.length > 0 &&
            this.filteredScreenshots.every(s => this.selectedScreenshotIds.has(s.id));
    }

    toggleSelectAll(): void {
        const newSelection = new Set(this.selectedScreenshotIds);
        if (this.isAllSelected()) {
            this.filteredScreenshots.forEach(s => newSelection.delete(s.id));
        } else {
            this.filteredScreenshots.forEach(s => newSelection.add(s.id));
        }
        this.selectedScreenshotIds = newSelection;
    }

    clearSelection(): void {
        this.selectedScreenshotIds = new Set();
    }

    deleteSelectedParams() {
        if (this.selectedScreenshotIds.size === 0) return;
        this.deleteErrorMessage = '';
        this.showDeleteConfirmModal = true;
        this.toggleBodyClass(true);
        setTimeout(() => this.refreshIcons(), 0);
    }

    cancelDelete() {
        this.showDeleteConfirmModal = false;
        this.toggleBodyClass(false);
    }

    confirmDelete() {
        this.isDeleting = true;
        this.deleteErrorMessage = '';
        const idsToDelete = Array.from(this.selectedScreenshotIds);

        this.cctvService.deleteScreenshots(idsToDelete).pipe(takeUntil(this.destroy$)).subscribe({
            next: (res) => {
                this.isDeleting = false;
                this.showDeleteConfirmModal = false;
                this.selectedScreenshotIds = new Set();
                this.toggleBodyClass(false);
                this.loadScreenshots(this.currentPage);
            },
            error: (err) => {
                console.error('Failed to delete screenshots', err);
                this.isDeleting = false;
                this.deleteErrorMessage = err.error?.message || 'Failed to delete some or all selected screenshots. Please try again.';
                // Keep showDeleteConfirmModal = true
                setTimeout(() => this.refreshIcons(), 0);
            }
        });
    }

    closeErrorModal() {
        this.showDeleteErrorModal = false;
        this.toggleBodyClass(false);
    }

    private toggleBodyClass(isOpen: boolean) {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }

    hasActionAccess(actionId: string): boolean {
        const user = this.cctvService.userDetails;
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return user.permissions?.actions?.includes(actionId) || false;
    }

    private refreshIcons() {
        this.iconService.refreshIcons();
    }

    trackByCollegeName(index: number, college: any): string { return college.name; }
    trackByScreenshotId(index: number, s: any): string { return s.id || s._id; }
    trackByIndex(index: number): number { return index; }
}
