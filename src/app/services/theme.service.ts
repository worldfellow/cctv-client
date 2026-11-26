import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { secureStorage } from '../utils/secure-storage';

export type ThemeType = 'white' | 'midnight' | 'obsidian';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private currentTheme: ThemeType = 'midnight';
  private themeSubject = new BehaviorSubject<ThemeType>(this.currentTheme);

  theme$ = this.themeSubject.asObservable();

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    const savedTheme = secureStorage.get('_t') as ThemeType;
    if (savedTheme && ['white', 'midnight', 'obsidian'].includes(savedTheme)) {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('midnight');
    }
  }

  setTheme(theme: ThemeType) {
    // Remove old theme classes
    this.renderer.removeClass(document.body, 'theme-white');
    this.renderer.removeClass(document.body, 'theme-midnight');
    this.renderer.removeClass(document.body, 'theme-obsidian');

    // Add new theme class
    this.renderer.addClass(document.body, `theme-${theme}`);

    this.currentTheme = theme;
    secureStorage.set('_t', theme);
    this.themeSubject.next(theme);
  }

  getCurrentTheme(): ThemeType {
    return this.currentTheme;
  }
}
