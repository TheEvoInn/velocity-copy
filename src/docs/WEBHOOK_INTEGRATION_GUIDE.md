# WEBHOOK INTEGRATION GUIDE

**VELOCITY Platform Webhook System**  
**Version:** 1.0  
**Status:** ✅ Fully Operational

---

## OVERVIEW

The webhook system enables **real-time data ingestion from external APIs** with automatic mapping to canonical VELOCITY entity models. All incoming payloads are validated, transformed, and synced to the database with full audit logging.

---

## COMPONENTS

### 1. **Webhook Listener Page** (`/WebhookListener`)
Centralized dashboard for managing all webhook configurations.

**Features:**
- Create, edit, delete webhooks
- Test webhook connectivity
- View delivery history and stats
- Copy webhook URLs for external configuration
- Real-time delivery metrics

### 2. **Payload Mapper** (`components/webhooks/PayloadMapper.jsx`)
Visual field-mapping interface that connects external API fields to VELOCITY entity models.

**Supported Mappings:**
- `Opportunity` → Auto-create market opportunities
- `Transaction` → Sync financial data
- `CryptoWallet` → Track blockchain assets
- `StakingPosition` → Monitor yield-earning positions
- `TaskExecutionQueue` → Queue execution tasks
- `ActivityLog` → Immutable event tracking

**Features:**
- Drag-and-drop field mapping
- Custom transform functions (JavaScript)
- Test payload validation
- Real-time preview

### 3. **Webhook Dispatcher** (`functions/webhookDispatcher.js`)
Backend handler that receives POST requests at `/api/webhooks/{webhook_id}`.

**Flow:**
1. Validate webhook exists and is active
2. Parse and validate incoming JSON
3. Apply field mappings
4. Create/update target entity
5. Log delivery to ActivityLog
6. Update webhook statistics

**Security:**
- Bearer token, API key, or basic auth support
- Custom header validation
- Request signature verification (optional)
- Rate limiting per webhook

### 4. **Test Webhook Function** (`functions/testWebhookDelivery.js`)
Sends test payload to verify webhook endpoint connectivity.

---

## SETUP INSTRUCTIONS

### Step 1: Create a Webhook

1. Navigate to **Admin Control Panel** → **Webhooks**
2. Click **New Webhook**
3. Fill in configuration:
   - **Name:** Friendly identifier (e.g., "Stripe Payments")
   - **Endpoint URL:** External API URL to call
   - **Events:** Which system events trigger this
   - **Auth Type:** Bearer, API Key, or Basic
   - **Timeout:** Request timeout in seconds

### Step 2: Configure Payload Mapping

1. Click **Map** on your webhook
2. Select **Target Entity** (e.g., "Transaction")
3. Add field mappings:
   - **Source:** External API field name (e.g., `amount_cents`)
   - **Target:** VELOCITY entity field (e.g., `value_usd`)
   - **Transform (optional):** JavaScript function to convert value
4. Test with sample payload
5. Save mapping

### Step 3: Test Connectivity

1. Click **Test** on the webhook
2. Verify response code is `200`
3. Check **Recent Deliveries** tab for details

### Step 4: Deploy External Integration

Once webhook is tested, use the generated URL with your external API:

```
https://your-app.com/api/webhooks/{webhook_id}
```

Configure your external service to POST to this endpoint with the mapped payload structure.

---

## EXAMPLE INTEGRATIONS

### Stripe Payments → Transaction Entity

**Webhook Configuration:**
- URL: `https://your-app.com/api/webhooks/stripe-123`
- Auth: Bearer token with your Stripe signing secret
- Events: `payment.completed`

**Payload Mapping:**
| External Field | VELOCITY Field | Transform |
|---|---|---|
| `amount` | `value_usd` | `val => val / 100` |
| `currency` | (ignored) | — |
| `status` | `status` | — |
| `customer_id` | (metadata) | — |

**Incoming Stripe Payload:**
```json
{
  "amount": 12500,
  "currency": "usd",
  "status": "succeeded",
  "customer_id": "cus_abc123"
}
```

**Auto-created VELOCITY Transaction:**
```json
{
  "transaction_type": "reward_earned",
  "value_usd": 125.00,
  "status": "completed",
  "timestamp": "2026-03-21T18:30:00Z",
  "source": "webhook:stripe-123"
}
```

