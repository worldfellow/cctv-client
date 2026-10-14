import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { CctvService } from '../services/cctv.service';
import { AuthSessionService } from '../services/auth-session.service';
import { firstValueFrom } from 'rxjs';

export const authGuard = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const session = inject(AuthSessionService);
    const router = inject(Router);
    const cctvService = inject(CctvService);

    if (!session.isAuthenticated) {
        // Not logged in (or token expired): go to the custom login page
        router.navigate(['/login']);
        return false;
    }

    // Ensure full user details are loaded from our backend
    if (!cctvService.userDetails || (!cctvService.userDetails.allowedColleges && cctvService.userDetails.role !== 'SUPER_ADMIN')) {
        try {
            await firstValueFrom(cctvService.getProfile());
        } catch (error) {
            console.error('Failed to load full user profile in guard:', error);

            // Fallback to the token claims if backend fails
            if (!cctvService.userDetails) {
                cctvService.setUserDetails(session.getProfileFromToken());
            }
        }
    }

    // Check if user must change password — redirect to login page if so
    const email = cctvService.userDetails?.email || session.tokenParsed?.email;
    if (email) {
        try {
            const status = await firstValueFrom(cctvService.checkPasswordStatus(email));
            if (status?.mustChangePassword) {
                router.navigate(['/login']);
                return false;
            }
        } catch (err) {
            // If check fails, allow access (don't block)
            console.warn('Could not check password status in guard:', err);
        }
    }

    return true;
};
