# MVP Features Implementation Guide

**Status:** November 4, 2025
**Target Launch:** December 1, 2025 (3-4 weeks)
**All Security Blockers:** ✅ COMPLETE

---

## Overview

This document provides complete implementation specifications for the 6 remaining MVP features. All features are ready to implement - no schema migrations needed.

### Timeline Summary
- **Week 1:** Features 2, 3, 5 (20-29 hours)
- **Week 2-3:** Feature 4 (20-25 hours)
- **Week 3-4:** Feature 6 (12-15 hours)
- **Total Effort:** 50-65 hours / 3-4 weeks

---

## FEATURE 2: Document APIs (PATCH/DELETE)

**Status:** 70% Complete | **Effort:** 5-7 hours | **Priority:** HIGH
**Start Date:** Immediately | **Dependencies:** None

### Context
Documents (CaseDocument model) are already fully uploadable. Users need to be able to update metadata and delete documents.

### Database Schema
```prisma
model CaseDocument {
  id            String    @id @default(cuid())
  caseId        String
  name          String    // editable
  type          String
  url           String    // immutable (in S3)
  tags          String[]  // editable
  size          BigInt
  mimeType      String
  textSha       String    @unique // immutable
  isDuplicate   Boolean   @default(false) // immutable
  metadata      Json?     // editable (summary, custom fields)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Implementation Tasks

#### Task 2.1: PATCH /api/documents/[id]
**Effort:** 2-3 hours | **File:** `src/app/api/documents/[id]/route.ts`

**Responsibilities:**
- Validate auth (user belongs to workspace with access)
- Parse request body with Zod schema
- Update document metadata
- Create audit event
- Return updated document

**Request Body:**
```typescript
{
  name?: string;           // new filename
  tags?: string[];         // comma-separated keywords
  summary?: string;        // in metadata.summary
  category?: string;       // in metadata.category
}
```

**Validation Rules:**
- `name`: 3-255 chars, no path traversal characters
- `tags`: array of 0-10 strings, each 1-50 chars
- `summary`: max 1000 chars

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "xxx",
    "name": "new name",
    "tags": ["tag1", "tag2"],
    "updatedAt": "2025-11-04T...",
    "lastModifiedBy": "user@example.com"
  }
}
```

**Key Code Pattern:**
```typescript
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { z } from 'zod';

const updateDocumentSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  tags: z.array(z.string()).max(10).optional(),
  summary: z.string().max(1000).optional(),
});

export async function PATCH(request: NextRequest, { params }: any) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    setSentryUserContext(user.id);

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateDocumentSchema.parse(body);

    // Check document ownership via workspace
    const document = await prisma.caseDocument.findUnique({
      where: { id },
      include: { case: { include: { workspace: true } } }
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Verify workspace access
    const hasAccess = document.case.workspace.members.some(m => m.userId === user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update document
    const updated = await prisma.caseDocument.update({
      where: { id },
      data: {
        name: validatedData.name,
        tags: validatedData.tags,
        metadata: {
          ...(document.metadata || {}),
          summary: validatedData.summary,
        },
      },
    });

    // Create audit event
    await prisma.caseEvent.create({
      data: {
        caseId: document.caseId,
        type: 'DOCUMENT_UPDATED',
        userId: user.id,
        metadata: { documentId: id, changes: validatedData },
      },
    });

    return NextResponse.json({
      success: true,
      document: updated,
    });

  } catch (error) {
    captureApiError(error, {
      endpoint: '/api/documents/[id]',
      method: 'PATCH',
      userId: user?.id,
    });
    // ... error response
  }
}
```

#### Task 2.2: DELETE /api/documents/[id]
**Effort:** 3-4 hours | **File:** Same file, DELETE handler

