/** Contrato que coincide con el record PrnAnalysisResult de Spring Boot. */
export interface PrnAnalysisResult {
  fileName: string;
  fileSize: number;
  widthCandidate: number;
  heightCandidate: number;
  channelCountCandidate: number;
  recognized: boolean;
  warnings: string[];
}

export interface ApiError {
  code: string;
  message: string;
}

export interface BackendHealth {
  status: string;
  service: string;
  mode: string;
  hardwareAccess: boolean;
}
