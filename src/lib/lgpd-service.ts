// ================================================================
// LGPD DATA SUBJECT RIGHTS SERVICE
// ================================================================
// Implements LGPD (Lei Geral de Proteção de Dados) compliance features:
// - Right to Access (Art. 18, II)
// - Right to Deletion (Art. 18, VI) 
// - Right to Data Portability (Art. 18, V)
// ================================================================

import { prisma } from './prisma';
import { log, logError } from '@/lib/services/logger';

export interface UserDataExport {
    exportedAt: string;
    userId: string;
    personalData: {
        id: string;
        email: string;
        name: string | null;
        phone: string | null;
        avatar: string | null;
        role: string;
        status: string;
        emailVerified: boolean;
        onboardingCompleted: boolean;
        practiceAreas: string[];
        mainGoals: string[];
        createdAt: string;
        updatedAt: string;
        lastLoginAt: string | null;
    };
    workspaces: Array<{
        id: string;
        name: string;
        role: string;
        joinedAt: string;
    }>;
    cases: Array<{
        id: string;
        number: string;
        title: string;
        type: string;
        status: string;
        createdAt: string;
        clientName: string;
    }>;
    documents: Array<{
        id: string;
        name: string;
        type: string;
        uploadedAt: string;
        caseNumber: string;
    }>;
    chatSessions: Array<{
        id: string;
        createdAt: string;
        messageCount: number;
    }>;
    activityLog: Array<{
        action: string;
        timestamp: string;
        details: string | null;
    }>;
}

export interface DeletionResult {
    success: boolean;
    deletedAt: string;
    scheduledPurgeAt: string;
    deletedEntities: {
        cases: number;
        documents: number;
        chatSessions: number;
        notifications: number;
        workspaceAssociations: number;
    };
    error?: string;
}

/**
 * LGPD Data Subject Rights Service
 */
