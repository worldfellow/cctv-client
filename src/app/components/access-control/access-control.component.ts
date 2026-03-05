import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CctvService, User, College } from '../../services/cctv.service';
import { ToastService } from '../../services/toast.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';

import { IconService } from '../../services/icon.service';

@Component({
    selector: 'app-access-control',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './access-control.component.html',
    styleUrl: './access-control.component.scss'
})
export class AccessControlComponent implements OnInit, OnDestroy, AfterViewInit {
    users: User[] = [];
    colleges: College[] = [];
    isSaving: boolean = false;
    isLoadingUsers: boolean = false;

    // Pagination
    currentPage: number = 1;
    totalPages: number = 1;
    totalUsers: number = 0;
    pageSize: number = 5;

    // Selection UI State
    showSelectedUsers: boolean = false;

    // Selection
    selectedUserIds: Set<string> = new Set();
    selectedUsersMap: Map<string, User> = new Map();
    searchQuery: string = '';
    collegeSearchQuery: string = '';
    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();

    // Permissions Data
    availableMenus = [
        { id: 'dashboard', label: 'Dashboard', icon: 'layout-grid' },
        { id: 'users', label: 'User Management', icon: 'users' },
        { id: 'colleges', label: 'Colleges', icon: 'building-2' },
        { id: 'add-camera', label: 'Camera Setup', icon: 'video' },
        { id: 'screenshots', label: 'Screenshots', icon: 'image' }
    ];

    availableActions = [
        { id: 'user_create', label: 'Add User', group: 'Users', menuId: 'users' },
        { id: 'user_edit', label: 'Edit User', group: 'Users', menuId: 'users' },
        { id: 'user_delete', label: 'Delete User', group: 'Users', menuId: 'users' },
        { id: 'user_reset', label: 'Reset Password', group: 'Users', menuId: 'users' },
        { id: 'user_bulk', label: 'Bulk Operations', group: 'Users', menuId: 'users' },

        { id: 'college_create', label: 'Add College', group: 'Colleges', menuId: 'colleges' },
        { id: 'college_edit', label: 'Edit College', group: 'Colleges', menuId: 'colleges' },
        { id: 'college_delete', label: 'Delete College', group: 'Colleges', menuId: 'colleges' },
        { id: 'college_bulk', label: 'Bulk Operations', group: 'Colleges', menuId: 'colleges' },

        { id: 'camera_create', label: 'Add Camera', group: 'Cameras', menuId: 'add-camera' },
        { id: 'camera_edit', label: 'Edit Camera', group: 'Cameras', menuId: 'add-camera' },
        { id: 'camera_delete', label: 'Delete Camera', group: 'Cameras', menuId: 'add-camera' },
        { id: 'camera_bulk', label: 'Bulk Operations', group: 'Cameras', menuId: 'add-camera' },

        { id: 'screenshot_bulk', label: 'Bulk Operations', group: 'Screenshots', menuId: 'screenshots' }
    ];

    get filteredAvailableActions() {
        // First filter by selected menus (Synchronization)
        const selectedMenuIds = this.currentPermissions.menus;
        let actions = this.availableActions.filter(a => selectedMenuIds.includes(a.menuId!));

        // Then filter by role for bulk operations
        if (this.selectedUserIds.size > 0) {
            const selectedUsers = Array.from(this.selectedUsersMap.values());
            const canDoBulk = selectedUsers.every(u => ['ADMIN', 'SUPER_ADMIN', 'OPERATOR', 'STAFF'].includes(u.role));

            if (!canDoBulk) {
                actions = actions.filter(a => !a.id.endsWith('_bulk'));
            }
        }

        return actions;
    }

