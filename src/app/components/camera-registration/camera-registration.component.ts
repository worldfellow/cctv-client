import { Component, OnInit, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CctvService, College } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmModalComponent } from '../shared/confirm-modal/confirm-modal.component';
import { IconService } from '../../services/icon.service';
import { forkJoin, Subject } from 'rxjs';
import { LucideAngularModule, Filter, FolderUp, Plus, Video, Radio, Edit3, Trash2, CameraOff, X, Building2, Network, Plug, User, Lock, PlusCircle, Save, Download, UploadCloud, CheckSquare, CheckCircle, XCircle, FileText, Loader2, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-angular';

// Flat record from server
export interface CameraRecord {
    id?: string;
    collegeId: string;
    name: string;
    location?: string;
    ipAddress: string;
    rtspPort: number;
    channel: string;
    isActive: boolean;
    status?: string;
    collegeName?: string;
    streamUrl?: string;
}

// Grouped device for table display
export interface CameraDevice {
    collegeId: string;
    collegeName?: string;
    ipAddress: string;
    rtspPort: number;
    username?: string;
    isActive: boolean;
    channels: CameraRecord[];
}

@Component({
    selector: 'app-camera-registration',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        LucideAngularModule,
        ConfirmModalComponent
    ],
    templateUrl: './camera-registration.component.html',
    styleUrl: './camera-registration.component.scss'
})
export class CameraRegistrationComponent implements OnInit, OnDestroy {
    registrationForm!: FormGroup;
    colleges: College[] = [];

    // Table & Data State
    allRecords: CameraRecord[] = [];
    groupedDevices: CameraDevice[] = [];
    filteredDevices: CameraDevice[] = [];
    selectedFilterCollege: string = '';
    isLoading = false;
    isSaving = false;
    registrationErrorMessage: string = '';
    confirmErrorMessage: string = '';

    // Pagination
    currentPage: number = 1;
    pageSize: number = 10;
    totalRecords: number = 0;
    totalPages: number = 0;

    // Selection
    selectedCameraIds: Set<string> = new Set();
    isAllSelected: boolean = false;

    // Modal State
    isModalOpen = false;
    isEditing = false;
    editingRecord: CameraRecord | null = null;
    isBulkUploadModalOpen = false;
    isBulkEditing = false; // New state for bulk edit mode

    // College Dropdown States
    showFilterDropdown: boolean = false;
    filterSearch: string = '';

    openDropdownIndex: number | null = null; // For FormArray dropdowns
    modalSearch: string = '';

    // Delete Confirmation
    itemToDelete: CameraRecord | null = null;
    deviceToDelete: CameraDevice | null = null;
    isConfirmModalOpen = false;
    private destroy$ = new Subject<void>();

    @HostListener('document:click')
    onDocumentClick(): void {
        this.showFilterDropdown = false;
        this.openDropdownIndex = null;
    }

    @ViewChild('fileInput') fileInput!: ElementRef;

    constructor(
        private fb: FormBuilder,
        private cctvService: CctvService,
        private toastService: ToastService,
        private iconService: IconService
    ) {
        this.createForm();
    }

