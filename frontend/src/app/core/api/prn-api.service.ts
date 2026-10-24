import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendHealth, PrnAnalysisResult } from '../models/prn-analysis-result';

/** Único lugar donde la UI conoce las rutas de nuestra API Java. */
@Injectable({ providedIn: 'root' })
export class PrnApiService {
  private readonly http = inject(HttpClient);

  health(): Observable<BackendHealth> {
    return this.http.get<BackendHealth>('/api/health');
  }

  analyze(file: File): Observable<PrnAnalysisResult> {
    const payload = new FormData();
    payload.append('file', file, file.name);
    // No establecer Content-Type: el navegador añade el boundary multipart.
    return this.http.post<PrnAnalysisResult>('/api/prn/analyze', payload);
  }
}
