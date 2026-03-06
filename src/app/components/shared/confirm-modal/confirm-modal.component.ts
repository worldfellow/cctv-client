import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IconService } from '../../../services/icon.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="isOpen" (click)="onCancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">
            <i data-lucide="alert-triangle" class="warning-icon"></i>
            {{ title }}
          </div>
          <button class="close-btn" (click)="onCancel()">
            <i data-lucide="x"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <p>{{ message }}</p>
          
          <div class="error-alert" *ngIf="errorMessage">
            <i data-lucide="alert-circle"></i>
            <span>{{ errorMessage }}</span>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="onCancel()" [disabled]="isLoading">Cancel</button>
          <button class="btn btn-danger" (click)="onConfirm()" [disabled]="isLoading">
            <i *ngIf="isLoading" data-lucide="loader-2" class="spin"></i>
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      width: 90%;
      max-width: 450px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalSlide {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 12px;

      .warning-icon {
        color: #ef4444;
        width: 24px;
        height: 24px;
      }
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;

      &:hover {
        background: rgba(128, 128, 128, 0.1);
        color: var(--text-main);
      }

      i { width: 20px; height: 20px; }
    }

    .modal-body {
      padding: 24px;
      color: var(--text-muted);
      font-size: 1rem;
      line-height: 1.5;
    }

    .error-alert {
      margin-top: 16px;
      padding: 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ef4444;
      font-size: 0.875rem;

      i { width: 16px; height: 16px; flex-shrink: 0; }
    }

    .modal-footer {
      padding: 20px 24px;
      border-top: 1px solid var(--card-border);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }

    .btn-secondary {
      background: var(--input-bg);
      color: var(--text-main);
      border: 1px solid var(--card-border);

      &:hover:not(:disabled) {
        background: var(--card-border);
      }
    }

    .btn-danger {
      background: #ef4444;
      color: white;

      &:hover:not(:disabled) {
        background: #dc2626;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `
})
export class ConfirmModalComponent implements OnChanges, AfterViewInit {
  @Input() isOpen: boolean = false;
  @Input() title: string = 'Confirm Action';
  @Input() message: string = 'Are you sure you want to proceed?';
  @Input() confirmText: string = 'Yes, Delete';
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  constructor(private iconService: IconService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.refreshIcons();
    }
  }

  ngAfterViewInit(): void {
    this.refreshIcons();
  }

  refreshIcons(): void {
    this.iconService.refreshIcons();
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
