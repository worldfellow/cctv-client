import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { CollegeManagementComponent } from './components/college-management/college-management.component';
import { CameraRegistrationComponent } from './components/camera-registration/camera-registration.component';
import { MainLayoutComponent } from './components/main-layout/main-layout.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: 'dashboard', component: DashboardComponent },
            { path: 'users', component: UserManagementComponent },
            { path: 'colleges', component: CollegeManagementComponent },
            { path: 'add-camera', component: CameraRegistrationComponent }
        ]
    },
    { path: '**', redirectTo: 'login' }
];
