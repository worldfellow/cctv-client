import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CctvService, Device, College } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmModalComponent } from '../shared/confirm-modal/confirm-modal.component';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-device-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, LucideAngularModule, ConfirmModalComponent],
  templateUrl: './device-setup.component.html',
  styleUrl: './device-setup.component.scss'
})
export class DeviceSetupComponent implements OnInit {
  @ViewChild('rtspInput') rtspInput!: ElementRef<HTMLInputElement>;
  deviceForm: FormGroup;
  devices: Device[] = [];
  colleges: College[] = [];
  isLoading = false;
  isEditing = false;
  editingId: string | null = null;
  isModalOpen = false;
  isViewLinkModalOpen = false;
  selectedLinkForView = '';

  // Confirm Modal state
  isConfirmModalOpen = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  deviceToDelete: string | null = null;

  constructor(
    private fb: FormBuilder,
    private cctvService: CctvService,
    private toastService: ToastService
  ) {
    this.deviceForm = this.fb.group({
      deviceName: ['', Validators.required],
      rtspLink: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadColleges();
    this.loadDevices();
  }

  loadColleges(): void {
    this.cctvService.getAllActiveColleges().subscribe({
      next: (colleges) => this.colleges = colleges,
      error: (err) => console.error('Error loading colleges', err)
    });
  }

  loadDevices(): void {
    this.isLoading = true;
    this.cctvService.getDevices().subscribe({
      next: (devices) => {
        this.devices = devices;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading devices', err);
        this.isLoading = false;
        this.toastService.show('Error loading devices', 'error');
      }
    });
  }

  openModal(device?: Device): void {
    this.isModalOpen = true;
    if (device) {
      this.isEditing = true;
      this.editingId = device.id!;
      this.deviceForm.patchValue(device);
    } else {
      this.isEditing = false;
      this.editingId = null;
      this.deviceForm.reset({
        deviceName: '',
        rtspLink: 'rtsp://$userTemplate:$passwordTemplate@$ipTemplate:$portTemplate/Streaming/Channels/$channelTemplate'
      });
    }
  }

  insertTemplate(placeholder: string): void {
    const input = this.rtspInput.nativeElement;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentLink = this.deviceForm.get('rtspLink')?.value || '';

    // Insert at selection/cursor
    const newValue = currentLink.substring(0, start) + placeholder + currentLink.substring(end);
    this.deviceForm.get('rtspLink')?.setValue(newValue);

    // Set cursor after inserted text
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.deviceForm.reset();
  }

  viewFullLink(link: string): void {
    this.selectedLinkForView = link;
    this.isViewLinkModalOpen = true;
  }

  closeViewLinkModal(): void {
    this.isViewLinkModalOpen = false;
    this.selectedLinkForView = '';
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.show('Link copied to clipboard', 'success');
    });
  }

  onSubmit(): void {
    if (this.deviceForm.invalid) return;

    this.isLoading = true;
    const deviceData = this.deviceForm.value;

    if (this.isEditing && this.editingId) {
      this.cctvService.updateDevice(this.editingId, deviceData).subscribe({
        next: () => {
          this.handleSuccess('Device updated successfully');
          this.loadDevices();
        },
        error: (err) => this.handleError('Error updating device', err)
      });
    } else {
      this.cctvService.createDevice(deviceData).subscribe({
        next: () => {
          this.handleSuccess('Device created successfully');
          this.loadDevices();
        },
        error: (err) => this.handleError('Error creating device', err)
      });
    }
  }

  confirmDelete(id: string): void {
    this.deviceToDelete = id;
    this.confirmModalTitle = 'Delete Device';
    this.confirmModalMessage = 'Are you sure you want to delete this device? This action cannot be undone.';
    this.isConfirmModalOpen = true;
  }

  onConfirmDelete(): void {
    if (!this.deviceToDelete) return;

    this.isLoading = true;
    this.cctvService.deleteDevice(this.deviceToDelete).subscribe({
      next: () => {
        this.isConfirmModalOpen = false;
        this.deviceToDelete = null;
        this.handleSuccess('Device deleted successfully');
        this.loadDevices();
      },
      error: (err) => {
        this.isConfirmModalOpen = false;
        this.handleError('Error deleting device', err);
      }
    });
  }

  onCancelDelete(): void {
    this.isConfirmModalOpen = false;
    this.deviceToDelete = null;
  }

  private handleSuccess(message: string): void {
    this.isLoading = false;
    this.closeModal();
    this.toastService.show(message, 'success');
  }

  private handleError(message: string, error: any): void {
    this.isLoading = false;
    console.error(error);
    this.toastService.show(message, 'error');
  }

  getCollegeName(id: string): string {
    const college = this.colleges.find(c => c.id === id);
    return college ? college.name : 'Unknown';
  }
}
