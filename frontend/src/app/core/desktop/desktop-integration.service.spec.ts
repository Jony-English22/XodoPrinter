import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopIntegrationService } from './desktop-integration.service';
import type { XodoDesktopInfo } from './desktop-bridge';

const originalBridge = window.xodoDesktop;

afterEach(() => { window.xodoDesktop = originalBridge; });

describe('DesktopIntegrationService', () => {
  const service = new DesktopIntegrationService();

  it('funciona tambien en Chrome sin Electron', async () => {
    window.xodoDesktop = undefined;
    expect(service.isAvailable()).toBe(false);
    await expect(service.getInfo()).resolves.toBeNull();
  });

  it('solo solicita informacion de lectura mediante el puente', async () => {
    const info: XodoDesktopInfo = {
      appName: 'xodoprinter-desktop', appVersion: '0.4.0',
      platform: 'win32', electronVersion: '45.0.0',
      environment: 'development',
    };
    const getInfo = vi.fn(async () => info);
    window.xodoDesktop = { getInfo };
    expect(service.isAvailable()).toBe(true);
    await expect(service.getInfo()).resolves.toEqual(info);
    expect(getInfo).toHaveBeenCalledOnce();
  });
});
