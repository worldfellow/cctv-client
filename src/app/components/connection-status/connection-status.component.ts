import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, Subscription, interval } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  CameraConnectivity, CctvService, CollegeConnectivity, ConnectivityJob, ConnectivityQuery, ConnectivitySummary
} from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';

type StatusFilter = 'all' | 'working' | 'partial' | 'down' | 'other';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './connection-status.component.html',
  styleUrl: './connection-status.component.scss'
})
export class ConnectionStatusComponent implements OnInit, OnDestroy {
  summary: ConnectivitySummary | null = null;
  colleges: CollegeConnectivity[] = [];
  isLoading = false;
  // Downloads in progress: 'excel' / 'pdf' for the whole list, '<collegeId>:<format>' per college
  exportingKeys = new Set<string>();

  // Filters & paging (all applied server-side)
  searchQuery = '';
  statusFilter: StatusFilter = 'all';
  sort = 'status';
  days = 7;
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Expanded college rows; cameras are loaded on demand
  expanded = new Set<string>();
  cameras = new Map<string, CameraConnectivity[]>();
  loadingCameras = new Set<string>();

  // Manual check progress
  activeJob: ConnectivityJob | null = null;
  private jobPoll: Subscription | null = null;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  readonly collegeStatusLabels: Record<string, string> = {
    working: 'Working',
    partial: 'Partially Working',
    down: 'Not Working',
    pending: 'Not Checked Yet',
    no_cameras: 'No Cameras',
    inactive: 'College Inactive'
  };

  readonly cameraStatusLabels: Record<string, string> = {
    online: 'Online',
    stream_error: 'Stream Error',
    no_response: 'No RTSP Response',
    offline: 'Offline',
    pending: 'Not Checked Yet',
    disabled: 'Disabled'
  };

  constructor(
    private cctvService: CctvService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => {
      this.currentPage = 1;
      this.loadColleges();
    });
    this.reload();
    // Pick up results of the background monitor without a manual refresh
    interval(60000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (!this.activeJob) this.reload(true);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.jobPoll?.unsubscribe();
  }

  private get query(): ConnectivityQuery {
    const query: ConnectivityQuery = { days: this.days, sort: this.sort, status: this.statusFilter };
    if (this.searchQuery.trim()) query.search = this.searchQuery.trim();
    return query;
  }

  reload(silent: boolean = false): void {
    this.loadSummary();
    this.loadColleges(silent);
    this.expanded.forEach(id => this.loadCameras(id));
  }

  loadSummary(): void {
    this.cctvService.getConnectivitySummary(this.days).subscribe({
      next: (summary) => {
        this.summary = summary;
        const job = summary.jobs.current && summary.jobs.current.type !== 'scheduled' ? summary.jobs.current : summary.jobs.queued;
        if (job && !this.activeJob) this.trackJob(job);
      },
      error: (err) => this.toastService.show(err.error?.message || 'Error loading connection summary', 'error')
    });
  }

