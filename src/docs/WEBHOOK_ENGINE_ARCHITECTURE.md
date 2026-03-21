# WEBHOOK ENGINE - ARCHITECTURE DIAGRAM

## System Architecture

```
╔════════════════════════════════════════════════════════════════════════════╗
║                           VELOCITY PLATFORM                                 ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐   ║
║  │                      ENTITY LAYER                                    │   ║
║  │                                                                      │   ║
║  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   ║
║  │  │TaskExecutionQueue│  │   Transaction    │  │    UserGoals     │  │   ║
║  │  │                  │  │                  │  │                  │  │   ║
║  │  │ status:          │  │ type: reward     │  │ onboarded:       │  │   ║
║  │  │ completed        │  │ created          │  │ true             │  │   ║
║  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   ║
║  │                                                                      │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
║          │                       │                        │                  ║
║          │ UPDATE                │ CREATE                 │ UPDATE            ║
║          ↓                       ↓                        ↓                  ║
║  ┌─────────────────────────────────────────────────────────────────────┐   ║
║  │                 ENTITY AUTOMATION LAYER                              │   ║
║  │                                                                      │   ║
║  │  ┌────────────────────────────────────────────────────────────┐    │   ║
║  │  │  Entity Automation: webhookEventAutomation                │    │   ║
║  │  │  ─────────────────────────────────────────────────────────│    │   ║
║  │  │  • Listens to entity mutations                           │    │   ║
║  │  │  • Maps entity → webhook event                           │    │   ║
║  │  │  • Extracts event data                                   │    │   ║
║  │  │  • Invokes webhookEventEngine                            │    │   ║
║  │  └────────────────────────────────────────────────────────────┘    │   ║
║  │                                                                      │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
║          │                                                                   ║
║          │ INVOKE webhookEventEngine                                        ║
║          ↓                                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────┐   ║
║  │              WEBHOOK EVENT ENGINE                                    │   ║
║  │                                                                      │   ║
║  │  webhookEventEngine.js                                              │   ║
║  │  ─────────────────────────────────────────────────────────────────  │   ║
║  │                                                                      │   ║
║  │  1. FETCH WEBHOOKS                                                  │   ║
║  │     └─ Query WebhookConfig for matching event subscriptions         │   ║
║  │                                                                      │   ║
║  │  2. BUILD PAYLOAD                                                   │   ║
║  │     └─ Create structured event payload with data                    │   ║
║  │                                                                      │   ║
║  │  3. SEND TO ENDPOINTS                                               │   ║
║  │     ├─ Add authentication headers (Bearer, API-Key, Custom)        │   ║
║  │     ├─ POST to endpoint URL                                         │   ║
║  │     ├─ Retry on failure (exponential backoff)                      │   ║
║  │     └─ Max 3 retries, 5s delay, 2x multiplier                      │   ║
║  │                                                                      │   ║
║  │  4. UPDATE STATISTICS                                               │   ║
║  │     ├─ Update delivery_stats (total, success, failed)              │   ║
║  │     ├─ Add to recent_deliveries history                            │   ║
║  │     └─ Update last_triggered_at & last_status                      │   ║
║  │                                                                      │   ║
║  │  5. LOG ACTIVITY                                                    │   ║
║  │     └─ Create ActivityLog entry for audit trail                     │   ║
║  │                                                                      │   ║
║  └──────────────────────────────────────────────────────────────────────┘   ║
║          │                                                                   ║
║          ├─ Update WebhookConfig (stats, delivery history)                  ║
║          ├─ Create ActivityLog entry                                        ║
║          └─ Send POST to each endpoint                                      ║
║               │                                                              ║
║               ├──────────────────────┬──────────────────────┬──────────────┤
║               ↓                      ↓                      ↓               ║
║  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐ ║
║  │   WEBHOOK ENDPOINT 1 │  │   WEBHOOK ENDPOINT 2 │  │   WEBHOOK ENDPOINT│ ║
║  │                      │  │                      │  │       N           │ ║
║  │ SUCCESS RESPONSE     │  │ 4xx/5xx ERROR       │  │ SUCCESS RESPONSE  │ ║
║  │ Update stats (✓)     │  │ Retry (exponential)  │  │ Update stats (✓)  │ ║
║  └──────────────────────┘  └──────────────────────┘  └──────────────────┘ ║
║          │                      │                       │                  ║
║          └──────────────────────┴───────────────────────┘                  ║
║                                 │                                           ║
║                    EXTERNAL SYSTEMS RECEIVE EVENTS                          ║
║                                                                              ║
║  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐ ║
║  │  EXTERNAL CRM        │  │  SLACK               │  │  GOOGLE SHEETS   │ ║
║  │  ────────────────────│  │  ────────────────────│  │  ────────────────│ ║
║  │  Receive webhook     │  │  Receive webhook     │  │  Receive webhook │ ║
║  │  Create deal record  │  │  Send message        │  │  Log transaction │ ║
║  │  Update UI           │  │  Notify team         │  │  Update metrics  │ ║
║  └──────────────────────┘  └──────────────────────┘  └──────────────────┘ ║
║                                                                              ║
╚════════════════════════════════════════════════════════════════════════════╝
```

