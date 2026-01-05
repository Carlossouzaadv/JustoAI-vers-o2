
import { getErrorMessage, isPDFData } from '@/lib/types/type-guards';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

export interface PDFValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    metadata: {
        pages: number;
        sizeMB: number;
        hasText: boolean;
        hasImages: boolean;
    };
}

export class PdfValidator {

    /**
     * Validação robusta de PDF
     */
    async validatePDF(buffer: Buffer, filename: string, userPlan: string = 'starter'): Promise<PDFValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const sizeMB = Math.round((buffer.length / (1024 * 1024)) * 100) / 100;

        try {
            // 1. Verificação de magic bytes
            if (!this.hasValidPDFHeader(buffer)) {
                errors.push('Arquivo não é um PDF válido');
            }

            // 2. Verificação de corrupção (simplificada para não depender de extração externa aqui)
            // Original code called 'extractWithPrimary' here, which creates cyclic dependency if not careful.
            // We will perform a basic structure check instead.
            const corruptionCheck = this.basicCorruptionCheck(buffer);
            if (corruptionCheck.isCorrupt) {
                if (userPlan === 'starter') {
                    errors.push('PDF corrompido detectado (simples)');
                } else {
                    warnings.push('PDF com possível corrupção');
                }
            }

            // 3. Metadados
            const hasImages = this.detectImagesInPDF(buffer);

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                metadata: {
                    pages: 0, // Requires parsing
                    sizeMB,
                    hasText: false, // Unknown at this stage without parsing
                    hasImages
                }
            };

        } catch (error) {
            const errorMsg = getErrorMessage(error);
            return {
                isValid: false,
                errors: [`Erro na validação: ${errorMsg}`],
                warnings: [],
                metadata: {
                    pages: 0,
                    sizeMB,
                    hasText: false,
                    hasImages: false
                }
            };
        }
    }

    private hasValidPDFHeader(buffer: Buffer): boolean {
        const header = buffer.slice(0, 4).toString();
        return header === '%PDF';
    }

    private basicCorruptionCheck(buffer: Buffer): { isCorrupt: boolean } {
        // A very basic check: does it end with %%EOF? (Approximate, as it might have garbage after)
        // Real check is hard without parsing.
        const tail = buffer.slice(buffer.length - 1024).toString('binary');
        if (!tail.includes('%%EOF')) {
            // Warning sign, but some valid PDFs might assume implicit EOF
            return { isCorrupt: true };
        }
        return { isCorrupt: false };
    }

    /**
     * Detecta presença de imagens usando marcadores binários comuns
     */
    private detectImagesInPDF(buffer: Buffer): boolean {
        try {
            const bufferStr = buffer.toString('binary');
            const imagePatterns = ['/Image', '/DCTDecode', '/JPXDecode', '/FlateDecode'];
            // Checking for existence of any image pattern
            return imagePatterns.some(pattern => bufferStr.includes(pattern));
        } catch (error) {
            return false;
        }
    }
}
