import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../services/toast.service';
import { IconService } from '../../../services/icon.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div 
        *ngFor="let toast of toastService.toasts()" 
        class="toast" 
        [ngClass]="'toast-' + toast.type"
        @fadeUpdate>
        
        <i [attr.data-lucide]="getIcon(toast.type)" class="toast-icon"></i>
        <div class="toast-message">{{ toast.message }}</div>
        
        <button class="toast-close" (click)="remove(toast.id)">
          <i data-lucide="x"></i>
        </button>
      </div>
    </div>
  `,
  styles: `
    /* ... existing styles ... */
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      gap: 12px;
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      min-width: 300px;
      max-width: 400px;
      transform-origin: bottom center;
    }

    .toast-success {
      border-left: 4px solid #10b981;
    }

    .toast-error {
      border-left: 4px solid #ef4444;
    }

    .toast-info {
      border-left: 4px solid #3b82f6;
    }

    .toast-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .toast-success .toast-icon { color: #10b981; }
    .toast-error .toast-icon { color: #ef4444; }
    .toast-info .toast-icon { color: #3b82f6; }

    .toast-message {
      flex: 1;
      color: #f8fafc;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .toast-close {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;

      &:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.1);
      }
      
      i {
        width: 16px;
        height: 16px;
      }
    }
  `,
  animations: [
    trigger('fadeUpdate', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px) scale(0.95)' }),
        animate('200ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('150ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translateY(10px) scale(0.95)' }))
      ])
    ])
  ]
})
export class ToastComponent {
  constructor(
    public toastService: ToastService,
    private iconService: IconService
  ) {
    effect(() => {
      this.toastService.toasts();
      this.refreshIcons();
    });
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'check-circle-2';
      case 'error': return 'alert-circle';
      case 'info': return 'info';
      default: return 'bell';
    }
  }

  remove(id: string) {
    this.toastService.remove(id);
  }

  private refreshIcons() {
    this.iconService.refreshIcons();
  }
}
