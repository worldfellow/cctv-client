import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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
    permissions?: {
        menus: string[];
        actions: string[];
    };
    allowedColleges?: string[];
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

export interface Role {
    roleId: string;
    roleName: string;
}

export interface CctvFeed {
    id: string;
    collegeId: string;
    cameraName: string;
    location: string;
    streamUrl: string;
    status: 'ONLINE' | 'OFFLINE';
    College?: {
        name: string;
    };
}

@Injectable({
    providedIn: 'root'
})
export class CctvService {
    private apiUrl = environment.apiUrl;
    private tokenSubject = new BehaviorSubject<string | null>(null);
    public token$ = this.tokenSubject.asObservable();

    private collegesSubject = new BehaviorSubject<any[]>([]);
    public colleges$ = this.collegesSubject.asObservable();

    private systemConfigSubject = new BehaviorSubject<any>({
        appName: 'CCTV Surveillance',
        logoUrl: '/assets/logo.png'
    });
    public systemConfig$ = this.systemConfigSubject.asObservable();

    private userDetailsSubject = new BehaviorSubject<User | null>(null);
    public userDetails$ = this.userDetailsSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadSystemConfig();
        const savedUser = localStorage.getItem('cctv_user');
        if (savedUser) {
            try {
                this.userDetailsSubject.next(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user data:', e);
            }
        }
    }

    private formatConfig(config: any): any {
        if (!config) return config;
        const formatted = { ...config };
        if (formatted.logoUrl && formatted.logoUrl.startsWith('/uploads')) {
            const baseUrl = this.apiUrl.replace('/api', '');
            formatted.logoUrl = baseUrl + formatted.logoUrl;
        }
        return formatted;
    }

    private loadSystemConfig(): void {
        this.getSystemConfig().subscribe({
            next: (config) => {
                if (config) this.systemConfigSubject.next(config);
            },
            error: (err) => console.warn('Failed to load initial system config', err)
        });
    }