    get groupedAvailableActions() {
        const actions = this.filteredAvailableActions;
        const groups: { menuId: string; menuLabel: string; actions: any[] }[] = [];

        actions.forEach(action => {
            const menu = this.availableMenus.find(m => m.id === action.menuId);
            const menuLabel = menu ? menu.label : action.group;

            let group = groups.find(g => g.menuId === action.menuId);
            if (!group) {
                group = { menuId: action.menuId!, menuLabel: menuLabel, actions: [] };
                groups.push(group);
            }
            group.actions.push(action);
        });

        // Optional: Sort groups by menu order in availableMenus
        return groups.sort((a, b) => {
            const indexA = this.availableMenus.findIndex(m => m.id === a.menuId);
            const indexB = this.availableMenus.findIndex(m => m.id === b.menuId);
            return indexA - indexB;
        });
    }

    // Current Working Permissions
    currentPermissions = {
        menus: [] as string[],
        actions: [] as string[]
    };
    selectedColleges: string[] = [];
    isAllCollegesSelected: boolean = false;

    // Expandable Groups
    expandedMenuGroups: Set<string> = new Set();

    constructor(
        private cctvService: CctvService,
        private toastService: ToastService,
        private iconService: IconService
    ) { }

    ngOnInit(): void {
        this.loadUsers();
        this.loadColleges();

        this.searchSubject.pipe(
            debounceTime(400),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.currentPage = 1;
            this.loadUsers();
        });