**Responsibilities:**
- Verify user has admin role OR is case owner
- Delete from Supabase Storage (use SDKStorage)
- Delete document record (cascades handled by Prisma)
- Create deletion audit event
- Return confirmation

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully",
  "documentId": "xxx",
  "deletedAt": "2025-11-04T..."
}
```

**Important Cascades:**
- ❌ TimelineEntry: Some may reference this document (handle gracefully)
- ❌ ImportedDataItem: May have data from this document

**Strategy:**
- Option A: Soft delete (mark `isDeleted`, hide in queries)
- Option B: Hard delete + null out references in TimelineEntry
- Recommendation: Hard delete with null handling

**Key Code:**
```typescript
export async function DELETE(request: NextRequest, { params }: any) {
  try {
    // 1. Auth + ownership check (same as PATCH)
    // 2. Get document with file path
    const document = await prisma.caseDocument.findUnique({
      where: { id },
    });

    // 3. Delete from Supabase Storage
    const { error } = await supabase.storage
      .from('documents')
      .remove([document.path]);

    if (error) throw new Error(`Failed to delete file: ${error.message}`);

    // 4. Delete related TimelineEntry references
    await prisma.timelineEntry.updateMany({
      where: { documentId: id },
      data: { documentId: null },
    });

    // 5. Delete document
    await prisma.caseDocument.delete({
      where: { id },
    });

    // 6. Create audit event
    await prisma.caseEvent.create({
      data: {
        caseId: document.caseId,
        type: 'DOCUMENT_DELETED',
        userId: user.id,
        metadata: { documentId: id, fileName: document.name },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    // ... error handling
  }
}
```

### Testing Checklist
- [ ] User can update document name
- [ ] User can add/remove tags
- [ ] User cannot modify other user's documents
- [ ] File is deleted from Supabase on DELETE
- [ ] Timeline entries are cleaned up
- [ ] Audit events created for both operations
- [ ] Sentry errors captured on failures

---

## FEATURE 3: Case Notes CRUD

**Status:** 5% Complete (stubs) | **Effort:** 7-10 hours | **Priority:** HIGH
**Start Date:** Immediately | **Dependencies:** None

### Context
Case notes are stored as CaseEvent records with type='NOTE'. System needs full CRUD operations with user assignment and metadata.

### Database Schema
```prisma
model CaseEvent {
  id            String    @id @default(cuid())
  caseId        String
  type          String    // "NOTE" for notes
  description   String    // note content
  userId        String    // author
  user          User      @relation(fields: [userId], references: [id])
  metadata      Json?     // { tags: [], isPinned: bool, priority: "low|med|high" }
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Implementation Tasks

#### Task 3.1: GET /api/cases/[id]/notes
**Effort:** 2 hours | **File:** `src/app/api/cases/[id]/notes/route.ts`

**Current State:** Returns empty array (stub)
**Replace with:** Query real CaseEvent records

**Query Parameters:**
- `page`: number (default 1)
- `limit`: number (default 20, max 100)
- `sort`: "newest" | "oldest" | "pinned" (default "newest")

**Response:**
```json
{
  "success": true,
  "notes": [
    {
      "id": "note_xxx",
      "title": "Follow up needed",
      "description": "Client requested status update",
      "author": {
        "id": "user_xxx",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "https://..."
      },
      "tags": ["urgent", "client-request"],
      "isPinned": true,
      "priority": "high",
      "createdAt": "2025-11-04T10:00:00Z",
      "updatedAt": "2025-11-04T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasMore": true
  }
}
```

**Key Code:**
```typescript
export async function GET(request: NextRequest, { params }: any) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { id: caseId } = await params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const sort = url.searchParams.get('sort') || 'newest';

    // Get notes from CaseEvent table
    const [notes, total] = await Promise.all([
      prisma.caseEvent.findMany({
        where: {
          caseId,
          type: 'NOTE',
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: sort === 'pinned'
          ? [{ metadata: { sort: 'desc' } }, { createdAt: 'desc' }]
          : { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.caseEvent.count({
        where: { caseId, type: 'NOTE' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      notes: notes.map(note => ({
        id: note.id,
        title: note.metadata?.title || 'Untitled',
        description: note.description,
        author: note.user,
        tags: note.metadata?.tags || [],
        isPinned: note.metadata?.isPinned || false,
        priority: note.metadata?.priority || 'normal',
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

#### Task 3.2: POST /api/cases/[id]/notes
**Effort:** 2-3 hours | **File:** Same file, POST handler

**Current State:** Returns 501 Not Implemented
**Replace with:** Create real CaseEvent note

**Request Body:**
```json
{
  "title": "Follow up needed",
  "description": "Client requested status update on case",
  "tags": ["urgent", "client-request"],
  "priority": "high",
  "isPinned": false
}
```

**Validation:**
- `title`: 3-100 chars (required)
- `description`: 10-5000 chars (required)
- `tags`: array of 0-10 strings, each 1-30 chars
- `priority`: "low" | "normal" | "high"
- `isPinned`: boolean

**Response:** Return created note (same structure as GET)

**Key Code:**
```typescript
const createNoteSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(5000),
  tags: z.array(z.string()).max(10).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  isPinned: z.boolean().default(false),
});

export async function POST(request: NextRequest, { params }: any) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { id: caseId } = await params;
    const body = await request.json();
    const validatedData = createNoteSchema.parse(body);

    // Verify case exists and user has access
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: { workspace: { include: { members: true } } },
    });

    if (!caseRecord) return NextResponse.json(
      { success: false, error: 'Case not found' },
      { status: 404 }
    );

    const hasAccess = caseRecord.workspace.members.some(m => m.userId === user.id);
    if (!hasAccess) return unauthorizedResponse();

    // Create note as CaseEvent
    const note = await prisma.caseEvent.create({
      data: {
        caseId,
        type: 'NOTE',
        description: validatedData.description,
        userId: user.id,
        metadata: {
          title: validatedData.title,
          tags: validatedData.tags || [],
          priority: validatedData.priority,
          isPinned: validatedData.isPinned,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        title: validatedData.title,
        description: note.description,
        author: note.user,
        tags: validatedData.tags || [],
        isPinned: validatedData.isPinned,
        priority: validatedData.priority,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      },
    }, { status: 201 });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

#### Task 3.3: PATCH /api/cases/[id]/notes/[noteId]
**Effort:** 2 hours | **File:** `src/app/api/cases/[id]/notes/[noteId]/route.ts` (NEW)

**Responsibilities:**
- Verify user is note author or case admin
- Update metadata and description
- Create audit event
- Return updated note

**Request Body:** Same as POST (all fields optional)

**Key Points:**
- Only author or workspace admin can edit
- Cannot change `caseId` or `userId`
- Update `updatedAt` automatically

**Key Code:**
```typescript
const updateNoteSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(5000).optional(),
  tags: z.array(z.string()).max(10).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  isPinned: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { id: caseId, noteId } = await params;
    const body = await request.json();
    const validatedData = updateNoteSchema.parse(body);

    // Get note and verify ownership
    const note = await prisma.caseEvent.findUnique({
      where: { id: noteId },
    });

    if (!note || note.caseId !== caseId || note.type !== 'NOTE') {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    // Check authorization: author or admin
    const isAuthor = note.userId === user.id;
    const isAdmin = await checkWorkspaceAdmin(user.id, caseId);

    if (!isAuthor && !isAdmin) {
      return unauthorizedResponse();
    }

    // Update note
    const updated = await prisma.caseEvent.update({
      where: { id: noteId },
      data: {
        description: validatedData.description,
        metadata: {
          title: validatedData.title || note.metadata?.title,
          tags: validatedData.tags || note.metadata?.tags,
          priority: validatedData.priority || note.metadata?.priority,
          isPinned: validatedData.isPinned ?? note.metadata?.isPinned,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    // Create audit event
    await prisma.caseEvent.create({
      data: {
        caseId,
        type: 'NOTE_UPDATED',
        userId: user.id,
        metadata: { noteId, changes: validatedData },
      },
    });

    return NextResponse.json({
      success: true,
      note: formatNote(updated),
    });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

#### Task 3.4: DELETE /api/cases/[id]/notes/[noteId]
**Effort:** 1.5 hours | **File:** Same file, DELETE handler

**Responsibilities:**
- Verify user is note author or admin
- Delete note from CaseEvent
- Create deletion audit event
- Return success

**Key Code:**
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { id: caseId, noteId } = await params;

    // Get note and verify ownership
    const note = await prisma.caseEvent.findUnique({
      where: { id: noteId },
    });

    if (!note || note.type !== 'NOTE') {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    // Authorization check
    const isAuthor = note.userId === user.id;
    const isAdmin = await checkWorkspaceAdmin(user.id, caseId);

    if (!isAuthor && !isAdmin) {
      return unauthorizedResponse();
    }

    // Delete note
    await prisma.caseEvent.delete({
      where: { id: noteId },
    });

    // Create audit event
    await prisma.caseEvent.create({
      data: {
        caseId,
        type: 'NOTE_DELETED',
        userId: user.id,
        metadata: { noteId, title: note.metadata?.title },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

### Testing Checklist
- [ ] User can create note on their case
- [ ] Note appears in GET with pagination
- [ ] User can update own note
- [ ] Admin can update any note
- [ ] User cannot delete other's note
- [ ] Pinned notes appear first
- [ ] Tags filter works (if added)
- [ ] Audit events created for all operations

---

## FEATURE 4: Real Telemetry

**Status:** 0% Complete | **Effort:** 20-25 hours | **Priority:** CRITICAL
**Start Date:** After Features 2-3 | **Dependencies:** Blocks Feature 6

### Context
The system needs to track real usage data including:
- JUDIT API calls (cost, duration, success rate)
- Credit consumption
- Document processing metrics
- Report generation performance
- System health and alerts

### Phase 1: JUDIT API Wrapper with Cost Tracking (3-5 hours)

**File:** `src/lib/judit-api-wrapper.ts` (NEW)

**Responsibilities:**
- Wrap all JUDIT API calls
- Track: duration, success/failure, documents processed, cost
- Save to JuditCostTracking
- Emit events for downstream telemetry

**Key Methods:**
```typescript
interface JuditCallMetrics {
  duration: number;        // milliseconds
  success: boolean;
  documentsProcessed?: number;
  movements?: number;
  cost?: number;
  errorCode?: string;
  errorMessage?: string;
  requestId: string;
  timestamp: Date;
}

export class JuditApiWrapper {
  async searchCases(query: string): Promise<SearchResult> {
    const startTime = Date.now();
    const requestId = generateId();

    try {
      const result = await this.juditClient.search(query);

      const metrics = {
        duration: Date.now() - startTime,
        success: true,
        documentsProcessed: result.count,
        cost: this.calculateSearchCost(query),
        requestId,
        timestamp: new Date(),
      };

      // Save to database
      await prisma.juditCostTracking.create({
        data: {
          workspaceId,
          action: 'SEARCH',
          cost: metrics.cost,
          duration: metrics.duration,
          metadata: metrics,
        },
      });

      // Emit event for telemetry
      this.emitter.emit('judit:call', metrics);

      return result;
    } catch (error) {
      const metrics = {
        duration: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
        requestId,
        timestamp: new Date(),
      };

      await prisma.juditCostTracking.create({
        data: {
          workspaceId,
          action: 'SEARCH_FAILED',
          cost: 0,
          duration: metrics.duration,
          metadata: metrics,
        },
      });

      this.emitter.emit('judit:error', metrics);
      throw error;
    }
  }

  // Similar methods for: monitoring, fetch, attachments, movements
}
```

### Phase 2: Real Telemetry Endpoints (4-6 hours)

#### GET /api/telemetry/monthly-usage

**File:** `src/app/api/telemetry/monthly-usage/route.ts`

**Current State:** Returns hardcoded mock data
**Replace with:** Query real data from database

**Response:**
```json
{
  "success": true,
  "period": {
    "month": "November",
    "year": 2025,
    "startDate": "2025-11-01T00:00:00Z",
    "endDate": "2025-11-30T23:59:59Z"
  },
  "usage": {
    "processes": {
      "monitored": 35,
      "limit": 100,
      "percentage": 35,
      "status": "low"
    },
    "reports": {
      "used": 3,
      "limit": 50,
      "percentage": 6,
      "status": "low"
    },
    "documents": {
      "uploaded": 127,
      "processed": 125,
      "failed": 2,
      "storageUsed": "2.4GB",
      "storageLimit": "10GB"
    },
    "api": {
      "juditCalls": 156,
      "averageResponseTime": 1240,
      "successRate": 98.7,
      "estimatedCost": 107.64,
      "costByAction": {
        "SEARCH": 69.0,
        "MONITORING": 26.4,
        "FETCH": 12.24
      }
    },
    "credits": {
      "consumed": 245,
      "remaining": 255,
      "percentage": 49,
      "status": "warning"
    }
  },
  "trends": {
    "dailyUsage": [ /* 30 data points */ ],
    "costTrend": [ /* 30 data points */ ]
  }
}
```

**Implementation:**
```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Get workspace
    const workspace = await getWorkspace(user.id);

    // Date range (this month)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Query telemetry data
    const [juditCalls, documents, reports, credits] = await Promise.all([
      prisma.juditCostTracking.findMany({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.caseDocument.groupBy({
        by: ['mimeType'],
        where: {
          case: {
            workspaceId: workspace.id,
          },
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
        _sum: { size: true },
      }),
      prisma.reportExecution.count({
        where: {
          schedule: { workspaceId: workspace.id },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.workspaceCredits.findUnique({
        where: { workspaceId: workspace.id },
      }),
    ]);

    // Aggregate JUDIT metrics
    const juditMetrics = {
      calls: juditCalls.length,
      success: juditCalls.filter(c => c.metadata?.success).length,
      cost: juditCalls.reduce((sum, c) => sum + (c.cost || 0), 0),
      avgDuration: juditCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / juditCalls.length,
      byAction: {} // group by action
    };

    // Calculate storage
    const storageUsed = documents.reduce((sum, d) => sum + (d._sum?.size || 0), 0);

    // Get credit history
    const creditTransactions = await prisma.creditTransaction.findMany({
      where: {
        workspaceId: workspace.id,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const creditsConsumed = creditTransactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return NextResponse.json({
      success: true,
      period: {
        month: startDate.toLocaleString('en-US', { month: 'long' }),
        year: startDate.getFullYear(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      usage: {
        processes: {
          monitored: /* count from Case where monitored=true */,
          limit: 100,
          percentage: /* calculated */,
        },
        reports: {
          used: reports,
          limit: 50,
        },
        documents: {
          uploaded: documents.reduce((sum, d) => sum + d._count, 0),
          storageUsed: formatBytes(storageUsed),
          storageLimit: '10GB',
        },
        api: {
          juditCalls: juditMetrics.calls,
          successRate: ((juditMetrics.success / juditMetrics.calls) * 100).toFixed(1),
          estimatedCost: juditMetrics.cost.toFixed(2),
        },
        credits: {
          consumed: creditsConsumed,
          remaining: credits?.fullCreditsBalance || 0,
        },
      },
    });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

#### GET /api/telemetry/active-alerts

**File:** `src/app/api/telemetry/active-alerts/route.ts`

**Current State:** Returns empty array (mock)
**Replace with:** Query real unresolved JuditAlert records

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert_xxx",
      "workspaceId": "ws_xxx",
      "severity": "high",
      "type": "HIGH_ERROR_RATE",
      "title": "High JUDIT API error rate detected",
      "description": "Error rate exceeded 10% in last 24 hours",
      "threshold": 10,
      "currentValue": 15.3,
      "detectedAt": "2025-11-04T10:00:00Z",
      "resolvedAt": null,
      "metadata": {
        "errorCount": 23,
        "totalRequests": 150,
        "errorTypes": ["timeout", "rate_limit"]
      }
    }
  ],
  "summary": {
    "total": 5,
    "critical": 1,
    "high": 2,
    "medium": 2,
    "low": 0
  }
}
```

**Implementation:**
```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const workspace = await getWorkspace(user.id);

    // Get unresolved alerts
    const alerts = await prisma.juditAlert.findMany({
      where: {
        workspaceId: workspace.id,
        resolvedAt: null,
      },
      orderBy: {
        severity: 'desc', // CRITICAL first
      },
    });

    // Count by severity
    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'CRITICAL').length,
      high: alerts.filter(a => a.severity === 'HIGH').length,
      medium: alerts.filter(a => a.severity === 'MEDIUM').length,
      low: alerts.filter(a => a.severity === 'LOW').length,
    };

    return NextResponse.json({
      success: true,
      alerts: alerts.map(alert => ({
        id: alert.id,
        workspaceId: alert.workspaceId,
        severity: alert.severity,
        type: alert.type,
        title: alert.title,
        description: alert.description,
        threshold: alert.metadata?.threshold,
        currentValue: alert.metadata?.currentValue,
        detectedAt: alert.createdAt,
        resolvedAt: alert.resolvedAt,
        metadata: alert.metadata,
      })),
      summary,
    });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

### Phase 3: Integration Points (3-4 hours)

Add telemetry recording at these locations:

**1. JUDIT Onboarding** → `src/app/api/judit/onboarding/route.ts`
```typescript
// At successful completion
await emitTelemetry('case:onboarded', {
  caseId,
  documentsCount,
  durationMs,
  juditCost: /* from wrapper */,
});
```

**2. Case Analysis** → `src/app/api/process/[id]/analysis/full/route.ts`
```typescript
// At completion
await emitTelemetry('case:analyzed', {
  caseId,
  analysisType: 'full',
  durationMs,
  creditsUsed: 1,
});
```

**3. Report Generation** → `src/app/api/reports/generate/route.ts`
```typescript
// At completion
await emitTelemetry('report:generated', {
  reportId,
  caseCount,
  durationMs,
  creditsUsed: reportCreditCost,
});
```

**4. Document Upload** → `src/app/api/documents/upload/route.ts`
```typescript
// At completion
await emitTelemetry('documents:uploaded', {
  count: documents.length,
  totalSize: totalBytes,
  durationMs,
});
```

### Phase 4: Daily Aggregation Job (4-5 hours)

**File:** `src/jobs/telemetry-aggregation.ts` (NEW)

**Responsibilities:**
- Run daily at 23:00 UTC
- Aggregate metrics by workspace
- Calculate trends
- Trigger alerts if thresholds exceeded
- Cache in Redis (5-minute TTL)

**Implementation:**
```typescript
import { CronJob } from 'cron';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import * as Sentry from '@sentry/nextjs';

export function startTelemetryAggregationJob() {
  const job = new CronJob(
    '0 23 * * *', // Daily at 23:00 UTC
    async () => {
      console.log('🕐 Starting telemetry aggregation job');

      try {
        // Get all workspaces
        const workspaces = await prisma.workspace.findMany();

        for (const workspace of workspaces) {
          await aggregateWorkspaceTelemetry(workspace.id);
        }

        console.log('✅ Telemetry aggregation complete');
      } catch (error) {
        console.error('❌ Telemetry aggregation failed:', error);
        Sentry.captureException(error);
      }
    },
    null,
    true,
    'UTC'
  );

  return job;
}

async function aggregateWorkspaceTelemetry(workspaceId: string) {
  // 1. Get today's metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 2. Query metrics
  const [juditCalls, uploads, reports, credits] = await Promise.all([
    prisma.juditCostTracking.findMany({
      where: {
        workspaceId,
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.caseDocument.count({
      where: {
        case: { workspaceId },
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.reportExecution.count({
      where: {
        schedule: { workspaceId },
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.creditTransaction.findMany({
      where: {
        workspaceId,
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
  ]);

  // 3. Calculate metrics
  const metrics = {
    date: today,
    judit: {
      calls: juditCalls.length,
      cost: juditCalls.reduce((sum, c) => sum + (c.cost || 0), 0),
      errors: juditCalls.filter(c => !c.metadata?.success).length,
    },
    documents: uploads,
    reports,
    credits: {
      consumed: credits
        .filter(c => c.type === 'DEBIT')
        .reduce((sum, c) => sum + Math.abs(c.amount), 0),
    },
  };

  // 4. Save to cache + database
  await redis.set(
    `telemetry:${workspaceId}:${today.toISOString().split('T')[0]}`,
    JSON.stringify(metrics),
    'EX',
    5 * 60 // 5 minutes
  );

  // 5. Check alerts (high error rate, high cost, etc)
  await checkAndCreateAlerts(workspaceId, metrics);
}

async function checkAndCreateAlerts(workspaceId: string, metrics: any) {
  const alerts = [];

  // Alert: High error rate (>10%)
  if (metrics.judit.calls > 0) {
    const errorRate = (metrics.judit.errors / metrics.judit.calls) * 100;
    if (errorRate > 10) {
      alerts.push({
        severity: 'HIGH',
        type: 'HIGH_ERROR_RATE',
        title: 'High JUDIT API error rate',
        description: `Error rate: ${errorRate.toFixed(1)}%`,
      });
    }
  }

  // Alert: High cost (>$200/day)
  if (metrics.judit.cost > 200) {
    alerts.push({
      severity: 'MEDIUM',
      type: 'HIGH_DAILY_COST',
      title: 'High daily JUDIT cost',
      description: `Daily cost: $${metrics.judit.cost.toFixed(2)}`,
    });
  }

  // Create alerts in database
  for (const alert of alerts) {
    // Check if alert already exists (don't duplicate)
    const existing = await prisma.juditAlert.findFirst({
      where: {
        workspaceId,
        type: alert.type,
        resolvedAt: null,
      },
    });

    if (!existing) {
      await prisma.juditAlert.create({
        data: {
          workspaceId,
          ...alert,
        },
      });
    }
  }
}
```

### Testing Checklist
- [ ] JUDIT API calls are tracked with cost/duration
- [ ] /api/telemetry/monthly-usage returns real data
- [ ] /api/telemetry/active-alerts shows unresolved alerts
- [ ] Alerts created when thresholds exceeded
- [ ] Daily aggregation job runs and caches data
- [ ] Error rate > 10% triggers alert
- [ ] High cost > $200/day triggers alert
- [ ] Sentry captures telemetry job failures

---

## FEATURE 5: Excel Export Retry & Error Handling

**Status:** 10% Complete | **Effort:** 8-12 hours | **Priority:** MEDIUM
**Start Date:** Immediately (parallel with F2-3) | **Dependencies:** None

### Current State
- ✅ Upload works: `POST /api/upload/excel`
- ✅ Batch tracking exists
- ✅ Row error storage exists
- ❌ No row-level validation
- ❌ No error export
- ❌ No retry capability

### Database Schema
```prisma
model UploadBatch {
  id                String  @id @default(cuid())
  workspaceId       String
  fileName          String
  totalRows         Int
  successfulRows    Int
  failedRows        Int
  status            String  // PENDING, PROCESSING, COMPLETED, FAILED
  errorSummary      Json?   // aggregated errors
  startedAt         DateTime?
  completedAt       DateTime?
  createdAt         DateTime  @default(now())
  rows              UploadBatchRow[]
}

model UploadBatchRow {
  id                String    @id @default(cuid())
  batchId           String
  rowNumber         Int       // line number in Excel
  status            String    // PENDING, PROCESSING, SUCCESS, ERROR
  data              Json      // raw row data
  errorMessage      String?   // specific error
  retryCount        Int       @default(0)
  maxRetries        Int       @default(3)
  batch             UploadBatch @relation(fields: [batchId], references: [id])
}
```

### Task 5.1: Row-Level Validation
**Effort:** 2-3 hours | **File:** `src/lib/excel-validation.ts` (NEW)

**Responsibilities:**
- Validate each row against business rules
- Return specific error messages
- Support retry on validation failures

**Implementation:**
```typescript
import { z } from 'zod';

const excelRowSchema = z.object({
  'Nome do Cliente': z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  'Email': z.string().email('Email inválido'),
  'Número de Processo': z.string().regex(
    /^\d{7}-\d{2}.\d{4}.\d{1}.\d{2}.\d{4}$/,
    'Formato de processo inválido (NNNNNNN-DD.AAAA.J.TT.OOOO)'
  ),
  'Status': z.enum(['ATIVO', 'ENCERRADO', 'SUSPENSO'], {
    errorMap: () => ({ message: 'Status deve ser ATIVO, ENCERRADO ou SUSPENSO' }),
  }),
  'Valor Causa': z.string().regex(/^\d+(?:,\d{2})?$/, 'Valor inválido'),
  'Tribunal': z.string().min(2, 'Tribunal obrigatório'),
});

export function validateExcelRow(
  rowNumber: number,
  rowData: Record<string, any>
): { success: boolean; error?: string; validatedData?: any } {
  try {
    const validated = excelRowSchema.parse(rowData);
    return { success: true, validatedData: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `Campo "${firstError.path[0]}": ${firstError.message}`,
      };
    }
    return {
      success: false,
      error: 'Erro desconhecido ao validar linha',
    };
  }
}

export async function validateBatchRows(
  rows: Array<Record<string, any>>
): Promise<{
  valid: UploadBatchRow[];
  invalid: UploadBatchRow[];
  errorSummary: Record<string, number>;
}> {
  const valid = [];
  const invalid = [];
  const errorSummary: Record<string, number> = {};

  for (let i = 0; i < rows.length; i++) {
    const { success, error } = validateExcelRow(i + 2, rows[i]); // Row 2 (skip header)

    if (success) {
      valid.push({
        rowNumber: i + 2,
        status: 'PENDING',
        data: rows[i],
        retryCount: 0,
      });
    } else {
      invalid.push({
        rowNumber: i + 2,
        status: 'ERROR',
        data: rows[i],
        errorMessage: error,
        retryCount: 0,
      });

      errorSummary[error] = (errorSummary[error] || 0) + 1;
    }
  }

  return { valid, invalid, errorSummary };
}
```

### Task 5.2: Error CSV Export
**Effort:** 2-3 hours | **File:** `src/app/api/upload/batch/[id]/errors/download/route.ts` (NEW)

**Endpoint:** `GET /api/upload/batch/[id]/errors/download`

**Responsibilities:**
- Get failed rows from batch
- Generate CSV with: row number, field, error, original value
- Return as downloadable attachment

**Implementation:**
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { id: batchId } = await params;

    // Get batch and failed rows
    const [batch, failedRows] = await Promise.all([
      prisma.uploadBatch.findUnique({
        where: { id: batchId },
        include: { workspace: { include: { members: true } } },
      }),
      prisma.uploadBatchRow.findMany({
        where: {
          batchId,
          status: 'ERROR',
        },
      }),
    ]);

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Check access
    const hasAccess = batch.workspace.members.some(m => m.userId === user.id);
    if (!hasAccess) return unauthorizedResponse();

    // Generate CSV
    const csv = [
      ['Linha', 'Campo', 'Erro', 'Valor Fornecido'].join(','),
      ...failedRows.map(row => {
        const data = row.data as Record<string, any>;
        const firstValue = Object.values(data)[0]; // First value from row

        return [
          row.rowNumber,
          '—', // Field (generic, could be enhanced)
          row.errorMessage || 'Erro desconhecido',
          JSON.stringify(firstValue).slice(0, 50), // Truncate long values
        ].map(v => `"${v}"`).join(',');
      }),
    ].join('\n');

    // Return as file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="erros_${batchId}.csv"`,
      },
    });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

### Task 5.3: Batch Retry Logic
**Effort:** 3-4 hours | **File:** `src/app/api/upload/batch/[id]/retry/route.ts` (NEW)

**Endpoint:** `POST /api/upload/batch/[id]/retry`

**Request Body:**
```json
{
  "rows": [
    {
      "rowNumber": 5,
      "data": {
        "Nome do Cliente": "Updated Name",
        "Email": "fixed@email.com"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "batchId": "batch_xxx",
  "retryResults": {
    "successful": 1,
    "failed": 0,
    "failedDetails": []
  },
  "nextSteps": "Seu lote foi re-enfileirado para processamento"
}
```

**Implementation:**
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { id: batchId } = await params;
    const body = await request.json();

    // Validate request
    const { rows } = z.object({
      rows: z.array(z.object({
        rowNumber: z.number(),
        data: z.record(z.any()),
      })),
    }).parse(body);

    // Get batch
    const batch = await prisma.uploadBatch.findUnique({
      where: { id: batchId },
      include: { workspace: { include: { members: true } } },
    });

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }

    const hasAccess = batch.workspace.members.some(m => m.userId === user.id);
    if (!hasAccess) return unauthorizedResponse();

    // Process retries
    const retryResults = {
      successful: 0,
      failed: 0,
      failedDetails: [],
    };

    for (const retryRow of rows) {
      // Validate row
      const validation = validateExcelRow(retryRow.rowNumber, retryRow.data);

      if (!validation.success) {
        retryResults.failed++;
        retryResults.failedDetails.push({
          rowNumber: retryRow.rowNumber,
          error: validation.error,
        });
        continue;
      }

      // Check retry limit
      const dbRow = await prisma.uploadBatchRow.findFirst({
        where: {
          batchId,
          rowNumber: retryRow.rowNumber,
        },
      });

      if (dbRow && dbRow.retryCount >= dbRow.maxRetries) {
        retryResults.failed++;
        retryResults.failedDetails.push({
          rowNumber: retryRow.rowNumber,
          error: 'Limite máximo de retentativas atingido',
        });
        continue;
      }

      // Update row to retry
      await prisma.uploadBatchRow.update({
        where: { id: dbRow?.id || '' },
        data: {
          status: 'PENDING',
          errorMessage: null,
          retryCount: (dbRow?.retryCount || 0) + 1,
          data: retryRow.data,
        },
      });

      retryResults.successful++;
    }

    // Reset batch status if all rows retryable
    if (retryResults.successful > 0) {
      await prisma.uploadBatch.update({
        where: { id: batchId },
        data: {
          status: 'PENDING', // Re-queue for processing
        },
      });

      // Enqueue for processing
      await enqueueBatchProcessing(batchId);
    }

    return NextResponse.json({
      success: true,
      batchId,
      retryResults,
      nextSteps: 'Seu lote foi re-enfileirado para processamento',
    });
  } catch (error) {
    captureApiError(error, { ... });
  }
}
```

### Task 5.4: Enhanced Status Endpoint
**Effort:** 1-2 hours | **File:** Update `src/app/api/upload/batch/[id]/status/route.ts`

**Enhanced Response:**
```json
{
  "success": true,
  "batch": {
    "id": "batch_xxx",
    "status": "COMPLETED",
    "progress": {
      "total": 150,
      "processed": 150,
      "successful": 148,
      "failed": 2,
      "percentage": 100
    },
    "errors": {
      "summary": {
        "Email inválido": 1,
        "Processo duplicado": 1
      },
      "retryable": 2,
      "nonRetryable": 0,
      "canDownloadErrors": true,
      "canRetry": true
    },
    "performance": {
      "startedAt": "2025-11-04T10:00:00Z",
      "completedAt": "2025-11-04T10:15:30Z",
      "duration": 930
    }
  },
  "actions": [
    {
      "type": "DOWNLOAD_ERRORS",
      "href": "/api/upload/batch/[id]/errors/download"
    },
    {
      "type": "RETRY",
      "href": "/api/upload/batch/[id]/retry",
      "method": "POST"
    }
  ]
}
```

### Testing Checklist
- [ ] Invalid email rejected with specific error
- [ ] Invalid CNJ number rejected
- [ ] Enum validation works (Status field)
- [ ] Error CSV downloads with correct format
- [ ] Retry updates failed rows
- [ ] Retry respects max retries limit
- [ ] Status endpoint shows error summary
- [ ] Sentry captures validation errors

---

## FEATURE 6: Dashboard Real Data

**Status:** 20% Complete (layout only) | **Effort:** 12-15 hours | **Priority:** MEDIUM
**Start Date:** After Feature 4 complete | **Dependencies:** Feature 4 (telemetry)

### Current State
- ✅ Dashboard layout and components
- ✅ Mock data and fixtures
- ❌ Real data from database
- ❌ Real API integration

### What Users See (Wrong)
```
Dashboard (Hardcoded Mocks):
├─ Processes: 0 / 100 ✗
├─ Reports: 0 / 50 ✗
├─ Credits: 999 (always) ✗
├─ Storage: 0 GB ✗
├─ Cost: $0 ✗
```

### What Should Appear (Real)
```
Dashboard (Real Data):
├─ Processes: 35 / 100 (35%)
├─ Reports: 3 / 50 (6%)
├─ Credits: 255 remaining
├─ Storage: 2.4 GB / 10 GB
├─ Cost: $107.64 this month
├─ Recent Activity: [list of events]
├─ Active Alerts: [unresolved issues]
```

### Task 6.1: Dashboard Service Layer
**Effort:** 2-3 hours | **File:** `src/lib/services/dashboardDataService.ts` (NEW)

**Responsibilities:**
- Fetch all data needed for dashboard
- Aggregate statistics
- Cache in Redis (5-minute TTL)
- Handle errors gracefully

**Implementation:**
```typescript
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export class DashboardDataService {
  constructor(private workspaceId: string) {}

  async getOverviewStats() {
    const cacheKey = `dashboard:overview:${this.workspaceId}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Fetch from database
    const [caseCount, clientCount, docCount, workspace, docSize] = await Promise.all([
      prisma.case.count({
        where: { workspaceId: this.workspaceId },
      }),
      prisma.client.count({
        where: { workspaceId: this.workspaceId },
      }),
      prisma.caseDocument.count({
        where: { case: { workspaceId: this.workspaceId } },
      }),
      prisma.workspace.findUnique({
        where: { id: this.workspaceId },
        select: { storageQuota: true },
      }),
      prisma.caseDocument.aggregate({
        where: { case: { workspaceId: this.workspaceId } },
        _sum: { size: true },
      }),
    ]);

    const data = {
      cases: caseCount,
      clients: clientCount,
      documents: docCount,
      storage: {
        used: docSize._sum?.size || 0,
        quota: workspace?.storageQuota || 10737418240, // 10GB default
      },
    };

    // Cache for 5 minutes
    await redis.setex(
      cacheKey,
      5 * 60,
      JSON.stringify(data)
    );

    return data;
  }

  async getProcessStats() {
    const stats = await prisma.case.groupBy({
      by: ['status'],
      where: { workspaceId: this.workspaceId },
      _count: true,
    });

    return {
      ACTIVE: stats.find(s => s.status === 'ACTIVE')?._count || 0,
      CLOSED: stats.find(s => s.status === 'CLOSED')?._count || 0,
      SUSPENDED: stats.find(s => s.status === 'SUSPENDED')?._count || 0,
    };
  }

  async getReportStats() {
    const thisMonth = new Date();
    thisMonth.setDate(1);

    const used = await prisma.reportExecution.count({
      where: {
        schedule: { workspaceId: this.workspaceId },
        createdAt: { gte: thisMonth },
      },
    });

    return {
      used,
      limit: 50,
      percentage: (used / 50) * 100,
    };
  }

  async getCreditStats() {
    const credits = await prisma.workspaceCredits.findUnique({
      where: { workspaceId: this.workspaceId },
    });

    return {
      balance: credits?.fullCreditsBalance || 0,
      essentialBalance: credits?.essentialCreditsBalance || 0,
    };
  }

  async getRecentActivity(limit: number = 10) {
    return prisma.caseEvent.findMany({
      where: {
        case: { workspaceId: this.workspaceId },
      },
      include: {
        user: { select: { name: true, email: true, avatar: true } },
        case: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getActiveAlerts(limit: number = 5) {
    return prisma.juditAlert.findMany({
      where: {
        workspaceId: this.workspaceId,
        resolvedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getFullDashboardData() {
    const [overview, processes, reports, credits, activity, alerts] = await Promise.all([
      this.getOverviewStats(),
      this.getProcessStats(),
      this.getReportStats(),
      this.getCreditStats(),
      this.getRecentActivity(),
      this.getActiveAlerts(),
    ]);

    return {
      overview,
      processes,
      reports,
      credits,
      activity,
      alerts,
    };
  }
}
```

### Task 6.2: Dashboard API Endpoint
**Effort:** 2 hours | **File:** `src/app/api/dashboard/overview/route.ts` (NEW)

**Endpoint:** `GET /api/dashboard/overview`

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { DashboardDataService } from '@/lib/services/dashboardDataService';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    setSentryUserContext(user.id);

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: user.id },
    });

    if (!userWorkspace) {
      return NextResponse.json(
        { success: false, error: 'No workspace found' },
        { status: 404 }
      );
    }

    // Get dashboard data
    const dashboardService = new DashboardDataService(userWorkspace.workspaceId);
    const data = await dashboardService.getFullDashboardData();

    return NextResponse.json({
      success: true,
      dashboard: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    captureApiError(error, {
      endpoint: '/api/dashboard/overview',
      method: 'GET',
      userId: user?.id,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}
```

### Task 6.3: Frontend Integration
**Effort:** 3-4 hours | **Files:** Component updates

**Components to Update:**
1. **UsageBanner.tsx** - Show real statistics
2. **ProcessesOverview.tsx** - Real process breakdown
3. **DocumentStorage.tsx** - Real storage usage
4. **RecentActivity.tsx** - Real case events
5. **AlertsWidget.tsx** - Real unresolved alerts
6. **CreditBalance.tsx** - Real credit balance

**Pattern for each component:**
```typescript
import { useEffect, useState } from 'react';

export function UsageBanner() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then(res => res.json())
      .then(data => {
        setData(data.dashboard);
        setLoading(false);
      });
  }, []);

  if (loading) return <Skeleton />;

  return (
    <div className="grid grid-cols-2 gap-4">
      <Stat label="Processos" value={data.processes.ACTIVE} total={100} />
      <Stat label="Relatórios" value={data.reports.used} total={50} />
      <Stat label="Créditos" value={data.credits.balance} />
      <Stat
        label="Armazenamento"
        value={formatBytes(data.overview.storage.used)}
        total={formatBytes(data.overview.storage.quota)}
      />
    </div>
  );
}
```

### Task 6.4: Caching Strategy
**Effort:** 2 hours

**Cache Invalidation:**
```typescript
// When document uploaded
await redis.del(`dashboard:overview:${workspaceId}`);