    getSystemConfig(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/config`).pipe(
            map(config => this.formatConfig(config))
        );
    }

    updateSystemConfig(formData: FormData): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/config`, formData, this.getHeaders()).pipe(
            map(config => this.formatConfig(config)),
            tap(config => this.systemConfigSubject.next(config))
        );
    }

    private getHeaders() {
        return {}; // Interceptor will handle tokens
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

    getFeeds(): Observable<CctvFeed[]> {
        return this.http.get<CctvFeed[]>(`${this.apiUrl}/feeds`, this.getHeaders());
    }

    getProfile(): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}/users/me`, this.getHeaders()).pipe(
            tap(user => this.setUserDetails(user))
        );
    }

    // User Management
    getUsers(page: number = 1, limit: number = 10, search: string = ''): Observable<PaginatedResponse<User>> {
        const params: any = { page: page.toString(), limit: limit.toString() };
        if (search) params.search = search;
        return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/users`, { params });
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
        return this.http.get<{ mustChangePassword: boolean; isActive: boolean }>(`${this.apiUrl}/users/check-password-status/${email}`, this.getHeaders());
    }

    changePassword(email: string, newPassword: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/change-password`, { email, newPassword }, this.getHeaders());
    }

    resetUserPassword(userId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/${userId}/reset-password`, {}, this.getHeaders());
    }

    downloadUserTemplate(): Observable<any> {
        return this.http.get(`${this.apiUrl}/users/template`, { responseType: 'blob' });
    }

    bulkUploadUsers(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/bulk-upload`, formData, this.getHeaders());
    }

    updateBulkPermissions(userIds: string[], permissions: any, allowedColleges: string[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/users/bulk-permissions`, { userIds, permissions, allowedColleges }, this.getHeaders());
    }

    getRoles(): Observable<Role[]> {
        return this.http.get<Role[]>(`${this.apiUrl}/users/roles`, this.getHeaders());
    }

    // College Management
    getColleges(page: number = 1, limit: number = 10, search: string = '', activeOnly: boolean = false): Observable<PaginatedResponse<College>> {
        const params: any = { page: page.toString(), limit: limit.toString() };
        if (search) params.search = search;
        if (activeOnly) params.activeOnly = 'true';
        return this.http.get<PaginatedResponse<College>>(`${this.apiUrl}/colleges`, { params });
    }

    getAllActiveColleges(): Observable<College[]> {
        return this.http.get<College[]>(`${this.apiUrl}/colleges/active`, this.getHeaders());
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

    toggleCollegeStatus(id: string): Observable<any> {
        return this.http.patch(`${this.apiUrl}/colleges/${id}/toggle-status`, {}, this.getHeaders());
    }

    bulkUpdateCollegeStatus(ids: string[], isActive: boolean): Observable<any> {
        return this.http.post(`${this.apiUrl}/colleges/bulk-status`, { ids, isActive }, this.getHeaders());
    }

    bulkDeleteColleges(ids: string[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/colleges/bulk-delete`, { ids }, this.getHeaders());
    }

    downloadCollegeTemplate(): Observable<any> {
        return this.http.get(`${this.apiUrl}/colleges/template`, { responseType: 'blob' });
    }

    bulkUploadColleges(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/colleges/bulk-upload`, formData, this.getHeaders());
    }

    // Camera Management
    getCameras(page: number = 1, limit: number = 10, collegeId: string = ''): Observable<PaginatedResponse<any>> {
        const params: any = { page: page.toString(), limit: limit.toString() };
        if (collegeId) params.collegeId = collegeId;
        return this.http.get<PaginatedResponse<any>>(`${this.apiUrl}/cameras`, { params });
    }

    createCamera(camera: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/cameras`, camera, this.getHeaders());
    }

    updateCamera(id: string, camera: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/cameras/${id}`, camera, this.getHeaders());
    }

    deleteCamera(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/cameras/${id}`, this.getHeaders());
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

    downloadCameraTemplate(): Observable<any> {
        return this.http.get(`${this.apiUrl}/cameras/template/download`, { responseType: 'blob' });
    }

    bulkUploadCameras(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/cameras/bulk-upload`, formData, this.getHeaders());
    }

    downloadCameraData(collegeId: string = ''): Observable<any> {
        const params: any = {};
        if (collegeId) params.collegeId = collegeId;
        return this.http.get(`${this.apiUrl}/cameras/bulk-export`, {
            params,
            responseType: 'blob'
        });
    }

    bulkUpdateCameras(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/cameras/bulk-update`, formData, this.getHeaders());
    }

    // Dashboard
    getDashboardFeeds(collegeId: string, page: number = 1, limit: number = 10): Observable<PaginatedResponse<CctvFeed>> {
        const params: any = { page: page.toString(), limit: limit.toString(), collegeId };
        return this.http.get<PaginatedResponse<CctvFeed>>(`${this.apiUrl}/dashboard`, { params });
    }

    getDashboardStats(collegeId: string): Observable<{ total: number; active: number; offline: number }> {
        return this.http.get<{ total: number; active: number; offline: number }>(`${this.apiUrl}/dashboard/stats`, { params: { collegeId } });
    }

    saveScreenshot(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/screenshots`, data, this.getHeaders());
    }

    getScreenshots(params: any = {}): Observable<any> {
        let queryParams = `?page=${params.page || 1}&limit=${params.limit || 10}`;
        if (params.collegeName) queryParams += `&collegeName=${encodeURIComponent(params.collegeName)}`;
        if (params.cameraName) queryParams += `&cameraName=${encodeURIComponent(params.cameraName)}`;
        if (params.startDate) queryParams += `&startDate=${params.startDate}`;
        if (params.endDate) queryParams += `&endDate=${params.endDate}`;
        return this.http.get<any>(`${this.apiUrl}/screenshots${queryParams}`, this.getHeaders());
    }

    deleteScreenshots(ids: string[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/screenshots/delete`, { ids }, this.getHeaders());
    }

    startCameraStream(id: string, quality: 'high' | 'low' = 'high'): Observable<{ message: string; wsUrl: string }> {
        return this.http.post<{ message: string; wsUrl: string }>(`${this.apiUrl}/cameras/${id}/start-stream`, {}, {
            params: { quality },
            ...this.getHeaders()
        });
    }
}
