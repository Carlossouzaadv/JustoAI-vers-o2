# 🚀 JustoAI v2 - API Documentation

## 📍 Base URL
```
http://localhost:3000/api
```

## 🔐 Authentication
All API endpoints (except `/health`) require authentication via Supabase Auth.

### Headers Required:
```
Authorization: Bearer <supabase_jwt_token>
```

## 📊 Standard Response Format

### Success Response:
```json
{
  "success": true,
  "data": {},
  "message": "Optional success message",
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

## 🏢 Workspaces API

### GET /api/workspaces
List user workspaces with pagination and search.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10, max: 100)
- `search` (string, optional)
- `status` (enum: ACTIVE, INACTIVE, SUSPENDED, DELETED)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "workspace_id",
      "name": "ACME Law Firm",
      "slug": "acme-law-firm",
      "description": "Law firm description",
      "plan": "PRO",
      "status": "ACTIVE",
      "userRole": "OWNER",
      "userStatus": "ACTIVE",
      "userJoinedAt": "2024-01-01T00:00:00Z",
      "_count": {
        "users": 5,
        "clients": 50,
        "cases": 200
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### POST /api/workspaces
Create a new workspace.

**Body:**
```json
{
  "name": "My Law Firm",
  "slug": "my-law-firm",
  "description": "Optional description",
  "plan": "FREE"
}
```

### GET /api/workspaces/[id]
Get workspace details including members.

**Response includes:**
- Full workspace details
- Member list with roles
- Usage statistics

### PUT /api/workspaces/[id]
Update workspace (requires OWNER or ADMIN role).

**Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "ACTIVE"
}
```

### DELETE /api/workspaces/[id]
Soft delete workspace (requires OWNER role).

## 👥 Clients API

### GET /api/clients
List clients with filtering and pagination.

**Query Parameters:**
- `page`, `limit`, `search`, `status` (same as workspaces)
- `workspaceId` (string, optional - filter by workspace)
- `type` (enum: INDIVIDUAL, COMPANY, GOVERNMENT, NGO)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "client_id",
      "name": "Tech Solutions Ltda",
      "email": "contact@techsolutions.com",
      "phone": "+5511999999999",
      "document": "12.345.678/0001-90",
      "type": "COMPANY",
      "status": "ACTIVE",
      "address": "Av. Paulista, 1000",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01310-100",
      "workspace": {
        "id": "workspace_id",
        "name": "ACME Law Firm",
        "slug": "acme-law-firm"
      },
      "_count": {
        "cases": 5
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/clients
Create a new client.

**Body:**
```json
{
  "workspaceId": "workspace_id",
  "name": "Client Name",
  "email": "client@email.com",
  "phone": "+5511999999999",
  "document": "123.456.789-00",
  "type": "INDIVIDUAL",
  "address": "Street Address",
  "city": "City",
  "state": "State",
  "zipCode": "12345-678",
  "notes": "Optional notes"
}
```

### GET /api/clients/[id]
Get client details including recent cases.

### PUT /api/clients/[id]
Update client information.

### DELETE /api/clients/[id]
Soft delete client (only if no active cases).

## 🔧 Utility Endpoints

### GET /api/health
Check API health and database connection.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "2.0.0",
    "database": {
      "connected": true,
      "stats": {
        "workspaces": 1,
        "users": 2,
        "clients": 2,
        "cases": 2
      }
    },
    "environment": "development"
  }
}
```

## ⚡ Rate Limiting

- **General APIs**: 100 requests per 15 minutes per IP
- **Create Operations**: 10-50 requests per 15 minutes per IP
- **Delete Operations**: 5 requests per 15 minutes per IP

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
Retry-After: 900
```

## 🛡️ Security Features

### Input Validation
- All inputs validated with Zod schemas
- Sanitization of user data
- Type-safe API responses

### Authorization
- Workspace-level access control
- Role-based permissions (OWNER, ADMIN, MEMBER, VIEWER)
- Resource ownership validation

### CORS
- Configurable origins
- Preflight request support

## 📝 Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resources)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Test with Authentication
```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/workspaces
```

## 🔄 Future Endpoints

Coming soon:
- `/api/cases` - Case management
- `/api/documents` - Document handling
- `/api/analysis` - AI analysis
- `/api/reports` - Report generation

---

*API Documentation - Updated 2025-09-13*