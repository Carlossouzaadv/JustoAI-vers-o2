
import { getErrorMessage, isRailwayPdfResponse } from '@/lib/types/type-guards';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

export class RailwayClient {
    private readonly TIMEOUT_MS = 60000;
    private readonly OCR_TIMEOUT_MS = 120000;

    private getPdfProcessorUrl(): string {
        const url = process.env.PDF_PROCESSOR_URL || 'http://localhost:3000';
        // Debug log if needed, but keeping it clean
        return url;
    }

    async processPdf(buffer: Buffer, fileName: string): Promise<unknown> {
        const startTime = Date.now();
        const baseUrl = this.getPdfProcessorUrl();
        const url = `${baseUrl}/api/pdf/process`;

        log.info({
            msg: `${ICONS.SERVER} Iniciando extração via Railway: ${fileName}`,
            data: { url, size: buffer.length },
            component: 'RailwayClient'
        });

        const formData = new FormData();
        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array], { type: 'application/pdf' });
        formData.append('file', blob, fileName);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetails = errorText;
                try {
                    const jsonError = JSON.parse(errorText);
                    errorDetails = jsonError.reason || jsonError.details || JSON.stringify(jsonError);
                } catch { /* Not JSON */ }

                throw new Error(`Railway HTTP ${response.status}: ${errorDetails.substring(0, 200)}`);
            }

            const result = await response.json();

            log.info({
                msg: `${ICONS.SUCCESS} PDF processado com sucesso`,
                data: { duration_ms: Date.now() - startTime, file_name: fileName },
                component: 'RailwayClient'
            });

            return result.data;

        } catch (error) {
            clearTimeout(timeoutId);
            const errorMsg = getErrorMessage(error);
            logError(error instanceof Error ? error : new Error(errorMsg), `${ICONS.ERROR} Erro ao chamar Railway`, {
                component: 'RailwayClient',
                data: { url, duration: Date.now() - startTime }
            });
            throw error;
        }
    }

    async processOcr(buffer: Buffer, fileName: string): Promise<string> {
        const startTime = Date.now();
        const baseUrl = this.getPdfProcessorUrl();
        const url = `${baseUrl}/api/pdf/process`;

        log.info({
            msg: `${ICONS.SCAN} Iniciando extração OCR via Railway: ${fileName}`,
            component: 'RailwayClient'
        });

        const formData = new FormData();
        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array], { type: 'application/pdf' });
        formData.append('file', blob, fileName);
        formData.append('forceOCR', 'true');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.OCR_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                await response.text();
                log.warn({ msg: `${ICONS.ERROR} OCR extraction failed (${response.status})`, component: 'RailwayClient' });
                return '';
            }

            const result = await response.json();

            // Validation logic similar to original
            // Assuming result structure matches what we expect or reused type guard
            // Original code had some inline checks, here we assume result.data is the payload
            const data = result.data as any; // Temporary any during refactor transition

            if (data && (data.cleanedText || data.text)) {
                return data.cleanedText || data.text;
            }

            return '';

        } catch (error) {
            clearTimeout(timeoutId);
            const isTimeout = error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'));

            if (isTimeout) {
                log.warn({ msg: `${ICONS.WARNING} OCR timeout (120s exceeded)`, component: 'RailwayClient' });
            } else {
                logError(error instanceof Error ? error : new Error(String(error)), `OCR fetch error`, { component: 'RailwayClient' });
            }
            return '';
        }
    }
}