    ngOnInit(): void {
        this.loadColleges();
        this.loadCameras();
        this.refreshIcons();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    createForm() {
        this.registrationForm = this.fb.group({
            cameras: this.fb.array([this.createCameraGroup()])
        });
    }

    createCameraGroup(): FormGroup {
        return this.fb.group({
            collegeId: ['', Validators.required],
            ipAddress: ['', [Validators.required, Validators.pattern('^([0-9]{1,3}\\.){3}[0-9]{1,3}$')]],
            rtspPort: [554, [Validators.required, Validators.min(1)]],
            username: ['', Validators.required],
            password: ['', Validators.required],
            isActive: [true],
            channels: this.fb.array([this.createChannelGroup()])
        });
    }

    createChannelGroup(): FormGroup {
        return this.fb.group({
            channel: ['', Validators.required],
            name: ['', Validators.required],
            location: ['']
        });
    }

    get cameras(): FormArray {
        return this.registrationForm.get('cameras') as FormArray;
    }

    getChannels(cameraIndex: number): FormArray {
        return this.cameras.at(cameraIndex).get('channels') as FormArray;
    }

    addCamera() {
        this.cameras.push(this.createCameraGroup());
    }

    removeCamera(index: number) {
        if (this.cameras.length > 1) {
            this.cameras.removeAt(index);
        }
    }

    addChannel(cameraIndex: number) {
        this.getChannels(cameraIndex).push(this.createChannelGroup());
    }

    removeChannel(cameraIndex: number, channelIndex: number) {
        const channels = this.getChannels(cameraIndex);
        if (channels.length > 1) {
            channels.removeAt(channelIndex);
        }
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

    get filteredCollegesFilter(): College[] {
        if (!this.filterSearch) return this.colleges;
        return this.colleges.filter(c =>
            c.name.toLowerCase().includes(this.filterSearch.toLowerCase())
        );
    }

    get filteredCollegesModal(): College[] {
        if (!this.modalSearch) return this.colleges;
        return this.colleges.filter(c =>
            c.name.toLowerCase().includes(this.modalSearch.toLowerCase())
        );
    }

    toggleFilterDropdown(event: Event): void {
        event.stopPropagation();
        this.showFilterDropdown = !this.showFilterDropdown;
        this.openDropdownIndex = null;
    }

    selectFilterCollege(collegeId: string): void {
        this.selectedFilterCollege = collegeId;
        this.showFilterDropdown = false;
        this.filterSearch = '';
        this.onFilterChange();
    }

    get selectedFilterCollegeName(): string {
        if (!this.selectedFilterCollege) return 'All Colleges';
        const college = this.colleges.find(c => c.id === this.selectedFilterCollege);
        return college ? college.name : 'All Colleges';
    }

    toggleModalDropdown(event: Event, index: number): void {
        event.stopPropagation();
        this.openDropdownIndex = this.openDropdownIndex === index ? null : index;
        this.showFilterDropdown = false;
        this.modalSearch = '';
    }

    selectModalCollege(index: number, college: College): void {
        this.cameras.at(index).get('collegeId')?.setValue(college.id);
        this.openDropdownIndex = null;
        this.modalSearch = '';
    }

    getSelectedCollegeNameModal(index: number): string {
        const id = this.cameras.at(index).get('collegeId')?.value;
        const college = this.colleges.find(c => c.id === id);
        return college ? college.name : 'Select a college';
    }

    loadCameras(): void {
        this.isLoading = true;
        const collegeId = this.selectedFilterCollege || undefined;
        this.cctvService.getCameras(this.currentPage, this.pageSize, collegeId).subscribe({
            next: (response) => {
                this.allRecords = (response.data || []).map((cam: any) => ({
                    id: cam.id,
                    collegeId: cam.collegeId,
                    name: cam.name,
                    location: cam.location,
                    ipAddress: cam.ipAddress || '',
                    rtspPort: cam.rtspPort || 554,
                    channel: cam.channel || '',
                    isActive: cam.status === 'online',
                    status: cam.status,
                    collegeName: cam.collegeName,
                    streamUrl: cam.streamUrl
                }));
                this.totalRecords = response.total || 0;
                this.totalPages = response.totalPages || 0;
                this.groupCameras();
                this.updateSelectAllState();
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading cameras:', err);
                this.isLoading = false;

                // Mock data fallback if API is unavailable
                const mockCameras = [
                    { id: '1', collegeId: '1', name: 'Main Gate Cam', location: 'Gate 1', ipAddress: '192.168.1.100', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Vision Institute of Technology' },
                    { id: '2', collegeId: '1', name: 'Lobby Cam', location: 'Reception', ipAddress: '192.168.1.101', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Vision Institute of Technology' },
                    { id: '3', collegeId: '2', name: 'Parking Lot', location: 'North Side', ipAddress: '10.0.0.51', rtspPort: 554, channel: '1', status: 'offline', collegeName: 'Global Science College' },
                    { id: '4', collegeId: '2', name: 'Cafeteria', location: 'Block C', ipAddress: '10.0.0.52', rtspPort: 554, channel: '2', status: 'online', collegeName: 'Global Science College' },
                    { id: '5', collegeId: '3', name: 'Library Cam', location: 'Reading Hall', ipAddress: '172.16.0.10', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Modern Arts Academy' },
                    { id: '6', collegeId: '1', name: 'Back Gate Cam', location: 'Gate 2', ipAddress: '192.168.1.102', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Vision Institute of Technology' },
                    { id: '7', collegeId: '1', name: 'Auditorium Hall', location: 'Main Hall', ipAddress: '192.168.1.103', rtspPort: 554, channel: '1', status: 'offline', collegeName: 'Vision Institute of Technology' },
                    { id: '8', collegeId: '2', name: 'Sports Complex', location: 'Gym', ipAddress: '10.0.0.53', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Global Science College' },
                    { id: '9', collegeId: '3', name: 'Studio Room 1', location: 'Arts Wing', ipAddress: '172.16.0.11', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Modern Arts Academy' },
                    { id: '10', collegeId: '3', name: 'Studio Room 2', location: 'Arts Wing', ipAddress: '172.16.0.12', rtspPort: 554, channel: '2', status: 'online', collegeName: 'Modern Arts Academy' },
                    { id: '11', collegeId: '1', name: 'Server Room', location: 'IT Dept', ipAddress: '192.168.1.104', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Vision Institute of Technology' },
                    { id: '12', collegeId: '2', name: 'Staff Room', location: 'Block A', ipAddress: '10.0.0.54', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Global Science College' },
                    { id: '13', collegeId: '1', name: 'Corridor 1', location: 'First Floor', ipAddress: '192.168.1.105', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Vision Institute of Technology' },
                    { id: '14', collegeId: '2', name: 'Quad Area', location: 'Center', ipAddress: '10.0.0.55', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Global Science College' },
                    { id: '15', collegeId: '3', name: 'Gallery', location: 'Exhibition', ipAddress: '172.16.0.13', rtspPort: 554, channel: '1', status: 'online', collegeName: 'Modern Arts Academy' }
                ];

                let filteredMock = mockCameras;
                if (collegeId) {
                    filteredMock = mockCameras.filter(c => c.collegeId === collegeId);
                }

                this.totalRecords = filteredMock.length;
                this.totalPages = Math.ceil(this.totalRecords / this.pageSize);

                const start = (this.currentPage - 1) * this.pageSize;
                const pageData = filteredMock.slice(start, start + this.pageSize);

                this.allRecords = pageData.map((cam: any) => ({
                    id: cam.id,
                    collegeId: cam.collegeId,
                    name: cam.name,
                    location: cam.location,
                    ipAddress: cam.ipAddress,
                    rtspPort: cam.rtspPort,
                    channel: cam.channel,
                    isActive: cam.status === 'online',
                    status: cam.status,
                    collegeName: cam.collegeName,
                    streamUrl: cam.streamUrl
                }));
                this.groupCameras();
            }
        });
    }

    // Group flat records by IP address into device groups
    groupCameras(): void {
        const deviceMap = new Map<string, CameraDevice>();

        this.allRecords.forEach(rec => {
            const key = `${rec.ipAddress}:${rec.rtspPort}:${rec.collegeId}`;
            if (!deviceMap.has(key)) {
                deviceMap.set(key, {
                    collegeId: rec.collegeId,
                    collegeName: rec.collegeName,
                    ipAddress: rec.ipAddress,
                    rtspPort: rec.rtspPort,
                    isActive: rec.isActive,
                    channels: []
                });
            }
            deviceMap.get(key)!.channels.push(rec);
        });

        this.groupedDevices = Array.from(deviceMap.values());
        // this.applyFilter();
    }

    // applyPagination() { ... }

    onPageSizeChange() {
        this.currentPage = 1;
        this.loadCameras();
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadCameras();
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadCameras();
        }
    }

    onFilterChange() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.loadCameras();
    }

    // --- Selection ---
    toggleSelect(id: string): void {
        if (this.selectedCameraIds.has(id)) {
            this.selectedCameraIds.delete(id);
        } else {
            this.selectedCameraIds.add(id);
        }
        this.updateSelectAllState();
    }

    toggleSelectAll(): void {
        if (this.isAllSelected) {
            this.allRecords.forEach(c => { if (c.id) this.selectedCameraIds.delete(c.id); });
        } else {
            this.allRecords.forEach(c => { if (c.id) this.selectedCameraIds.add(c.id); });
        }
        this.updateSelectAllState();
    }

    updateSelectAllState(): void {
        if (this.allRecords.length === 0) {
            this.isAllSelected = false;
            return;
        }
        this.isAllSelected = this.allRecords.every(c => c.id && this.selectedCameraIds.has(c.id));
    }

    clearSelection(): void {
        this.selectedCameraIds.clear();
        this.isAllSelected = false;
    }

    // Modal Methods
    openModal(isEdit: boolean = false, record: CameraRecord | null = null) {
        this.isModalOpen = true;
        this.isEditing = isEdit;

        if (isEdit && record) {
            this.editingRecord = record;
            while (this.cameras.length !== 0) {
                this.cameras.removeAt(0);
            }

            const camGroup = this.createCameraGroup();
            camGroup.patchValue({
                collegeId: record.collegeId,
                ipAddress: record.ipAddress,
                rtspPort: record.rtspPort,
                username: '',
                password: '',
                isActive: record.isActive
            });
            // Make credentials optional for editing
            camGroup.get('password')?.clearValidators();
            camGroup.get('username')?.clearValidators();
            camGroup.get('password')?.updateValueAndValidity();
            camGroup.get('username')?.updateValueAndValidity();

            const channelsArray = camGroup.get('channels') as FormArray;
            channelsArray.clear();

            const chGroup = this.createChannelGroup();
            chGroup.patchValue({
                channel: record.channel,
                name: record.name,
                location: record.location || ''
            });
            channelsArray.push(chGroup);

            this.cameras.push(camGroup);
        } else {
            this.editingRecord = null;
            this.createForm();
        }
    }

    closeModal() {
        this.isModalOpen = false;
        this.editingRecord = null;
        this.registrationErrorMessage = '';
        this.createForm();
    }

    editRecord(record: CameraRecord) {
        this.openModal(true, record);
    }

    deleteRecord(record: CameraRecord) {
        this.itemToDelete = record;
        this.deviceToDelete = null;
        this.isConfirmModalOpen = true;
    }

    executeDelete() {
        if (this.itemToDelete && this.itemToDelete.id) {
            this.isSaving = true;
            this.cctvService.deleteCamera(this.itemToDelete.id).subscribe({
                next: () => {
                    this.isSaving = false;
                    this.isConfirmModalOpen = false;
                    this.itemToDelete = null;
                    this.confirmErrorMessage = '';
                    this.toastService.show('Camera deleted successfully', 'success');
                    this.loadCameras();
                },
                error: (err) => {
                    console.error('Error deleting camera:', err);
                    this.isSaving = false;
                    this.confirmErrorMessage = err.error?.message || 'Failed to delete camera';
                    this.toastService.show(this.confirmErrorMessage, 'error');
                }
            });
        } else if (this.deviceToDelete) {
            this.isSaving = true;
            const deleteCalls = this.deviceToDelete.channels
                .filter(ch => ch.id)
                .map(ch => this.cctvService.deleteCamera(ch.id!));

            if (deleteCalls.length === 0) {
                this.cancelDelete();
                return;
            }

            forkJoin(deleteCalls).subscribe({
                next: () => {
                    this.isSaving = false;
                    this.isConfirmModalOpen = false;
                    this.deviceToDelete = null;
                    this.confirmErrorMessage = '';
                    this.toastService.show('Camera device deleted successfully', 'success');
                    this.loadCameras();
                },
                error: (err) => {
                    console.error('Error deleting cameras:', err);
                    this.isSaving = false;
                    this.confirmErrorMessage = err.error?.message || 'Failed to delete camera device';
                    this.toastService.show(this.confirmErrorMessage, 'error');
                }
            });
        } else if (this.pendingBulkAction) {
            this.pendingBulkAction();
        }
    }

    cancelDelete() {
        this.isConfirmModalOpen = false;
        this.itemToDelete = null;
        this.deviceToDelete = null;
        this.pendingBulkAction = null;
        this.confirmErrorMessage = '';
    }

    toggleStatus(record: CameraRecord) {
        if (!record.id) return;
        const newStatus = !record.isActive;
        const payload = { isActive: newStatus };

        // Optimistically update UI
        record.isActive = newStatus;

        this.cctvService.updateCamera(record.id, payload).subscribe({
            next: () => {
                this.toastService.show(`Camera status updated to ${newStatus ? 'Online' : 'Offline'}`, 'success');
            },
            error: (err) => {
                console.error('Error updating status:', err);
                record.isActive = !newStatus;
                this.toastService.show('Failed to update camera status', 'error');
            }
        });
    }

    deleteDevice(device: CameraDevice) {
        this.deviceToDelete = device;
        this.itemToDelete = null;
        this.isConfirmModalOpen = true;
    }

    onSubmit() {
        if (this.registrationForm.valid) {
            this.isSaving = true;
            this.registrationErrorMessage = '';
            const formValue = this.registrationForm.value;

            // Trim data recursively before saving
            const trimmedData = this.trimObjectStrings(formValue.cameras);

            if (this.isEditing && this.editingRecord) {
                const updatedRecord = trimmedData[0];
                const flatRecord = this.flattenFormData([updatedRecord])[0];
                const id = this.editingRecord.id; // Use editingRecord.id for update

                if (id) {
                    // Remove username/password if not provided during edit
                    if (!flatRecord.password) delete flatRecord.password;
                    if (!flatRecord.username) delete flatRecord.username;

                    this.cctvService.updateCamera(id, flatRecord).subscribe({
                        next: () => {
                            this.isSaving = false;
                            this.toastService.show('Camera updated successfully', 'success');
                            this.closeModal();
                            this.loadCameras();
                        },
                        error: (err) => {
                            this.isSaving = false;
                            console.error('Error updating camera', err);
                            this.registrationErrorMessage = err.error?.message || 'Failed to update camera';
                            this.toastService.show(this.registrationErrorMessage, 'error');
                        }
                    });
                } else {
                    this.isSaving = false;
                    this.toastService.show('Error: Cannot find camera ID for update', 'error');
                }

            } else {
                const flattenedData = this.flattenFormData(trimmedData);

                // Bulk create flat records using forkJoin since createBulkCameras doesn't exist yet
                const createRequests = flattenedData.map(record => this.cctvService.createCamera(record));

                forkJoin(createRequests).subscribe({
                    next: () => {
                        this.isSaving = false;
                        this.toastService.show('Cameras registered successfully', 'success');
                        this.closeModal();
                        this.loadCameras();
                    },
                    error: (err: any) => {
                        this.isSaving = false;
                        console.error('Error creating cameras', err);
                        this.registrationErrorMessage = err.error?.message || 'Failed to register cameras';
                        this.toastService.show(this.registrationErrorMessage, 'error');
                    }
                });
            }
        } else {
            this.registrationForm.markAllAsTouched();
        }
    }

    private trimObjectStrings(obj: any): any {
        if (typeof obj === 'string') {
            return obj.trim();
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.trimObjectStrings(item));
        }
        if (obj !== null && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    newObj[key] = this.trimObjectStrings(obj[key]);
                }
            }
            return newObj;
        }
        return obj;
    }

    // Flatten nested form data (device + channels) into flat API records
    private flattenFormData(camerasData: any[]): any[] {
        const records: any[] = [];
        camerasData.forEach(device => {
            (device.channels || []).forEach((ch: any) => {
                records.push({
                    collegeId: device.collegeId,
                    name: ch.name,
                    location: ch.location || null,
                    ipAddress: device.ipAddress,
                    rtspPort: device.rtspPort,
                    channel: ch.channel,
                    username: device.username,
                    password: device.password,
                    isActive: device.isActive
                });
            });
        });
        return records;
    }

    // --- Bulk Operations ---
    bulkActivate(): void {
        const ids = Array.from(this.selectedCameraIds);
        this.showBulkConfirm(
            'Activate Cameras',
            `Are you sure you want to activate ${ids.length} camera(s)?`,
            'Activate',
            () => {
                this.isSaving = true;
                this.cctvService.bulkUpdateCameraStatus(ids, true).subscribe({
                    next: () => {
                        this.isSaving = false;
                        this.toastService.show(`${ids.length} camera(s) activated successfully`, 'success');
                        this.clearSelection();
                        this.loadCameras();
                        this.cancelDelete(); // Closes confirm modal
                    },
                    error: (err) => {
                        this.isSaving = false;
                        this.confirmErrorMessage = err.error?.message || 'Failed to activate cameras';
                        this.toastService.show(this.confirmErrorMessage, 'error');
                    }
                });
            }
        );
    }

    bulkDeactivate(): void {
        const ids = Array.from(this.selectedCameraIds);
        this.showBulkConfirm(
            'Deactivate Cameras',
            `Are you sure you want to deactivate ${ids.length} camera(s)?`,
            'Deactivate',
            () => {
                this.isSaving = true;
                this.cctvService.bulkUpdateCameraStatus(ids, false).subscribe({
                    next: () => {
                        this.isSaving = false;
                        this.toastService.show(`${ids.length} camera(s) deactivated successfully`, 'success');
                        this.clearSelection();
                        this.loadCameras();
                        this.cancelDelete();
                    },
                    error: (err) => {
                        this.isSaving = false;
                        this.confirmErrorMessage = err.error?.message || 'Failed to deactivate cameras';
                        this.toastService.show(this.confirmErrorMessage, 'error');
                    }
                });
            }
        );
    }

    bulkDelete(): void {
        const ids = Array.from(this.selectedCameraIds);
        this.showBulkConfirm(
            'Delete Cameras',
            `Are you sure you want to delete ${ids.length} camera(s)? This action cannot be undone.`,
            'Delete All',
            () => {
                this.isSaving = true;
                this.cctvService.bulkDeleteCameras(ids).subscribe({
                    next: () => {
                        this.isSaving = false;
                        this.toastService.show(`${ids.length} camera(s) deleted successfully`, 'success');
                        this.clearSelection();
                        this.loadCameras();
                        this.cancelDelete();
                    },
                    error: (err) => {
                        this.isSaving = false;
                        this.confirmErrorMessage = err.error?.message || 'Failed to delete cameras';
                        this.toastService.show(this.confirmErrorMessage, 'error');
                    }
                });
            }
        );
    }

    // Helper for bulk confirm
    private pendingBulkAction: (() => void) | null = null;
    bulkConfirmTitle: string = '';
    bulkConfirmMessage: string = '';
    bulkConfirmBtnText: string = '';

    showBulkConfirm(title: string, message: string, btnText: string, action: () => void) {
        this.bulkConfirmTitle = title;
        this.bulkConfirmMessage = message;
        this.bulkConfirmBtnText = btnText;
        this.pendingBulkAction = action;
        this.isConfirmModalOpen = true;
        // Reset itemToDelete/deviceToDelete so the template knows it's a bulk action
        this.itemToDelete = null;
        this.deviceToDelete = null;
    }

    // Bulk Management
    downloadTemplate() {
        this.cctvService.downloadCameraTemplate().subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Camera_Bulk_Upload_Template.xlsx';
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

    downloadExistingData() {
        const collegeId = this.selectedFilterCollege;
        this.cctvService.downloadCameraData(collegeId).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const fileName = collegeId ? `Camera_Bulk_Edit_${this.selectedFilterCollegeName}.xlsx` : 'Camera_Bulk_Edit_All_Colleges.xlsx';
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
                this.toastService.show('Camera data exported successfully', 'success');
            },
            error: (err) => {
                console.error('Error exporting camera data:', err);
                this.toastService.show('Failed to export camera data', 'error');
            }
        });
    }

    triggerFileInput() {
        if (this.fileInput) {
            this.fileInput.nativeElement.click();
        }
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);

            this.isLoading = true;
            const uploadObservable = this.isBulkEditing
                ? this.cctvService.bulkUpdateCameras(formData)
                : this.cctvService.bulkUploadCameras(formData);

            uploadObservable.subscribe({
                next: (res) => {
                    this.isLoading = false;
                    const msg = this.isBulkEditing
                        ? `Bulk Update Complete: ${res.details.updated} updated, ${res.details.created} created.`
                        : res.message || 'Cameras uploaded successfully!';
                    this.toastService.show(msg, 'success');
                    this.loadCameras();
                    this.closeBulkUploadModal();
                },
                error: (err) => {
                    this.isLoading = false;
                    const errMsg = err.error?.message || 'Failed to process file';
                    const errDetails = err.error?.errors?.join('\n') || '';
                    console.error(errMsg, errDetails);
                    this.toastService.show(errMsg, 'error');
                }
            });

            event.target.value = null;
        }
    }

    openBulkUploadModal(isEdit: boolean = false) {
        this.isBulkEditing = isEdit;
        this.isBulkUploadModalOpen = true;
        this.refreshIcons();
    }

    private refreshIcons() {
        this.iconService.refreshIcons();
    }

    closeBulkUploadModal() {
        this.isBulkUploadModalOpen = false;
        if (this.fileInput && this.fileInput.nativeElement) {
            this.fileInput.nativeElement.value = null;
        }
    }

    hasActionAccess(actionId: string): boolean {
        const user = this.cctvService.userDetails;
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return user.permissions?.actions?.includes(actionId) || false;
    }

    trackByCollegeId(index: number, college: any): string { return college.id; }
    trackByRecordId(index: number, record: any): string { return record.id; }

    trackByIndex(index: number): number { return index; }
}
