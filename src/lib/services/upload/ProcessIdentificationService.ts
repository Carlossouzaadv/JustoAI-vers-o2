
import { PrismaClient } from '@prisma/client';
import { TextCleaner } from '@/lib/text-cleaner';
import { ICONS } from '@/lib/icons';
import { log, logError } from '@/lib/services/logger';

// Interface for extraction result
export interface ProcessExtractionResult {
    processNumber: string | null;
    cleaningResult: {
        cleanedText: string;
        originalLength: number;
        cleanedLength: number;
    };
}

// Interface for identification result
export interface ProcessIdentificationResult {
    targetCaseId: string | null;
    isNew: boolean;
    requiresUserDecision: boolean;
    existingProcess?: {
        id: string;
        title: string;
        number: string;
        clientName: string;
        documentCount: number;
    };
    extractedProcessNumber?: string;
    defaultClientId?: string;
}

export class ProcessIdentificationService {
    private prisma: PrismaClient;
    private textCleaner: TextCleaner;
    private readonly UNASSIGNED_FOLDER = 'clientes_a_definir';

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.textCleaner = new TextCleaner();
    }

    /**
     * Extracts process number and cleans text
     */
    public processText(text: string): ProcessExtractionResult {
        const cleaningResult = this.textCleaner.cleanLegalDocument(text);
        const processNumber = this.textCleaner.extractProcessNumber(cleaningResult.cleanedText);

        log.info({
            msg: processNumber
                ? `${ICONS.SUCCESS} Processo identificado: ${processNumber}`
                : `${ICONS.INFO} Número do processo não identificado`,
            component: 'ProcessIdentificationService'
        });

        return {
            processNumber,
            cleaningResult
        };
    }

    /**
     * Identifies or creates a process based on extraction
     */
    public async identifyOrCreateProcess(
        workspaceId: string,
        userId: string,
        extraction: ProcessExtractionResult,
        providedCaseId?: string
    ): Promise<ProcessIdentificationResult> {
        const { processNumber } = extraction;

        // 1. Try to find existing process in this workspace
        let existingProcess = null;
        if (processNumber) {
            existingProcess = await this.prisma.case.findFirst({
                where: {
                    number: processNumber,
                    workspaceId: workspaceId
                },
                include: {
                    client: true,
                    _count: {
                        select: { documents: true }
                    }
                }
            });
        }

        // 2. If found, return for user decision (Prompt User)
        if (existingProcess) {
            return {
                targetCaseId: existingProcess.id,
                isNew: false,
                requiresUserDecision: true, // Should match 'shouldPromptUser' logic
                existingProcess: {
                    id: existingProcess.id,
                    title: existingProcess.title,
                    number: existingProcess.number,
                    clientName: existingProcess.client.name,
                    documentCount: existingProcess._count.documents
                },
                extractedProcessNumber: processNumber || undefined
            };
        }

        // 3. If providedCaseId exists, validate and use it
        if (providedCaseId) {
            const providedCase = await this.prisma.case.findFirst({
                where: {
                    id: providedCaseId,
                    workspaceId: workspaceId
                }
            });

            if (!providedCase) {
                throw new Error('Caso fornecido não existe ou você não tem acesso a ele');
            }

            return {
                targetCaseId: providedCase.id,
                isNew: false,
                requiresUserDecision: false
            };
        }

        // 4. If new process detected (CNJ found but no existing case), create "Unassigned"
        if (processNumber) {
            return await this.createUnassignedProcess(workspaceId, userId, processNumber, extraction.cleaningResult.cleanedText);
        }

        // 5. Fallback: No process number and no caseId
        return {
            targetCaseId: null,
            isNew: false,
            requiresUserDecision: false
        };
    }

    /**
     * Creates a new process in the "Unassigned" folder
     */
    private async createUnassignedProcess(
        workspaceId: string,
        userId: string,
        processNumber: string,
        cleanText: string
    ): Promise<ProcessIdentificationResult> {
        // Determine default client
        let defaultClient = await this.prisma.client.findFirst({
            where: {
                workspaceId: workspaceId,
                name: this.UNASSIGNED_FOLDER
            }
        });

        if (!defaultClient) {
            defaultClient = await this.prisma.client.create({
                data: {
                    workspaceId: workspaceId,
                    name: this.UNASSIGNED_FOLDER,
                    type: 'INDIVIDUAL',
                    status: 'ACTIVE'
                }
            });
        }

        // Extract basic basic metadata for title/description
        const basicData = await this.extractBasicProcessData(cleanText);

        try {
            const newCase = await this.prisma.case.upsert({
                where: {
                    number_workspaceId: {
                        number: processNumber,
                        workspaceId: workspaceId
                    }
                },
                update: {
                    updatedAt: new Date()
                },
                create: {
                    workspaceId: workspaceId,
                    clientId: defaultClient.id,
                    number: processNumber,
                    detectedCnj: processNumber,
                    title: basicData.title || `Processo ${processNumber}`,
                    description: basicData.description,
                    type: 'CIVIL',
                    status: 'UNASSIGNED',
                    priority: 'MEDIUM',
                    createdById: userId,
                    claimValue: basicData.claimValue,
                    metadata: JSON.parse(JSON.stringify({
                        autoCreated: true,
                        createdFromUpload: true,
                        extractedData: basicData,
                        needsAssignment: true
                    }))
                }
            });

            return {
                targetCaseId: newCase.id,
                isNew: true,
                requiresUserDecision: false,
                extractedProcessNumber: processNumber,
                defaultClientId: defaultClient.id
            };

        } catch (error) {
            // If upsert fails (race condition), try to find again
            const existingCase = await this.prisma.case.findFirst({
                where: {
                    number: processNumber,
                    workspaceId: workspaceId
                }
            });

            if (existingCase) {
                return {
                    targetCaseId: existingCase.id,
                    isNew: false,
                    requiresUserDecision: false
                };
            }

            logError(error instanceof Error ? error : new Error(String(error)), `${ICONS.ERROR} Erro ao criar processo automático`, { component: 'ProcessIdentificationService' });
            throw error;
        }
    }

    /**
     * Helper to extract basic data from text (Title, Description, Value)
     * This is a lite version of what Gemini does, using regex/heuristics to avoid cost
     */
    private async extractBasicProcessData(text: string): Promise<{
        title?: string;
        description?: string;
        claimValue?: number;
    }> {
        // Implement heuristics here similar to original route
        // DEFERRED: Improve this with light regex extraction if needed (Phase 2)
        // For now returning basic structure as per original implementation
        return {
            description: text.substring(0, 200) + '...'
        };
    }
}
