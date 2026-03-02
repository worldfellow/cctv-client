import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { CctvFeed } from '../components/cctv-card/cctv-card.component';

export interface User {
    id?: string;
    keycloakId: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    email: string;
    mobileNo: string;
    role: string;
    collegeId?: string;
    College?: {
        name: string;
    };
    createdAt?: string;
    isActive?: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface College {
    id: string;
    name: string;
    address?: string;
    contactEmail?: string;
    createdAt?: string;
    isActive?: boolean;
}

import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class CctvService {
    private apiUrl = environment.apiUrl;
    private tokenSubject = new BehaviorSubject<string | null>(null);
    public token$ = this.tokenSubject.asObservable();

    private userDetailsSubject = new BehaviorSubject<User | null>(null);
    public userDetails$ = this.userDetailsSubject.asObservable();

    constructor(private http: HttpClient) {
        // We will now rely on Keycloak for user details
        // but we keep the subject for compatibility with existing components
        const savedUser = localStorage.getItem('cctv_user');

        if (savedUser) {
            try {
                this.userDetailsSubject.next(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user data:', e);
            }
        }
    }

    get token(): string | null {
        return this.tokenSubject.value;
    }

    setToken(token: string) {
        this.tokenSubject.next(token);
    }

    get userDetails(): User | null {
        return this.userDetailsSubject.value;
    }

    setUserDetails(user: User) {
        localStorage.setItem('cctv_user', JSON.stringify(user));
        this.userDetailsSubject.next(user);
    }

    clearAuth() {
        localStorage.removeItem('cctv_user');
        this.tokenSubject.next(null);
        this.userDetailsSubject.next(null);
    }

    private getHeaders() {
        return {}; // Interceptor will handle tokens
    }

    getFeeds(): Observable<CctvFeed[]> {
        return this.http.get<CctvFeed[]>(`${this.apiUrl}/feeds`, this.getHeaders());
    }

    login(credentials: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/auth/login`, credentials);
    }

    // User Management
    getUsers(page: number = 1, limit: number = 10, search: string = ''): Observable<PaginatedResponse<User>> {
        const params: any = {
            page: page.toString(),
            limit: limit.toString()
        };
        if (search) {
            params.search = search;
        }
        return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/users`, {
            ...this.getHeaders(),
            params
        });
    }

    createUser(user: Partial<User>): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/users`, user, this.getHeaders());
    }

    updateUser(id: string, user: Partial<User>): Observable<User> {
        return this.http.put<User>(`${this.apiUrl}/users/${id}`, user, this.getHeaders());
    }

    deleteUser(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/users/${id}`, this.getHeaders());
    }

    toggleUserStatus(id: string): Observable<any> {
        return this.http.patch(`${this.apiUrl}/users/${id}/toggle-status`, {}, this.getHeaders());
    }

    bulkUpdateUserStatus(ids: string[], isActive: boolean): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/bulk-status`, { ids, isActive }, this.getHeaders());
    }

    bulkDeleteUsers(ids: string[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/bulk-delete`, { ids }, this.getHeaders());
    }

    checkPasswordStatus(email: string): Observable<{ mustChangePassword: boolean; isActive: boolean }> {
        return this.http.get<{ mustChangePassword: boolean; isActive: boolean }>(`${this.apiUrl}/users/check-password-status/${encodeURIComponent(email)}`, this.getHeaders());
    }

    changePassword(email: string, newPassword: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/change-password`, { email, newPassword }, this.getHeaders());
    }

    resetUserPassword(userId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/${userId}/reset-password`, {}, this.getHeaders());
    }

    downloadUserTemplate(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/users/template/download`, {
            ...this.getHeaders(),
            responseType: 'blob'
        });
    }

    bulkUploadUsers(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/bulk-upload`, formData, this.getHeaders());
    }

    // College Management
    getColleges(page: number = 1, limit: number = 10, search: string = '', activeOnly: boolean = false): Observable<PaginatedResponse<College>> {
        const params: any = {
            page: page.toString(),
            limit: limit.toString()
        };
        if (search) {
            params.search = search;
        }
        if (activeOnly) {
            params.activeOnly = 'true';
        }
        return this.http.get<PaginatedResponse<College>>(`${this.apiUrl}/colleges`, {
            ...this.getHeaders(),
            params
        });
    }

    createCollege(college: Partial<College>): Observable<College> {
        return this.http.post<College>(`${this.apiUrl}/colleges`, college, this.getHeaders());
    }

    updateCollege(id: string, college: Partial<College>): Observable<College> {
        return this.http.put<College>(`${this.apiUrl}/colleges/${id}`, college, this.getHeaders());
    }

    deleteCollege(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/colleges/${id}`, this.getHeaders());
    }

    downloadCollegeTemplate(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/colleges/template/download`, {
            ...this.getHeaders(),
            responseType: 'blob'
        });
    }

    bulkUploadColleges(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/colleges/bulk-upload`, formData, this.getHeaders());
    }

    toggleCollegeStatus(id: string): Observable<any> {
        return this.http.patch(`${this.apiUrl}/colleges/${id}/toggle-status`, {}, this.getHeaders());
    }

    bulkUpdateCollegeStatus(ids: string[], isActive: boolean): Observable<any> {
        return this.http.post(`${this.apiUrl}/colleges/bulk-status`, { ids, isActive }, this.getHeaders());
    }

    bulkDeleteColleges(ids: string[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/colleges/bulk-delete`, { ids }, this.getHeaders());
    }

    // Camera Management
    getCameras(page: number = 1, limit: number = 10, collegeId?: string): Observable<PaginatedResponse<any>> {
        const params: any = {
            page: page.toString(),
            limit: limit.toString()
        };
        if (collegeId) {
            params.collegeId = collegeId;
        }
        return this.http.get<PaginatedResponse<any>>(`${this.apiUrl}/cameras`, {
            ...this.getHeaders(),
            params
        });
    }

    createCamera(camera: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/cameras`, camera, this.getHeaders());
    }

    updateCamera(id: string, camera: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/cameras/${id}`, camera, this.getHeaders());
    }

    deleteCamera(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/cameras/${id}`, this.getHeaders());
    }

    // Camera Bulk Management
    downloadCameraTemplate(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/cameras/template/download`, {
            ...this.getHeaders(),
            responseType: 'blob'
        });
    }

    bulkUploadCameras(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/cameras/bulk-upload`, formData, this.getHeaders());
    }

    toggleCameraStatus(id: string): Observable<any> {
        return this.http.patch(`${this.apiUrl}/cameras/${id}/toggle-status`, {}, this.getHeaders());
    }

    bulkUpdateCameraStatus(ids: string[], isActive: boolean): Observable<any> {
        return this.http.post(`${this.apiUrl}/cameras/bulk-status`, { ids, isActive }, this.getHeaders());
    }

    bulkDeleteCameras(ids: string[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/cameras/bulk-delete`, { ids }, this.getHeaders());
    }

    getAllActiveColleges(): Observable<College[]> {
        return this.http.get<College[]>(`${this.apiUrl}/colleges/active`, this.getHeaders());
    }

    // Dashboard
    getDashboardFeeds(collegeId: string, page: number = 1, limit: number = 10): Observable<PaginatedResponse<CctvFeed>> {
        const params: any = {
            page: page.toString(),
            limit: limit.toString(),
            collegeId
        };
        return this.http.get<PaginatedResponse<CctvFeed>>(`${this.apiUrl}/dashboard`, {
            ...this.getHeaders(),
            params
        });
    }

    getDashboardStats(collegeId: string): Observable<{ total: number; active: number; offline: number }> {
        return this.http.get<{ total: number; active: number; offline: number }>(`${this.apiUrl}/dashboard/stats`, {
            ...this.getHeaders(),
            params: { collegeId }
        });
    }
}