  loadColleges(silent: boolean = false): void {
    if (!silent) this.isLoading = true;
    this.cctvService.getConnectivityColleges(this.query, this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        this.colleges = res.data;
        this.total = res.total;
        this.totalPages = res.totalPages;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.toastService.show(err.error?.message || 'Error loading colleges', 'error');
      }
    });
  }

  loadCameras(collegeId: string): void {
    this.loadingCameras.add(collegeId);
    this.cctvService.getCollegeCameraConnectivity(collegeId, this.days).subscribe({
      next: (cameras) => {
        this.cameras.set(collegeId, cameras);
        this.loadingCameras.delete(collegeId);
      },
      error: () => {
        this.loadingCameras.delete(collegeId);
        this.toastService.show('Error loading cameras', 'error');
      }
    });
  }

  onSearch(value: string): void {
    this.searchSubject.next(value);
  }

  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter = filter;
    this.currentPage = 1;
    this.loadColleges();
  }

  onSortChange(): void {
    this.currentPage = 1;
    this.loadColleges();
  }

  onDaysChange(): void {
    this.cameras.clear();
    this.reload();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadColleges();
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadColleges();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadColleges();
    }
  }

  countFor(filter: StatusFilter): number {
    if (!this.summary) return 0;
    const s = this.summary;
    switch (filter) {
      case 'all': return s.colleges;
      case 'working': return s.working;
      case 'partial': return s.partial;
      case 'down': return s.down;
      case 'other': return s.noCameras + s.inactive + s.pending;
    }
  }

  toggleExpand(id: string): void {
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
    } else {
      this.expanded.add(id);
      if (!this.cameras.has(id)) this.loadCameras(id);
    }
  }

  // --- Manual checks ---

  recheck(college?: CollegeConnectivity, event?: Event): void {
    event?.stopPropagation();
    this.cctvService.startConnectivityCheck(college?.id).subscribe({
      next: (res) => {
        if (!res.started) {
          this.toastService.show('A check is already running, showing its progress', 'info');
        }
        this.trackJob(res.job);
      },
      error: (err) => this.toastService.show(err.error?.message || 'Could not start the check', 'error')
    });
  }

  private trackJob(job: ConnectivityJob): void {
    this.activeJob = job;
    this.jobPoll?.unsubscribe();
    this.jobPoll = interval(1500).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cctvService.getConnectivityJobs().subscribe(jobs => {
        const running = [jobs.current, jobs.queued].find(j => j && j.id === this.activeJob?.id);
        if (running) {
          this.activeJob = running;
          return;
        }
        const finished = jobs.lastManual && jobs.lastManual.id === this.activeJob?.id ? jobs.lastManual : null;
        this.jobPoll?.unsubscribe();
        this.jobPoll = null;
        this.activeJob = null;
        if (finished?.state === 'failed') {
          this.toastService.show('Connection check failed: ' + (finished.error || 'unknown error'), 'error');
        } else {
          this.toastService.show(`Connection check finished (${finished?.total ?? 0} cameras)`, 'success');
        }
        this.reload(true);
      });
    });
  }

  get jobProgress(): number {
    if (!this.activeJob || !this.activeJob.total) return 0;
    return Math.round(this.activeJob.done / this.activeJob.total * 100);
  }

  isCheckingCollege(collegeId: string): boolean {
    return !!this.activeJob && (this.activeJob.type === 'full' || this.activeJob.collegeId === collegeId);
  }

  // --- Display helpers ---

  timeSince(value: string | null): string {
    if (!value) return '-';
    const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }

  uptimeClass(uptime: number | null): string {
    if (uptime === null) return '';
    if (uptime >= 99) return 'ok-text';
    if (uptime >= 90) return 'warn-text';
    return 'bad-text';
  }

  cameraDetails(camera: CameraConnectivity): string {
    if (camera.unconfirmedFailure) return `Last check failed (${camera.error}), confirming...`;
    return camera.error || (camera.rtspCode ? `RTSP ${camera.rtspCode}` : '');
  }

  // Download the report for the current list, or for a single college when one is given
  download(format: 'excel' | 'pdf', college?: CollegeConnectivity, event?: Event): void {
    event?.stopPropagation();
    const exportKey = college ? `${college.id}:${format}` : format;
    this.exportingKeys.add(exportKey);
    const query: ConnectivityQuery = college ? { days: this.days, collegeId: college.id } : this.query;
    const label = college ? `${college.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_` : '';

    this.cctvService.downloadConnectivityReport(format, query).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `College_Connection_Status_${label}${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.exportingKeys.delete(exportKey);
        this.toastService.show(`${format === 'excel' ? 'Excel' : 'PDF'} report downloaded${college ? ' for ' + college.name : ''}`, 'success');
      },
      error: () => {
        this.exportingKeys.delete(exportKey);
        this.toastService.show('Failed to download report', 'error');
      }
    });
  }

  isExporting(format: 'excel' | 'pdf', college?: CollegeConnectivity): boolean {
    return this.exportingKeys.has(college ? `${college.id}:${format}` : format);
  }
}
