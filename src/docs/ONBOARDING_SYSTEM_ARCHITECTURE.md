# ONBOARDING SYSTEM ARCHITECTURE

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   UNIFIED ONBOARDING MODULE                      │
│                                                                   │
│  UnifiedOnboardingWizard.jsx ←→ onboardingOrchestratorEngine    │
│                                                                   │
│  Data Flow:                                                       │
│  Step Data → Validation → Persistence → Sync → Activation       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        ↓                                           ↓
┌─────────────────────────┐              ┌─────────────────────┐
│   ENTITY PERSISTENCE    │              │   REAL-TIME SYNCING │
├─────────────────────────┤              ├─────────────────────┤
│ • AIIdentity            │              │ • ActivityLog       │
│ • KYCVerification       │              │ • realtimeEventBus  │
│ • CryptoWallet          │              │ • departmentBus     │
│ • EncryptedCredential   │              │ • React Query       │
│ • UserGoals             │              │                     │
└─────────────────────────┘              └─────────────────────┘
        ↓                                           ↓
        └──────────────────┬──────────────────────┘
                           ↓
            ┌──────────────────────────────────┐
            │  PLATFORM-WIDE CACHE INVALIDATION│
            ├──────────────────────────────────┤
            │ useUserGoalsV2()                 │
            │ useAIIdentitiesV2()              │
            │ useTransactionsV2()              │
            │ useWorkflowsV2()                 │
            │ useOpportunitiesV2()             │
            │ useTasksV2()                     │
            └──────────────────────────────────┘
                           ↓
            ┌──────────────────────────────────┐
            │  DEPARTMENT ACTIVATION           │
            ├──────────────────────────────────┤
            │ Autopilot ✓                      │
            │ VIPZ ✓                           │
            │ NED ✓                            │
            │ Workflow Architect ✓             │
            │ Command Center ✓                 │
            │ Deep Space ✓                     │
            └──────────────────────────────────┘
```

## Data Model

### OnboardingState
```javascript
{
  user_email: "user@example.com",
  is_complete: false,
  onboarding_started_at: "2026-03-21T10:00:00Z",
  steps: [
    {
      id: "welcome",
      title: "Welcome",
      required: false,
      status: "completed"
    },
    {
      id: "identity",
      title: "Legal Identity",
      required: true,
      status: "pending"
    },
    // ... more steps
  ],
  progress: {
    percent_complete: 14,
    current_step: 2,
    steps_completed: 1,
    total_steps: 7
  }
}
```

### CollectedData
```javascript
{
  identity: {
    full_name: "John Doe",
    date_of_birth: "1990-01-01",
    residential_address: "123 Main St",
    preferred_identity_id: "identity_123"
  },
  kyc: {
    government_id_type: "passport",
    government_id_number: "...",
    government_id_expiry: "2030-01-01",
    id_document_front_url: "...",
    id_document_back_url: "...",
    selfie_url: "...",
    status: "submitted"
  },
  wallets: [
    {
      name: "Primary",
      type: "ethereum",
      address: "0x...",
      is_primary: true
    }
  ],
  credentials: [
    {
      name: "Upwork Account",
      platform: "upwork",
      type: "username_password",
      value: "encrypted..."
    }
  ],
  preferences: {
    autopilot_enabled: true,
    vipz_enabled: true,
    ned_enabled: true
  }
}
```

## Component Hierarchy

```
App.jsx
├── AppLayout (navigation, event bus subscription)
│   └── Outlet
│       ├── Dashboard
│       ├── OnboardingModal (if not onboarded)
│       │   └── UnifiedOnboardingWizard
│       │       ├── Step: Welcome
│       │       ├── Step: Identity
│       │       │   ├── Input fields
│       │       │   └── Validation
│       │       ├── Step: KYC
│       │       ├── Step: Wallet
│       │       ├── Step: Credentials
│       │       ├── Step: Departments
│       │       └── Step: Review & Activate
│       ├── AutoPilot
│       ├── Execution
│       └── Finance
```

## Function Flow

### 1. User Starts Onboarding

```
UnifiedOnboardingWizard Mount
    ↓
useEffect: fetchOnboardingStatus()
    ↓
base44.functions.invoke('onboardingOrchestratorEngine', { action: 'get_status' })
    ↓
getOnboardingStatus(base44, user)
    ├─ Fetch UserGoals
    ├─ Fetch KYCVerification
    ├─ Fetch AIIdentity
    ├─ Fetch CryptoWallet
    ├─ Fetch EncryptedCredential
    └─ Return onboarding state + collected data
        ↓
setStatus(response) → UI updates with current step
```

### 2. User Completes a Step

```
User clicks "Next"
    ↓
validateStep(step) → Check required fields
    ↓
handleStepChange() → Store stepData
    ↓
completeStep(step)
    ├─ Invoke 'onboardingOrchestratorEngine' with step_id + data
    │   ├─ Validate data
    │   ├─ Route to handler:
    │   │   ├─ handleIdentityStep() → Create/update AIIdentity
    │   │   ├─ handleKYCStep() → Create/update KYCVerification
    │   │   ├─ handleWalletStep() → Create CryptoWallet
    │   │   ├─ handleCredentialsStep() → Create EncryptedCredential
    │   │   └─ handleDepartmentsStep() → Update UserGoals
    │   ├─ Create ActivityLog entry
    │   └─ Return success
    │       ↓
    ├─ fetchOnboardingStatus() → Refresh state
    └─ setCurrentStep(nextStep) → Show next step
