# USER INTERVENTION ENGINE — FULL EXPANSION REQUIREMENTS
**Phase 11 Roadmap**  
**Target**: Complete two-way sync bridge between Autopilot and User  

---

## CURRENT STATE SUMMARY

| Component | Status | Grade |
|-----------|--------|-------|
| Entity Schema | Complete | A+ |
| Backend Manager | Partial | C (broken resume logic) |
| Error Detection | Complete | A |
| UI Components | Missing | F |
| Automation Triggers | Missing | F |
| Resume Mechanism | Broken | F |
| Credential Persistence | Missing | F |
| Admin Oversight | Missing | F |
| Notification Integration | Missing | F |

---

## REQUIRED SYSTEMS FOR FULL IMPLEMENTATION

### 1. AUTOPILOT TRIGGER SYSTEM ❌
**What**: When smartErrorAnalyzer detects `requires_user_input: true`, create UserIntervention

**Location to Modify**: `functions/smartErrorAnalyzer` + new `createUserIntervention` function

**Flow**:
```
taskFailureHandler
  ↓
smartErrorAnalyzer (return requires_user_input = true)
  ↓
[NEW] createUserIntervention(task_id, requirement_type, schema)
  ↓
UserIntervention.create({ task_id, requirement_type, data_schema, status: 'pending' })
  ↓
Notification.create({ type: 'user_intervention_required', ... })
  ↓
[DONE] User sees alert
```

**Files to Create**:
- `functions/createUserIntervention` — Generates structured intervention requests

**Files to Modify**:
- `functions/taskFailureHandler` — Add trigger after analysis

---

### 2. USER-FACING UI COMPONENTS ❌
**What**: Forms, dashboards, modals for users to respond to interventions

**Components to Create**:

#### A. PendingInterventionsBell (Navigation Update)
```
components/notifications/InterventionBell.jsx
- Show badge count of pending interventions
- Click → expand inline list or navigate to dashboard
- Real-time sync with UserIntervention subscriptions
```

#### B. InterventionForm Component
```
components/interventions/InterventionForm.jsx
- Render dynamic form based on data_schema (JSON Schema Form)
- Display requirement_type as title + icon
- Show template_responses as quick-select buttons
- Validate against data_schema
- Submit to userInterventionManager/provide_missing_data
```

#### C. InterventionCard Component
```
components/interventions/InterventionCard.jsx
- Show single intervention in summary
- Display task_id (link to task details)
- Show requirement_type + required_data description
- Display priority badge
- Show expires_at countdown
- Action buttons: [Resolve] [Reject] [Postpone]
```

#### D. PendingInterventions Page
```
pages/PendingInterventions.jsx
- List all pending interventions (for user)
- Filter by: status, priority, requirement_type, expires_at
- Sort by: priority (desc), expires_at (asc)
- For each: Show InterventionCard
- Click to expand InterventionForm
- Real-time subscription to UserIntervention changes
```

#### E. AdminInterventionOverview
```
components/admin/AdminInterventionPanel.jsx
- Show ALL pending interventions (all users)
- Filter by: user_email, status, priority
- Admin override button (approve/reject on behalf of user)
- Intervention resolution SLA tracking
- Bulk actions: [Approve All] [Escalate High Priority]
```

---

### 3. RESUME AUTOMATION SYSTEM ❌
**What**: Automatically resume task execution after user provides data

**Current Broken Code**: `functions/userInterventionManager.js` line 270-283

**Correct Flow**:
```
UserIntervention.status = 'resolved'
  ↓
[NEW] resumeTaskAfterIntervention(intervention_id)
  ↓
intervention = UserIntervention.get(intervention_id)
task = TaskExecutionQueue.get(intervention.task_id)
  ↓
Inject user_response into task execution context
  ↓
Call unifiedOrchestrator/unifiedAutopilot to resume
  ↓
Task re-queued with user-provided data
```

**Functions to Repair/Create**:
- `functions/userInterventionManager.js` — Fix resumeAfterIntervention (line 270)
- `functions/resumeTaskAfterIntervention` — [NEW] Orchestrate task resumption
- `functions/injectInterventionDataIntoTask` — [NEW] Convert user response to execution format

---

