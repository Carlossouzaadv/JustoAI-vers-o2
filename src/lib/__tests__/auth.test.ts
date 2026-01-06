/**
 * @jest-environment node
 * 
 * Auth Module Tests
 * Tests authentication functions: getCurrentUser, requireAuth
 * Uses mocked Supabase client and Prisma
 */

import { NextRequest, NextResponse } from 'next/server';

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
const mockPrisma = {
    user: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
    },
    workspace: {
        create: jest.fn(),
    },
};

jest.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
}));

// Mock logger
jest.mock('@/lib/services/logger', () => ({
    log: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    logError: jest.fn(),
}));

// Import after mocks are set up
import { getCurrentUser, requireAuth } from '../auth';

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

            mockPrisma.user.upsert.mockResolvedValue(mockDbUser);

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
            };

            const mockDbUserWithWorkspace = {
                ...mockDbUserWithoutWorkspace,
                workspaces: [{ workspace: mockNewWorkspace }],
            };

            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: mockSupabaseUser },
                error: null,
            });

            mockPrisma.user.upsert.mockResolvedValue(mockDbUserWithoutWorkspace);
            mockPrisma.workspace.create.mockResolvedValue(mockNewWorkspace);
            mockPrisma.user.findUnique.mockResolvedValue(mockDbUserWithWorkspace);

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

    describe('requireAuth', () => {
        it('should return 401 when no user is authenticated', async () => {
            mockSupabaseAuth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const handler = async () => {
                return NextResponse.json({ data: 'protected' });
            };

            const mockRequest = new NextRequest('http://localhost:3000/api/test');
            const result = await requireAuth(handler)(mockRequest);

            expect(result.status).toBe(401);
            const json = await result.json();
            expect(json.error).toBeDefined();
        });

        it('should call handler with user when authenticated', async () => {
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

            mockPrisma.user.upsert.mockResolvedValue(mockDbUser);

            const handler = jest.fn().mockResolvedValue(
                NextResponse.json({ data: 'protected' })
            );

            const mockRequest = new NextRequest('http://localhost:3000/api/test');
            const result = await requireAuth(handler)(mockRequest);

            expect(result.status).toBe(200);
            expect(handler).toHaveBeenCalledWith(
                mockRequest,
                expect.objectContaining({
                    id: 'db-user-123',
                    email: 'test@example.com',
                })
            );
        });

        it('should pass workspace info to handler', async () => {
            const mockSupabaseUser = {
                id: 'supabase-user-123',
                email: 'test@example.com',
                email_confirmed_at: '2024-01-01T00:00:00Z',
                user_metadata: {},
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

            mockPrisma.user.upsert.mockResolvedValue(mockDbUser);

            const handler = jest.fn().mockResolvedValue(
                NextResponse.json({ data: 'protected' })
            );

            const mockRequest = new NextRequest('http://localhost:3000/api/test');
            await requireAuth(handler)(mockRequest);

            const calledUser = handler.mock.calls[0][1];
            expect(calledUser.workspaces).toBeDefined();
            expect(calledUser.workspaces[0].workspace.id).toBe('workspace-123');
        });
    });
});
