import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IconService } from '../../services/icon.service';

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
  private observer: IntersectionObserver | null = null;

  constructor(private iconService: IconService, private elementRef: ElementRef) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.iconService.refreshIcons();
    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver(): void {
    if (this.feed.wsUrl && this.feed.status === 'online') {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.initPlayer();
          } else {
            this.stopPlayer();
          }
        });
      }, { threshold: 0.1 });
      
      this.observer.observe(this.elementRef.nativeElement);
    }
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
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  onClick(): void {
    this.viewDetail.emit(this.feed);
  }
}
