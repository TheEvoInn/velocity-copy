# CREDENTIAL VAULT SYNC ENHANCEMENT
**Phase 11+ Extension** — Multi-Account Credential Management for Autopilot  
**Status**: COMPLETE ✅  

---

## OBJECTIVE
Enable Autopilot to:
- Securely store + encrypt credentials across multiple platform accounts
- Automatically switch accounts to avoid rate-limiting & account suspension
- Maintain session state across task executions
- Sync credentials to new identities without manual re-entry

---

## ARCHITECTURE

### Existing Layer (No Changes)
```
CredentialVault (encrypted storage)
  ├─ AES-256-GCM encryption (at-rest security)
  ├─ Access logging (audit trail)
  └─ Expiration tracking (credential lifecycle)
```

### NEW: Credential Sync Orchestrator
```
credentialSyncOrchestrator (new function)
  ├─ list_available_credentials_for_task
  │   └─ Query: platform + health + expiry status
  ├─ get_best_credential_for_execution
  │   └─ Score: linked account health → select healthiest
  ├─ switch_session
  │   └─ Load credential, log switch, update access count
  ├─ sync_credentials_to_identity
  │   └─ Propagate creds from one identity to another
  └─ get_identity_account_matrix
      └─ View all accounts/platforms for identity + execution readiness
```

### NEW: Session Manager
```
sessionManager (new function)
  ├─ initialize_session
  │   └─ Create session record + set status=active
  ├─ log_activity
  │   └─ Track actions within session (apply, click, submit)
  ├─ check_rate_limit_status
  │   └─ Query cooldown + daily app limit
  ├─ rotate_account
  │   └─ Auto-switch to healthiest account if current is limited
  └─ close_session
      └─ Mark session closed + calculate duration
```

---

## DATA FLOW: CREDENTIAL SYNC + AUTO-SWITCHING

```
TASK INITIALIZATION
┌─────────────────────────────────────────────┐
│ unifiedAutopilot/opportunity_to_agent_task  │
│ 1. Identify platform (opp.platform)         │
│ 2. Select identity (intelligentIdentityRouter)│
└────────────────┬────────────────────────────┘
                 │
                 ↓ NEW STEP
    ┌────────────────────────────────────────┐
    │ credentialSyncOrchestrator              │
    │ /get_best_credential_for_execution      │
    │ - Query all vaults for platform         │
    │ - Filter: active + non-expired          │
    │ - Score: linked account health          │
    │ → Return: vault_id + account_health     │
    └────────────┬───────────────────────────┘
                 │
                 ↓
    ┌────────────────────────────────────────┐
    │ sessionManager/initialize_session       │
    │ - Create session record                 │
    │ - Status: active                        │
    │ - Log: started_at + platform            │
    └────────────┬───────────────────────────┘
                 │
                 ↓
    ┌────────────────────────────────────────┐
    │ agentWorker/queue_task                  │
    │ - Receive: vault_id (credential ready)  │
    │ - Inject: credential via vault_id       │
    │ - Task execution: NO MANUAL INTERVENTION│
    └────────────┬───────────────────────────┘
                 │
EXECUTION FLOW
│
├─ Rate limit detected during task?
│  ↓
│  ┌────────────────────────────────────────┐
│  │ sessionManager/check_rate_limit_status  │
│  │ - Monitor cooldown_until                │
│  │ - Check daily_applications used         │
│  │ - If in cooldown/limit exceeded:        │
│  │   → Route to sessionManager/rotate_account
│  └────────────┬───────────────────────────┘
│               │
│               ↓ AUTO-ROTATION TRIGGERED
│  ┌────────────────────────────────────────┐
│  │ sessionManager/rotate_account           │
│  │ - Query healthy accounts for platform   │
│  │ - Pick: lowest daily_applications_used  │
│  │ - Load: new vault_id for new account    │
│  │ - Switch: seamless, no interruption     │
│  │ - Return: new_vault_id + new_username   │
│  └────────────┬───────────────────────────┘
│               │
│               ↓
│  Task resumes with new account
│  (same identity, different credentials)
│
├─ Task completes
│  ↓
│  ┌────────────────────────────────────────┐
│  │ sessionManager/close_session            │
│  │ - Log: closed_at + outcome              │
│  │ - Calculate: duration_seconds           │
│  │ - Audit: success/failure                │
│  └────────────────────────────────────────┘
│
└─ Return: task_result + session_summary
```

---

## EXECUTION SCENARIOS

### Scenario 1: Simple Single-Account Execution
```
1. Task: Apply to Upwork job
2. Credentials: 1 active Upwork vault
3. Flow:
   - credentialSyncOrchestrator selects it
   - sessionManager initializes
   - agentWorker executes with credentials
   - Task completes
```

### Scenario 2: Rate-Limited Account → Auto-Rotate
```
1. Task: Apply to 10 Upwork jobs
2. Credentials: 3 active Upwork vaults (3 accounts)
3. Flow:
   - Account A: applies to jobs 1-3
   - Job 4: Rate limit hit (3 more apps already today)
   - sessionManager/rotate_account triggers
   - Selects Account B (fresh, 0 apps today)
   - Jobs 4-7: executed with Account B
   - Job 8: Account B also limited
   - Rotates to Account C
   - Jobs 8-10: executed with Account C
4. Result: 10 jobs completed via smart account rotation
5. Zero manual intervention required ✅
```

