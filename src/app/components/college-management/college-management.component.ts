import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CctvService, College } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmModalComponent } from '../shared/confirm-modal/confirm-modal.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

declare var lucide: any;

@Component({
  selector: 'app-college-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './college-management.component.html',
  styleUrl: './college-management.component.scss'
})
export class CollegeManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  colleges: College[] = [];
  isLoading: boolean = false;
  showModal: boolean = false;
  isEditing: boolean = false;
  isSaving: boolean = false;
  isUploading: boolean = false;

  isBulkUploadModalOpen: boolean = false;
  @ViewChild('fileInput') fileInput!: ElementRef;

  // Selection
  selectedCollegeIds: Set<string> = new Set();
  isAllSelected: boolean = false;

  // Confirm modal (generic)
  isConfirmModalOpen: boolean = false;
  confirmModalTitle: string = '';
  confirmModalMessage: string = '';
  confirmModalBtnText: string = '';
  pendingConfirmAction: (() => void) | null = null;

  private destroy$ = new Subject<void>();

  currentCollege: Partial<College> = {
    name: '',
    address: '',
    contactEmail: ''
  };

  searchQuery: string = '';
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  currentPage: number = 1;
  pageSize: number = 10;
  totalColleges: number = 0;
  totalPages: number = 0;

  constructor(
    private cctvService: CctvService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.loadColleges();

    // Setup search debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadColleges();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.refreshIcons();
  }

  refreshIcons(): void {
    setTimeout(() => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 50);
  }

  loadColleges(): void {
    this.isLoading = true;
    this.cctvService.getColleges(this.currentPage, this.pageSize, this.searchQuery).subscribe({
      next: (response) => {
        this.colleges = response.data || [];
        this.totalColleges = response.total || 0;
        this.totalPages = response.totalPages || 0;
        this.isLoading = false;
        this.updateSelectAllState();
        this.refreshIcons();
      },
      error: (err) => {
        console.error('Error loading colleges:', err);
        this.isLoading = false;
        if (!this.searchQuery) {
          this.colleges = [
            { id: '1', name: 'Vision Institute of Technology', address: 'Tech Park, Sector 62', contactEmail: 'info@visiontech.edu', createdAt: '2026-01-15', isActive: true },
            { id: '2', name: 'Global Science College', address: 'Downtown Campus', contactEmail: 'contact@globalscience.edu', createdAt: '2026-01-20', isActive: true },
            { id: '3', name: 'Modern Arts Academy', address: 'Riverside Drive', contactEmail: 'admin@modernarts.org', createdAt: '2026-02-01', isActive: false }
          ];
          this.totalColleges = 3;
          this.totalPages = 1;
        } else {
          this.colleges = [];
          this.totalColleges = 0;
          this.totalPages = 0;
        }
        this.refreshIcons();
      }
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchQuery);
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

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadColleges();
  }

  // --- Selection ---
  toggleSelect(id: string): void {
    if (this.selectedCollegeIds.has(id)) {
      this.selectedCollegeIds.delete(id);
    } else {
      this.selectedCollegeIds.add(id);
    }
    this.updateSelectAllState();
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.colleges.forEach(c => { if (c.id) this.selectedCollegeIds.delete(c.id); });
    } else {
      this.colleges.forEach(c => { if (c.id) this.selectedCollegeIds.add(c.id); });
    }
    this.updateSelectAllState();
  }

  updateSelectAllState(): void {
    if (this.colleges.length === 0) {
      this.isAllSelected = false;
      return;
    }
    this.isAllSelected = this.colleges.every(c => c.id && this.selectedCollegeIds.has(c.id));
  }

  clearSelection(): void {
    this.selectedCollegeIds.clear();
    this.isAllSelected = false;
  }

  // --- Status Toggle ---
  toggleStatus(college: College): void {
    const id = college.id;
    if (!id) return;

    this.cctvService.toggleCollegeStatus(id).subscribe({
      next: (updatedCollege) => {
        const index = this.colleges.findIndex(c => c.id === id);
        if (index !== -1) {
          this.colleges[index] = { ...this.colleges[index], ...updatedCollege };
        }
        const statusText = updatedCollege.isActive ? 'activated' : 'deactivated';
        this.toastService.show(`College ${statusText} successfully`, 'success');
        this.refreshIcons();
      },
      error: (err) => {
        console.error('Error toggling status:', err);
        this.toastService.show('Failed to toggle college status', 'error');
        college.isActive = !college.isActive;
      }
    });
  }

  // --- Bulk Operations ---
  bulkActivate(): void {
    const ids = Array.from(this.selectedCollegeIds);
    this.showConfirmModal(
      'Activate Colleges',
      `Are you sure you want to activate ${ids.length} college(s)?`,
      'Activate',
      () => {
        this.isSaving = true;
        this.cctvService.bulkUpdateCollegeStatus(ids, true).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show(`${ids.length} college(s) activated successfully`, 'success');
            this.clearSelection();
            this.loadColleges();
            this.closeConfirmModal();
          },
          error: (err) => {
            this.isSaving = false;
            this.toastService.show('Failed to activate colleges', 'error');
            this.closeConfirmModal();
          }
        });
      }
    );
  }

  bulkDeactivate(): void {
    const ids = Array.from(this.selectedCollegeIds);
    this.showConfirmModal(
      'Deactivate Colleges',
      `Are you sure you want to deactivate ${ids.length} college(s)?`,
      'Deactivate',
      () => {
        this.isSaving = true;
        this.cctvService.bulkUpdateCollegeStatus(ids, false).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show(`${ids.length} college(s) deactivated successfully`, 'success');
            this.clearSelection();
            this.loadColleges();
            this.closeConfirmModal();
          },
          error: (err) => {
            this.isSaving = false;
            this.toastService.show('Failed to deactivate colleges', 'error');
            this.closeConfirmModal();
          }
        });
      }
    );
  }

  bulkDelete(): void {
    const ids = Array.from(this.selectedCollegeIds);
    this.showConfirmModal(
      'Delete Colleges',
      `Are you sure you want to delete ${ids.length} college(s)? This action cannot be undone.`,
      'Delete All',
      () => {
        this.isSaving = true;
        this.cctvService.bulkDeleteColleges(ids).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show(`${ids.length} college(s) deleted successfully`, 'success');
            this.clearSelection();
            this.loadColleges();
            this.closeConfirmModal();
          },
          error: (err) => {
            this.isSaving = false;
            this.toastService.show('Failed to delete colleges', 'error');
            this.closeConfirmModal();
          }
        });
      }
    );
  }

  // --- Confirm Modal (generic) ---
  showConfirmModal(title: string, message: string, btnText: string, action: () => void): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalBtnText = btnText;
    this.pendingConfirmAction = action;
    this.isConfirmModalOpen = true;
  }

  closeConfirmModal(): void {
    this.isConfirmModalOpen = false;
    this.pendingConfirmAction = null;
  }

  executeConfirmAction(): void {
    if (this.pendingConfirmAction) {
      this.pendingConfirmAction();
    }
  }

  cancelConfirmAction(): void {
    this.closeConfirmModal();
  }

  // --- CRUD ---
  openCreateModal(): void {
    this.isEditing = false;
    this.currentCollege = { name: '', address: '', contactEmail: '' };
    this.showModal = true;
    this.refreshIcons();
  }

  openEditModal(college: College): void {
    this.isEditing = true;
    this.currentCollege = { ...college };
    this.showModal = true;
    this.refreshIcons();
  }

  closeModal(): void {
    this.showModal = false;
  }

  openBulkUploadModal(): void {
    this.isBulkUploadModalOpen = true;
  }

  closeBulkUploadModal(): void {
    this.isBulkUploadModalOpen = false;
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = null;
    }
  }

  downloadTemplate(): void {
    this.cctvService.downloadCollegeTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'College_Bulk_Upload_Template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.show('Template downloaded successfully', 'success');
      },
      error: (err) => {
        console.error('Error downloading template:', err);
        this.toastService.show('Failed to download template', 'error');
      }
    });
  }

  triggerFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      this.isUploading = true;
      this.cctvService.bulkUploadColleges(formData).subscribe({
        next: (res) => {
          this.isUploading = false;
          this.toastService.show(res.message || 'Colleges uploaded successfully!', 'success');
          this.loadColleges();
          this.closeBulkUploadModal();
        },
        error: (err) => {
          this.isUploading = false;
          const errMsg = err.error?.message || 'Failed to upload colleges';
          const errDetails = err.error?.errors?.join('\n') || '';
          console.error(errMsg, errDetails);
          this.toastService.show(errMsg, 'error');
        }
      });

      // Reset the file input
      event.target.value = null;
    }
  }

  saveCollege(): void {
    this.isSaving = true;

    // Trim string inputs
    this.currentCollege.name = this.currentCollege.name?.trim();
    this.currentCollege.address = this.currentCollege.address?.trim();
    this.currentCollege.contactEmail = this.currentCollege.contactEmail?.trim();

    if (this.isEditing && this.currentCollege.id) {
      this.cctvService.updateCollege(this.currentCollege.id, this.currentCollege).subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.show('College updated successfully', 'success');
          this.loadColleges();
          this.closeModal();
        },
        error: (err) => {
          this.isSaving = false;
          this.toastService.show('Update failed', 'error');
          console.error('Update failed');
          this.closeModal();
        }
      });
    } else {
      this.cctvService.createCollege(this.currentCollege).subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.show('College registered successfully', 'success');
          this.loadColleges();
          this.closeModal();
        },
        error: (err) => {
          this.isSaving = false;
          this.toastService.show('Registration failed', 'error');
          console.error('Create failed');
          this.closeModal();
        }
      });
    }
  }

  deleteCollege(id: string): void {
    this.showConfirmModal(
      'Delete College',
      'Are you sure you want to delete this college? This may affect users assigned to it and cannot be undone.',
      'Delete College',
      () => {
        this.isSaving = true;
        this.cctvService.deleteCollege(id).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show('College deleted successfully', 'success');
            this.closeConfirmModal();
            this.loadColleges();
          },
          error: (err) => {
            this.isSaving = false;
            this.toastService.show('Delete failed', 'error');
            this.closeConfirmModal();
            console.error('Delete failed');
          }
        });
      }
    );
  }
}
