// Type stub for optional tesseract.js dependency (dynamically imported with fallback)
declare module 'tesseract.js' {
  interface RecognizeResult {
    data: { text: string };
  }
  interface Worker {
    recognize(source: string | Buffer): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }
  export function createWorker(lang: string): Promise<Worker>;
}
