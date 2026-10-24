import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

// Inyecta HttpClient: todos los servicios que lo necesiten pueden pedirlo.
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
