import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IconService } from '../../services/icon.service';
import { CctvService } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';

declare var JSMpeg: any;

export interface CctvFeed {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  thumbnail: string;
  streamUrl?: string; // RTSP or MP4 for viewer
  wsUrl?: string;     // WebSocket for dashboard card
}

@Component({
  selector: 'app-cctv-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cctv-card.component.html',
  styleUrl: './cctv-card.component.scss'
})
export class CctvCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() feed!: CctvFeed;
  @Output() viewDetail = new EventEmitter<CctvFeed>();
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  player: any;

  constructor(
    private iconService: IconService, 
    private elementRef: ElementRef, 
    private cctvService: CctvService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.iconService.refreshIcons();
    this.initPlayer();
  }


  initPlayer(): void {
    if (typeof JSMpeg !== 'undefined' && this.canvas && !this.player) {
      this.player = new JSMpeg.Player(this.feed.wsUrl, {
        canvas: this.canvas.nativeElement,
        autoplay: true,
        audio: false,
        disableGl: false, // Performance
        videoBufferSize: 512 * 1024, // Dashboard cards are small
        throttled: false,
        loop: true
      });
    }
  }

  stopPlayer(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  ngOnDestroy(): void {
    this.stopPlayer();
  }

  onClick(): void {
    this.viewDetail.emit(this.feed);
  }

  onRestart(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.feed.id) return;

    this.toastService.show('Restarting stream...', 'info');
    
    this.cctvService.restartDashboardStream(this.feed.id).subscribe({
      next: (res) => {
        if (res && res.wsUrl) {
          this.feed.wsUrl = res.wsUrl;
        }
        this.stopPlayer();
        this.toastService.show('Stream restart initiated', 'success');
        setTimeout(() => {
          this.initPlayer();
          this.iconService.refreshIcons();
        }, 1500);
      },
      error: (err) => {
        console.error('Failed to restart stream:', err);
        this.toastService.show('Failed to restart stream', 'error');
      }
    });
  }
}
