import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CctvCardComponent, CctvFeed } from '../cctv-card/cctv-card.component';
import { CctvViewerComponent } from '../cctv-viewer/cctv-viewer.component';
import { CctvService, College } from '../../services/cctv.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { IconService } from '../../services/icon.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CctvCardComponent, CctvViewerComponent, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  feeds: CctvFeed[] = [];
  selectedFeed: CctvFeed | null = null;
  isLoading: boolean = true;
  selectedCollegeId: string = '';

  // Pagination and Limit
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  totalPages: number = 1;
  limitOptions: number[] = [10, 15, 20];

  stats: { total: number; active: number; offline: number } = { total: 0, active: 0, offline: 0 };

  colleges: College[] = [];
  filteredColleges: College[] = [];
  collegeSearchQuery: string = '';
  showCollegeDropdown: boolean = false;
  selectedCollegeName: string = 'Select College';

  private destroy$ = new Subject<void>();

  Math = Math;

  constructor(
    private cctvService: CctvService,
    private cdr: ChangeDetectorRef,
    private iconService: IconService
  ) { }

  ngOnInit(): void {
    this.loadColleges();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadColleges(): void {
    this.cctvService.getAllActiveColleges().pipe(takeUntil(this.destroy$)).subscribe({
      next: (colleges) => {
        const user = this.cctvService.userDetails;

        if (user && user.role !== 'SUPER_ADMIN') {
          const allowed = user.allowedColleges || [];
          if (allowed.includes('ALL')) {
            this.colleges = colleges;
          } else {
            this.colleges = colleges.filter(c => allowed.includes(c.id));
          }
        } else {
          this.colleges = colleges;
        }

        this.filteredColleges = this.colleges;

        if (this.colleges.length === 0) {
          this.isLoading = false;
          this.refreshIcons();
          return;
        }

        if (this.colleges.length > 0 && !this.selectedCollegeId) {
          this.selectCollege(this.colleges[0]);
        } else if (this.selectedCollegeId) {
          const selected = this.colleges.find(c => c.id === this.selectedCollegeId);
          if (selected) {
            this.selectedCollegeName = selected.name;
            this.loadStats(); // Load stats if college already selected
          }
        }
      },
      error: (err) => {
        console.error('Error loading colleges:', err);
        this.isLoading = false;
        this.refreshIcons();
      }
    });
  }

  loadStats(): void {
    if (!this.selectedCollegeId) return;

    this.cctvService.getDashboardStats(this.selectedCollegeId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.refreshIcons();
      },
      error: (err) => console.error('Error loading stats:', err)
    });
  }

  filterColleges(): void {
    if (!this.collegeSearchQuery) {
      this.filteredColleges = this.colleges;
    } else {
      const query = this.collegeSearchQuery.toLowerCase();
      this.filteredColleges = this.colleges.filter(c =>
        c.name.toLowerCase().includes(query)
      );
    }
  }

  selectCollege(college: College): void {
    this.selectedCollegeId = college.id;
    this.selectedCollegeName = college.name;
    this.showCollegeDropdown = false;
    this.collegeSearchQuery = '';
    this.filteredColleges = this.colleges;
    this.currentPage = 1;
    this.loadStats();
    this.loadFeeds();
  }

  loadFeeds(): void {
    if (!this.selectedCollegeId) return;

    this.isLoading = true;
    this.cctvService.getDashboardFeeds(this.selectedCollegeId, this.currentPage, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.feeds = response.data.map((feed: any) => ({
            id: feed.id,
            name: feed.name || 'Unknown Camera',
            location: feed.location || 'Unknown Location',
            status: feed.status ? feed.status.toLowerCase() as 'online' | 'offline' : 'offline',
            thumbnail: feed.thumbnail || 'assets/placeholder-camera.png',
            streamUrl: feed.streamUrl,
            wsUrl: feed.wsUrl
          }));
          this.totalItems = response.total;
          this.totalPages = response.totalPages;
          this.isLoading = false;
          this.refreshIcons();
        },
        error: (err) => {
          console.error('Error loading feeds:', err);
          this.isLoading = false;
          this.feeds = [];
          this.refreshIcons();
        }
      });
  }

  toggleCollegeDropdown(): void {
    this.showCollegeDropdown = !this.showCollegeDropdown;
    if (this.showCollegeDropdown) {
      setTimeout(() => {
        const input = document.querySelector('.college-search-input') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    }
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.showCollegeDropdown = false;
  }

  onLimitChange(limit: number): void {
    this.pageSize = limit;
    this.currentPage = 1;
    this.loadFeeds();
  }

  resetLimit(): void {
    this.pageSize = 10;
    this.currentPage = 1;
    this.loadFeeds();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadFeeds();
    }
  }

  ngAfterViewInit(): void {
    this.refreshIcons();
  }

  refreshIcons(): void {
    this.iconService.refreshIcons();
  }

  onViewDetail(feed: CctvFeed): void {
    if (feed.status !== 'online') return;

    // Call server to ensure high quality stream is started
    this.cctvService.startCameraStream(feed.id, 'high').pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        // Create a copy of feed with the high-quality wsUrl
        this.selectedFeed = { ...feed, wsUrl: res.wsUrl };
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to start high quality stream:', err);
        // Fallback to existing wsUrl if any
        this.selectedFeed = feed;
        this.cdr.detectChanges();
      }
    });
  }

  onCloseViewer(): void {
    this.selectedFeed = null;
  }

  trackByCollegeId(index: number, college: any): string { return college.id; }
  trackByFeedId(index: number, feed: any): string { return feed.id; }
  trackByIdentity(index: number, item: any): any { return item; }
}
