export interface XodoDesktopInfo {
  appName: string;
  appVersion: string;
  platform: string;
  electronVersion: string;
  environment: 'development' | 'compiled-preview';
}

declare global {
  interface Window {
    xodoDesktop?: {
      getInfo(): Promise<XodoDesktopInfo>;
    };
  }
}