```

### 3. User Activates Platform

```
User clicks "Activate Platform"
    ↓
handleComplete()
    ├─ Invoke 'onboardingOrchestratorEngine' with action='complete_onboarding'
    │   ├─ Validate all data
    │   ├─ Update UserGoals (onboarded=true)
    │   ├─ Create ActivityLog entry (event_type='onboarding_complete')
    │   └─ Invoke autopilotScheduler (activate_from_onboarding)
    │       └─ Begins continuous_cycle
    │           ↓
    └─ (Syncing happens here via existing frameworks)
        ↓
AppLayout (useRealtimeEventBus)
    ├─ Detects ActivityLog 'onboarding_complete' entry
    ├─ Invalidates cache keys
    └─ All hooks refresh automatically
        ↓
All Pages Using velocityHooks
    ├─ useUserGoalsV2() → New data
    ├─ useAIIdentitiesV2() → New data
    └─ useWorkflowsV2() → New data
        ↓
UI Updates Instantly
    ├─ Dashboard shows "Onboarded" status
    ├─ AutoPilot shows "Cycle running"
    ├─ Execution shows "Queued tasks"
    └─ Finance shows "Wallet balance synced"
```

## Persistence & Syncing

### Persistence Layer

Each step creates/updates entities:

| Step | Entity | Action |
|------|--------|--------|
| identity | AIIdentity | create/update |
| kyc | KYCVerification | create/update |
| wallet | CryptoWallet | create (one per wallet) |
| credentials | EncryptedCredential | create (one per credential) |
| departments | UserGoals | create/update |
| Final | UserGoals | update (onboarded=true) |

### Syncing Mechanism

1. **Direct**: Entity subscriptions in hooks listen for changes
2. **ActivityLog**: All entity mutations create ActivityLog entry
3. **Cascade**: ActivityLog entry triggers `useRealtimeEventBus`
4. **Invalidation**: React Query caches invalidated
5. **Refetch**: All affected hooks refetch data
6. **Update**: Components receive new data

### No Extra Syncing Needed

Because the platform already has:
- ✓ `realtimeEventBus` (global cache invalidation)
- ✓ `entityMutationWrapper` (logging)
- ✓ `departmentBus` (cross-department events)
- ✓ React Query subscriptions (hooks)

The onboarding system **doesn't need custom syncing** — it just triggers the existing infrastructure.

## Autopilot Activation After Onboarding

```
onboardingOrchestratorEngine.complete_onboarding()
    ├─ Mark UserGoals.onboarded = true
    └─ Invoke autopilotOrchestrator(action='activate_from_onboarding')
        └─ Invoke autopilotScheduler(action='run_continuous_cycle')
            ├─ Stage 1: Pre-flight checks
            │   ├─ Verify active identity ✓
            │   ├─ Verify wallets ✓
            │   └─ Verify credentials ✓
            ├─ Stage 2: Identity setup (if needed)
            ├─ Stage 3: Opportunity discovery
            │   ├─ Use credentials to scan platforms
            │   └─ Queue matching opportunities
            ├─ Stage 4: Task execution
            │   ├─ Execute queued tasks
            │   └─ Update TaskExecutionQueue
            ├─ Stage 5: Account health check
            │   └─ Verify all accounts are healthy
            └─ Stage 6: Stats collection
                └─ Update ActivityLog with cycle summary

Result: Autopilot is NOW AUTONOMOUS & RUNNING ✓
```

## Error Handling

### Client-Side Validation

```
UnifiedOnboardingWizard.validateStep()
  ├─ Check required fields filled
  ├─ Check email format valid
  ├─ Check wallet address valid
  └─ Return errors or proceed
```

### Server-Side Validation

```
onboardingOrchestratorEngine.validateOnboardingData()
  ├─ Verify government ID data
  ├─ Test credentials (API calls)
  ├─ Verify wallet connectivity
  └─ Check KYC data completeness
```

### Error Recovery

- **Validation error**: User corrects and resubmits
- **Credential test fails**: User retests credential
- **Network error**: Automatic retry
- **Partial completion**: Save progress, resume later
- **Final activation fails**: Log error, offer manual activation

## Security Considerations

- ✓ Credentials encrypted with `EncryptedCredential` entity
- ✓ All data persisted to secure entities (with RLS)
- ✓ Activity logged in `ActivityLog` (immutable audit trail)
- ✓ No secrets in logs or error messages
- ✓ Rate limiting on API credential tests
- ✓ Checksums verify data integrity

## Performance Optimizations

| Optimization | Benefit |
|---|---|
| React Query staleTime | Reduces network calls |
| Entity subscriptions | Real-time without polling |
| Cache invalidation | Instant sync without refetching everything |
| Batch entity creation | Faster persistence |
| Parallel credential tests | Faster credential validation |

## Testing Scenarios

### Scenario 1: Complete Happy Path
1. Fill all steps sequentially ✓
2. Activate platform ✓
3. Verify Autopilot running ✓

### Scenario 2: Skip Optional Steps
1. Skip "Welcome" and "Departments" ✓
2. Fill required steps ✓
3. Activate platform ✓

### Scenario 3: Error & Retry
1. Fill identity step ✓
2. Credential test fails ✗
3. User retests credential ✓
4. Activate platform ✓

### Scenario 4: Resume Later
1. Fill identity step ✓
2. User closes browser
3. User reopens, onboarding resume point ✓
4. Continue from next step ✓

---

**Architecture Version**: 2.0 (Unified Framework Integration)
**Last Updated**: 2026-03-21
**Production Ready**: ✓ YES