import { Component, Input, Output, EventEmitter, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CctvFeed } from '../cctv-card/cctv-card.component';

declare var lucide: any;
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
  @Output() close = new EventEmitter<void>();
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  player: any;

  controls = {
    isRecording: true,
    isMuted: false,
    zoom: 100
  };

  ngAfterViewInit(): void {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    if (this.feed.wsUrl && this.feed.status === 'online') {
      this.initPlayer();
    }
  }

  initPlayer(): void {
    if (typeof JSMpeg !== 'undefined' && this.canvas) {
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
}