// When case created/updated
await redis.del(`dashboard:overview:${workspaceId}`);

// When report generated
await redis.del(`dashboard:overview:${workspaceId}`);

// When alert created
await redis.del(`dashboard:overview:${workspaceId}`);
```

**Use decorators:**
```typescript
export async function invalidateDashboardCache(workspaceId: string) {
  return redis.del(`dashboard:overview:${workspaceId}`);
}
```

### Testing Checklist
- [ ] Dashboard loads real data from API
- [ ] Case count matches database
- [ ] Storage calculation is accurate
- [ ] Process breakdown shows correct statuses
- [ ] Recent activity displays last 10 events
- [ ] Alerts show unresolved items
- [ ] Cache invalidates on document upload
- [ ] Performance: Dashboard loads in < 2s
- [ ] Sentry captures load errors

---

## Implementation Checklist

### Week 1 (Nov 4-10) - Quick Wins
- [ ] FEATURE 2: Document PATCH/DELETE (5-7h)
- [ ] FEATURE 3: Case Notes CRUD (7-10h)
- [ ] FEATURE 5: Excel Retry (8-12h)
- [ ] **Subtotal:** 20-29 hours
- [ ] **QA:** All unit tests passing

### Week 2-3 (Nov 10-24) - Telemetry
- [ ] FEATURE 4: Real Telemetry (20-25h)
- [ ] **Subtotal:** 20-25 hours
- [ ] **QA:** Cost tracking verified

### Week 3-4 (Nov 17-Dec 1) - Dashboard
- [ ] FEATURE 6: Dashboard Real Data (12-15h)
- [ ] Integration tests (3-5h)
- [ ] **Subtotal:** 15-20 hours
- [ ] **QA:** E2E tests passing

### Pre-Launch (Nov 24-Dec 1)
- [ ] All features merged to main
- [ ] Production build passes
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Beta launch ready

---

## Database Considerations

### ✅ No Migrations Needed
All 6 features use existing database tables. No schema changes required.

### Verification Queries
```sql
-- Check CaseDocument has all fields
SELECT * FROM "CaseDocument" LIMIT 1;

