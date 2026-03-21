# Identity Router API Reference

## Backend Function: `intelligentIdentityRouter`

### Base Call
```javascript
const res = await base44.functions.invoke('intelligentIdentityRouter', {
  action: 'ACTION_NAME',
  opportunity: {...},  // Required for most actions
  identity_id: '...'   // Required for evaluate/switch actions
});
```

---

## Actions

### 1. `recommend_identity`
**Get AI recommendation for best identity**

**Request:**
```javascript
{
  action: 'recommend_identity',
  opportunity: {
    id: 'opp_123',
    title: 'Write Technical Blog Post',
    description: '...',
    category: 'service',
    platform: 'upwork',
    profit_estimate_low: 300,
    profit_estimate_high: 500,
    time_sensitivity: 'days',
    required_documents: [],
    // Optional:
    requires_kyc_identity: false
  }
}
```

**Response:**
```javascript
{
  recommended_identity_id: 'id_abc123',
  recommended_identity: {
    id: 'id_abc123',
    name: 'Alex Developer',
    role_label: 'Freelancer',
    email: 'alex@example.com',
    color: '#7c3aed',
    skills: ['writing', 'tech', 'seo'],
    tasks_executed: 42,
    total_earned: 1250.50,
    linked_account_ids: ['acc_1', 'acc_2'],
    // ... other identity fields
  },
  fit_score: 85,  // 0-100
  routing_reason: {
    requires_kyc: false,
    kyc_reason: null,
    requires_legal_identity: false,
    policy_applied: 'Auto-detected'
  },
  alternatives: [
    { identity_id: 'id_def456', fit_score: 72 },
    { identity_id: 'id_ghi789', fit_score: 68 }
  ],
  requires_kyc: false,
  kyc_identity_needed: false
}
```

**Grades:**
- A: 80-100 (Excellent)
- B: 70-79 (Good)
- C: 60-69 (Acceptable)
- D: <60 (Poor)

---

### 2. `evaluate_identity_fit`
**Get detailed breakdown of identity suitability**

**Request:**
```javascript
{
  action: 'evaluate_identity_fit',
  opportunity: {...},  // Same structure as recommend_identity
  identity_id: 'id_abc123'
}
```

**Response:**
```javascript
{
  identity_id: 'id_abc123',
  overall_fit: 85,  // 0-100
  metrics: {
    skill_match: 90,           // How well skills align
    platform_experience: 85,    // Success rate on this platform
    performance_score: 80,      // General success rate
    account_health: 85,         // Health of linked accounts
    kyc_clearance: 100          // KYC verification status
  },
  recommendation: 'RECOMMENDED'  // RECOMMENDED | ACCEPTABLE | NOT_RECOMMENDED
}
```

---

### 3. `get_routing_policies`
**Fetch all user's routing policies**

**Request:**
```javascript
{
  action: 'get_routing_policies'
  // No additional parameters
}
```

**Response:**
```javascript
{
  policies: [
    {
      id: 'policy_1',
      rule_name: 'High-value grants require KYC',
      category: 'grant',
      platform: 'grants.gov',
      requires_kyc: true,
      kyc_reason: 'grant_application',
      identity_type: 'legal',  // 'persona', 'legal', 'auto_detect'
      priority: 80,
      enabled: true,
      created_date: '2026-03-20T...',
      created_by: 'user@example.com'
    },
    // ... more policies
  ],
  policy_count: 3,
  enabled_count: 2
}
```

---

### 4. `create_routing_policy`
**Create new routing policy**

**Request:**
```javascript
{
  action: 'create_routing_policy',
  opportunity: {  // This is actually policyData
    rule_name: 'Upwork jobs use developer',
    category: 'freelance',
    platform: 'upwork',
    requires_kyc: false,
    kyc_reason: null,
    identity_type: 'persona',  // 'persona' | 'legal' | 'auto_detect'
    priority: 60,
    enabled: true,
    notes: 'Route all upwork freelance jobs to developer identity'
  }
}
```

**Response:**
```javascript
{
  success: true,
  policy_id: 'policy_new123',
  policy: {
    id: 'policy_new123',
    rule_name: 'Upwork jobs use developer',
    // ... full policy object
  }
}
```

---

### 5. `switch_and_queue`
**Select identity and queue task**

**Request:**
```javascript
{
  action: 'switch_and_queue',
  opportunity: {
    id: 'opp_123',
    title: '...',
    category: '...',
    platform: '...',
    url: 'https://...',
    requires_kyc_identity: false,
    // ... full opportunity object
  },
  identity_id: 'id_abc123'
}
```

**Response:**
```javascript
{
  success: true,
  task_id: 'task_xyz789',
  identity_id: 'id_abc123',
  routing_log_id: 'log_123abc',
  message: 'Task queued with identity: Alex Developer'
}
```

---

## Component Props

### IntelligentIdentityRouter
```jsx
<IntelligentIdentityRouter 
  opportunity={selectedOpportunity}           // Required
  onIdentitySelected={(identity) => {...}}    // Callback on selection
/>
```

