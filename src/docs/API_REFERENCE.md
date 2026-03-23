# Velocity Platform API Reference

## Overview

The Velocity Platform REST API provides secure, authenticated access to core platform capabilities including opportunity management, task execution, and user operations.

**Base URL**: `https://api.velocity.local`  
**API Version**: v1  
**Authentication**: API Key (X-API-Key header)

## Authentication

All API requests require an API key passed via the `X-API-Key` header:

```bash
curl -H "X-API-Key: pk_your_api_key" https://api.velocity.local/api/v1/status
```

### Creating API Keys

API keys can be created via the Dashboard → API Management or programmatically:

```bash
POST /api/v1/keys
X-API-Key: pk_existing_key_with_admin_permission
Content-Type: application/json

{
  "key_name": "My Integration",
  "permissions": ["read:opportunities", "read:tasks", "execute:tasks"],
  "rate_limit_calls_per_hour": 5000
}
```

**Response**:
```json
{
  "api_key": "pk_abc123def456ghi789",
  "prefix": "pk_abc123de",
  "message": "Save this key securely"
}
```

⚠️ **Important**: Save the API key immediately. You cannot retrieve it later.

## Rate Limiting

API requests are rate-limited per tenant:

- **Free Tier**: 1,000 calls/hour
- **Pro Tier**: 10,000 calls/hour  
- **Enterprise**: Custom limits

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 975
X-RateLimit-Reset: 2026-03-23T07:30:00Z
```

When rate limit is exceeded, the API returns HTTP 429 (Too Many Requests).

## Endpoints

### Status

#### Get System Status

```
GET /api/v1/status
```

**Response** (200 OK):
```json
{
  "status": "operational",
  "version": "v1"
}
```

### Opportunities

#### List Opportunities

```
GET /api/v1/opportunities
X-API-Key: pk_your_key
```

**Query Parameters**:
- `status`: Filter by status (new, executing, completed, expired)
- `category`: Filter by category (arbitrage, service, lead_gen, etc.)
- `limit`: Max results (default: 50, max: 250)

**Response** (200 OK):
```json
{
  "opportunities": [
    {
      "id": "opp_123",
      "title": "Design Contest",
      "category": "contest",
      "profit_estimate_high": 500,
      "status": "new",
      "deadline": "2026-03-30T23:59:59Z",
      "created_date": "2026-03-23T12:00:00Z"
    }
  ]
}
```

#### Get Opportunity Details

```
GET /api/v1/opportunities/{id}
X-API-Key: pk_your_key
```

**Response** (200 OK):
```json
{
  "id": "opp_123",
  "title": "Design Contest",
  "category": "contest",
  "profit_estimate_high": 500,
  "status": "new",
  "deadline": "2026-03-30T23:59:59Z",
  "created_date": "2026-03-23T12:00:00Z"
}
```

### Tasks

#### List Tasks

```
GET /api/v1/tasks
X-API-Key: pk_your_key
```

**Query Parameters**:
- `status`: Filter by status (queued, processing, completed, failed)
- `limit`: Max results (default: 50)

**Response** (200 OK):
```json
{
  "tasks": [
    {
      "id": "task_456",
      "status": "completed",
      "opportunity_id": "opp_123",
      "priority": 75
    }
  ]
}
```

#### Get Task Details

```
GET /api/v1/tasks/{id}
X-API-Key: pk_your_key
```

**Response** (200 OK):
```json
{
  "id": "task_456",
  "status": "completed",
  "opportunity_id": "opp_123",
  "priority": 75
}
```

#### Execute Task

```
POST /api/v1/tasks/execute
X-API-Key: pk_your_key
Content-Type: application/json

{
  "opportunity_id": "opp_123",
  "identity_id": "identity_789"
}
```

**Response** (201 Created):
```json
{
  "task_id": "task_456",
  "status": "queued"
}
```

### User

#### Get Current User

```
GET /api/v1/user
X-API-Key: pk_your_key
```

**Response** (200 OK):
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "admin"
}
```

### API Keys

#### List API Keys

```
GET /api/v1/keys
X-API-Key: pk_your_key_with_admin_permission
```

**Response** (200 OK):
```json
{
  "keys": [
    {
      "key_name": "My Integration",
      "prefix": "pk_abc123de",
      "is_active": true,
      "created_date": "2026-03-23T12:00:00Z"
    }
  ]
}
```

#### Revoke API Key

```
DELETE /api/v1/keys/{id}
X-API-Key: pk_your_key_with_admin_permission
```

**Response** (200 OK):
```json
{
  "message": "API key revoked"
}
```

## Error Handling

The API returns standard HTTP status codes and error responses:

### 400 Bad Request
```json
{
  "error": "Missing opportunity_id"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid API key"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal error message"
}
```

## Permission Scopes

API keys can be granted specific permissions:

- `read:opportunities` - View opportunities
- `read:tasks` - View tasks
- `read:user` - View user profile
- `write:tasks` - Create/update tasks
- `write:opportunities` - Create/update opportunities
- `execute:tasks` - Execute task automation
- `admin:keys` - Manage API keys

## OpenAPI 3.0 Specification

The complete OpenAPI 3.0 specification is available at:

```
GET /api/v1/openapi.json
```

Use this for automated client generation, documentation tools, or IDE integrations.

## Code Examples

### Python
```python
import requests

api_key = "pk_your_api_key"
headers = {"X-API-Key": api_key}

# List opportunities
response = requests.get(
  "https://api.velocity.local/api/v1/opportunities",
  headers=headers
)
opportunities = response.json()["opportunities"]
```

### Node.js
```javascript
const apiKey = "pk_your_api_key";
const response = await fetch(
  "https://api.velocity.local/api/v1/opportunities",
  { headers: { "X-API-Key": apiKey } }
);
const data = await response.json();
```

### cURL
```bash
curl -H "X-API-Key: pk_your_api_key" \
  https://api.velocity.local/api/v1/opportunities
```

## Support

For API issues or questions, contact support@velocity.local or refer to the OpenAPI specification at `/api/v1/openapi.json`.