-- Check CaseEvent supports NOTE type
SELECT DISTINCT type FROM "CaseEvent";

-- Check JuditCostTracking exists
SELECT * FROM "JuditCostTracking" LIMIT 1;

-- Check UploadBatch/Row have error tracking
SELECT * FROM "UploadBatchRow" WHERE "errorMessage" IS NOT NULL LIMIT 1;

-- Check WorkspaceCredits exists
SELECT * FROM "WorkspaceCredits" LIMIT 1;
```

---

## Success Metrics

| Feature | Metric | Target |
|---------|--------|--------|
| **F2** | PATCH/DELETE response time | < 500ms |
| **F3** | Create note response time | < 300ms |
| **F5** | Validation speed per row | < 10ms |
| **F4** | Telemetry collection latency | < 100ms |
| **F6** | Dashboard load time | < 2000ms |

---

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Redis unavailable | Low | Graceful fallback to DB queries |
| JUDIT API outage | Low | Circuit breaker + cached data |
| High dashboard load | Low | Client-side caching + Redis |
| Data inconsistency | Very Low | Prisma transactions |

---

## Contacts & Support

**For questions on specific features:**
- Feature 2-3: Document & Notes patterns already exist in `/api/documents/upload`
- Feature 4: Refer to existing JuditCostTracking model
- Feature 5: Follow pattern in `src/app/api/upload/excel/route.ts`
- Feature 6: Use DashboardDataService pattern from other service classes

All code should follow existing patterns for consistency. Reference similar endpoints before implementing new ones.

---

**Last Updated:** November 4, 2025
**Status:** Ready for implementation
**Target:** Production December 1, 2025