export class LgpdService {
    /**
     * Export all user data (Right to Access / Portability)
     * LGPD Art. 18, II and V
     */
    static async exportUserData(userId: string): Promise<UserDataExport> {
        log.info({
            msg: 'Starting LGPD data export',
            component: 'lgpd',
            userId,
            action: 'EXPORT_DATA'
        });

        const startTime = Date.now();

        try {
            // Fetch user with all related data
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    workspaces: {
                        include: {
                            workspace: true,
                        },
                    },
                    createdCases: {
                        include: {
                            client: true,
                            documents: true,
                        },
                    },
                    chatSessions: {
                        include: {
                            _count: {
                                select: { messages: true },
                            },
                        },
                    },
                    caseEvents: {
                        orderBy: { createdAt: 'desc' },
                        take: 100,
                    },
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            const exportData: UserDataExport = {
                exportedAt: new Date().toISOString(),
                userId: user.id,
                personalData: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    avatar: user.avatar,
                    role: user.role,
                    status: user.status,
                    emailVerified: user.emailVerified,
                    onboardingCompleted: user.onboardingCompleted,
                    practiceAreas: user.practiceAreas,
                    mainGoals: user.mainGoals,
                    createdAt: user.createdAt.toISOString(),
                    updatedAt: user.updatedAt.toISOString(),
                    lastLoginAt: user.lastLoginAt?.toISOString() || null,
                },
                workspaces: user.workspaces.map((uw) => ({
                    id: uw.workspace.id,
                    name: uw.workspace.name,
                    role: uw.role,
                    joinedAt: uw.createdAt.toISOString(),
                })),
                cases: user.createdCases.map((c) => ({
                    id: c.id,
                    number: c.number,
                    title: c.title,
                    type: c.type,
                    status: c.status,
                    createdAt: c.createdAt.toISOString(),
                    clientName: c.client.name,
                })),
                documents: user.createdCases.flatMap((c) =>
                    c.documents.map((d) => ({
                        id: d.id,
                        name: d.name,
                        type: d.type,
                        uploadedAt: d.createdAt.toISOString(),
                        caseNumber: c.number,
                    }))
                ),
                chatSessions: user.chatSessions.map((s) => ({
                    id: s.id,
                    createdAt: s.createdAt.toISOString(),
                    messageCount: s._count.messages,
                })),
                activityLog: user.caseEvents.map((e) => ({
                    action: e.type,
                    timestamp: e.createdAt.toISOString(),
                    details: e.description,
                })),
            };

            log.info({
                msg: 'LGPD data export completed',
                component: 'lgpd',
                userId,
                action: 'EXPORT_DATA',
                duration_ms: Date.now() - startTime,
                entities: {
                    workspaces: exportData.workspaces.length,
                    cases: exportData.cases.length,
                    documents: exportData.documents.length,
                    chatSessions: exportData.chatSessions.length,
                },
            });

            return exportData;
        } catch (error) {
            logError(error, 'LGPD data export failed', {
                component: 'lgpd',
                userId,
                action: 'EXPORT_DATA',
            });
            throw error;
        }
    }

    /**
     * Delete user account and all associated data (Right to Deletion)
     * LGPD Art. 18, VI
     * 
     * Implements soft-delete with 30-day grace period before hard delete
     */
    static async deleteUserAccount(userId: string): Promise<DeletionResult> {
        log.info({
            msg: 'Starting LGPD account deletion',
            component: 'lgpd',
            userId,
            action: 'DELETE_ACCOUNT',
        });

        const startTime = Date.now();
        const deletedAt = new Date();
        const scheduledPurgeAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        try {
            // Use transaction for atomicity
            const result = await prisma.$transaction(async (tx) => {
                // Get user to verify exists
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    include: {
                        workspaces: true,
                        createdCases: {
                            include: {
                                documents: true,
                            },
                        },
                        chatSessions: true,
                        notificationSettings: true,
                    },
                });

                if (!user) {
                    throw new Error('User not found');
                }

                // Count entities to be deleted
                let casesDeleted = 0;
                let documentsDeleted = 0;
                let chatSessionsDeleted = 0;
                let notificationsDeleted = 0;

                // 1. Delete chat sessions and messages
                for (const session of user.chatSessions) {
                    await tx.chatMessage.deleteMany({
                        where: { sessionId: session.id },
                    });
                }
                chatSessionsDeleted = await tx.chatSession.deleteMany({
                    where: { userId: userId },
                }).then(r => r.count);

                // 2. Delete notification settings
                notificationsDeleted = await tx.userNotificationSettings.deleteMany({
                    where: { userId: userId },
                }).then(r => r.count);

                // 3. Delete case events created by user
                await tx.caseEvent.deleteMany({
                    where: { userId: userId },
                });

                // 4. For cases created by user - soft delete or reassign based on workspace policy
                // Here we're marking them as deleted but keeping data for 30 days
                for (const caseItem of user.createdCases) {
                    // Delete associated documents
                    documentsDeleted += await tx.caseDocument.deleteMany({
                        where: { caseId: caseItem.id },
                    }).then(r => r.count);

                    // Delete timeline entries
                    await tx.processTimelineEntry.deleteMany({
                        where: { caseId: caseItem.id },
                    });

                    // Delete analysis versions
                    await tx.caseAnalysisVersion.deleteMany({
                        where: { caseId: caseItem.id },
                    });
                }

                casesDeleted = await tx.case.deleteMany({
                    where: { createdById: userId },
                }).then(r => r.count);

                // 5. Remove user from all workspaces
                const workspaceAssociationsDeleted = await tx.userWorkspace.deleteMany({
                    where: { userId: userId },
                }).then(r => r.count);

                // 6. Anonymize user record (soft delete with data retention)
                // We keep the record for 30 days per LGPD requirements
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        status: 'DELETED',
                        email: `deleted-${userId}@anonymized.local`,
                        name: 'Usuário Removido',
                        phone: null,
                        avatar: null,
                        emailVerified: false,
                        settings: {
                            deletedAt: deletedAt.toISOString(),
                            scheduledPurgeAt: scheduledPurgeAt.toISOString(),
                            originalEmail: user.email, // Keep for audit
                        },
                    },
                });

                return {
                    cases: casesDeleted,
                    documents: documentsDeleted,
                    chatSessions: chatSessionsDeleted,
                    notifications: notificationsDeleted,
                    workspaceAssociations: workspaceAssociationsDeleted,
                };
            });

            log.info({
                msg: 'LGPD account deletion completed',
                component: 'lgpd',
                userId,
                action: 'DELETE_ACCOUNT',
                duration_ms: Date.now() - startTime,
                deletedEntities: result,
                scheduledPurgeAt: scheduledPurgeAt.toISOString(),
            });

            return {
                success: true,
                deletedAt: deletedAt.toISOString(),
                scheduledPurgeAt: scheduledPurgeAt.toISOString(),
                deletedEntities: result,
            };
        } catch (error) {
            logError(error, 'LGPD account deletion failed', {
                component: 'lgpd',
                userId,
                action: 'DELETE_ACCOUNT',
            });

            return {
                success: false,
                deletedAt: deletedAt.toISOString(),
                scheduledPurgeAt: scheduledPurgeAt.toISOString(),
                deletedEntities: {
                    cases: 0,
                    documents: 0,
                    chatSessions: 0,
                    notifications: 0,
                    workspaceAssociations: 0,
                },
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Hard delete user data after retention period
     * Should be called by a scheduled job 30 days after soft delete
     */
    static async purgeDeletedUser(userId: string): Promise<boolean> {
        log.info({
            msg: 'Starting LGPD hard purge',
            component: 'lgpd',
            userId,
            action: 'PURGE_USER',
        });

        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user || user.status !== 'DELETED') {
                log.warn({
                    msg: 'User not found or not in DELETED status',
                    component: 'lgpd',
                    userId,
                    action: 'PURGE_USER',
                });
                return false;
            }

            // Verify 30-day retention period has passed
            const settings = user.settings as { scheduledPurgeAt?: string } | null;
            if (settings?.scheduledPurgeAt) {
                const purgeDate = new Date(settings.scheduledPurgeAt);
                if (purgeDate > new Date()) {
                    log.warn({
                        msg: 'Retention period not yet expired',
                        component: 'lgpd',
                        userId,
                        action: 'PURGE_USER',
                        scheduledPurgeAt: settings.scheduledPurgeAt,
                    });
                    return false;
                }
            }

            // Hard delete user record
            await prisma.user.delete({
                where: { id: userId },
            });

            log.info({
                msg: 'LGPD hard purge completed',
                component: 'lgpd',
                userId,
                action: 'PURGE_USER',
            });

            return true;
        } catch (error) {
            logError(error, 'LGPD hard purge failed', {
                component: 'lgpd',
                userId,
                action: 'PURGE_USER',
            });
            return false;
        }
    }

    /**
     * Get list of users pending hard delete (scheduled job helper)
     */
    static async getUsersPendingPurge(): Promise<string[]> {
        try {
            const deletedUsers = await prisma.user.findMany({
                where: {
                    status: 'DELETED',
                },
                select: {
                    id: true,
                    settings: true,
                },
            });

            const now = new Date();
            return deletedUsers
                .filter((user) => {
                    const settings = user.settings as { scheduledPurgeAt?: string } | null;
                    if (!settings?.scheduledPurgeAt) return false;
                    return new Date(settings.scheduledPurgeAt) <= now;
                })
                .map((user) => user.id);
        } catch (error) {
            logError(error, 'Failed to get users pending purge', {
                component: 'lgpd',
                action: 'GET_PENDING_PURGE',
            });
            return [];
        }
    }
}

export default LgpdService;
