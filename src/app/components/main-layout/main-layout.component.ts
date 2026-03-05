import { Component, AfterViewInit, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ThemeService, ThemeType } from '../../services/theme.service';
import { CctvService, User } from '../../services/cctv.service';
import { IconService } from '../../services/icon.service';
import { Subscription } from 'rxjs';
import Keycloak from 'keycloak-js';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  isSidebarOpen: boolean = true;
  isMobile: boolean = false;
  searchQuery: string = '';
  showThemeMenu: boolean = false;
  isLogoEnlarged: boolean = false;
  private routerSubscription: Subscription;
  private configSubscription: Subscription;
  private keycloak = inject(Keycloak);

  constructor(
    private router: Router,
    public themeService: ThemeService,
    private cctvService: CctvService,
    private iconService: IconService
  ) {
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if (window.innerWidth <= 768) {
          this.isSidebarOpen = false;
        }
        this.refreshIcons();
      }
    });

    this.configSubscription = this.cctvService.systemConfig$.subscribe(() => {
      this.refreshIcons();
    });
  }

  ngOnInit(): void {
    this.checkScreenSize();
    this.refreshIcons();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth <= 768;
    if (this.isMobile) {
      this.isSidebarOpen = false;
    } else {
      this.isSidebarOpen = true; // Or keep current state if resizing on desktop
    }
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
  }

  ngAfterViewInit(): void {
    this.refreshIcons();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    this.refreshIcons();
  }

  onNavClick(): void {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
    this.refreshIcons();
  }

  toggleThemeMenu(): void {
    this.showThemeMenu = !this.showThemeMenu;
    this.refreshIcons();
  }

  changeTheme(theme: ThemeType): void {
    this.themeService.setTheme(theme);
    this.showThemeMenu = false;
    this.refreshIcons();
  }

  get user$() {
    return this.cctvService.userDetails$;
  }

  get config$() {
    return this.cctvService.systemConfig$;
  }

  isSuperAdmin(user: User | null): boolean {
    return user?.role === 'SUPER_ADMIN';
  }

  hasMenuAccess(user: User | null, menuId: string): boolean {
    if (!user) return false;
    if (this.isSuperAdmin(user)) return true;
    return user.permissions?.menus?.includes(menuId) || false;
  }

  logout(): void {
    this.cctvService.clearAuth();
    localStorage.removeItem('kc_token');
    localStorage.removeItem('kc_refreshToken');
    localStorage.removeItem('kc_idToken');
    this.keycloak.logout({
      redirectUri: window.location.origin + '/login'
    });
  }

  toggleEnlargedLogo(): void {
    this.isLogoEnlarged = !this.isLogoEnlarged;
  }

  private refreshIcons(): void {
    this.iconService.refreshIcons();
  }
}
