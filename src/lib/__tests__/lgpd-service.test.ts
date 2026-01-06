/**
 * @jest-environment node
 * 
 * LGPD Service Tests
 * Tests data export and account deletion functionality
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { LgpdService } from '../lgpd-service';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
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
        chatMessage: {
            deleteMany: jest.fn(),
        },
        userWorkspace: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        userNotificationSettings: {
            deleteMany: jest.fn(),
        },
        caseEvent: {
            deleteMany: jest.fn(),
        },
        processTimelineEntry: {
            deleteMany: jest.fn(),
        },
        caseAnalysisVersion: {
            deleteMany: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

// Mock logger
jest.mock('@/lib/services/logger', () => ({
    log: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    logError: jest.fn(),
}));

// Get typed mock
const mockPrisma = jest.mocked(prisma);

describe('LgpdService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exportUserData', () => {
        it('should throw error when user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            await expect(LgpdService.exportUserData('non-existent-user'))
                .rejects
                .toThrow('User not found');
        });

        it('should export user data with all related records', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                phone: '11999999999',
                avatar: null,
                role: 'USER',
                status: 'ACTIVE',
                emailVerified: true,
                onboardingCompleted: true,
                practiceAreas: ['civil'],
                mainGoals: ['automation'],
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-06-01'),
                lastLoginAt: new Date('2024-06-15'),
                workspaces: [
                    {
                        workspace: {
                            id: 'workspace-123',
                            name: 'Test Workspace',
                        },
                        role: 'OWNER',
                        createdAt: new Date('2024-01-01'),
                    },
                ],
                createdCases: [
                    {
                        id: 'case-123',
                        number: '0001234-56.2024.8.26.0100',
                        title: 'Ação de Cobrança',
                        type: 'CIVIL',
                        status: 'ACTIVE',
                        createdAt: new Date('2024-02-01'),
                        client: { name: 'Cliente Teste' },
                        documents: [
                            {
                                id: 'doc-123',
                                name: 'petição.pdf',
                                type: 'PETITION',
                                createdAt: new Date('2024-02-01'),
                            },
                        ],
                    },
                ],
                chatSessions: [
                    {
                        id: 'chat-123',
                        createdAt: new Date('2024-03-01'),
                        _count: { messages: 5 },
                    },
                ],
                caseEvents: [
                    {
                        type: 'CASE_CREATED',
                        createdAt: new Date('2024-02-01'),
                        description: 'Caso criado',
                    },
                ],
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

            const result = await LgpdService.exportUserData('user-123');

            expect(result).toHaveProperty('personalData');
            expect(result).toHaveProperty('workspaces');
            expect(result).toHaveProperty('cases');
            expect(result).toHaveProperty('documents');
            expect(result).toHaveProperty('chatSessions');
            expect(result).toHaveProperty('activityLog');

            expect(result.personalData.email).toBe('test@example.com');
            expect(result.cases).toHaveLength(1);
            expect(result.documents).toHaveLength(1);
            expect(result.chatSessions).toHaveLength(1);
        });

        it('should return empty arrays when user has no data', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'minimal@example.com',
                name: 'Minimal User',
                phone: null,
                avatar: null,
                role: 'USER',
                status: 'ACTIVE',
                emailVerified: false,
                onboardingCompleted: false,
                practiceAreas: [],
                mainGoals: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                lastLoginAt: null,
                workspaces: [],
                createdCases: [],
                chatSessions: [],
                caseEvents: [],
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

            const result = await LgpdService.exportUserData('user-123');

            expect(result.cases).toHaveLength(0);
            expect(result.documents).toHaveLength(0);
            expect(result.chatSessions).toHaveLength(0);
        });
    });

    describe('deleteUserAccount', () => {
        it('should return error result when user not found', async () => {
            // Mock transaction to throw the not found error
            mockPrisma.$transaction.mockImplementation(async (callback) => {
                if (typeof callback === 'function') {
                    const txMock = {
                        user: {
                            findUnique: jest.fn().mockResolvedValue(null),
                            update: jest.fn(),
                        },
                        chatMessage: { deleteMany: jest.fn() },
                        chatSession: { deleteMany: jest.fn() },
                        userNotificationSettings: { deleteMany: jest.fn() },
                        caseEvent: { deleteMany: jest.fn() },
                        caseDocument: { deleteMany: jest.fn() },
                        processTimelineEntry: { deleteMany: jest.fn() },
                        caseAnalysisVersion: { deleteMany: jest.fn() },
                        case: { deleteMany: jest.fn() },
                        userWorkspace: { deleteMany: jest.fn() },
                    };
                    return callback(txMock as unknown as Prisma.TransactionClient);
                }
                throw new Error('Invalid transaction');
            });

            const result = await LgpdService.deleteUserAccount('non-existent-user');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should soft delete user and return deletion result', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                status: 'ACTIVE',
                workspaces: [],
                createdCases: [],
                chatSessions: [],
                notificationSettings: null,
            };

            // Mock successful transaction
            mockPrisma.$transaction.mockImplementation(async (callback) => {
                if (typeof callback === 'function') {
                    const txMock = {
                        user: {
                            findUnique: jest.fn().mockResolvedValue(mockUser),
                            update: jest.fn().mockResolvedValue({
                                ...mockUser,
                                status: 'DELETED',
                                email: 'deleted-user-123@anonymized.local',
                                name: 'Usuário Removido',
                            }),
                        },
                        chatMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
                        userNotificationSettings: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
                        caseEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        caseDocument: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
                        processTimelineEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        caseAnalysisVersion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        case: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
                        userWorkspace: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
                    };
                    return callback(txMock as unknown as Prisma.TransactionClient);
                }
                throw new Error('Invalid transaction');
            });

            const result = await LgpdService.deleteUserAccount('user-123');

            expect(result.success).toBe(true);
            expect(result).toHaveProperty('deletedAt');
            expect(result).toHaveProperty('scheduledPurgeAt');
            expect(result).toHaveProperty('deletedEntities');
        });

        it('should return proper purge date (30 days from now)', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                status: 'ACTIVE',
                workspaces: [],
                createdCases: [],
                chatSessions: [],
                notificationSettings: null,
            };

            mockPrisma.$transaction.mockImplementation(async (callback) => {
                if (typeof callback === 'function') {
                    const txMock = {
                        user: {
                            findUnique: jest.fn().mockResolvedValue(mockUser),
                            update: jest.fn().mockResolvedValue(mockUser),
                        },
                        chatMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        userNotificationSettings: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        caseEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        caseDocument: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        processTimelineEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        caseAnalysisVersion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        case: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                        userWorkspace: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
                    };
                    return callback(txMock as unknown as Prisma.TransactionClient);
                }
                throw new Error('Invalid transaction');
            });

            const before = new Date();
            const result = await LgpdService.deleteUserAccount('user-123');

            const purgeDate = new Date(result.scheduledPurgeAt);
            const expectedMinDate = new Date(before);
            expectedMinDate.setDate(expectedMinDate.getDate() + 29); // At least 29 days

            expect(purgeDate.getTime()).toBeGreaterThan(expectedMinDate.getTime());
        });
    });

    describe('getUsersPendingPurge', () => {
        it('should return user IDs marked for deletion past retention period', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 31); // 31 days ago

            mockPrisma.user.findMany.mockResolvedValue([
                {
                    id: 'user-to-purge',
                    settings: {
                        scheduledPurgeAt: pastDate.toISOString(),
                    },
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any);

            const result = await LgpdService.getUsersPendingPurge();

            expect(result).toHaveLength(1);
            expect(result[0]).toBe('user-to-purge');
        });

        it('should not return users whose purge date has not passed', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 10); // 10 days in future

            mockPrisma.user.findMany.mockResolvedValue([
                {
                    id: 'user-not-ready',
                    settings: {
                        scheduledPurgeAt: futureDate.toISOString(),
                    },
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any);

            const result = await LgpdService.getUsersPendingPurge();

            expect(result).toHaveLength(0);
        });
    });
});
