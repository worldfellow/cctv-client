import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

const W = 600, H = 180, GROUND = 150;

@Component({
    selector: 'app-rate-limited',
    standalone: true,
    templateUrl: './rate-limited.component.html',
    styleUrl: './rate-limited.component.scss'
})
export class RateLimitedComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private zone = inject(NgZone);

    @ViewChild('game', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    total = 60;
    remaining = 60;
    blocked = false;
    private back = '/dashboard';
    private timer?: ReturnType<typeof setInterval>;

    // --- game state ---
    private ctx!: CanvasRenderingContext2D;
    private raf = 0;
    private last = 0;
    private y = 0; private vy = 0;           // dragon height above ground / velocity
    private obstacles: { x: number; w: number; h: number }[] = [];
    private clouds: { x: number; y: number }[] = [];
    private speed = 260; private spawnIn = 1; private score = 0; private best = 0;
    private dead = false; private started = false; private t = 0;

    ngOnInit(): void {
        const q = this.route.snapshot.queryParamMap;
        this.total = Math.min(Math.max(parseInt(q.get('wait') || '60', 10) || 60, 1), 3600);
        this.remaining = this.total;
        this.blocked = q.get('blocked') === '1';
        const back = q.get('back') || '/dashboard';
        this.back = back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/too-many-requests') ? back : '/dashboard';

        // Reuse the saved end time (survives reload) so the countdown never restarts from the full wait
        let endAt = Date.now() + this.total * 1000;
        try {
            const saved = JSON.parse(localStorage.getItem('rateLimit') || 'null');
            if (saved && saved.endAt > Date.now()) {
                endAt = saved.endAt;
                this.total = Math.max(this.total, Math.ceil((endAt - Date.now()) / 1000));
                this.blocked = this.blocked || !!saved.blocked;
                if (!q.get('back') && typeof saved.back === 'string' && saved.back.startsWith('/') && !saved.back.startsWith('//') && !saved.back.startsWith('/too-many-requests')) this.back = saved.back;
            } else {
                localStorage.setItem('rateLimit', JSON.stringify({ endAt, back: this.back, blocked: this.blocked }));
            }
        } catch { /* ignore */ }
        this.remaining = Math.max(Math.ceil((endAt - Date.now()) / 1000), 0);
        this.timer = setInterval(() => {
            this.remaining = Math.max(Math.ceil((endAt - Date.now()) / 1000), 0);
            if (this.remaining === 0) clearInterval(this.timer);
        }, 250);

        this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
        this.clouds = [{ x: 120, y: 40 }, { x: 380, y: 70 }, { x: 560, y: 30 }];
        this.zone.runOutsideAngular(() => { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); });
    }

    ngOnDestroy(): void {
        clearInterval(this.timer);
        cancelAnimationFrame(this.raf);
    }

    get display(): string {
        const m = Math.floor(this.remaining / 60), s = this.remaining % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
    get dashOffset(): number { return 326.7 * (1 - this.remaining / this.total); }

    goBack(): void {
        if (this.remaining > 0) return;
        try { localStorage.removeItem('rateLimit'); } catch { /* ignore */ }
        // After the client's own five-failure block a full reload is needed to reset the counters
        if (this.blocked) window.location.href = this.back;
        else this.router.navigateByUrl(this.back);
    }

    // ---------- dragon game ----------
    @HostListener('window:keydown', ['$event'])
    onKey(e: KeyboardEvent): void {
        if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); this.jump(); }
    }

    jump(): void {
        if (this.dead) { this.reset(); return; }
        this.started = true;
        if (this.y === 0) this.vy = 560;
    }

    private reset(): void {
        this.obstacles = []; this.score = 0; this.speed = 260; this.spawnIn = 1;
        this.y = 0; this.vy = 0; this.dead = false; this.started = true;
    }

    private loop = (now: number) => {
        const dt = Math.min((now - this.last) / 1000, 0.05);
        this.last = now;
        this.t += dt;
        if (this.started && !this.dead) this.update(dt);
        this.draw();
        this.raf = requestAnimationFrame(this.loop);
    };

    private update(dt: number): void {
        if (this.y > 0 || this.vy > 0) {
            this.y += this.vy * dt; this.vy -= 1700 * dt;
            if (this.y <= 0) { this.y = 0; this.vy = 0; }
        }
        this.spawnIn -= dt;
        if (this.spawnIn <= 0) {
            const big = Math.random() < 0.35;
            this.obstacles.push({ x: W + 20, w: big ? 26 : 16, h: big ? 46 : 30 });
            this.spawnIn = 0.9 + Math.random() * 1.1 - Math.min(this.score / 3000, 0.4);
        }
        this.obstacles.forEach(o => o.x -= this.speed * dt);
        this.obstacles = this.obstacles.filter(o => o.x + o.w > -10);
        this.clouds.forEach(c => { c.x -= 30 * dt; if (c.x < -60) { c.x = W + 20; c.y = 20 + Math.random() * 60; } });
        this.score += this.speed * dt * 0.05;
        this.speed = Math.min(this.speed + 6 * dt, 520);

        // collision (slightly forgiving hit box)
        const dx = 50, dw = 34, dh = 30, top = GROUND - this.y - dh;
        for (const o of this.obstacles) {
            if (dx + dw - 6 > o.x && dx + 6 < o.x + o.w && top + dh - 4 > GROUND - o.h) {
                this.dead = true; this.best = Math.max(this.best, Math.floor(this.score));
            }
        }
    }

    private draw(): void {
        const c = this.ctx;
        c.clearRect(0, 0, W, H);
        c.fillStyle = 'rgba(148,163,184,.25)';
        this.clouds.forEach(cl => { c.fillRect(cl.x, cl.y, 38, 8); c.fillRect(cl.x + 8, cl.y - 6, 22, 6); });
        c.fillStyle = '#334155'; c.fillRect(0, GROUND + 1, W, 2);
        c.fillStyle = '#475569';
        const off = (this.t * this.speed) % 40;
        for (let x = -off; x < W; x += 40) c.fillRect(x, GROUND + 8, 14, 2);
        this.obstacles.forEach(o => {
            c.fillStyle = '#64748b';
            c.beginPath(); c.moveTo(o.x, GROUND); c.lineTo(o.x + o.w / 2, GROUND - o.h); c.lineTo(o.x + o.w, GROUND); c.closePath(); c.fill();
            c.fillStyle = '#94a3b8'; c.fillRect(o.x + o.w / 2 - 1, GROUND - o.h + 6, 2, 8);
        });
        this.drawDragon(50, GROUND - this.y);
        c.fillStyle = '#cbd5e1'; c.font = '14px monospace'; c.textAlign = 'right';
        c.fillText(`HI ${String(this.best).padStart(5, '0')}  ${String(Math.floor(this.score)).padStart(5, '0')}`, W - 12, 20);
        c.textAlign = 'center';
        if (!this.started) { c.fillStyle = '#94a3b8'; c.fillText('Press Space or tap to start', W / 2, 90); }
        if (this.dead) {
            c.fillStyle = '#f8fafc'; c.font = 'bold 20px monospace'; c.fillText('G A M E   O V E R', W / 2, 80);
            c.font = '13px monospace'; c.fillText('tap / Space to restart', W / 2, 104);
        }
    }

    private drawDragon(x: number, footY: number): void {
        const c = this.ctx;
        const run = this.started && !this.dead && this.y === 0 ? Math.floor(this.t * 12) % 2 : 0;
        const y = footY - 30;
        c.fillStyle = this.dead ? '#ef4444' : '#22c55e';
        c.fillRect(x + 6, y + 8, 26, 14);   // body
        c.fillRect(x + 24, y, 14, 12);      // head
        c.fillRect(x + 36, y + 4, 6, 6);    // snout
        c.fillRect(x, y + 12, 8, 6);        // tail
        c.fillRect(x - 6, y + 16, 8, 4);
        c.fillStyle = '#16a34a';            // wing (flaps)
        const wing = this.y > 0 ? -6 : (run ? -4 : 0);
        c.beginPath(); c.moveTo(x + 10, y + 8); c.lineTo(x + 18, y + wing - 6); c.lineTo(x + 24, y + 8); c.closePath(); c.fill();
        c.fillStyle = this.dead ? '#ef4444' : '#22c55e';  // legs
        if (this.y > 0) { c.fillRect(x + 10, y + 22, 5, 8); c.fillRect(x + 22, y + 22, 5, 8); }
        else { c.fillRect(x + 10, y + 22, 5, run ? 8 : 5); c.fillRect(x + 22, y + 22, 5, run ? 5 : 8); }
        c.fillStyle = '#fbbf24'; c.fillRect(x + 28, y - 4, 3, 5); c.fillRect(x + 33, y - 3, 3, 4);  // horns
        c.fillStyle = '#0f172a'; c.fillRect(x + 31, y + 3, 3, 3);                                   // eye
        if (!this.dead && this.started && this.y === 0 && run) { c.fillStyle = '#f97316'; c.fillRect(x + 42, y + 5, 5, 3); }  // fire flicker
    }
}
