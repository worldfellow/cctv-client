import { Component, Input, Output, EventEmitter, AfterViewInit, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CctvFeed } from '../cctv-card/cctv-card.component';
import { CctvService } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';

import { IconService } from '../../services/icon.service';

declare var JSMpeg: any;

@Component({
  selector: 'app-cctv-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cctv-viewer.component.html',
  styleUrl: './cctv-viewer.component.scss'
})
export class CctvViewerComponent implements AfterViewInit, OnDestroy {
  @Input() feed!: CctvFeed;
  @Input() collegeName: string = '';
  @Output() close = new EventEmitter<void>();
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;

  player: any;
  currentQuality: 'high' | 'low' = 'high';

  controls = {
    isRecording: true,
    isMuted: false,
    zoomScale: 1
  };

  constructor(
    private cctvService: CctvService,
    private toastService: ToastService,
    private iconService: IconService,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit(): void {
    this.iconService.refreshIcons();
    if (this.feed.wsUrl && this.feed.status === 'online') {
      this.initPlayer();
    }
  }

  initPlayer(): void {
    if (typeof JSMpeg !== 'undefined' && this.canvas) {
      if (this.player) {
        this.player.destroy();
      }
      this.player = new JSMpeg.Player(this.feed.wsUrl, {
        canvas: this.canvas.nativeElement,
        autoplay: true,
        audio: false,
        loop: true
      });
    }
  }

  ngOnDestroy(): void {
    if (this.player) {
      this.player.destroy();
    }
  }

  setZoom(delta: number): void {
    const newZoom = this.controls.zoomScale + delta;
    if (newZoom >= 1 && newZoom <= 3) {
      this.controls.zoomScale = parseFloat(newZoom.toFixed(1));
    }
  }

  resetZoom(): void {
    this.controls.zoomScale = 1;
  }

  toggleQuality(): void {
    const nextQuality = this.currentQuality === 'high' ? 'low' : 'high';
    this.cctvService.startCameraStream(this.feed.id, nextQuality).subscribe({
      next: (res) => {
        this.currentQuality = nextQuality;
        this.feed.wsUrl = res.wsUrl;
        this.initPlayer();
        this.toastService.show(`Switched to ${nextQuality === 'high' ? 'HD' : 'SD'} quality`, 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to switch quality:', err);
        this.toastService.show('Failed to switch quality', 'error');
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  toggleFullscreen(): void {
    const videoWrapper = document.querySelector('.video-wrapper');
    if (videoWrapper) {
      if (!document.fullscreenElement) {
        videoWrapper.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  }

  toggleRecording(): void {
    this.controls.isRecording = !this.controls.isRecording;
  }

  toggleMute(): void {
    this.controls.isMuted = !this.controls.isMuted;
  }

  captureScreenshot(): void {
    let source: HTMLCanvasElement | HTMLVideoElement | null = null;

    if (this.feed.wsUrl && this.feed.status === 'online' && this.canvas) {
      source = this.canvas.nativeElement;
    } else if (this.videoElement) {
      source = this.videoElement.nativeElement;
    }

    if (!source) {
      console.error('No video source found for screenshot');
      return;
    }

    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Use actual dimensions
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

    tempCanvas.width = width || 1280;
    tempCanvas.height = height || 720;

    // Draw video frame
    ctx.drawImage(source, 0, 0, tempCanvas.width, tempCanvas.height);

    // Overlay Metadata
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();

    // Semi-transparent overlay bar at bottom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, tempCanvas.height - 80, tempCanvas.width, 80);

    // Text configuration
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';

    const padding = 20;
    const line2Y = tempCanvas.height - 20;
    const line1Y = tempCanvas.height - 50;

    ctx.fillText(`${dateStr} ${timeStr}`, padding, line1Y);
    ctx.fillText(`College: ${this.collegeName || 'N/A'}`, padding, line2Y);

    ctx.textAlign = 'right';
    ctx.fillText(`Camera: ${this.feed.name}`, tempCanvas.width - padding, line1Y);
    ctx.fillText(`Location: ${this.feed.location}`, tempCanvas.width - padding, line2Y);

    // Save to Backend
    const dataUrl = tempCanvas.toDataURL('image/png');
    const screenshotData = {
      image: dataUrl,
      collegeName: this.collegeName || 'N/A',
      cameraName: this.feed.name,
      location: this.feed.location,
      date: dateStr,
      time: timeStr
    };

    this.cctvService.saveScreenshot(screenshotData).subscribe({
      next: (res) => {
        console.log('Screenshot saved successfully:', res);
        this.toastService.show('Screenshot saved successfully!', 'success');
      },
      error: (err) => {
        console.error('Failed to save screenshot:', err);
        this.toastService.show('Failed to save screenshot to server.', 'error');
      }
    });

    // Old download logic (removed as per user request)
    /*
    const link = document.createElement('a');
    const safeName = this.feed.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `screenshot_${safeName}_${now.getTime()}.png`;
    link.href = dataUrl;
    link.click();
    */
  }
}
