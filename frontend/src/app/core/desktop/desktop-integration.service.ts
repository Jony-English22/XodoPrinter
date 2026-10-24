import { Injectable } from '@angular/core';
import type { XodoDesktopInfo } from './desktop-bridge';

/**
 * Angular NO importa electron ni utiliza ipcRenderer directamente.
 * El unico acceso al escritorio es la funcion limitada que ofrece preload.cjs.
 */
@Injectable({ providedIn: 'root' })
export class DesktopIntegrationService {
  isAvailable(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.xodoDesktop?.getInfo === 'function';
  }

  getInfo(): Promise<XodoDesktopInfo | null> {
    if (!this.isAvailable()) return Promise.resolve(null);
    return window.xodoDesktop!.getInfo();
  }
}