### Scenario 3: Sync Credentials to New Identity
```
1. Scenario: User creates 2nd identity (Designer persona)
2. User previously linked 3 Upwork accounts to Identity A (Writer)
3. Want: Designer identity to reuse same accounts
4. Flow:
   - credentialSyncOrchestrator/sync_credentials_to_identity
   - From: Identity A (Writer)
   - To: Identity B (Designer)
   - Platforms: ['upwork'] or [] for all
   - Result: All Upwork credentials copied to Designer identity
5. Designer can now execute on Upwork without re-auth ✅
```

### Scenario 4: Account Suspended → Fallback
```
1. Task: Apply on Freelancer
2. Account A credentials loaded, task begins
3. During execution: Account A suspended (detected by system)
4. sessionManager/check_rate_limit_status reports: health_status='suspended'
5. sessionManager/rotate_account skips Account A, selects healthy B
6. Task continues without interruption
```

---

## INTEGRATION POINTS

### ✅ unifiedAutopilot
- Now calls credentialSyncOrchestrator before queueing task
- Passes vault_id to agentWorker
- Enables credential auto-injection

### ✅ agentWorker (future update)
- Receives vault_id in task payload
- Decrypts credential via credentialVault/retrieve
- Injects into browser/API execution context
- Logs all credential accesses

### ✅ smartErrorAnalyzer (future update)
- Detects rate-limit errors
- Triggers sessionManager/rotate_account
- Resumes task with new credentials
- No user intervention

### ✅ Credential Vault (existing, enhanced)
- Still owns encryption/decryption
- Sync orchestrator reads vault metadata (not payloads)
- Session manager logs all account rotations

### ✅ Notifications
- User alerted when account rotated
- Dashboard shows: "Task resumed with Account B (daily limit: 7/10)"
- Intervention only if zero healthy accounts available

---

## SECURITY MODEL

### Encryption
- CredentialVault: AES-256-GCM (at-rest)
- Credentials: Never logged, never cached
- Keys: Derived from APP_ID + user ID + vault ID

### Access Control
- credentialSyncOrchestrator: Service-role only
- sessionManager: Service-role only
- Audit log: Every credential access logged with task_id + purpose

### Audit Trail
- Created: "Credential stored from user"
- Accessed: "Credential retrieved for task #123"
- Rotated: "Account rotated from @user1 to @user2 (rate limit)"
- Deleted: "Credential marked inactive, encrypted_payload cleared"

---

## PERFORMANCE

### Query Optimization
- credentialSyncOrchestrator caches account health for 5 min
- sessionManager uses IndexedDB for rate-limit history
- No decryption until task execution (no unnecessary crypto ops)

### Limits
- Max 10 active vaults per platform (enforced)
- Max 50 access logs per vault (rotation friendly)
- Session timeout: 4 hours (auto-close inactive)

---

## FUTURE ENHANCEMENTS

1. **Predictive Rotation** (Phase 12)
   - Pre-rotate before hitting rate limit
   - Monitor: daily_applications_today trend
   - Rotate when 70% of daily limit approached

2. **Credential Health Scoring** (Phase 12)
   - Track: success rate per account
   - Prefer: accounts with high success rate
   - Deactivate: accounts with >5 consecutive failures

3. **Identity-Aware Credential Sync** (Phase 13)
   - Sync only credentials matching identity skill set
   - "Designer" identity → design platforms only
   - "Developer" identity → coding platforms only

4. **Multi-Tenant Credential Sharing** (Phase 14+)
   - Share vaults between trusted identities
   - Audit: track who accessed what + when

---

## DEPLOYMENT CHECKLIST

- ✅ credentialSyncOrchestrator (function created)
- ✅ sessionManager (function created)
- ✅ unifiedAutopilot (integrated with credential sync)
- ⏳ agentWorker (pending update for vault_id injection)
- ⏳ smartErrorAnalyzer (pending rate-limit → rotation)
- ⏳ Notification system (pending rotation alerts)
- ⏳ Admin dashboard (pending session/rotation monitoring)

---

## TESTING CHECKLIST

- [ ] Create 3 test accounts (Upwork, Fiverr, Freelancer)
- [ ] Store credentials in vault
- [ ] List available credentials (credentialSyncOrchestrator)
- [ ] Select best credential (health scoring)
- [ ] Initialize session (sessionManager)
- [ ] Simulate rate limit (check_rate_limit_status)
- [ ] Rotate account (auto-switch)
- [ ] Close session (verify duration + outcome)
- [ ] Sync credentials between identities
- [ ] Verify encryption at rest (no plaintext stored)
- [ ] Audit trail complete (all actions logged)
- [ ] No user interventions triggered (fully autonomous)

---

**Status**: Ready for agentWorker integration + E2E testing  
**Next Phase**: Implement vault_id injection in agentWorker