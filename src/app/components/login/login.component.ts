import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Keycloak from 'keycloak-js';
import { CctvService } from '../../services/cctv.service';
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
  private keycloak = inject(Keycloak);
  private cctvService = inject(CctvService);
  private iconService = inject(IconService);

  loginData = {
    email: '',
    password: ''
  };

  errorMessage = '';
  isLoading = false;

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
    // If already authenticated, check password status before going to dashboard
    if (this.keycloak.authenticated) {
      try {
        const profile = await this.keycloak.loadUserProfile();
        const email = profile.email || '';
        this.loginData.email = email;
        this.cctvService.setUserDetails({
          keycloakId: profile.id || '',
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: email,
          mobileNo: '',
          role: this.getRoleFromToken()
        });

        // Check if password change is still required — clear session and stay on login
        try {
          const status = await this.cctvService.checkPasswordStatus(email).toPromise();
          if (status && !status.isActive) {
            this.errorMessage = 'Your account has been deactivated. Please contact an administrator.';
            localStorage.removeItem('kc_token');
            localStorage.removeItem('kc_refreshToken');
            localStorage.removeItem('kc_idToken');
            (this.keycloak as any).authenticated = false;
            return;
          }
          if (status?.mustChangePassword) {
            localStorage.removeItem('kc_token');
            localStorage.removeItem('kc_refreshToken');
            localStorage.removeItem('kc_idToken');
            (this.keycloak as any).authenticated = false;
            return;
          }
        } catch (err) {
          console.warn('Could not check password status:', err);
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
      this.router.navigate(['/dashboard']);
      return;
    }

    // Try restoring session from localStorage
    const savedToken = localStorage.getItem('kc_token');
    const savedRefreshToken = localStorage.getItem('kc_refreshToken');
    if (savedToken && savedRefreshToken) {
      (this.keycloak as any).token = savedToken;
      (this.keycloak as any).refreshToken = savedRefreshToken;
      (this.keycloak as any).idToken = localStorage.getItem('kc_idToken') || '';
      (this.keycloak as any).authenticated = true;

      // Parse the saved token
      try {
        const tokenParts = savedToken.split('.');
        const tokenPayload = JSON.parse(atob(tokenParts[1]));
        (this.keycloak as any).tokenParsed = tokenPayload;
        (this.keycloak as any).subject = tokenPayload.sub;
        (this.keycloak as any).realmAccess = tokenPayload.realm_access;
        (this.keycloak as any).resourceAccess = tokenPayload.resource_access;

        // Check if token is expired
        if (tokenPayload.exp && tokenPayload.exp * 1000 < Date.now()) {
          // Token expired, clear storage and stay on login
          localStorage.removeItem('kc_token');
          localStorage.removeItem('kc_refreshToken');
          localStorage.removeItem('kc_idToken');
          (this.keycloak as any).authenticated = false;
          return;
        }

        const email = tokenPayload.email || '';
        this.loginData.email = email;
        this.cctvService.setUserDetails({
          keycloakId: tokenPayload.sub || '',
          firstName: tokenPayload.given_name || '',
          lastName: tokenPayload.family_name || '',
          email: email,
          mobileNo: '',
          role: this.getRoleFromToken()
        });

        // Check if password change is still required — clear session and stay on login
        try {
          const status = await this.cctvService.checkPasswordStatus(email).toPromise();
          if (status && !status.isActive) {
            this.errorMessage = 'Your account has been deactivated. Please contact an administrator.';
            localStorage.removeItem('kc_token');
            localStorage.removeItem('kc_refreshToken');
            localStorage.removeItem('kc_idToken');
            (this.keycloak as any).authenticated = false;
            return;
          }
          if (status?.mustChangePassword) {
            localStorage.removeItem('kc_token');
            localStorage.removeItem('kc_refreshToken');
            localStorage.removeItem('kc_idToken');
            (this.keycloak as any).authenticated = false;
            return;
          }
        } catch (err) {
          console.warn('Could not check password status:', err);
        }

        this.router.navigate(['/dashboard']);
      } catch (e) {
        console.warn('Failed to restore session from localStorage:', e);
        localStorage.removeItem('kc_token');
        localStorage.removeItem('kc_refreshToken');
        localStorage.removeItem('kc_idToken');
      }
    }
  }

  ngAfterViewInit(): void {
    this.refreshIcons();
  }

  async onLogin(): Promise<void> {
    this.errorMessage = '';
    this.isLoading = true;

    const tokenUrl = `${environment.keycloak.url}/realms/${environment.keycloak.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams();
    body.set('grant_type', 'password');
    body.set('client_id', environment.keycloak.clientId);
    body.set('username', this.loginData.email);
    body.set('password', this.loginData.password);

    try {
      // Use fetch directly to avoid Angular interceptor issues
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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

      // Set up tokens on the Keycloak instance
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
      const tokenUrl = `${environment.keycloak.url}/realms/${environment.keycloak.realm}/protocol/openid-connect/token`;
      const body = new URLSearchParams();
      body.set('grant_type', 'password');
      body.set('client_id', environment.keycloak.clientId);
      body.set('username', this.loginData.email);
      body.set('password', this.changePasswordData.newPassword);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    (this.keycloak as any).token = tokenData.access_token;
    (this.keycloak as any).refreshToken = tokenData.refresh_token;
    (this.keycloak as any).idToken = tokenData.id_token || '';
    (this.keycloak as any).authenticated = true;

    // Persist tokens to localStorage
    localStorage.setItem('kc_token', tokenData.access_token);
    localStorage.setItem('kc_refreshToken', tokenData.refresh_token);
    if (tokenData.id_token) {
      localStorage.setItem('kc_idToken', tokenData.id_token);
    }

    // Parse the access token
    try {
      const tokenParts = tokenData.access_token.split('.');
      const tokenPayload = JSON.parse(atob(tokenParts[1]));
      (this.keycloak as any).tokenParsed = tokenPayload;
      (this.keycloak as any).subject = tokenPayload.sub;
      (this.keycloak as any).realmAccess = tokenPayload.realm_access;
      (this.keycloak as any).resourceAccess = tokenPayload.resource_access;
    } catch (e) {
      console.warn('Failed to parse token payload:', e);
    }
  }

  private async loadProfileAndNavigate(): Promise<void> {
    try {
      // Fetch full user profile from our backend after Keycloak authentication
      await firstValueFrom(this.cctvService.getProfile());
    } catch (error) {
      console.error('Failed to load full user profile after login:', error);

      // Fallback to Keycloak profile if backend fails
      try {
        const profile = await this.keycloak.loadUserProfile();
        this.cctvService.setUserDetails({
          keycloakId: profile.id || '',
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          mobileNo: '',
          role: this.getRoleFromToken()
        });
      } catch (profileError) {
        console.error('Failed to load user profile fallback:', profileError);
        this.cctvService.setUserDetails({
          keycloakId: (this.keycloak as any).tokenParsed?.sub || '',
          firstName: (this.keycloak as any).tokenParsed?.given_name || '',
          lastName: (this.keycloak as any).tokenParsed?.family_name || '',
          email: (this.keycloak as any).tokenParsed?.email || '',
          mobileNo: '',
          role: this.getRoleFromToken()
        });
      }
    }
    this.router.navigate(['/dashboard']);
  }

  private getRoleFromToken(): string {
    try {
      const tokenParsed = (this.keycloak as any).tokenParsed;
      const clientId = environment.keycloak.clientId;
      const clientRoles = tokenParsed?.resource_access?.[clientId]?.roles;
      if (clientRoles && clientRoles.length > 0) {
        return clientRoles[0];
      }
    } catch (e) {
      console.warn('Failed to extract role from token:', e);
    }
    return 'VIEWER';
  }

  private refreshIcons(): void {
    this.iconService.refreshIcons();
  }
}

