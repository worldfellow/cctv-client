import { Component, Input, Output, EventEmitter, AfterViewInit, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef, OnInit } from '@angular/core';
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
  @ViewChild('videoWrapper') videoWrapper!: ElementRef<HTMLDivElement>;

  player: any;

  controls = {
    isMuted: false,
    zoomScale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0
  };
  screenshotError: string = '';

  constructor(
    private cctvService: CctvService,
    private toastService: ToastService,
    private iconService: IconService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    document.body.classList.add('modal-open');
  }

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
        disableGl: true, // Force 2D renderer so the frame is preserved for screenshots
        loop: true
      });
    }
  }

  ngOnDestroy(): void {
    if (this.player) {
      this.player.destroy();
    }
    document.body.classList.remove('modal-open');
  }

  setZoom(delta: number): void {
    const newZoom = this.controls.zoomScale + delta;
    if (newZoom >= 1 && newZoom <= 3) {
      this.controls.zoomScale = parseFloat(newZoom.toFixed(1));
      
      // Reset pan if zoomed out to 1
      if (this.controls.zoomScale <= 1) {
        this.controls.panX = 0;
        this.controls.panY = 0;
      }
    }
  }

  resetZoom(): void {
    this.controls.zoomScale = 1;
    this.controls.panX = 0;
    this.controls.panY = 0;
  }

  startDragging(event: MouseEvent): void {
    if (this.controls.zoomScale > 1) {
      this.controls.isDragging = true;
      this.controls.lastMouseX = event.clientX;
      this.controls.lastMouseY = event.clientY;
      event.preventDefault();
    }
  }

  drag(event: MouseEvent): void {
    if (this.controls.isDragging) {
      const deltaX = event.clientX - this.controls.lastMouseX;
      const deltaY = event.clientY - this.controls.lastMouseY;

      this.controls.panX = this.clampPan(this.controls.panX + deltaX, 'x');
      this.controls.panY = this.clampPan(this.controls.panY + deltaY, 'y');

      this.controls.lastMouseX = event.clientX;
      this.controls.lastMouseY = event.clientY;
    }
  }

  stopDragging(): void {
    this.controls.isDragging = false;
  }

  pan(dx: number, dy: number): void {
    this.controls.panX = this.clampPan(this.controls.panX + dx, 'x');
    this.controls.panY = this.clampPan(this.controls.panY + dy, 'y');
  }

  private clampPan(value: number, axis: 'x' | 'y'): number {
    const s = this.controls.zoomScale;
    if (s <= 1) return 0;

    const wrapper = this.videoWrapper?.nativeElement;
    if (!wrapper) return value;

    // Rough limit calculation based on scale
    // We allow panning up to the edge of the screen + a bit more for perspective
    const dim = axis === 'x' ? wrapper.clientWidth : wrapper.clientHeight;
    const limit = (dim * (s - 1)) / 1.8; // Allow slightly more than edge for better feel
    
    return Math.max(-limit, Math.min(limit, value));
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

    // Get source dimensions and calculate target for high-res screenshot
    let sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    let sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

    // Default to HD if dimensions are missing
    sourceWidth = sourceWidth || 1280;
    sourceHeight = sourceHeight || 720;

    // Target minimum resolution (Full HD 1920x1080)
    const targetMinWidth = 1920;
    const targetMinHeight = 1080;

    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;

    // Upscale if below target resolution while preserving aspect ratio
    if (sourceWidth < targetMinWidth || sourceHeight < targetMinHeight) {
      const scale = Math.max(targetMinWidth / sourceWidth, targetMinHeight / sourceHeight);
      targetWidth = Math.round(sourceWidth * scale);
      targetHeight = Math.round(sourceHeight * scale);
    }

    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    
    // FILL BLACK first to avoid transparent backgrounds
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw video frame
    // Draw video frame - capture directly from source canvas
    ctx.drawImage(source, 0, 0, tempCanvas.width, tempCanvas.height);

    // Overlay Metadata
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();

    // Semi-transparent overlay bar at bottom
    const barHeight = Math.max(80, tempCanvas.height * 0.12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, tempCanvas.height - barHeight, tempCanvas.width, barHeight);

    // Responsive Text configuration
    const fontSize = Math.max(16, Math.floor(tempCanvas.width * 0.022)); // Proportional font size
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Arial`;

    const padding = 20;
    const spacing = fontSize * 1.4; // Better line spacing
    const line2Y = tempCanvas.height - (barHeight * 0.25);
    const line1Y = line2Y - spacing;

    // Left Aligned Info
    ctx.textAlign = 'left';
    ctx.fillText(`${dateStr} ${timeStr}`, padding, line1Y);
    ctx.fillText(`College: ${this.collegeName || 'N/A'}`, padding, line2Y);

    // Right Aligned Info
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
        this.screenshotError = '';
        this.toastService.show('Screenshot saved successfully!', 'success');
      },
      error: (err) => {
        console.error('Failed to save screenshot:', err);
        this.screenshotError = err.error?.message || 'Failed to save screenshot to server. Please check connection and try again.';
        this.toastService.show(this.screenshotError, 'error');
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
