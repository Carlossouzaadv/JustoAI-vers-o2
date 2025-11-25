-- Create ChatSession table
CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "contextType" TEXT,
  "contextId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create ChatMessage table
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tokens" INTEGER,
  "cost" DECIMAL(10, 4),
  "modelUsed" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "chat_sessions_workspaceId_userId_idx" ON "chat_sessions"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "chat_sessions_workspaceId_updatedAt_idx" ON "chat_sessions"("workspaceId", "updatedAt");
CREATE INDEX IF NOT EXISTS "chat_sessions_userId_updatedAt_idx" ON "chat_sessions"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "chat_messages_role_idx" ON "chat_messages"("role");
