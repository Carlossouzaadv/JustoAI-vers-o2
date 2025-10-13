# JustoAI V2 API Documentation with Swagger

## Overview

Complete API documentation for JustoAI V2 is available through Swagger/OpenAPI. This documentation is interactive, allowing you to test endpoints directly from the browser.

## Accessing the Documentation

### During Development

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access the documentation:**
   - Swagger UI Interface: http://localhost:3000/api-docs
   - Specification JSON: http://localhost:3000/api/swagger

### In Production

Documentation will be available at:
- Interface: https://api.justoai.com/api-docs
- JSON: https://api.justoai.com/api/swagger

## Documentation Features

### Navigation by Tags

The documentation is organized by categories (tags):
- **Health**: System health check endpoints
- **Processos** (Processes): Legal process monitoring management
- **Clientes** (Clients): Client CRUD operations
- **Casos** (Cases): Legal case management
- **Relatórios** (Reports): Report generation and queries
- **IA** (AI): Artificial intelligence analysis endpoints
- **Créditos** (Credits): Credit management and consumption
- **Workspaces**: Workspace (law firm) management
- **Upload**: Document and file uploads
- **Analytics**: System metrics and statistics

### Testing Endpoints

1. **Authentication:**
   - Click the "Authorize" button at the top of the page
   - Enter your JWT token in the format: `Bearer your-token-here`
   - Click "Authorize" to save

2. **Execute Requests:**
   - Select an endpoint
   - Click "Try it out"
   - Fill in the required parameters
   - Click "Execute"
   - View the complete response, including status, headers, and body

### Reusable Schemas

The documentation includes common schemas referenced across multiple endpoints:
- **Process**: Legal process model
- **Client**: Client model
- **Case**: Legal case model
- **Workspace**: Workspace model
- **Error**: Standard error structure
- **Pagination**: Pagination structure

## Available Scripts

### Generate Specification JSON

```bash
npm run docs:generate
```

This command generates a `swagger.json` file at the project root with the complete API specification.

### Develop with Documentation

```bash
npm run docs:dev
```

Starts the development server with access to documentation.

## File Structure

```
justoai-v2/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/
│   │   │   │   └── route.ts          # Documented inline
│   │   │   ├── processes/
│   │   │   │   └── route.ts          # Documented inline
│   │   │   ├── clients/
│   │   │   │   └── route.ts          # Documented inline
│   │   │   ├── cases/
│   │   │   │   └── route.ts          # Documented inline
│   │   │   └── swagger/
│   │   │       └── route.ts          # JSON endpoint
│   │   └── api-docs/
│   │       ├── page.tsx              # Swagger UI page
│   │       └── layout.tsx            # Page layout
│   └── lib/
│       ├── swagger.ts                # Swagger configuration
│       └── swagger-docs/
│           └── additional-endpoints.ts # Additional documentation
└── SWAGGER_DOCUMENTATION.md          # This file
```

## Documenting New Endpoints

To document a new endpoint, add JSDoc comments in Swagger format above the handler function:

```typescript
/**
 * @swagger
 * /api/your-endpoint:
 *   get:
 *     summary: Brief description
 *     description: Detailed endpoint description
 *     tags:
 *       - Tag Name
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: param
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET(request: NextRequest) {
  // Implementation
}
```

## Documentation Standards

### Common Responses

Use pre-defined responses when applicable:
- `401`: `$ref: '#/components/responses/UnauthorizedError'`
- `403`: `$ref: '#/components/responses/ForbiddenError'`
- `404`: `$ref: '#/components/responses/NotFoundError'`
- `400`: `$ref: '#/components/responses/ValidationError'`
- `500`: `$ref: '#/components/responses/InternalServerError'`

### Common Parameters

Use pre-defined parameters:
- Pagination: `$ref: '#/components/parameters/PageParam'`
- Limit: `$ref: '#/components/parameters/LimitParam'`
- Search: `$ref: '#/components/parameters/SearchParam'`
- Sorting: `$ref: '#/components/parameters/SortByParam'` and `SortOrderParam`

### Schemas

Reference existing schemas:
```yaml
schema:
  $ref: '#/components/schemas/Process'
```

## Environment Variables

Configure the following variables in the `.env.local` file:

```env
# Enable Swagger documentation
NEXT_PUBLIC_SWAGGER_ENABLED=true

# API base URL
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Security

### In Production

- Configure proper authentication to access `/api-docs`
- Consider disabling in production if the API is not public
- Use `NEXT_PUBLIC_SWAGGER_ENABLED=false` to disable

### Sensitive Information

- Don't include real tokens in examples
- Don't expose sensitive information in schemas
- Use generic and realistic examples

## Additional Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger Editor](https://editor.swagger.io/)
- [swagger-jsdoc Documentation](https://github.com/Surnet/swagger-jsdoc)

## Support

For questions about API documentation, contact:
- Email: dev@justoai.com
- Project documentation: [Link to docs]

---

**Last updated:** 2025-10-09
**API Version:** 2.0.0
