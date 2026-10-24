import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrnApiService } from './prn-api.service';

describe('PrnApiService', () => {
  let api: PrnApiService;
  let requests: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PrnApiService);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => requests.verify());

  it('consulta el endpoint de estado del motor Java', () => {
    let status = '';
    api.health().subscribe((response) => status = response.status);
    const req = requests.expectOne('/api/health');
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'UP', service: 'xodoprinter', mode: 'RESEARCH_ONLY', hardwareAccess: false });
    expect(status).toBe('UP');
  });

  it('envía un PRN como multipart/form-data sin fijar Content-Type', () => {
    const file = new File([new Uint8Array(72)], 'prueba.prn');
    let recognized = false;
    api.analyze(file).subscribe((response) => recognized = response.recognized);
    const req = requests.expectOne('/api/prn/analyze');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect(((req.request.body as FormData).get('file') as File).name).toBe('prueba.prn');
    expect(((req.request.body as FormData).get('file') as File).size).toBe(72);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({ fileName: 'prueba.prn', fileSize: 72, widthCandidate: 3, heightCandidate: 2, channelCountCandidate: 4, recognized: true, warnings: [] });
    expect(recognized).toBe(true);
  });
});