### IdentityRoutingPolicyBuilder
```jsx
<IdentityRoutingPolicyBuilder 
  // No required props
/>
```

### AutopilotIdentitySelector
```jsx
<AutopilotIdentitySelector 
  opportunities={[...]}                      // Array of opportunities
  onTasksQueued={(count) => {...}}           // Callback when done
  autoExecute={true}                         // Auto-process queue
/>
```

### IdentityRoutingDashboard
```jsx
<IdentityRoutingDashboard 
  routingStats={{
    total_routing_logs: 42,
    successful_routes: 38,
    avg_fit_score: 82,
    policies_active: 3,
    identities_available: 5,
    kyc_required_today: 2
  }}
/>
```

---

## Database Entities

### IdentityRoutingPolicy
```typescript
{
  id: string                    // Auto-generated
  rule_name: string            // Required
  category: string             // Required, enum
  platform?: string            // Optional
  requires_kyc: boolean        // Default: false
  kyc_reason?: string          // Enum
  identity_type: string        // 'auto_detect', 'persona', 'legal'
  kyc_verification_type?: string  // 'basic', 'standard', 'enhanced'
  keywords?: string[]          // Keywords that trigger rule
  minimum_payout?: number      // Threshold amount
  enabled: boolean             // Default: true
  priority: number             // 0-100, higher = checked first
  notes?: string
  created_date: ISO8601        // Auto
  created_by: email            // Auto
}
```

### IdentityRoutingLog
```typescript
{
  id: string                    // Auto-generated
  opportunity_id: string        // Required
  task_id?: string             // Optional
  identity_used: 'persona'|'legal'
  identity_name: string        // Human-readable name
  routing_reason: string       // Why this identity was chosen
  required_kyc: boolean        // Was KYC needed
  kyc_verified: boolean        // Was KYC verified
  auto_detected: boolean       // True if auto-routed
  platform: string
  opportunity_category: string
  status: 'pending'|'executed'|'completed'|'failed'
  created_date: ISO8601        // Auto
  created_by: email            // Auto
}
```

---

## Error Handling

### Common Errors
```javascript
// No identities available
{
  error: 'No identities configured',
  recommendation: null
}

// Identity not found
{
  error: 'Identity not found',
  status: 404
}

// Unauthorized
{
  error: 'Unauthorized',
  status: 401
}

// Invalid action
{
  error: 'Unknown action',
  status: 400
}
```

---

## Score Calculation Details

```javascript
// Skill Match (0-100)
skillMatch = (matchCount / totalSkills) * 100

// Platform Experience (0-100)
platformXP = (successCount / totalAttempts) * 100

// Performance Score (0-100)
performance = (completedCount / totalTasks) * 100

// Account Health (0-100)
health = hasLinkedAccounts ? 100 : 40

// KYC Clearance (0-100)
kyc = requiresKYC ? (hasValidKYC ? 100 : 0) : 100

// Final Score (0-100)
fitScore = (skill * 0.25) + 
           (platform * 0.30) + 
           (perf * 0.25) + 
           (health * 0.15) + 
           (kyc * 0.05)
```

---

## Constants

### Categories
```javascript
CATEGORIES = [
  'arbitrage', 'service', 'lead_gen', 'digital_flip', 'auction',
  'market_inefficiency', 'trend_surge', 'freelance', 'resale',
  'grant', 'contest', 'giveaway', 'financial', 'tax',
  'government', 'prize', 'general'
]
```

### KYC Reasons
```javascript
KYC_REASONS = [
  'financial_onboarding', 'payment_payout', 'prize_claiming',
  'grant_application', 'tax_compliance', 'government_compliance',
  'identity_verification', 'age_verification',
  'residency_verification', 'high_value_transaction'
]
```

### Identity Types
```javascript
IDENTITY_TYPES = ['auto_detect', 'persona', 'legal']
```

### Status
```javascript
STATUSES = ['pending', 'executed', 'completed', 'failed']
```

---

## Rate Limits

- `recommend_identity`: 30 calls/minute per user
- `evaluate_identity_fit`: 30 calls/minute per user
- `create_routing_policy`: 10 calls/minute per user
- `switch_and_queue`: 60 calls/minute per user

---

## Webhook Events

When routed, logs are created and can trigger automations:

```javascript
// Entity: IdentityRoutingLog
// Event: create
{
  event: 'create',
  entity_name: 'IdentityRoutingLog',
  entity_id: 'log_123',
  data: {
    opportunity_id: 'opp_123',
    identity_used: 'persona',
    status: 'pending',
    // ... full log object
  }
}
```

---

## Best Practices

1. **Always pass complete opportunity** with all available fields
2. **Check fit_score before manual selection** for critical tasks
3. **Create routing policies for compliance requirements** (KYC, etc.)
4. **Monitor success rates** to refine identity selection
5. **Log routing decisions** for audit trail
6. **Test with evaluate_identity_fit** before routing critical tasks
7. **Use batch processing** for queued opportunities
8. **Respect KYC requirements** - never override

---

**Version**: 1.0  
**Last Updated**: 2026-03-21