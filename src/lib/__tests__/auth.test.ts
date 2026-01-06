/**
 * @jest-environment node
 * 
 * Auth Module Tests
 * Tests authentication functions: getCurrentUser
 * Uses mocked Supabase client and Prisma
 */

import { prisma } from '@/lib/prisma';

// Mock next/headers before importing auth module
jest.mock('next/headers', () => ({
    cookies: jest.fn().mockResolvedValue({
        get: jest.fn(),
        set: jest.fn(),
    }),
}));

// Mock Supabase SSR
const mockSupabaseAuth = {
    getUser: jest.fn(),
    getSession: jest.fn(),
};

const mockSupabaseClient = {
    auth: mockSupabaseAuth,
};

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
        },
        workspace: {
            create: jest.fn(),
        },
        userWorkspace: {
            findUnique: jest.fn(),
        },
    },
}));

// Mock logger
jest.mock('@/lib/services/logger', () => ({
    log: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    logError: jest.fn(),
}));

// Get typed mock
const mockPrisma = jest.mocked(prisma);

// Import after mocks are set up
import { getCurrentUser, hasWorkspaceAccess, getUserWorkspaceRole, validateAuth } from '../auth';

describe('Auth Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getCurrentUser', () => {
        it('should return null when no user session exists', async () => {
            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const result = await getCurrentUser();

            expect(result).toBeNull();
            expect(mockSupabaseAuth.getUser).toHaveBeenCalled();
        });

        it('should return null when auth error occurs', async () => {
            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Auth error'),
            });

            const result = await getCurrentUser();

            expect(result).toBeNull();
        });

        it('should sync user with database and return user data', async () => {
            const mockSupabaseUser = {
                id: 'supabase-user-123',
                email: 'test@example.com',
                email_confirmed_at: '2024-01-01T00:00:00Z',
                user_metadata: { full_name: 'Test User' },
            };

            const mockDbUser = {
                id: 'db-user-123',
                email: 'test@example.com',
                name: 'Test User',
                supabaseId: 'supabase-user-123',
                workspaces: [
                    {
                        workspace: {
                            id: 'workspace-123',
                            name: 'Test Workspace',
                            slug: 'test-workspace',
                        },
                    },
                ],
            };

            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: mockSupabaseUser },
                error: null,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockPrisma.user.upsert.mockResolvedValue(mockDbUser as any);

            const result = await getCurrentUser();

            expect(result).toBeDefined();
            expect(result?.email).toBe('test@example.com');
            expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { supabaseId: 'supabase-user-123' },
                })
            );
        });

        it('should create default workspace for new user without workspaces', async () => {
            const mockSupabaseUser = {
                id: 'new-user-123',
                email: 'newuser@example.com',
                email_confirmed_at: '2024-01-01T00:00:00Z',
                user_metadata: { full_name: 'New User' },
            };

            // User exists but has no workspaces
            const mockDbUserWithoutWorkspace = {
                id: 'db-user-123',
                email: 'newuser@example.com',
                name: 'New User',
                supabaseId: 'new-user-123',
                workspaces: [], // Empty workspaces array
            };

            const mockNewWorkspace = {
                id: 'new-workspace-123',
                name: "New User's Workspace",
                slug: 'workspace-new-user',
                users: [],
            };

            const mockDbUserWithWorkspace = {
                ...mockDbUserWithoutWorkspace,
                workspaces: [{ workspace: mockNewWorkspace }],
            };

            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: mockSupabaseUser },
                error: null,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockPrisma.user.upsert.mockResolvedValue(mockDbUserWithoutWorkspace as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockPrisma.workspace.create.mockResolvedValue(mockNewWorkspace as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockPrisma.user.findUnique.mockResolvedValue(mockDbUserWithWorkspace as any);

            const result = await getCurrentUser();

            expect(result).toBeDefined();
            expect(mockPrisma.workspace.create).toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            const mockSupabaseUser = {
                id: 'user-123',
                email: 'test@example.com',
                email_confirmed_at: null,
                user_metadata: {},
            };

            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: mockSupabaseUser },
                error: null,
            });

            mockPrisma.user.upsert.mockRejectedValue(new Error('Database error'));

            const result = await getCurrentUser();

            expect(result).toBeNull();
        });
    });

    describe('hasWorkspaceAccess', () => {
        it('should return true when user has active workspace access', async () => {
            mockPrisma.userWorkspace.findUnique.mockResolvedValue({
                userId: 'user-123',
                workspaceId: 'workspace-123',
                status: 'ACTIVE',
                role: 'MEMBER',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            const result = await hasWorkspaceAccess('user-123', 'workspace-123');

            expect(result).toBe(true);
        });

        it('should return false when user has no workspace access', async () => {
            mockPrisma.userWorkspace.findUnique.mockResolvedValue(null);

            const result = await hasWorkspaceAccess('user-123', 'workspace-123');

            expect(result).toBe(false);
        });

        it('should return false when user workspace status is not active', async () => {
            mockPrisma.userWorkspace.findUnique.mockResolvedValue({
                userId: 'user-123',
                workspaceId: 'workspace-123',
                status: 'INACTIVE',
                role: 'MEMBER',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            const result = await hasWorkspaceAccess('user-123', 'workspace-123');

            expect(result).toBe(false);
        });
    });

    describe('getUserWorkspaceRole', () => {
        it('should return role when user has workspace access', async () => {
            mockPrisma.userWorkspace.findUnique.mockResolvedValue({
                userId: 'user-123',
                workspaceId: 'workspace-123',
                status: 'ACTIVE',
                role: 'OWNER',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);

            const result = await getUserWorkspaceRole('user-123', 'workspace-123');

            expect(result).toBe('OWNER');
        });

        it('should return null when user has no workspace access', async () => {
            mockPrisma.userWorkspace.findUnique.mockResolvedValue(null);

            const result = await getUserWorkspaceRole('user-123', 'workspace-123');

            expect(result).toBeNull();
        });
    });

    describe('validateAuth', () => {
        it('should throw when no user session exists', async () => {
            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            await expect(validateAuth()).rejects.toThrow('Unauthorized');
        });

        it('should return user and workspace when authenticated', async () => {
            const mockSupabaseUser = {
                id: 'supabase-user-123',
                email: 'test@example.com',
                email_confirmed_at: '2024-01-01T00:00:00Z',
                user_metadata: { full_name: 'Test User' },
            };

            const mockDbUser = {
                id: 'db-user-123',
                email: 'test@example.com',
                name: 'Test User',
                supabaseId: 'supabase-user-123',
                workspaces: [
                    {
                        workspace: {
                            id: 'workspace-123',
                            name: 'Test Workspace',
                            slug: 'test-workspace',
                        },
                    },
                ],
            };

            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: mockSupabaseUser },
                error: null,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mockPrisma.user.upsert.mockResolvedValue(mockDbUser as any);

            const result = await validateAuth();

            expect(result.user).toBeDefined();
            expect(result.user.email).toBe('test@example.com');
            expect(result.workspace?.id).toBe('workspace-123');
        });
    });
});
