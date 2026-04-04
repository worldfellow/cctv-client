import { Routes } from '@angular/router';
import { MainLayoutComponent } from './components/main-layout/main-layout.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    {
        path: 'login',
        loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
    },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent) },
            { path: 'users', loadComponent: () => import('./components/user-management/user-management.component').then(m => m.UserManagementComponent) },
            { path: 'colleges', loadComponent: () => import('./components/college-management/college-management.component').then(m => m.CollegeManagementComponent) },
            { path: 'add-camera', loadComponent: () => import('./components/camera-registration/camera-registration.component').then(m => m.CameraRegistrationComponent) },
            { path: 'access-control', loadComponent: () => import('./components/access-control/access-control.component').then(m => m.AccessControlComponent) },
            { path: 'screenshots', loadComponent: () => import('./components/screenshot-gallery/screenshot-gallery.component').then(m => m.ScreenshotGalleryComponent) },
            { path: 'branding-settings', canActivate: [adminGuard], loadComponent: () => import('./components/branding-settings/branding-settings.component').then(m => m.BrandingSettingsComponent) },
            { path: 'devicesetup', canActivate: [adminGuard], loadComponent: () => import('./components/device-setup/device-setup.component').then(m => m.DeviceSetupComponent) }
        ]
    },
    { path: '**', redirectTo: 'login' }
];
