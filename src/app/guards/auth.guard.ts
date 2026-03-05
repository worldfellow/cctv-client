import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import Keycloak from 'keycloak-js';
import { CctvService } from '../services/cctv.service';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

function getRoleFromKeycloak(keycloak: Keycloak): string {
    try {
        const tokenParsed = (keycloak as any).tokenParsed;
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

export const authGuard = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const keycloak = inject(Keycloak);
    const router = inject(Router);
    const cctvService = inject(CctvService);

    const authenticated = keycloak.authenticated;
    const isCallback = window.location.search.includes('code=') ||
        window.location.hash.includes('code=') ||
        window.location.search.includes('state=');

    if (authenticated) {
        // Handle URL cleanup if we're in a callback state after successful login
        if (isCallback) {
            setTimeout(() => {
                router.navigate([state.url.split('#')[0].split('?')[0]], {
                    replaceUrl: true,
                    queryParams: {}
                });
            }, 0);
        }

        // Ensure full user details are loaded from our backend
        if (!cctvService.userDetails || (!cctvService.userDetails.allowedColleges && cctvService.userDetails.role !== 'SUPER_ADMIN')) {
            try {
                await firstValueFrom(cctvService.getProfile());
            } catch (error) {
                console.error('Failed to load full user profile in guard:', error);

                // Fallback to Keycloak profile if backend fails
                if (!cctvService.userDetails) {
                    const profile = await keycloak.loadUserProfile();
                    cctvService.setUserDetails({
                        keycloakId: profile.id || '',
                        firstName: profile.firstName || '',
                        lastName: profile.lastName || '',
                        email: profile.email || '',
                        mobileNo: '',
                        role: getRoleFromKeycloak(keycloak)
                    });
                }
            }
        }

        // Check if user must change password — redirect to login page if so
        const email = cctvService.userDetails?.email || (keycloak as any).tokenParsed?.email;
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
    }

    if (isCallback) {
        return true;
    }

    // If not authenticated, redirect to custom login page
    router.navigate(['/login']);

    return false;
};

