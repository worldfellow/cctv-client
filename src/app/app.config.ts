import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  LucideAngularModule,
  AlertCircle, AlertTriangle, Building2, CameraOff, CheckCircle, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle,
  Download, Edit3, FileCheck, FileText, Filter, FolderUp, Image, Info, Key, LayoutGrid, Loader, Loader2, Lock, Mail, Network, Play, Plus, PlusCircle, Plug, Radio, RotateCcw, Save, Search, SearchX, Shield, ShieldCheck, Square,
  Trash2, UploadCloud, User, Users, UserCheck, UserPlus, UserX, Video, X, XCircle, Eye, EyeOff, Server, Link, MoreHorizontal, Copy
} from 'lucide-angular';

import { routes } from './app.routes';
import { authInterceptor, bearerInterceptor } from './interceptors/auth.interceptor';
import { decryptInterceptor } from './interceptors/decrypt.interceptor';
import { retryLimitInterceptor } from './interceptors/retry-limit.interceptor';
import { rateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { gatewayInterceptor } from './interceptors/gateway.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([rateLimitInterceptor, retryLimitInterceptor, bearerInterceptor, authInterceptor, decryptInterceptor, gatewayInterceptor])),
    provideAnimations(),
    importProvidersFrom(LucideAngularModule.pick({
      AlertCircle, AlertTriangle, Building2, CameraOff, CheckCircle, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle,
      Download, Edit3, FileCheck, FileText, Filter, FolderUp, Image, Info, Key, LayoutGrid, Loader, Loader2, Lock, Mail, Network, Play, Plus, PlusCircle, Plug, Radio, RotateCcw, Save, Search, SearchX, Shield, ShieldCheck, Square,
      Trash2, UploadCloud, User, Users, UserCheck, UserPlus, UserX, Video, X, XCircle, Eye, EyeOff, Server, Link, MoreHorizontal, Copy
    }))
  ]
};