### 4. CREDENTIAL VAULT PERSISTENCE ❌
**What**: Store user-submitted credentials for reuse

**Flow**:
```
User submits credentials through InterventionForm
  ↓
userInterventionManager/provide_missing_data
  ↓
[NEW] Extract credential fields from user_response
  ↓
CredentialVault.create({
  platform: "upwork",
  credential_type: "login",
  encrypted_payload: AES256(user_response),
  linked_account_id: task.linked_account_id
})
  ↓
[DONE] Future tasks can reuse credential
```

**Functions to Create**:
- `functions/persistInterventionCredentials` — Encrypt + store to CredentialVault

**Modification**:
- `functions/userInterventionManager.js` — Call credential persistence after data provided

---

### 5. DATA VALIDATION & CONVERSION ❌
**What**: Ensure user responses match schema + convert to task format

**Flow**:
```
User submits form data
  ↓
InterventionForm validates against data_schema (JSON Schema Validator)
  ↓
userInterventionManager/provide_missing_data receives validated data
  ↓
[NEW] convertInterventionResponseToTaskFormat(requirement_type, user_response)
  ↓
Return execution-ready format (e.g., credential object, form fields, etc.)
  ↓
Store in task execution context
```

**Libraries Needed**:
- `ajv` (JSON Schema validation) — check if installed
- Custom converter function for each requirement_type

---

### 6. NOTIFICATION INTEGRATION ❌
**What**: Alert user when intervention created + provide real-time updates

**Modifications**:
- `functions/createUserIntervention` — Create Notification after UserIntervention created
- `functions/userInterventionManager.js` — Create Notification for status changes

**Notification Types**:
- `user_intervention_required` (severity: urgent)
- `intervention_resolved` (severity: info)
- `intervention_expired` (severity: warning)
- `intervention_rejected` (severity: info)

---

### 7. AUTOMATION ORCHESTRATION ❌
**What**: Create task-based automations to manage intervention lifecycle

**Automations to Create**:

#### A. Intervention Expiration Monitor
```
Type: Scheduled
Name: "Expire pending interventions"
Function: expireOldInterventions
Frequency: Every 5 minutes
Action: Mark interventions with expires_at < now as 'expired'
```

#### B. Intervention Resolution Trigger
```
Type: Entity
Entity: UserIntervention
Event: update (status → 'resolved')
Function: resumeTaskAfterIntervention
Action: Auto-resume task with user data
```

#### C. Intervention Created Notification
```
Type: Entity
Entity: UserIntervention
Event: create
Function: notifyUserOfIntervention
Action: Send real-time alert to user
```

---

### 8. ADMIN CONSOLE INTEGRATION ❌
**What**: Admin visibility + override capability

**Components**:
- Add new tab to AdminPanel: "Interventions"
- Show pending count by status
- List all pending interventions (paginated)
- Filter + sort options
- Admin override: approve/reject/extend expiration

**Function**:
- `functions/adminInterventionActions` — Allow admin to approve/reject on behalf

---

## TWO-WAY SYNC REQUIREMENTS

### Sync Direction 1: Autopilot → UserIntervention
```
Autopilot detects blocking scenario
  → smartErrorAnalyzer.requires_user_input = true
  → createUserIntervention created
  → Notification pushed
  → [WAITING FOR USER]
```

### Sync Direction 2: UserIntervention → Autopilot
```
User submits data through form
  → userInterventionManager.provide_missing_data received
  → Data validated against data_schema
  → Data converted to execution format
  → Credential persisted to CredentialVault
  → resumeTaskAfterIntervention triggered
  → Task re-queued with user data
  → Autopilot resumes execution
  → [TASK CONTINUES]
```

### Sync Direction 3: Notification ↔ User
```
Real-time subscription to UserIntervention changes
  → Notification bell updates immediately
  → User sees badge count
  → User clicks to see pending list
  → User sees direct_link to external page (if needed)
  → User can preview task details
  → User can submit response inline or external
```

---

## COMPLETE FUNCTION INVENTORY

### Existing (to repair):
- ✅ `userInterventionManager.js` — Fix resume logic + add credential persistence

