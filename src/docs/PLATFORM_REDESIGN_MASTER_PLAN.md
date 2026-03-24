# VELO AI: Platform Redesign Master Plan

**Status:** In Progress  
**Started:** 2026-03-24  
**Objective:** Complete platform-wide consolidation, rebranding, and unified two-way sync

---

## Executive Summary

The VELOCITY platform suffers from:
- **Fragmentation:** Duplicate modules, scattered identity/autopilot pages, multiple execution hubs
- **Desynchronization:** No real-time two-way sync between systems
- **Outdated Infrastructure:** Email system non-functional, finance tracking fragmented, discovery engines isolated
- **Unclear Architecture:** Multiple "activation" buttons, conflicting data sources, no unified command center

**Directive:** Consolidate into a unified, autonomous platform called **VELO AI** with centralized hubs, real-time sync, and agentic execution.

---

## Phase Breakdown

### Phase 1: Rebranding & Foundation (Priority: CRITICAL)
- [ ] Replace "VELOCITY AI" → "VELO AI" across entire codebase
- [ ] Update all UI text, labels, navigation, metadata
- [ ] Update internal variable names and references
- [ ] Create unified color/branding system
- [ ] Establish rebranding checklist

**Files affected:** 100+  
**Estimated complexity:** High  
**Dependencies:** None (foundational)

### Phase 2: Module Consolidation (Priority: CRITICAL)
- [ ] Create **Unified Identity Hub** (single source of truth for all identities)
- [ ] Create **Autopilot Control Center** (master switch + real-time status)
- [ ] Create **Unified Execution Engine** (all tasks, logs, workflows)
- [ ] Merge/deprecate duplicate pages
- [ ] Establish two-way sync between consolidated hubs

**Files affected:** 50+  
**Estimated complexity:** Very High  
**Dependencies:** Phase 1

### Phase 3: System Overhauls (Priority: HIGH)
- [ ] **Email System Rebuild** (send/receive, verification, mailbox, vault sync)
- [ ] **Finance Center Redesign** (unified financial command hub)
- [ ] **StarshipBridge Redesign** (VELO-aligned cockpit, real-time data)
- [ ] **Discovery/Scout Merger** (dual-purpose opportunity engine)

**Files affected:** 30+  
**Estimated complexity:** High  
**Dependencies:** Phase 2

### Phase 4: Advanced Automation (Priority: MEDIUM)
- [ ] **Commerce + Crypto Expansion** (templates, auto-sourcing, landing page gen)
- [ ] **Department AI Assistants** (Identity AI, Execution AI, Finance AI, etc.)
- [ ] **Autonomous Knowledge Builders** (expanding AI agents)

**Files affected:** 25+  
**Estimated complexity:** Very High  
**Dependencies:** Phase 3

### Phase 5: Integration & Testing (Priority: CRITICAL)
- [ ] Full two-way sync validation
- [ ] User Dashboard integration
- [ ] Autopilot system testing
- [ ] Command Center validation
- [ ] Performance & stability audit

**Files affected:** All  
**Estimated complexity:** Critical  
**Dependencies:** All phases

---

## Consolidation Map

### Current Duplicate Modules → Consolidated Hubs

#### Identity (Currently Fragmented)
**Current locations:** AIIdentityStudio, IdentityManager, Onboarding, AccountCreationDashboard  
**Consolidates to:** **VELO Identity Hub** (unified master page)
- Single identity creation flow
- Real-time sync to Autopilot, KYC, Credentials, Wallet
- Full identity lifecycle management
- Master Account data source

#### Autopilot (Currently Scattered)
**Current locations:** UnifiedAutopilot, AutopilotPanel, various component toggles  
**Consolidates to:** **VELO Autopilot Control** (unified master page)
- Master on/off switch
- Real-time task queue
- Execution logs
- Identity assignment
- Policy configuration

#### Execution (Currently Fragmented)
**Current locations:** UnifiedAutopilot, TaskExecutionDashboard, various logs  
**Consolidates to:** **VELO Execution Engine** (unified master page)
- All active tasks
- Real-time status updates
- Task logs and history
- Error handling and recovery
- Workflow orchestration

#### Finance (Currently Scattered)
**Current locations:** WalletDashboard, Finance page, multiple trackers  
**Consolidates to:** **VELO Finance Command** (unified master page)
- Real-time balance and earnings
- Transaction history
- Payout tracking
- Tax calculations
- Sync to all revenue engines

#### Discovery (Currently Dual)
**Current locations:** Discovery, ProactiveScout  
**Consolidates to:** **VELO Discovery Engine** (merged, expanded)
- Unified scraping + analysis
- Direct autopilot integration
- Opportunity filtering and routing

---

## Rebranding Reference