### CoinGecko Crypto Data → CryptoWallet Entity

**Payload Mapping:**
| CoinGecko Field | VELOCITY Field |
|---|---|
| `name` | `wallet_name` |
| `symbol` | `token_symbol` |
| `contract_address` | `address` |
| `market_data.current_price` | (metadata) |

---

## AUTHENTICATION METHODS

### Bearer Token
```bash
curl -X POST https://your-app.com/api/webhooks/123 \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"data": "..."}'
```

### API Key
```bash
curl -X POST https://your-app.com/api/webhooks/123 \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"data": "..."}'
```

### Basic Auth
```bash
curl -X POST https://your-app.com/api/webhooks/123 \
  -H "Authorization: Basic base64(username:password)" \
  -H "Content-Type: application/json" \
  -d '{"data": "..."}'
```

### Custom Headers
Add arbitrary headers in webhook configuration:
```
X-Webhook-Signature: hmac-sha256-...
X-Source-ID: partner-id-123
```

---

## MONITORING & DEBUGGING

### View Delivery Statistics
- **Dashboard:** Real-time success/failure rates
- **Recent Deliveries:** Last 50 webhook calls with timestamps, response codes, errors

### Troubleshooting Failures

**❌ 401 Unauthorized**
- Verify auth token/API key is correct
- Check Bearer token format: `Bearer {token}`

**❌ 400 Bad Request**
- Validate JSON payload is valid
- Verify all required mapped fields are present in payload

**❌ 504 Timeout**
- Increase timeout in webhook settings (max 120s)
- Optimize your endpoint response time

**❌ 422 Unmapped Fields**
- Check field mappings are configured correctly
- Test with sample payload in Payload Mapper

### View Audit Log
All webhook events logged to **ActivityLog** entity:
- Timestamp, webhook ID, entity created
- Success/failure status, response times
- Full request/response for debugging

---

## TRANSFORM FUNCTIONS

Apply JavaScript transformations to field values during mapping:

### Examples

**Convert cents to dollars:**
```javascript
val => val / 100
```

**Extract nested property:**
```javascript
val => val.data.amount || 0
```

**Format date:**
```javascript
val => new Date(val).toISOString()
```

**Map category strings:**
```javascript
val => val === 'job' ? 'freelance' : val === 'gig' ? 'arbitrage' : 'other'
```

**Conditional multiplier:**
```javascript
val => val > 1000 ? val * 0.9 : val
```

---

## SECURITY BEST PRACTICES

1. **Always use HTTPS** for webhook endpoints
2. **Validate signatures** if external service supports it
3. **Rotate secrets** regularly
4. **Use IP whitelisting** if external service allows
5. **Log all deliveries** for audit trails
6. **Rate limit** to prevent DDoS
7. **Test in test mode first** before production

---

## API REFERENCE

### POST `/api/webhooks/{webhook_id}`

**Required Headers:**
```
Content-Type: application/json
Authorization: [configured_auth_header]
```

**Request Body:**
```json
{
  "field_name": "value",
  "nested_field": {
    "data": "value"
  }
}
```

**Response Success (200):**
```json
{
  "success": true,
  "entity_id": "opp_abc123",
  "message": "Payload synced"
}
```

**Response Error (400):**
```json
{
  "success": false,
  "error": "Invalid payload",
  "message": "Sync failed"
}
```

---

## MONITORING & ALERTS

**Real-time Metrics:**
- Total webhooks active
- Success rate % (per webhook)
- Average response time
- Failed deliveries in last hour

**Automatic Alerts:**
- Success rate drops below 90%
- Response time exceeds 5 seconds
- Consecutive failures (3+)
- Unusual payload sizes

---

## TROUBLESHOOTING CHECKLIST

- [ ] Webhook is enabled (`is_active: true`)
- [ ] Endpoint URL is correct and accessible
- [ ] Auth credentials are correct
- [ ] Field mappings are configured
- [ ] Sample payload tests successfully
- [ ] All required mapped fields are present
- [ ] External service is sending valid JSON
- [ ] Firewall/network allows inbound requests

---

**Status:** ✅ Production Ready  
**Last Updated:** 2026-03-21

For support, contact admin or check `ActivityLog` entity for detailed error logs.