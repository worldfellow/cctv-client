import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  LucideAngularModule,
  AlertCircle, AlertTriangle, Building2, CameraOff, CheckCircle, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle,
  Download, Edit3, FileCheck, FileText, Filter, FolderUp, Image, Info, Key, LayoutGrid, Loader, Loader2, Lock, Mail, Network, Play, Plus, PlusCircle, Plug, Radio, RotateCcw, Save, Search, SearchX, Shield, ShieldCheck, Square,
  Trash2, UploadCloud, User, Users, UserCheck, UserPlus, UserX, Video, X, XCircle
} from 'lucide-angular';

import { routes } from './app.routes';

import { environment } from '../environments/environment';

import {
  provideKeycloak,
  createInterceptorCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  includeBearerTokenInterceptor
} from 'keycloak-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([includeBearerTokenInterceptor])),
    provideKeycloak({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId
      },
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        checkLoginIframe: false
      }
    }),
    provideAnimations(),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [
        createInterceptorCondition({
          urlPattern: new RegExp(`^${environment.apiUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|^\/api`, 'i'),
          bearerPrefix: 'Bearer'
        })
      ]
    },
    importProvidersFrom(LucideAngularModule.pick({
      AlertCircle, AlertTriangle, Building2, CameraOff, CheckCircle, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle,
      Download, Edit3, FileCheck, FileText, Filter, FolderUp, Image, Info, Key, LayoutGrid, Loader, Loader2, Lock, Mail, Network, Play, Plus, PlusCircle, Plug, Radio, RotateCcw, Save, Search, SearchX, Shield, ShieldCheck, Square,
      Trash2, UploadCloud, User, Users, UserCheck, UserPlus, UserX, Video, X, XCircle
    }))
  ]
};