### Global Replacements
```
"VELOCITY" → "VELO"
"VELOCITY AI" → "VELO AI"
"Velocity" → "Velo"
"velocity" → "velo"
"Autopilot" → "Autopilot" (unchanged, but verify context)
```

### UI Strings (High Priority)
- Navigation labels
- Page titles
- System messages
- Button text
- Descriptions and subtitles
- Error messages
- Success messages

### Code References
- Component names (if clear)
- Function names
- Variable names
- Comments
- Documentation
- Metadata

---

## System Architecture: Unified Sync Pattern

### Two-Way Sync Architecture
```
User Input → Consolidated Hub → Entity Update → Query Invalidation → Real-time Broadcast
                                                  ↓
                                    All subscribed modules
```

### Key Hubs (Source of Truth)
1. **VELO Identity Hub** → AIIdentity, KYCVerification, CredentialVault
2. **VELO Autopilot Control** → AITask, TaskExecutionQueue, WithdrawalPolicy
3. **VELO Execution Engine** → TaskExecutionQueue, EngineAuditLog, AIWorkLog
4. **VELO Finance Command** → Transaction, EarningGoal, Wallet data
5. **VELO Discovery Engine** → Opportunity, APIMetadata, discovery logs

### Sync Requirements
- All modules read from and write to their designated hub
- Real-time subscriptions for all changes
- Query invalidation on updates
- No stale data allowed
- Full audit logging

---

## Page Deprecation & Migration

### Pages to Consolidate (Remove or Repurpose)
- `IdentityManager` → Redirect to VELO Identity Hub
- `AIIdentityStudio` → Merge into VELO Identity Hub
- `UnifiedAutopilot` → Consolidate into VELO Autopilot Control
- `AutopilotLogs` → Merge into VELO Execution Engine
- `Onboarding` → Integrate into VELO Identity Hub
- `AccountCreationDashboard` → Merge into VELO Identity Hub
- `WalletDashboard` → Merge into VELO Finance Command
- `ProactiveScout` → Merge with Discovery → VELO Discovery Engine

### Pages to Create (New Consolidated Hubs)
- `VeloIdentityHub.jsx` (NEW)
- `VeloAutopilotControl.jsx` (NEW)
- `VeloExecutionEngine.jsx` (NEW)
- `VeloFinanceCommand.jsx` (NEW)
- `VeloDiscoveryEngine.jsx` (NEW)

### Pages to Enhance
- `StarshipBridge` → Full redesign with VELO vocabulary, real-time data binding
- `Dashboard` → Feed from all consolidated hubs
- `Control` → Settings hub for VELO configs

---

## Dependencies & Implementation Order

1. **Rebranding (Phase 1)** → Foundation for all other work
2. **Identity Hub (Phase 2)** → Unblocks Autopilot and Execution
3. **Autopilot Control (Phase 2)** → Unblocks Execution Engine
4. **Execution Engine (Phase 2)** → Validates sync architecture
5. **Email System (Phase 3)** → Required for account creation
6. **Finance Command (Phase 3)** → Consolidates revenue tracking
7. **StarshipBridge (Phase 3)** → Becomes unified command center
8. **Discovery Merger (Phase 3)** → Autonomous opportunity engine
9. **Advanced Features (Phase 4)** → Build on stable foundation

---

## Success Criteria

✅ **Phase 1 Complete:** All "VELO AI" references consistent, 0 "VELOCITY" remaining  
✅ **Phase 2 Complete:** 3+ consolidated hubs operational, full two-way sync validated  
✅ **Phase 3 Complete:** Email system live, Finance Command unified, StarshipBridge redesigned  
✅ **Phase 4 Complete:** Commerce/Crypto automated, AI Assistants deployed  
✅ **Phase 5 Complete:** Full platform test passed, all systems in sync, zero fragmentation  

**Final Goal:** One unified, autonomous, real-time synchronized VELO AI platform with consolidated hubs, full two-way sync, and agentic execution capability.

---

## Progress Tracking

| Phase | Status | Start | End | Notes |
|-------|--------|-------|-----|-------|
| 1: Rebranding | ✅ 50% | 2026-03-24 | TBD | UI labels updated, ongoing |
| 2: Consolidation | 🔄 In Progress | 2026-03-24 | TBD | 3 hubs created: Identity, Autopilot, Finance |
| 3: System Overhauls | 🔄 In Progress | 2026-03-24 | TBD | Finance complete, Email next |
| 4: Advanced Automation | ⏳ Queued | TBD | TBD | Depends on Phase 3 |
| 5: Integration & Testing | ⏳ Queued | TBD | TBD | Depends on all phases |

---

**Last Updated:** 2026-03-24  
**Owner:** Platform Redesign Initiative  
**Status:** Active