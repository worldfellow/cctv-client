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
  showUserMenu: boolean = false;
  isLogoEnlarged: boolean = false;
  isChangePasswordModalOpen: boolean = false;

  // Change Password Form
  changePasswordModel = {
    newPassword: '',
    confirmPassword: ''
  };
  passwordStrength: string = '';
  strengthProgress: number = 0;
  strengthColor: string = '';
  passwordError: string = '';
  isUpdatingPassword: boolean = false;

  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  hasSpaceError: boolean = false;

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

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    this.showThemeMenu = false;
    this.refreshIcons();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-profile-container') && !target.closest('.user-menu')) {
      this.showUserMenu = false;
    }
    if (!target.closest('.theme-switcher') && !target.closest('.theme-menu')) {
      this.showThemeMenu = false;
    }
  }

  openChangePasswordModal(): void {
    this.isChangePasswordModalOpen = true;
    this.showUserMenu = false;
    this.changePasswordModel = { newPassword: '', confirmPassword: '' };
    this.passwordStrength = '';
    this.strengthProgress = 0;
    this.passwordError = '';
    this.refreshIcons();
  }

  closeChangePasswordModal(): void {
    this.isChangePasswordModalOpen = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.refreshIcons();
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
    this.refreshIcons();
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
    this.refreshIcons();
  }

  onConfirmPasswordInput(password: string) {
    if (/\s/.test(password)) {
      this.hasSpaceError = true;
      this.changePasswordModel.confirmPassword = password.replace(/\s/g, '');
      setTimeout(() => this.hasSpaceError = false, 3000);
    }
  }

  checkPasswordStrength(password: string) {
    if (/\s/.test(password)) {
      this.hasSpaceError = true;
      this.changePasswordModel.newPassword = password.replace(/\s/g, '');
      password = this.changePasswordModel.newPassword;
      setTimeout(() => this.hasSpaceError = false, 3000);
    }

    if (!password) {
      this.passwordStrength = '';
      this.strengthProgress = 0;
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) strength += 25;
    else if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) strength += 15;

    this.strengthProgress = strength;
    if (strength <= 30) {
      this.passwordStrength = 'Weak';
      this.strengthColor = '#f87171';
    } else if (strength <= 70) {
      this.passwordStrength = 'Medium';
      this.strengthColor = '#fbbf24';
    } else {
      this.passwordStrength = 'Strong';
      this.strengthColor = '#34d399';
    }
  }

  validatePassword(): boolean {
    const p = this.changePasswordModel.newPassword;
    if (p.length < 8) {
      this.passwordError = 'Password must be at least 8 characters long';
      return false;
    }
    if (!/[A-Z]/.test(p)) {
      this.passwordError = 'Password must include at least one capital letter';
      return false;
    }
    if (!/[a-z]/.test(p)) {
      this.passwordError = 'Password must include at least one small letter';
      return false;
    }
    if (!/[0-9]/.test(p)) {
      this.passwordError = 'Password must include at least one number';
      return false;
    }
    if (!/[^A-Za-z0-9]/.test(p)) {
      this.passwordError = 'Password must include at least one special character';
      return false;
    }
    if (/\s/.test(p)) {
      this.passwordError = 'Spaces are not allowed in password';
      return false;
    }
    if (p !== this.changePasswordModel.confirmPassword) {
      this.passwordError = 'Passwords do not match';
      return false;
    }
    this.passwordError = '';
    return true;
  }

  get isPasswordComplexityValid(): boolean {
    const p = this.changePasswordModel.newPassword;
    return p.length >= 8 &&
      /[A-Z]/.test(p) &&
      /[a-z]/.test(p) &&
      /[0-9]/.test(p) &&
      /[^A-Za-z0-9]/.test(p) &&
      !/\s/.test(p);
  }

  hasCapitalLetter(p: string): boolean {
    return /[A-Z]/.test(p);
  }

  hasSmallLetter(p: string): boolean {
    return /[a-z]/.test(p);
  }

  hasNumber(p: string): boolean {
    return /[0-9]/.test(p);
  }

  hasSpecialChar(p: string): boolean {
    return /[^A-Za-z0-9]/.test(p);
  }

  async updatePassword() {
    if (!this.validatePassword()) return;

    this.isUpdatingPassword = true;
    try {
      const user = await new Promise<any>(resolve => this.user$.subscribe(resolve));
      if (!user) throw new Error('User not found');

      await this.cctvService.updateProfilePassword(this.changePasswordModel.newPassword).toPromise();
      alert('Password updated successfully!');
      this.closeChangePasswordModal();
    } catch (error: any) {
      console.error('Update password error:', error);
      this.passwordError = error.error?.message || 'Failed to update password. Please try again.';
    } finally {
      this.isUpdatingPassword = false;
    }
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
