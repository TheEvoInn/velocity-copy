# Unified Automation System Architecture v1.0

## Overview
The platform has been unified into a single, monolithic orchestrator that merges Autopilot and Agent Worker functionality into one cohesive autonomous automation engine.

## System Architecture

### 1. Data Layer (Persistent Memory)

#### PlatformState Entity
- **autopilot_enabled** (boolean): Master switch - ON by default
- **autopilot_mode** (string): continuous | scheduled | manual
- **last_cycle_timestamp**: When last automation ran
- **current_queue_count**: Tasks waiting execution
- **active_identity_id**: Current AI identity in use
- **system_health**: healthy | warning | critical
- **execution_log**: Real-time activity log
- **cycle_count_today**: Number of completed cycles
- **tasks_completed_today**: Number of completed tasks
- **revenue_generated_today**: Today's earnings
- **emergency_stop_engaged**: Kill-switch for all automation

#### UserGoals Entity (Extended)
- autopilot_enabled
- ai_daily_target
- ai_preferred_categories
- platform_accounts
- ai_instructions

#### Related Entities (All Persistent)
- AIIdentity
- Opportunity
- TaskExecutionQueue
- LinkedAccount
- CredentialVault
- Transaction
- ActivityLog
- AITask

### 2. Orchestrator Layer

#### unifiedOrchestrator Function
The single monolithic automation engine with these actions:

**full_cycle**
- Phase 1: Scan for opportunities
- Phase 2: Select best tasks
- Phase 3: Execute tasks
- Phase 4: Track results

**scan_opportunities**
- Discovers new opportunities
- Filters by user preferences
- Saves to queue

**execute_queued_tasks**
- Processes waiting tasks
- Creates identities/accounts as needed
- Generates proposals
- Fills and submits forms
- Tracks confirmations

**toggle_autopilot**
- Enable/disable automation
- Preserves queue state

**get_status**
- Returns current platform state
- Used for UI updates

**emergency_stop**
- Kills all automation immediately
- Preserves state for recovery

### 3. UI Layer

#### UnifiedAutopilotControl Component
- Real-time status display
- Autopilot toggle (ON/OFF)
- Manual cycle trigger
- System health indicator
- Queue count visualization
- Revenue tracking

#### AutoPilot Page
- Integrates UnifiedAutopilotControl
- Shows cycle history
- Displays task feed
- Platform context editor
- Spending policies

### 4. Initialization Flow

#### Platform Initializer Function
Runs on app load:
1. Creates PlatformState if missing
2. **Ensures autopilot_enabled = true** (default behavior)
3. Creates UserGoals if missing
4. Ensures at least one AIIdentity exists
5. Logs initialization event

#### Auth Context Integration
- Calls platformInitializer when user authenticates
- Ensures system always boots with autopilot ON
- Maintains persistent state across sessions

## Autonomous Workflow

```
┌─────────────────────────────────────────────────────────┐
│ Platform Loads → Auth Check → platformInitializer       │
│ (Autopilot Always ON)                                   │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ unifiedOrchestrator (Full Cycle Every 30 Minutes)      │
│                                                         │
│ 1. SCAN: Find new opportunities                        │
│ 2. SELECT: Choose highest-value tasks                  │
│ 3. EXECUTE: Create identities, fill forms, submit      │
│ 4. TRACK: Log results, update balances                 │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ PlatformState Updated                                  │
│ - cycle_count_today++                                  │
│ - tasks_completed_today += executed                    │
│ - revenue_generated_today += earnings                  │
│ - execution_log appended                               │
└─────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Master Toggle
```javascript
// Always enabled on boot
platformState.autopilot_enabled = true;

// User can disable anytime
await orchestrator.toggleAutopilot(false);

// Preserves queue and state
// Can resume later without data loss
```

### 2. 24/7 Operation
- All data stored in database (survives restarts)
- Real-time state synchronization
- No session dependency
- Continuous automation possible

### 3. Single Execution Brain
- One task queue
- One execution pipeline
- One identity selector
- One logging system
- Eliminates conflicts and duplicates

### 4. Emergency Control
```javascript
// User can pause all automation
await orchestrator.emergencyStop();

// System health monitoring
if (platformState.system_health === 'critical') {
  // Alert user
}

