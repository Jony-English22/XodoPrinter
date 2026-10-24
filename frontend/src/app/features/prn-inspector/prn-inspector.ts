import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PrnApiService } from '../../core/api/prn-api.service';
import { ApiError, PrnAnalysisResult } from '../../core/models/prn-analysis-result';

const MAX_PRN_BYTES = 64 * 1024 * 1024; // Igual al límite configurado en Spring Boot 0.2.

@Component({
  selector: 'app-prn-inspector',
  standalone: true,
  templateUrl: './prn-inspector.html',
  styleUrl: './prn-inspector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrnInspector {
  private readonly api = inject(PrnApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedFile = signal<File | null>(null);
  readonly busy = signal(false);
  readonly result = signal<PrnAnalysisResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly dragOver = signal(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectFile(input.files?.item(0) ?? null);
    // Permite seleccionar nuevamente el mismo archivo después de procesarlo.
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.busy()) this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (!this.busy()) this.selectFile(event.dataTransfer?.files.item(0) ?? null);
  }

  private selectFile(file: File | null): void {
    this.result.set(null);
    this.error.set(null);
    this.selectedFile.set(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.prn')) {
      this.error.set('Selecciona un archivo con extensión .prn.');
      return;
    }
    if (file.size < 48) {
      this.error.set('El archivo necesita una cabecera de al menos 48 bytes.');
      return;
    }
    if (file.size > MAX_PRN_BYTES) {
      this.error.set('Esta primera versión acepta archivos de hasta 64 MiB.');
      return;
    }
    this.selectedFile.set(file);
  }

  analyze(): void {
    const file = this.selectedFile();
    if (!file || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    this.api.analyze(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.result.set(result),
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(this.getErrorMessage(err));
      },
      complete: () => this.busy.set(false),
    });
  }

  clear(): void {
    if (this.busy()) return;
    this.selectedFile.set(null);
    this.result.set(null);
    this.error.set(null);
  }

  formatBytes(bytes: number): string {
    return `${new Intl.NumberFormat('es-MX').format(bytes)} bytes`;
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No fue posible completar el análisis.';
    if (error.status === 0) return 'No se pudo conectar con Spring Boot. Revisa que el backend esté ejecutándose.';
    if (error.status === 413) return 'El archivo excede el tamaño máximo configurado en el backend.';
    const body = error.error as Partial<ApiError> | null;
    if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
    return `No fue posible analizar el PRN (HTTP ${error.status}).`;
  }
}