## Event Flow Sequence Diagram

```
User Completes Task
    │
    ├─> Update TaskExecutionQueue (status: "completed")
    │
    ├─> Entity mutation detected
    │
    ├─> Entity Automation triggered
    │   └─> webhookEventAutomation.js invoked
    │
    ├─> Map entity change
    │   └─> Entity: TaskExecutionQueue
    │   └─> Event Type: update
    │   └─> Webhook Event: task.completed
    │
    ├─> Invoke webhookEventEngine
    │
    ├─> Engine queries WebhookConfig
    │   └─> WHERE events CONTAINS "task.completed"
    │   └─> AND is_active = true
    │
    ├─> For each matching webhook:
    │   │
    │   ├─> Build event payload
    │   │   {
    │   │     "event": "task.completed",
    │   │     "timestamp": "...",
    │   │     "data": { ... }
    │   │   }
    │   │
    │   ├─> Attempt 1: POST to endpoint
    │   │   ├─ Success (200): Update stats ✓
    │   │   └─ Failure (500): Retry in 5s
    │   │
    │   ├─> Attempt 2: POST to endpoint (5s delay)
    │   │   ├─ Success (200): Update stats ✓
    │   │   └─ Failure (500): Retry in 10s (2x backoff)
    │   │
    │   ├─> Attempt 3: POST to endpoint (10s delay)
    │   │   ├─ Success (200): Update stats ✓
    │   │   └─ Failure (500): Retry in 20s (2x backoff)
    │   │
    │   └─> Final attempt: Give up, mark as failed
    │       └─ Update stats (failed_deliveries++)
    │
    ├─> Update WebhookConfig.recent_deliveries
    │
    ├─> Create ActivityLog entry
    │   └─ action_type: webhook_event
    │   └─ event_type: task.completed
    │   └─ summary: "Event triggered 5 webhooks"
    │
    └─> Return to caller with results
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WEBHOOK CONFIGURATION                             │
│                                                                           │
│  WebhookConfig Entity                                                    │
│  ──────────────────────────────────────────────────────────────────      │
│  {                                                                        │
│    "id": "webhook_123",                                                  │
│    "name": "CRM Task Sync",                                              │
│    "endpoint_url": "https://crm.example.com/webhooks/velocity",         │
│    "events": ["task.completed", "task.failed"],                         │
│    "auth_type": "bearer_token",                                          │
│    "auth_value": "encrypted_token_xxx",                                  │
│    "is_active": true,                                                    │
│    "headers": { "X-Custom": "value" },                                   │
│    "retry_config": {                                                     │
│      "max_retries": 3,                                                   │
│      "retry_delay_seconds": 5,                                           │
│      "backoff_multiplier": 2                                             │
│    },                                                                     │
│    "delivery_stats": {                                                   │
│      "total_deliveries": 150,                                            │
│      "successful_deliveries": 147,                                       │
│      "failed_deliveries": 3,                                             │
│      "success_rate": 98                                                  │
│    },                                                                     │
│    "recent_deliveries": [                                                │
│      {                                                                    │
│        "timestamp": "2026-03-21T10:30:00Z",                              │
│        "event": "task.completed",                                        │
│        "status": "success",                                              │
│        "response_code": 200,                                             │
│        "response_time_ms": 245                                           │
│      },                                                                   │
│      ...                                                                 │
│    ]                                                                      │
│  }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         WEBHOOK PAYLOAD                                   │
│                                                                           │
│  {                                                                        │
│    "event": "task.completed",                                            │
│    "timestamp": "2026-03-21T10:30:45.123Z",                              │
│    "summary": "Task completed with value: $150",                         │
│    "data": {                                                              │
│      "id": "task_abc123",                                                │
│      "status": "completed",                                              │
│      "estimated_value": 150,                                             │
│      "platform": "upwork",                                               │
│      "url": "https://upwork.com/jobs/task-123",                          │
│      "completion_timestamp": "2026-03-21T10:30:00Z",                     │
│      "execution_time_seconds": 3600                                      │
│    }                                                                      │
│  }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        HTTP REQUEST HEADERS                               │
│                                                                           │
│  POST /webhooks/velocity HTTP/1.1                                        │
│  Host: crm.example.com                                                   │
│  Content-Type: application/json                                          │
│  Content-Length: 342                                                     │
│  Authorization: Bearer encrypted_token_xxx                               │
│  X-Webhook-Event: task.completed                                         │
│  X-Webhook-Timestamp: 2026-03-21T10:30:45.123Z                           │
│  X-Custom: value                                                         │
│  User-Agent: VELOCITY-WebhookEngine/1.0                                  │
│                                                                           │
│  [JSON payload body]                                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        ACTIVITY LOG ENTRY                                 │
│                                                                           │
│  ActivityLog Entity                                                      │
│  ──────────────────────────────────────────────────────────────────      │
│  {                                                                        │
│    "action_type": "webhook_event",                                       │
│    "message": "Event 'task.completed' triggered 3 webhooks",            │
│    "severity": "success",                                                │
│    "metadata": {                                                         │
│      "event_type": "task.completed",                                     │
│      "webhooks_triggered": 3,                                            │
│      "successful": 3,                                                    │
│      "failed": 0,                                                        │
│      "timestamp": "2026-03-21T10:30:45.500Z"                             │
│    },                                                                     │
│    "created_date": "2026-03-21T10:30:45.500Z"                            │
│  }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VELOCITY ECOSYSTEM                                   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                 INBOUND WEBHOOKS (Existing)                      │   │
│  │                                                                  │   │
│  │  External System → WebhookTaskTrigger → Create Tasks           │   │
│  │  (Unchanged, still active)                                      │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              ENTITY MUTATIONS & AUTOMATIONS                      │   │
│  │                                                                  │   │
│  │  TaskExecutionQueue → Entity Automation → webhookEventEngine   │   │
│  │  Transaction → Entity Automation → webhookEventEngine           │   │
│  │  UserGoals → Entity Automation → webhookEventEngine             │   │
│  │                                                                  │   │
│  │  (New webhook event automations)                                │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              OUTBOUND WEBHOOKS (New)                             │   │
│  │                                                                  │   │
│  │  webhookEventEngine → External Systems (CRM, Slack, etc.)      │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                  MONITORING & AUDITING                           │   │
│  │                                                                  │   │
│  │  WebhookConfig → Statistics & History                           │   │
│  │  ActivityLog → Audit Trail                                      │   │
│  │  WebhookEngine UI → Dashboard                                   │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

```
Frontend
├── WebhookEngine.jsx (React component)
│   ├── Create webhook form
│   ├── List webhooks with status
│   ├── View analytics
│   ├── Test webhook
│   └── Monitor deliveries
└── WebhookEngine page (router integration)

Backend
├── webhookEventEngine.js (Deno function)
│   ├── Webhook event routing
│   ├── Payload building
│   ├── HTTP delivery with retries
│   ├── Statistics tracking
│   └── Audit logging
└── webhookEventAutomation.js (Deno function)
    ├── Entity mutation listener
    ├── Event type mapping
    └── Engine invocation

Database
├── WebhookConfig entity
│   ├── Webhook definitions
│   ├── Delivery statistics
│   ├── Recent deliveries
│   └── User-scoped RLS
└── ActivityLog entity
    ├── Webhook event records
    ├── Audit trail
    └── Monitoring data

Infrastructure
├── Entity Automation Framework
│   ├── TaskExecutionQueue triggers
│   ├── Transaction triggers
│   ├── UserGoals triggers
│   └── Opportunity triggers
└── Real-time Event Bus (for UI updates)
```

---

**Architecture Version**: 1.0
**Last Updated**: 2026-03-21
**Status**: ✅ Production Ready