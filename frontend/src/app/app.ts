import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PrnApiService } from './core/api/prn-api.service';
import { DesktopIntegrationService } from './core/desktop/desktop-integration.service';
import type { XodoDesktopInfo } from './core/desktop/desktop-bridge';
import { PrnInspector } from './features/prn-inspector/prn-inspector';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PrnInspector],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly api = inject(PrnApiService);
  private readonly desktop = inject(DesktopIntegrationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly backendStatus = signal<'checking' | 'online' | 'offline'>('checking');
  readonly desktopMode = signal(this.desktop.isAvailable());
  readonly desktopInfo = signal<XodoDesktopInfo | null>(null);
  readonly desktopInfoError = signal(false);

  ngOnInit(): void {
    this.checkBackend();
    void this.loadDesktopInfo();
  }

  async loadDesktopInfo(): Promise<void> {
    if (!this.desktop.isAvailable()) return;
    try {
      const info = await this.desktop.getInfo();
      this.desktopInfo.set(info);
    } catch {
      this.desktopInfoError.set(true);
    }
  }

  platformLabel(platform: string): string {
    return platform === 'win32' ? 'Windows' : platform;
  }

  checkBackend(): void {
    this.backendStatus.set('checking');
    this.api.health().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (health) => this.backendStatus.set(health.status === 'UP' ? 'online' : 'offline'),
      error: () => this.backendStatus.set('offline'),
    });
  }
}
