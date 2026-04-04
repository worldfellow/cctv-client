import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { CctvService } from '../services/cctv.service';

export const adminGuard = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const cctvService = inject(CctvService);
    const router = inject(Router);

    // Ensure user details are available (should be handled by authGuard first)
    const user = cctvService.userDetails;
    
    if (user && user.role === 'SUPER_ADMIN') {
        return true;
    }

    // If not a super admin, redirect to dashboard or access denied page
    router.navigate(['/dashboard']);
    return false;
};