// Auto-stop after N errors
if (platformState.error_count_today > 5) {
  // Engage emergency stop
}
```

## Removed Contradictions

### Eliminated
- Separate Autopilot triggers (now unified)
- Separate Agent Worker logic (now unified)
- Legacy execution handlers (consolidated)
- Duplicate credential systems (unified approach)
- Conflicting identity selectors (one brain)
- Multiple logging systems (single log)
- Circular event listeners (linear flow)
- Hard-coded overrides (config-driven)

### Consolidated Into
- **unifiedOrchestrator**: Single entry point
- **PlatformState**: Single source of truth
- **Unified execution**: One pipeline
- **Persistent storage**: All data survives
- **Master toggle**: One on/off switch

## API Reference

### Invoke Unified Orchestrator

```javascript
// Full cycle (scan → select → execute → track)
await base44.functions.invoke('unifiedOrchestrator', { 
  action: 'full_cycle' 
});

// Just scan for opportunities
await base44.functions.invoke('unifiedOrchestrator', { 
  action: 'scan_opportunities' 
});

// Execute queued tasks
await base44.functions.invoke('unifiedOrchestrator', { 
  action: 'execute_queued_tasks' 
});

// Toggle autopilot
await base44.functions.invoke('unifiedOrchestrator', { 
  action: 'toggle_autopilot',
  enabled: false // or true
});

// Get current status
await base44.functions.invoke('unifiedOrchestrator', { 
  action: 'get_status' 
});

// Emergency stop
await base44.functions.invoke('unifiedOrchestrator', { 
  action: 'emergency_stop' 
});
```

## Data Persistence

### Survives Restarts
- ✓ User information (User entity)
- ✓ Preferences (UserGoals)
- ✓ Goals and targets
- ✓ AI Identities and personas
- ✓ Platform accounts and credentials (CredentialVault)
- ✓ Opportunity queue (Opportunity)
- ✓ Task execution state (TaskExecutionQueue)
- ✓ Wallet balance (UserGoals, Transaction)
- ✓ Execution logs (ActivityLog)
- ✓ System state (PlatformState)

### Real-Time Sync
- UnifiedAutopilotControl polls PlatformState every 5s
- Task status updates instantly
- User can watch progress in real-time
- No manual refresh needed

## Autopilot Defaults

- **Enabled**: ON (true)
- **Mode**: continuous
- **Cycle Interval**: 30 minutes (configurable)
- **Max Concurrent Tasks**: 3
- **Proposal Generation**: Enabled
- **Auto Form Fill**: Enabled
- **Auto Apply**: Enabled
- **Prize Claiming**: Enabled

## Next Steps for Full Implementation

1. **Browser Automation**
   - Integrate Selenium/Puppeteer for actual form filling
   - Real URL navigation instead of simulation

2. **Proposal Engine**
   - Generate tailored proposals
   - Store proposal templates
   - Track acceptance rates

3. **Email Integration**
   - Monitor inbox for replies
   - Parse confirmation emails
   - Extract payout info

4. **Wallet Management**
   - Real withdrawal mechanics
   - Bank account linking
   - Tax estimation

5. **Prize Automation**
   - Prize opportunity discovery
   - Automated claim submission
   - Prize fulfillment tracking

## System Health Monitoring

```
healthy    → All systems operational
warning    → Errors occurred but recovering
critical   → Emergency stop may be needed
```

Automatic transitions:
- 1-2 errors/cycle → healthy
- 3-4 errors/cycle → warning
- 5+ errors/cycle → critical (auto-stop if configured)

## Troubleshooting

### Autopilot Won't Start
1. Check platformState.autopilot_enabled
2. Check platformState.emergency_stop_engaged
3. Verify user is authenticated
4. Check PlatformState entity exists

### Queue Stuck
1. Check TaskExecutionQueue for stuck tasks
2. Reset task status to 'queued'
3. Run manual execute_queued_tasks action

### System Critical
1. View platformState.last_error
2. Check error_count_today
3. Engage emergencyStop() if needed
4. Review execution_log for details

## Architecture Diagrams

See `/src/docs/architecture/` for detailed diagrams:
- Data flow
- Execution pipeline
- State machine
- Error recovery paths