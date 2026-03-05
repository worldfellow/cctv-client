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

  constructor(private iconService: IconService) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.iconService.refreshIcons();
    if (this.feed.wsUrl && this.feed.status === 'online') {
      this.initPlayer();
    }
  }

  initPlayer(): void {
    if (typeof JSMpeg !== 'undefined' && this.canvas) {
      this.player = new JSMpeg.Player(this.feed.wsUrl, {
        canvas: this.canvas.nativeElement,
        autoplay: true,
        audio: false, // Dashboard cards are muted by default
        loop: true
      });
    }
  }

  ngOnDestroy(): void {
    if (this.player) {
      this.player.destroy();
    }
  }

  onClick(): void {
    this.viewDetail.emit(this.feed);
  }
}