### To Create:
1. `createUserIntervention.js` — Generate intervention from error analysis
2. `resumeTaskAfterIntervention.js` — Orchestrate task resumption
3. `injectInterventionDataIntoTask.js` — Convert user response to execution format
4. `persistInterventionCredentials.js` — Encrypt + store credentials
5. `notifyUserOfIntervention.js` — Create notification + push alert
6. `expireOldInterventions.js` — Mark expired interventions
7. `validateInterventionResponse.js` — Schema validation
8. `adminInterventionActions.js` — Admin override capability

---

## COMPLETE COMPONENT INVENTORY

### New Components:
1. `components/interventions/InterventionForm.jsx` — Dynamic form
2. `components/interventions/InterventionCard.jsx` — Summary card
3. `components/interventions/InterventionBell.jsx` — Navigation notification
4. `components/admin/AdminInterventionPanel.jsx` — Admin dashboard

### New Pages:
1. `pages/PendingInterventions.jsx` — User dashboard

### Modifications:
1. `components/layout/AppLayout.jsx` — Add InterventionBell to nav
2. `pages/AdminPanel.jsx` — Add Interventions tab
3. `App.jsx` — Add route to /PendingInterventions

---

## DATA SCHEMA REQUIREMENTS

### UserIntervention (Existing Entity)
**No changes needed** — Already complete

### Notification (Existing Entity)
**Extend for intervention types**:
- Add `intervention_id` field (reference to UserIntervention)
- Ensure `action_type` enum includes intervention workflow

### CredentialVault (Existing Entity)
**Already supports**:
- encrypted_payload
- linked_account_id
- Platform/credential_type isolation

---

## INTEGRATION WITH EXISTING SYSTEMS

### Autopilot (`functions/unifiedAutopilot.js`)
- Calls `smartErrorAnalyzer` (already done)
- Should call `createUserIntervention` on `requires_user_input` (NEW)

### Task Executor (`functions/optimizedTaskExecutor.js`)
- Should inject user_response from UserIntervention before executing (NEW)
- Should resume from `resumeTaskAfterIntervention` trigger (NEW)

### Notification System (`functions/notificationOrchestrator.js`)
- Should create notifications for intervention lifecycle (NEW)

### Credential Manager (`functions/credentialVaultManager.js`)
- Should persist intervention credentials (NEW)

### Admin Console (`pages/AdminPanel.jsx`)
- Should display intervention metrics (NEW)

---

## DEPLOYMENT CHECKLIST

- [ ] Repair `userInterventionManager.js` (resume logic)
- [ ] Create 8 new backend functions
- [ ] Create 4 new components + 1 page
- [ ] Update App.jsx routing
- [ ] Create 3 new automations (entity + scheduled)
- [ ] Update AdminPanel with Interventions tab
- [ ] Add InterventionBell to AppLayout
- [ ] Test end-to-end flow: error → intervention → user response → task resume
- [ ] Verify credential persistence
- [ ] Verify notification real-time sync
- [ ] Document for users + admins

---

## SUCCESS METRICS

After Phase 11 completion:

1. ✅ Autopilot detects blocking scenario → Creates UserIntervention (real-time)
2. ✅ User receives notification → Sees pending list (real-time)
3. ✅ User submits data → Data validated + persisted (atomic)
4. ✅ Task auto-resumes → Uses user-provided data (seamless)
5. ✅ Credentials stored → Reused in future tasks (efficiency)
6. ✅ Admin oversight → Can see + manage all interventions (control)
7. ✅ No lost data → All user responses persisted (reliability)
8. ✅ No infinite loops → Autopilot never asks same question twice (autonomy)

---

## TIMELINE ESTIMATE

| Phase | Duration | Tasks |
|-------|----------|-------|
| A. Repair + Planning | 4h | Fix resume logic, design schemas |
| B. Backend Functions | 8h | Create 8 functions, integrate |
| C. UI Components | 8h | Create 4 components + 1 page |
| D. Automations | 4h | Entity + scheduled + notification |
| E. Testing + Docs | 4h | End-to-end QA, documentation |

**Total**: 28 hours ≈ **3.5 days** (assuming full-time development)

---

**Status**: Ready for Phase 11 implementation  
**Priority**: CRITICAL (blocks Autopilot independence)  
**Owner**: Platform Team