        // Initialize only Users group as expanded by default
        this.expandedMenuGroups.add('users');
    }

    ngAfterViewInit(): void {
        this.refreshIcons();
    }

    refreshIcons(): void {
        this.iconService.refreshIcons();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadUsers(): void {
        this.isLoadingUsers = true;
        this.cctvService.getUsers(this.currentPage, this.pageSize, this.searchQuery).subscribe({
            next: (response) => {
                let allUsers = response.data || [];
                // Filter out super_admin
                this.users = allUsers.filter(u => u.role !== 'super_admin');
                this.totalPages = response.totalPages || 1;
                this.totalUsers = response.total || 0;
                this.isLoadingUsers = false;
            },
            error: (err) => {
                console.error('Error loading users:', err);
                this.isLoadingUsers = false;
            }
        });
    }

    changePage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.loadUsers();
        }
    }

    loadColleges(): void {
        this.cctvService.getAllActiveColleges().subscribe({
            next: (colleges) => {
                this.colleges = colleges;
            },
            error: (err) => console.error('Error loading colleges:', err)
        });
    }

    get filteredColleges(): College[] {
        if (!this.collegeSearchQuery) return this.colleges;
        const query = this.collegeSearchQuery.toLowerCase();
        return this.colleges.filter(c => c.name.toLowerCase().includes(query));
    }

    onSearch(): void {
        this.searchSubject.next(this.searchQuery);
    }

    toggleUserSelection(user: User): void {
        const userId = user.id!;
        if (this.selectedUserIds.has(userId)) {
            this.selectedUserIds.delete(userId);
            this.selectedUsersMap.delete(userId);
        } else {
            this.selectedUserIds.add(userId);
            this.selectedUsersMap.set(userId, user);
        }

        // If exactly one user is selected, load their permissions for editing
        if (this.selectedUserIds.size === 1) {
            const onlyUser = Array.from(this.selectedUsersMap.values())[0];
            this.loadUserPermissions(onlyUser);
        } else if (this.selectedUserIds.size === 0) {
            this.currentPermissions = { menus: ['dashboard'], actions: [] };
            this.selectedColleges = [];
            this.isAllCollegesSelected = false;
            this.showSelectedUsers = false;
        }
    }

    toggleSelectedUsersView(): void {
        if (this.selectedUserIds.size > 0) {
            this.showSelectedUsers = !this.showSelectedUsers;
        } else {
            this.showSelectedUsers = false;
        }
    }

    removeUserFromSelection(userId: string): void {
        this.selectedUserIds.delete(userId);
        this.selectedUsersMap.delete(userId);

        if (this.selectedUserIds.size === 1) {
            const onlyUser = Array.from(this.selectedUsersMap.values())[0];
            this.loadUserPermissions(onlyUser);
        } else if (this.selectedUserIds.size === 0) {
            this.currentPermissions = { menus: ['dashboard'], actions: [] };
            this.selectedColleges = [];
            this.isAllCollegesSelected = false;
            this.showSelectedUsers = false;
        }
    }

    private loadUserPermissions(user: User): void {
        if (user.permissions) {
            this.currentPermissions = {
                menus: [...user.permissions.menus],
                actions: [...user.permissions.actions]
            };
        } else {
            this.currentPermissions = { menus: ['dashboard'], actions: [] };
        }

        if (user.allowedColleges) {
            this.isAllCollegesSelected = user.allowedColleges.includes('ALL');
            this.selectedColleges = this.isAllCollegesSelected ? [] : [...user.allowedColleges];
        } else {
            this.isAllCollegesSelected = false;
            this.selectedColleges = user.collegeId ? [user.collegeId] : [];
        }
    }

    toggleMenu(menuId: string): void {
        const index = this.currentPermissions.menus.indexOf(menuId);
        if (index > -1) {
            // Deselect Menu -> Remove associated actions (Synchronization)
            this.currentPermissions.menus = this.currentPermissions.menus.filter(id => id !== menuId);
            this.currentPermissions.actions = this.currentPermissions.actions.filter(actionId => {
                const action = this.availableActions.find(a => a.id === actionId);
                return action?.menuId !== menuId;
            });
        } else {
            // Select Menu
            this.currentPermissions.menus = [...this.currentPermissions.menus, menuId];
        }
    }

    toggleAction(actionId: string): void {
        const index = this.currentPermissions.actions.indexOf(actionId);
        if (index > -1) {
            // Deselect Action
            this.currentPermissions.actions = this.currentPermissions.actions.filter(id => id !== actionId);
        } else {
            // Select Action -> Ensure associated Menu is selected (Synchronization)
            this.currentPermissions.actions = [...this.currentPermissions.actions, actionId];
            const action = this.availableActions.find(a => a.id === actionId);
            if (action?.menuId && !this.currentPermissions.menus.includes(action.menuId)) {
                this.currentPermissions.menus = [...this.currentPermissions.menus, action.menuId];
            }
        }
    }

    toggleAllColleges(): void {
        this.isAllCollegesSelected = !this.isAllCollegesSelected;
        if (this.isAllCollegesSelected) {
            this.selectedColleges = [];
        }
    }

    toggleCollege(collegeId: string): void {
        if (this.isAllCollegesSelected) return;

        const index = this.selectedColleges.indexOf(collegeId);
        if (index > -1) {
            this.selectedColleges.splice(index, 1);
        } else {
            this.selectedColleges.push(collegeId);
        }
    }

    selectAllFilteredColleges(): void {
        if (this.isAllCollegesSelected) return;
        const currentFilteredIds = this.filteredColleges.map(c => c.id);
        const newSelection = new Set([...this.selectedColleges, ...currentFilteredIds]);
        this.selectedColleges = Array.from(newSelection);
    }

    deselectAllFilteredColleges(): void {
        if (this.isAllCollegesSelected) return;
        const currentFilteredIds = this.filteredColleges.map(c => c.id);
        this.selectedColleges = this.selectedColleges.filter(id => !currentFilteredIds.includes(id));
    }

    applyAccess(): void {
        if (this.selectedUserIds.size === 0) {
            this.toastService.show('Please select at least one user', 'info');
            return;
        }

        this.isSaving = true;
        const userIds = Array.from(this.selectedUserIds);
        const allowedColleges = this.isAllCollegesSelected ? ['ALL'] : this.selectedColleges;

        this.cctvService.updateBulkPermissions(userIds, this.currentPermissions, allowedColleges).subscribe({
            next: (res) => {
                this.isSaving = false;
                this.toastService.show(res.message, 'success');
                this.resetPage(); // Reset after successful apply
            },
            error: (err) => {
                this.isSaving = false;
                this.toastService.show('Failed to update access', 'error');
            }
        });
    }

    resetPage(): void {
        this.selectedUserIds.clear();
        this.selectedUsersMap.clear();
        this.currentPermissions = { menus: ['dashboard'], actions: [] };
        this.selectedColleges = [];
        this.isAllCollegesSelected = false;
        this.searchQuery = '';
        this.currentPage = 1;
        this.loadUsers();
    }

    isMenuSelected(menuId: string): boolean {
        return this.currentPermissions.menus.includes(menuId);
    }

    isActionSelected(actionId: string): boolean {
        return this.currentPermissions.actions.includes(actionId);
    }

    isCollegeSelected(collegeId: string): boolean {
        return this.isAllCollegesSelected || this.selectedColleges.includes(collegeId);
    }

    trackByUserId(index: number, user: any): string { return user.id; }
    trackByKeyValue(index: number, entry: any): string { return entry.key; }
    trackByMenuId(index: number, menu: any): string { return menu.id; }
    trackByActionId(index: number, action: any): string { return action.id; }
    trackByCollegeId(index: number, college: any): string { return college.id; }

    get allMenusSelected(): boolean {
        return this.availableMenus.length > 0 &&
            this.availableMenus.every(m => this.currentPermissions.menus.includes(m.id));
    }

    get allActionsSelected(): boolean {
        const currentActions = this.filteredAvailableActions;
        return currentActions.length > 0 &&
            currentActions.every(a => this.currentPermissions.actions.includes(a.id));
    }

    toggleAllMenus(): void {
        if (this.allMenusSelected) {
            this.currentPermissions.menus = [];
            this.currentPermissions.actions = []; // Clear all actions (Synchronization)
        } else {
            this.currentPermissions.menus = [...this.availableMenus.map(m => m.id)];
        }
    }

    toggleAllActions(): void {
        const currentActions = this.filteredAvailableActions;
        if (this.allActionsSelected) {
            // Only remove the ones currently visible
            const visibleIds = currentActions.map(a => a.id);
            this.currentPermissions.actions = this.currentPermissions.actions.filter(id => !visibleIds.includes(id));
        } else {
            // Add all visible ones
            const visibleIds = currentActions.map(a => a.id);
            const newActions = new Set([...this.currentPermissions.actions, ...visibleIds]);
            this.currentPermissions.actions = Array.from(newActions);
        }
    }

    toggleMenuGroup(menuId: string): void {
        if (this.expandedMenuGroups.has(menuId)) {
            this.expandedMenuGroups.delete(menuId);
        } else {
            this.expandedMenuGroups.add(menuId);
        }
    }

    isGroupExpanded(menuId: string): boolean {
        return this.expandedMenuGroups.has(menuId);
    }

    allActionsInGroupSelected(group: any): boolean {
        return group.actions.length > 0 &&
            group.actions.every((a: any) => this.currentPermissions.actions.includes(a.id));
    }

    toggleGroupActions(group: any, event?: Event): void {
        if (event) {
            event.stopPropagation();
        }

        const actionIds = group.actions.map((a: any) => a.id);
        const isAllSelected = this.allActionsInGroupSelected(group);

        if (isAllSelected) {
            // Remove these actions
            this.currentPermissions.actions = this.currentPermissions.actions.filter(id => !actionIds.includes(id));
        } else {
            // Add these actions (avoid duplicates)
            const newActions = new Set([...this.currentPermissions.actions, ...actionIds]);
            this.currentPermissions.actions = Array.from(newActions);

            // Also ensure the menu itself is selected
            if (!this.currentPermissions.menus.includes(group.menuId)) {
                this.currentPermissions.menus.push(group.menuId);
            }
        }
    }
}
