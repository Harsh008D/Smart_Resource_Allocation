/**
 * OCR Service stub.
 * Returns null (simulating unavailability) and flags report for manual review.
 * Swap in Tesseract or AWS Textract by implementing the same interface.
 */
export interface OcrService {
  extractText(imageBuffer: Buffer): Promise<string | null>;
}

export const ocrService: OcrService = {
  async extractText(_imageBuffer: Buffer): Promise<string | null> {
    // Stub: real implementation would call Tesseract / AWS Textract here
    console.warn("[OCR] OCR service not configured — flagging report for manual review");
    return null;
  },
};
