# Database Indexing Strategy for JustoAI V2

## Overview

Comprehensive database indexing strategy to optimize query performance and reduce latency for production workloads.

## Current Indexes

### User & Authentication
- `users.email` - PRIMARY KEY (implicit)
- `users.id` - Indexed for fast lookups
- `userSessions.userId` - For session lookups by user

### Workspace Management
- `workspaces.id` - PRIMARY KEY
- `workspaceMembers.workspaceId` - For listing members
- `workspaceMembers.userId` - For user's workspaces

### Credits System
- `workspaceCredits.workspaceId` - PRIMARY KEY (unique)
- `creditAllocations.workspaceId` - For balance queries
- `creditTransactions.workspaceId` - For transaction history
- `creditTransactions.createdAt` - For time-range queries

### Process Management
- `processes.workspaceId` - For listing workspace processes
- `processes.processNumber` - For unique number lookup
- `processes.createdAt` - For sorting by date
- `reportExecutions.processId` - For report listings
- `reportExecutions.createdAt` - For monthly quota counting

### Batch Operations
- `processBatchUpload.workspaceId` - For batch listings
- `processBatchUpload.status` - For status filtering
- `uploadBatchRow.batchId` - For batch items
- `uploadBatchRow.status` - For filtering by status

### Webhooks & Events
- `webhookDelivery.workspaceId` - For delivery tracking
- `webhookDelivery.status` - For pending retries
- `webhookDelivery.nextRetryAt` - For retry scheduling
- `uploadBatchEvent.batchId` - For event history

### Chat System
- `chatSessions.workspaceId` - For user chats
- `chatMessages.sessionId` - For session messages
- `chatMessages.createdAt` - For chronological order

## Recommended Additional Indexes

### High-Priority (Performance Critical)

```sql
-- Quota system: Monthly report counting
CREATE INDEX idx_report_execution_workspace_date
ON reportExecution(workspaceId, createdAt DESC)
WHERE createdAt >= CURRENT_DATE - INTERVAL '1 month';

-- Credit transactions: Fast balance queries
CREATE INDEX idx_credit_transaction_workspace_type
ON creditTransaction(workspaceId, type)
WHERE status = 'COMPLETED';

-- Webhook retries: Fast pending query
CREATE INDEX idx_webhook_delivery_retry
ON webhookDelivery(nextRetryAt, status)
WHERE status = 'RETRYING';

-- Batch processing: Status filtering
CREATE INDEX idx_batch_upload_workspace_status
ON processBatchUpload(workspaceId, status)
WHERE status IN ('PROCESSING', 'PENDING');
```

### Medium-Priority (Optimization Targets)

```sql
-- Process search and filtering
CREATE INDEX idx_process_workspace_number
ON process(workspaceId, processNumber);

-- Chat history search
CREATE INDEX idx_chat_session_workspace_date
ON chatSession(workspaceId, createdAt DESC);

-- Audit logging
CREATE INDEX idx_global_log_workspace_timestamp
ON globalLog(workspaceId, timestamp DESC);

-- Rate limiting (optional, if persisted to DB)
CREATE INDEX idx_rate_limit_key_reset
ON rateLimitStore(key, resetTime)
WHERE count > 0;
```

## Query Optimization Best Practices

### 1. Batch Quota Counting (Monthly)
```sql
-- OPTIMIZED: Use index for month range
SELECT COUNT(*)
FROM reportExecution
WHERE workspaceId = $1
  AND createdAt >= DATE_TRUNC('month', CURRENT_DATE)
  AND createdAt < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
```

### 2. Credit Balance Query
```sql
-- OPTIMIZED: Direct lookup with workspaceId
SELECT * FROM workspaceCredits
WHERE workspaceId = $1;
-- OR with recent transactions
SELECT SUM(amount) FROM creditTransaction
WHERE workspaceId = $1 AND type = 'CREDIT'
AND createdAt > NOW() - INTERVAL '30 days';
```

### 3. Webhook Retry Processing
```sql
-- OPTIMIZED: Index on nextRetryAt and status
SELECT * FROM webhookDelivery
WHERE status = 'RETRYING'
  AND nextRetryAt <= NOW()
ORDER BY nextRetryAt ASC
LIMIT 100;
```

### 4. Batch Processing Status
```sql
-- OPTIMIZED: Composite index on workspace and status
SELECT * FROM processBatchUpload
WHERE workspaceId = $1
  AND status = 'PROCESSING'
ORDER BY createdAt DESC;
```

## Index Maintenance

### Regular Monitoring
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Periodic Maintenance
```sql
-- Vacuum and analyze tables (weekly)
VACUUM ANALYZE reportExecution;
VACUUM ANALYZE creditTransaction;
VACUUM ANALYZE processBatchUpload;
VACUUM ANALYZE webhookDelivery;

-- Reindex fragmented indexes (monthly)
REINDEX INDEX CONCURRENTLY idx_report_execution_workspace_date;
REINDEX INDEX CONCURRENTLY idx_webhook_delivery_retry;
```

## Performance Benchmarks

### Target Query Execution Times
- Quota counting (monthly): < 50ms
- Credit balance lookup: < 10ms
- Webhook retry query: < 20ms
- Batch status filtering: < 30ms

### Monitoring Metrics
- Index hit ratio: > 99%
- Table scan rate: < 1% of queries
- Query plan: Always uses available indexes

## Migration Plan

### Phase 1 (Immediate)
1. Add indexes for quota system (most critical)
2. Add indexes for webhook retries
3. Monitor and validate performance

### Phase 2 (Week 2)
1. Add indexes for credit transactions
2. Add indexes for batch operations
3. Run baseline performance tests

### Phase 3 (Week 3)
1. Add remaining indexes
2. Set up automated index monitoring
3. Document final index usage patterns

## Monitoring Dashboard

Track these metrics in production:
- Query execution times by endpoint
- Index hit rates
- Slow query log (> 100ms)
- Table growth and index size

## Related Documentation
- See: CLAUDE.md - Data model documentation
- See: DATABASE_MIGRATIONS.md - Schema changes
