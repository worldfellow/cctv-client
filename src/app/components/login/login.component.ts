import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CctvService } from '../../services/cctv.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { environment } from '../../../environments/environment';

import { IconService } from '../../services/icon.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, AfterViewInit {
  private router = inject(Router);
  private session = inject(AuthSessionService);
  private cctvService = inject(CctvService);
  private iconService = inject(IconService);

  loginData = {
    email: '',
    password: ''
  };

  errorMessage = '';
  isLoading = false;
  // Logo URL whose image failed to load; the shield placeholder is shown instead
  failedLogoUrl: string | null = null;

  onLogoError(url: string): void {
    this.failedLogoUrl = url;
    this.refreshIcons();
  }

  get config$() {
    return this.cctvService.systemConfig$;
  }

  // Change password modal state
  showChangePassword = false;
  changePasswordData = {
    newPassword: '',
    confirmPassword: ''
  };
  changePasswordError = '';
  isChangingPassword = false;
  
  // Password visibility states
  showPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  togglePasswordVisibility(field: 'login' | 'new' | 'confirm'): void {
    if (field === 'login') this.showPassword = !this.showPassword;
    if (field === 'new') this.showNewPassword = !this.showNewPassword;
    if (field === 'confirm') this.showConfirmPassword = !this.showConfirmPassword;
    this.refreshIcons();
  }

  async ngOnInit(): Promise<void> {
    // Restore an existing session (token still valid), then check the account state before going to the dashboard
    if (!this.session.isAuthenticated) {
      this.session.clear();
      return;
    }

    const profile = this.session.getProfileFromToken();
    const email = profile.email;
    this.loginData.email = email;
    this.cctvService.setUserDetails(profile);

    try {
      const status = await this.cctvService.checkPasswordStatus(email).toPromise();
      if (status && !status.isActive) {
        this.errorMessage = 'Your account has been deactivated. Please contact an administrator.';
        this.session.clear();
        return;
      }
      if (status?.mustChangePassword) {
        this.session.clear();
        return;
      }
    } catch (err) {
      console.warn('Could not check password status:', err);
    }

    this.router.navigate(['/dashboard']);
  }

  ngAfterViewInit(): void {
    this.refreshIcons();
  }

  async onLogin(): Promise<void> {
    this.errorMessage = '';
    this.isLoading = true;

    try {
      // Login goes through our backend (service-account client); the browser never calls Keycloak directly
      const response = await fetch(`${environment.apiUrl}/auth/keycloak-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.loginData.email, password: this.loginData.password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // Check if the error is because account is not fully set up (temporary password)
        if (errorData?.error === 'invalid_grant' && errorData?.error_description?.includes('not fully set up')) {
          // User has a temporary password in Keycloak — show change password modal
          this.showChangePassword = true;
          this.isLoading = false;
          this.refreshIcons();
          return;
        }

        if (response.status === 401 || response.status === 400) {
          this.errorMessage = 'Invalid email or password. Please try again.';
        } else {
          this.errorMessage = 'Login failed. Please try again.';
        }
        this.isLoading = false;
        return;
      }

      const tokenData = await response.json();

      // Store the tokens issued by the backend
      this.setupKeycloakTokens(tokenData);

      // Check if user must change password (from our DB flag)
      try {
        const statusResponse = await this.cctvService.checkPasswordStatus(this.loginData.email).toPromise();
        if (statusResponse && !statusResponse.isActive) {
          this.errorMessage = 'Your account has been deactivated. Please contact an administrator.';
          this.isLoading = false;
          return;
        }
        if (statusResponse?.mustChangePassword) {
          this.showChangePassword = true;
          this.isLoading = false;
          this.refreshIcons();
          return;
        }
      } catch (err) {
        // If check fails, proceed to dashboard (don't block login)
        console.warn('Could not check password status:', err);
      }

      // Load profile and navigate to dashboard
      await this.loadProfileAndNavigate();
    } catch (error: any) {
      console.error('Login error:', error);
      this.errorMessage = 'Login failed. Please check your connection and try again.';
    } finally {
      this.isLoading = false;
      this.refreshIcons();
    }
  }

  async onChangePassword(): Promise<void> {
    this.changePasswordError = '';

    if (this.changePasswordData.newPassword.length < 6) {
      this.changePasswordError = 'Password must be at least 6 characters long.';
      return;
    }

    if (this.changePasswordData.newPassword !== this.changePasswordData.confirmPassword) {
      this.changePasswordError = 'Passwords do not match.';
      return;
    }

    this.isChangingPassword = true;

    try {
      await this.cctvService.changePassword(
        this.loginData.email,
        this.changePasswordData.newPassword
      ).toPromise();

      // Re-authenticate with the new password
      const response = await fetch(`${environment.apiUrl}/auth/keycloak-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.loginData.email, password: this.changePasswordData.newPassword })
      });

      if (!response.ok) {
        this.changePasswordError = 'Password changed but login failed. Please sign in again.';
        this.showChangePassword = false;
        this.isChangingPassword = false;
        return;
      }

      const tokenData = await response.json();
      this.setupKeycloakTokens(tokenData);

      // Navigate to dashboard
      await this.loadProfileAndNavigate();
    } catch (error: any) {
      console.error('Change password error:', error);
      this.changePasswordError = 'Failed to change password. Please try again.';
    } finally {
      this.isChangingPassword = false;
      this.refreshIcons();
    }
  }

  private setupKeycloakTokens(tokenData: any): void {
    this.session.setTokens(tokenData);
  }

  private async loadProfileAndNavigate(): Promise<void> {
    try {
      // Fetch full user profile from our backend after Keycloak authentication
      await firstValueFrom(this.cctvService.getProfile());
    } catch (error) {
      console.error('Failed to load full user profile after login:', error);

      // Fallback to the token claims if backend fails
      this.cctvService.setUserDetails(this.session.getProfileFromToken());
    }
    this.router.navigate(['/dashboard']);
  }

  private refreshIcons(): void {
    this.iconService.refreshIcons();
  }
}

