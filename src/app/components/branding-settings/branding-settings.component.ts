import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CctvService } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';
import { IconService } from '../../services/icon.service';

@Component({
    selector: 'app-branding-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './branding-settings.component.html',
    styleUrl: './branding-settings.component.scss'
})
export class BrandingSettingsComponent implements OnInit {
    config = {
        appName: '',
        logoUrl: ''
    };
    selectedFile: File | null = null;
    previewUrl: string | null = null;
    isLoading = false;

    constructor(
        private cctvService: CctvService,
        private toastService: ToastService,
        private iconService: IconService
    ) { }

    ngOnInit(): void {
        this.loadConfig();
    }

    loadConfig(): void {
        this.cctvService.getSystemConfig().subscribe({
            next: (config) => {
                if (config) {
                    this.config = { ...this.config, ...config };
                    this.previewUrl = config.logoUrl;
                    this.refreshIcons();
                }
            },
            error: (err) => {
                console.error('Failed to load branding settings', err);
                this.toastService.show('Failed to load branding settings', 'error');
            }
        });
    }

    onFileSelected(event: any): void {
        const file = event.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                this.toastService.show('Please select an image file', 'info');
                return;
            }
            this.selectedFile = file;
            const reader = new FileReader();
            reader.onload = () => {
                this.previewUrl = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    saveSettings(): void {
        if (!this.config.appName.trim()) {
            this.toastService.show('Application name is required', 'info');
            return;
        }

        this.isLoading = true;
        const formData = new FormData();
        formData.append('appName', this.config.appName);
        if (this.selectedFile) {
            formData.append('logo', this.selectedFile);
        }

        this.cctvService.updateSystemConfig(formData).subscribe({
            next: (updatedConfig) => {
                this.isLoading = false;
                this.toastService.show('Branding settings updated successfully', 'success');
                this.selectedFile = null;
                if (updatedConfig) {
                    this.config = { ...this.config, ...updatedConfig };
                    this.previewUrl = updatedConfig.logoUrl;
                    this.refreshIcons();
                }
            },
            error: (err) => {
                this.isLoading = false;
                console.error('Failed to update branding settings', err);
                this.toastService.show('Failed to update branding settings', 'error');
            }
        });
    }

    private refreshIcons() {
        this.iconService.refreshIcons();
    }
}
