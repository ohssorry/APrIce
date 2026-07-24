export type SupportedProvider =
  'openai' | 'anthropic' | 'google-maps' | 'twilio' | 'aws-s3' | 'sendgrid';

export interface DetectedCallSite {
  provider: SupportedProvider;
  product: string | null;
  file: string;
  line: number;
  snippet: string;
}

export interface SkippedFile {
  file: string;
  reason: 'parse_error';
}

export interface DetectionResult {
  detections: DetectedCallSite[];
  skipped: SkippedFile[];
}
