import { Component, OnInit, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CctvService, User } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmModalComponent } from '../shared/confirm-modal/confirm-modal.component';
import { IconService } from '../../services/icon.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  LucideAngularModule, Search, FolderUp, UserPlus, CheckSquare,
  UserCheck, UserX, Trash2, X, Info, Download, FileCheck,
  UploadCloud, Play, CheckCircle, AlertTriangle, AlertCircle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, User as UserIcon, Mail, Lock, Shield, Building2, Key, Edit3
} from 'lucide-angular';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, LucideAngularModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  users: User[] = [];
  colleges: any[] = [];
  roles: any[] = [];
  isLoading: boolean = false;
  isAddingNewRole: boolean = false;
  newRoleName: string = '';
  showModal: boolean = false;
  isEditing: boolean = false;
  isSaving: boolean = false;

  // Selection
  selectedUserIds: Set<string> = new Set();
  isAllSelected: boolean = false;

  // Confirm modal (generic)
  isConfirmModalOpen: boolean = false;
  confirmModalTitle: string = '';
  confirmModalMessage: string = '';
  confirmModalBtnText: string = '';
  pendingConfirmAction: (() => void) | null = null;

  searchQuery: string = '';
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  // Pagination
  currentPage: number = 1;
  totalPages: number = 1;
  pageSize: number = 10;
  totalUsers: number = 0;

  // College Dropdown
  showCollegeDropdown: boolean = false;
  collegeSearch: string = '';

  // Bulk Upload
  isBulkUploadModalOpen: boolean = false;
  isUploading: boolean = false;
  uploadProgress: number = 0;
  uploadResults: any = null;
  selectedFile: File | null = null;
  bulkUploadErrors: string[] = [];
  modalErrorMessage: string = '';
  bulkUploadGeneralError: string = '';
  confirmModalErrorMessage: string = '';

  private destroy$ = new Subject<void>();

  currentUser: Partial<User> = {
    firstName: '',
    lastName: '',
    email: '',
    mobileNo: '',
    role: 'VIEWER',
    collegeId: ''
  };

  constructor(
    private cctvService: CctvService,
    private toastService: ToastService,
    private iconService: IconService
  ) { }

  ngOnInit(): void {
    this.loadUsers();
    this.loadColleges();
    this.loadRoles();

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadUsers();
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
    this.iconService.refreshIcons();
  }



  loadColleges(): void {
    this.cctvService.getAllActiveColleges().subscribe({
      next: (colleges) => {
        this.colleges = colleges;
      },
      error: (err) => {
        console.error('Error loading colleges:', err);
      }
    });
  }

  loadRoles(): void {
    this.cctvService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (err) => {
        console.error('Error loading roles:', err);
        this.roles = [
          { roleId: 'STAFF', roleName: 'STAFF' },
          { roleId: 'SUPER_ADMIN', roleName: 'SUPER_ADMIN' }
        ];
      }
    });
  }

  onRoleChange(): void {
    if (this.currentUser.role === 'ADD_NEW') {
      this.isAddingNewRole = true;
      this.currentUser.role = '';
    } else {
      this.isAddingNewRole = false;
    }
  }

  cancelNewRole(): void {
    this.isAddingNewRole = false;
    this.newRoleName = '';
    this.currentUser.role = this.roles.length > 0 ? this.roles[0].roleName : '';
  }

  get filteredColleges(): any[] {
    if (!this.collegeSearch) return this.colleges;
    return this.colleges.filter(c =>
      c.name.toLowerCase().includes(this.collegeSearch.toLowerCase())
    );
  }

  toggleCollegeDropdown(event: Event): void {
    event.stopPropagation();
    this.showCollegeDropdown = !this.showCollegeDropdown;
  }

  selectCollege(college: any): void {
    if (college === 'ALL') {
      this.currentUser.collegeId = 'ALL';
    } else {
      this.currentUser.collegeId = college.id;
    }
    this.showCollegeDropdown = false;
    this.collegeSearch = '';
  }

  get selectedCollegeName(): string {
    if (this.currentUser.collegeId === 'ALL') return 'All Colleges';
    const college = this.colleges.find(c => c.id === this.currentUser.collegeId);
    return college ? college.name : 'Select College';
  }

  // Close dropdown on outside click
  @HostListener('document:click')
  onDocumentClick(): void {
    this.showCollegeDropdown = false;
  }

  loadUsers(page: number = this.currentPage): void {
    this.isLoading = true;
    this.currentPage = page;
    this.cctvService.getUsers(this.currentPage, this.pageSize, this.searchQuery).subscribe({
      next: (response) => {
        this.users = response.data || [];
        this.totalPages = response.totalPages || 0;
        this.totalUsers = response.total || 0;
        this.isLoading = false;
        this.updateSelectAllState();
        this.refreshIcons();
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.isLoading = false;
        if (!this.searchQuery) {
          const mockData: User[] = [
            { keycloakId: '1', firstName: 'John', lastName: 'Doe', email: 'john@vision.com', mobileNo: '1234567890', role: 'ADMIN', createdAt: '2026-02-18', isActive: true },
            { keycloakId: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@vision.com', mobileNo: '0987654321', role: 'OPERATOR', createdAt: '2026-02-17', isActive: true },
            { keycloakId: '3', firstName: 'Mike', lastName: 'Ross', email: 'mike@vision.com', mobileNo: '1122334455', role: 'VIEWER', createdAt: '2026-02-10', isActive: false },
          ];
          const start = (this.currentPage - 1) * this.pageSize;
          this.users = mockData.slice(start, start + this.pageSize);
          this.totalUsers = mockData.length;
          this.totalPages = Math.ceil(mockData.length / this.pageSize);
        } else {
          this.users = [];
          this.totalUsers = 0;
          this.totalPages = 0;
        }
      }
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchQuery);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadUsers(this.currentPage + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.loadUsers(this.currentPage - 1);
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  // --- Selection ---
  toggleSelect(id: string): void {
    if (this.selectedUserIds.has(id)) {
      this.selectedUserIds.delete(id);
    } else {
      this.selectedUserIds.add(id);
    }
    this.updateSelectAllState();
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      // Deselect all on current page
      this.users.forEach(u => { if (u.id) this.selectedUserIds.delete(u.id); });
    } else {
      // Select all on current page
      this.users.forEach(u => { if (u.id) this.selectedUserIds.add(u.id); });
    }
    this.updateSelectAllState();
  }

  updateSelectAllState(): void {
    if (this.users.length === 0) {
      this.isAllSelected = false;
      return;
    }
    this.isAllSelected = this.users.every(u => u.id && this.selectedUserIds.has(u.id));
  }

  clearSelection(): void {
    this.selectedUserIds.clear();
    this.isAllSelected = false;
  }

  // --- Status Toggle ---
  toggleStatus(user: User): void {
    const id = user.id;
    if (!id) return;

    this.cctvService.toggleUserStatus(id).subscribe({
      next: (updatedUser) => {
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users[index] = { ...this.users[index], ...updatedUser };
        }
        const statusText = updatedUser.isActive ? 'activated' : 'deactivated';
        this.toastService.show(`User ${statusText} successfully`, 'success');
        this.refreshIcons();
      },
      error: (err) => {
        console.error('Error toggling status:', err);
        this.toastService.show('Failed to toggle user status', 'error');
        // Revert the toggle visually
        user.isActive = !user.isActive;
      }
    });
  }

  // --- Bulk Operations ---
  bulkActivate(): void {
    const ids = Array.from(this.selectedUserIds);
    this.showConfirmModal(
      'Activate Users',
      `Are you sure you want to activate ${ids.length} user(s)? They will be able to log in to the system.`,
      'Activate',
      () => {
        this.isSaving = true;
        this.cctvService.bulkUpdateUserStatus(ids, true).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show(`${ids.length} user(s) activated successfully`, 'success');
            this.clearSelection();
            this.loadUsers();
            this.closeConfirmModal();
          },
          error: (err) => {
            this.isSaving = false;
            this.confirmModalErrorMessage = err.error?.message || 'Failed to activate users';
            this.toastService.show(this.confirmModalErrorMessage, 'error');
          }
        });
      }
    );
  }

  bulkDeactivate(): void {
    const ids = Array.from(this.selectedUserIds);
    this.showConfirmModal(
      'Deactivate Users',
      `Are you sure you want to deactivate ${ids.length} user(s)? They will no longer be able to log in.`,
      'Deactivate',
      () => {
        this.isSaving = true;
        this.cctvService.bulkUpdateUserStatus(ids, false).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show(`${ids.length} user(s) deactivated successfully`, 'success');
            this.clearSelection();
            this.loadUsers();
            this.closeConfirmModal();
          },
          error: (err) => {
            this.isSaving = false;
            this.confirmModalErrorMessage = err.error?.message || 'Failed to deactivate users';
            this.toastService.show(this.confirmModalErrorMessage, 'error');
          }
        });
      }
    );
  }

  bulkDelete(): void {
    const ids = Array.from(this.selectedUserIds);
    this.showConfirmModal(
      'Delete Users',
      `Are you sure you want to delete ${ids.length} user(s)? This action cannot be undone.`,
      'Delete All',
      () => {
        this.isSaving = true;
        this.cctvService.bulkDeleteUsers(ids).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show(`${ids.length} user(s) deleted successfully`, 'success');
            this.clearSelection();
            this.loadUsers();
            this.closeConfirmModal();
          },
          error: (err) => {
            this.isSaving = false;
            this.confirmModalErrorMessage = err.error?.message || 'Failed to delete users';
            this.toastService.show(this.confirmModalErrorMessage, 'error');
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
    this.confirmModalErrorMessage = '';
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
    this.isAddingNewRole = false;
    this.newRoleName = '';
    this.currentUser = { firstName: '', lastName: '', email: '', mobileNo: '', role: 'STAFF', collegeId: '' };
    this.modalErrorMessage = '';
    this.showModal = true;
  }

  openEditModal(user: User): void {
    this.isEditing = true;
    this.isAddingNewRole = false;
    this.newRoleName = '';
    this.currentUser = { ...user };
    this.modalErrorMessage = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveUser(): void {
    this.isSaving = true;
    this.modalErrorMessage = '';

    if (this.isAddingNewRole && this.newRoleName.trim()) {
      this.currentUser.role = this.newRoleName.trim();
    }
    this.currentUser.lastName = this.currentUser.lastName?.trim();
    this.currentUser.email = this.currentUser.email?.trim();
    this.currentUser.mobileNo = this.currentUser.mobileNo?.trim();

    if (this.isEditing && this.currentUser.keycloakId) {
      this.cctvService.updateUser(this.currentUser.keycloakId, this.currentUser).subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.show('User updated successfully', 'success');
          this.loadUsers();
          this.loadRoles(); // Refresh roles list
          this.closeModal();
          this.refreshIcons();
        },
        error: (err) => {
          this.isSaving = false;
          this.modalErrorMessage = err.error?.message || 'Failed to update user';
          this.toastService.show(this.modalErrorMessage, 'error');
          console.error('Update failed', err);
        }
      });
    } else {
      this.cctvService.createUser(this.currentUser).subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.show('User created successfully', 'success');
          this.currentPage = 1;
          this.loadUsers();
          this.loadRoles(); // Refresh roles list
          this.closeModal();
          this.refreshIcons();
        },
        error: (err) => {
          this.isSaving = false;
          this.modalErrorMessage = err.error?.message || 'Failed to create user';
          this.toastService.show(this.modalErrorMessage, 'error');
          console.error('Create failed', err);
        }
      });
    }
  }

  deleteUser(id: string): void {
    this.showConfirmModal(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      'Delete User',
      () => {
        this.isSaving = true;
        this.cctvService.deleteUser(id).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show('User deleted successfully', 'success');
            this.closeConfirmModal();
            this.loadUsers();
            this.refreshIcons();
          },
          error: (err) => {
            this.isSaving = false;
            this.confirmModalErrorMessage = err.error?.message || 'Failed to delete user';
            this.toastService.show(this.confirmModalErrorMessage, 'error');
            console.error('Delete failed', err);
          }
        });
      }
    );
  }

  resetPassword(user: User): void {
    if (!user.id) return;

    this.showConfirmModal(
      'Reset Password',
      `Are you sure you want to reset the password for ${user.firstName} ${user.lastName}? It will be set to the default password, and the user will be required to change it upon their next login.`,
      'Reset Password',
      () => {
        this.isSaving = true;
        this.cctvService.resetUserPassword(user.id!).subscribe({
          next: () => {
            this.isSaving = false;
            this.toastService.show('Password reset successfully', 'success');
            this.closeConfirmModal();
            this.refreshIcons();
          },
          error: (err) => {
            this.isSaving = false;
            this.confirmModalErrorMessage = err.error?.message || 'Failed to reset password';
            this.toastService.show(this.confirmModalErrorMessage, 'error');
            console.error('Reset failed', err);
          }
        });
      }
    );
  }

  openAddModal(): void {
    this.openCreateModal();
  }

  // Bulk Upload Methods
  openBulkUploadModal(): void {
    this.isBulkUploadModalOpen = true;
    this.bulkUploadGeneralError = '';
    this.resetUploadState();
  }

  closeBulkUploadModal(): void {
    this.isBulkUploadModalOpen = false;
    this.resetUploadState();
    if (this.uploadResults && this.uploadResults.success > 0) {
      this.currentPage = 1;
      this.loadUsers();
    }
  }

  resetUploadState(): void {
    this.isUploading = false;
    this.uploadProgress = 0;
    this.uploadResults = null;
    this.selectedFile = null;
    this.bulkUploadErrors = [];
    this.bulkUploadGeneralError = '';
  }

  downloadTemplate(): void {
    this.cctvService.downloadUserTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'User_Bulk_Upload_Template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.toastService.show('Error downloading template', 'error');
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx'))) {
      this.selectedFile = file;
    } else {
      this.toastService.show('Please upload a valid Excel (.xlsx) file', 'info');
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  uploadFile(): void {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.bulkUploadErrors = [];
    this.bulkUploadGeneralError = '';
    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.cctvService.bulkUploadUsers(formData).subscribe({
      next: (res) => {
        this.isUploading = false;
        this.uploadResults = res;
        this.toastService.show(res.message, 'success');
        this.loadUsers();
      },
      error: (err) => {
        this.isUploading = false;
        if (err.error && err.error.errors) {
          this.bulkUploadErrors = err.error.errors;
        } else {
          this.bulkUploadGeneralError = err.error?.message || 'Bulk upload failed';
          this.toastService.show(this.bulkUploadGeneralError, 'error');
        }
      }
    });
  }

  hasActionAccess(actionId: string): boolean {
    const user = this.cctvService.userDetails;
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return user.permissions?.actions?.includes(actionId) || false;
  }

  trackByUserId(index: number, user: any): string { return user.id || user.keycloakId; }
  trackByRoleId(index: number, role: any): string { return role.roleId || role.roleName; }
  trackByCollegeId(index: number, college: any): string { return college.id; }
  trackByIndex(index: number): number { return index; }
}
