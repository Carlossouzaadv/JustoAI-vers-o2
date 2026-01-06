/**
 * @jest-environment node
 * 
 * LGPD Service Tests
 * Tests data export and account deletion functionality
 */

// Mock Prisma
const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    case: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
    },
    caseDocument: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
    },
    chatSession: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
    },
    userWorkspace: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
}));

// Mock logger
jest.mock('@/lib/services/logger', () => ({
    log: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    logError: jest.fn(),
}));

import { LgpdService } from '../lgpd-service';

describe('LgpdService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exportUserData', () => {
        it('should throw error when user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            await expect(LgpdService.exportUserData('non-existent-user'))
                .rejects
                .toThrow('Usuário não encontrado');
        });

        it('should export user data with all related records', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                phone: '11999999999',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-06-01'),
                lastLoginAt: new Date('2024-06-15'),
                workspaces: [
                    {
                        workspace: {
                            id: 'workspace-123',
                            name: 'Test Workspace',
                            createdAt: new Date('2024-01-01'),
                        },
                    },
                ],
            };

            const mockCases = [
                {
                    id: 'case-123',
                    number: '0001234-56.2024.8.26.0100',
                    title: 'Ação de Cobrança',
                    status: 'ACTIVE',
                    createdAt: new Date('2024-02-01'),
                },
            ];

            const mockDocuments = [
                {
                    id: 'doc-123',
                    name: 'petição.pdf',
                    originalName: 'petição inicial.pdf',
                    mimeType: 'application/pdf',
                    size: 102400,
                    createdAt: new Date('2024-02-01'),
                },
            ];

            const mockChatSessions = [
                {
                    id: 'chat-123',
                    title: 'Consulta sobre caso',
                    createdAt: new Date('2024-03-01'),
                    updatedAt: new Date('2024-03-01'),
                },
            ];

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockPrisma.case.findMany.mockResolvedValue(mockCases);
            mockPrisma.caseDocument.findMany.mockResolvedValue(mockDocuments);
            mockPrisma.chatSession.findMany.mockResolvedValue(mockChatSessions);

            const result = await LgpdService.exportUserData('user-123');

            expect(result).toHaveProperty('dadosPessoais');
            expect(result).toHaveProperty('workspaces');
            expect(result).toHaveProperty('casos');
            expect(result).toHaveProperty('documentos');
            expect(result).toHaveProperty('historicoChat');
            expect(result).toHaveProperty('metadados');

            expect(result.dadosPessoais.email).toBe('test@example.com');
            expect(result.casos).toHaveLength(1);
            expect(result.documentos).toHaveLength(1);
            expect(result.historicoChat).toHaveLength(1);
        });

        it('should return empty arrays when user has no data', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'minimal@example.com',
                name: 'Minimal User',
                phone: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastLoginAt: null,
                workspaces: [],
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockPrisma.case.findMany.mockResolvedValue([]);
            mockPrisma.caseDocument.findMany.mockResolvedValue([]);
            mockPrisma.chatSession.findMany.mockResolvedValue([]);

            const result = await LgpdService.exportUserData('user-123');

            expect(result.casos).toHaveLength(0);
            expect(result.documentos).toHaveLength(0);
            expect(result.historicoChat).toHaveLength(0);
        });
    });

    describe('deleteUserAccount', () => {
        it('should throw error when user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            await expect(LgpdService.deleteUserAccount('non-existent-user'))
                .rejects
                .toThrow('Usuário não encontrado');
        });

        it('should soft delete user and anonymize data', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                status: 'ACTIVE',
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);

            // Mock transaction
            mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
                const txMock = {
                    caseDocument: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
                    case: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
                    chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 10 }) },
                    userWorkspace: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
                    user: {
                        update: jest.fn().mockResolvedValue({
                            ...mockUser,
                            status: 'DELETED',
                            email: 'deleted_user_123@deleted.lgpd',
                            name: 'Usuário Deletado',
                        }),
                    },
                };
                return callback(txMock);
            });

            const result = await LgpdService.deleteUserAccount('user-123');

            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('deletionScheduledFor');
            expect(result).toHaveProperty('deletedRecords');
            expect(result.deletedRecords.documents).toBe(5);
            expect(result.deletedRecords.cases).toBe(2);
            expect(result.deletedRecords.chatSessions).toBe(10);
        });

        it('should return proper purge date (30 days from now)', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                status: 'ACTIVE',
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
                const txMock = {
                    caseDocument: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                    case: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                    chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                    userWorkspace: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                    user: { update: jest.fn().mockResolvedValue(mockUser) },
                };
                return callback(txMock);
            });

            const before = new Date();
            const result = await LgpdService.deleteUserAccount('user-123');

            const purgeDate = new Date(result.deletionScheduledFor);
            const expectedMinDate = new Date(before);
            expectedMinDate.setDate(expectedMinDate.getDate() + 29); // At least 29 days

            expect(purgeDate.getTime()).toBeGreaterThan(expectedMinDate.getTime());
        });
    });

    describe('getUsersPendingPurge', () => {
        it('should return users marked for deletion past retention period', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 31); // 31 days ago

            mockPrisma.user.findMany = jest.fn().mockResolvedValue([
                {
                    id: 'user-to-purge',
                    email: 'deleted_user_123@deleted.lgpd',
                    status: 'DELETED',
                    updatedAt: pastDate,
                },
            ]);

            const result = await LgpdService.getUsersPendingPurge();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('user-to-purge');
        });
    });
});
