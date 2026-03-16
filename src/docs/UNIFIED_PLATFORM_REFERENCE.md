# Unified Platform Reference Guide

## Quick Reference: Navigation Structure

```
┌─────────────────────────────────────────────────────────┐
│                    PROFIT ENGINE                        │
├─────────────────────────────────────────────────────────┤
│ Dashboard | Opportunities | Autopilot* | Identities | Wallet & Payouts | More... │
└─────────────────────────────────────────────────────────┘

More Menu (Collapsible):
├─ Prizes & Grants
├─ Security
├─ AI Assistant
└─ System Audit
```

*Highlighted as primary automation hub

---

## Page Hierarchy & Purpose

```
DASHBOARD (Real-time Overview)
├─ Wallet balance & today's earnings
├─ Top opportunities
├─ Dual stream progress (AI vs User)
├─ Autopilot status
└─ Autopilot Activity log
    └─ [Click] → Navigate to AutopilotLogs

OPPORTUNITIES (Action Center)
├─ Browse opportunities by status
├─ Filter by category, platform, score
├─ Click opportunity → Detail modal
│   ├─ [Execute with Autopilot] → Immediate execution
│   ├─ [Generate Proposal] → Proposal workflow
│   ├─ [Send to Autopilot Queue] → Queue for later
│   └─ [Dismiss] → Archive opportunity

AUTOPILOT (Unified Execution Hub) ⭐
├─ Master toggle (ON/OFF)
├─ Unified Orchestrator Control
│   ├─ Current status
│   ├─ Manual cycle trigger
│   └─ System health indicator
├─ Task Queue Monitor
│   ├─ Platform conflict detection
│   ├─ By-platform breakdown
│   ├─ Top queued tasks
│   └─ Conflict resolution
├─ AI Task Feed
│   ├─ Running tasks
│   ├─ Recent completions
│   └─ Task details
├─ Platform Context Editor
│   └─ AI instructions & account info
├─ Spending Policies
│   ├─ Category limits
│   ├─ Auto-approval thresholds
│   └─ ROI requirements
└─ [Logs Button] → Navigate to AutopilotLogs

AUTOPILOT LOGS (Execution History) 🆕
├─ Statistics
│   ├─ Total executions
│   ├─ Successful count
│   ├─ Failed count
│   └─ Current queue depth
├─ Filter tabs
│   ├─ All logs
│   ├─ Completed
│   ├─ Failed
│   └─ Pending
├─ Execution timeline
│   ├─ Task type & status
│   ├─ Timestamp
│   ├─ Details & recipient
│   └─ Revenue attributed
├─ Current queue visualization
│   └─ Top 10 waiting tasks
└─ Export capability

IDENTITIES (AI Personas)
├─ Active identity banner
├─ Create new identity
├─ Manage existing identities
│   ├─ Edit bio & skills
│   ├─ Set communication tone
│   ├─ Link accounts
│   └─ Configure spending limits
└─ Bank account linking
    └─ Primary payout method

WALLET & PAYOUTS (Financial Center)
├─ Wallet balance
├─ Today's earnings breakdown
│   ├─ AI-generated (Autopilot)
│   └─ User-generated
├─ Transaction history
│   ├─ Income
│   ├─ Expenses
│   └─ Transfers
├─ Payout tracking
│   ├─ Pending payouts
│   ├─ In-transit funds
│   └─ Cleared balance
├─ Withdrawal policy
│   ├─ Auto-withdrawal settings
│   ├─ Safety buffer
│   └─ Frequency controls
└─ Tax estimation
    └─ Quarterly summary

PRIZES & GRANTS
├─ Browse prize opportunities
├─ Filter by prize type
│   ├─ Grants
│   ├─ Sweepstakes
│   ├─ Giveaways
│   └─ Contests
├─ Prize detail view
│   ├─ Eligibility requirements
│   ├─ Application status
│   └─ Claim instructions
└─ Prize tracking
    ├─ Applied
    ├─ Won
    └─ Claimed

SECURITY (Credential Management)
├─ API key management
├─ OAuth token management
├─ Session security
├─ Account verification
└─ Audit log

AI ASSISTANT (Chat Interface)
├─ Ask for market scans
├─ Get suggestions
├─ Troubleshoot issues
└─ Get system status

SYSTEM AUDIT (Diagnostics)
├─ Platform health
├─ Error logs
├─ Performance metrics
└─ System status
```

---

## Unified Execution Flow

```
┌─────────────────────────────────┐
│   User Selects Opportunity      │
│   (Dashboard or /Opportunities) │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Opportunity Detail Modal       │
│ ┌───────────────────────────────┤
│ │ [Execute with Autopilot]   ◄──┼─── PRIMARY ACTION
│ │ [Generate Proposal]            │
│ │ [Send to Autopilot Queue]      │
│ │ [Dismiss]                      │
│ └───────────────────────────────┤
└────────────┬────────────────────┘
             │
      ┌──────┴──────────────┬───────────────┐
      │                     │               │
      ▼                     ▼               ▼
┌──────────────┐   ┌───────────────┐  ┌─────────┐
│  Immediate   │   │   Generate    │  │  Queue  │
│ Execution    │   │   Proposal    │  │   for   │
│              │   │   Workflow    │  │  Later  │
└──────────────┘   └───────────────┘  └─────────┘
      │                     │               │
      └──────────────┬──────┴───────────────┘
                     │
                     ▼
┌────────────────────────────────┐
│   unifiedOrchestrator Function │
│ • Identity selection           │
│ • Account selection            │
│ • Priority calculation         │
│ • Queue management             │
│ • Execution orchestration      │
│ • Logging & tracking           │
└────────────────┬───────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌───────────────┐
│  Database    │  │  Execution    │
│  Updates     │  │  Logs/History │
│              │  │               │
│ • Status     │  │ • AIWorkLog   │
│ • Queue      │  │ • Screenshots │
│ • State      │  │ • Timestamps  │
└──────────────┘  └───────────────┘
        │                 │
        └────────┬────────┘
                 │
                 ▼
┌────────────────────────────────┐
│   User Sees Progress           │
│ • AutoPilot page (realtime)    │
│ • Dashboard (activity feed)    │
│ • AutopilotLogs (history)      │
└────────────────────────────────┘
```

---

## Terminology Map (Old → New)

| Context | Old | New |
|---------|-----|-----|
| **Page** | Agent Worker Center | (Removed - features in AutoPilot) |
| **Button** | "Run Worker" | "Execute with Autopilot" |
| **Action** | "Send to Worker" | "Send to Autopilot Queue" |
| **Log** | "Worker Log" or "Activity Log" | "Autopilot Execution Log" |
| **History** | "Work Log" | "AutopilotLogs" |
| **Status** | "Worker Status" | "Autopilot Status" |
| **Dashboard** | "AI Autopilot" subtitle | "Unified Autopilot" |
| **Activity** | Generic "Activity Log" | "Autopilot Activity" |
| **Process** | Multiple contradicting flows | Single "unifiedOrchestrator" |

---

## State Management Flow

```
┌────────────────────────────────────┐
│       PlatformState Entity         │
├────────────────────────────────────┤
│ • autopilot_enabled (Boolean)      │
│ • autopilot_mode (String)          │
│ • last_cycle_timestamp             │
│ • current_queue_count              │
│ • active_identity_id               │
│ • system_health (Status)           │
│ • execution_log (Array)            │
│ • tasks_completed_today            │
│ • revenue_generated_today          │
│ • emergency_stop_engaged           │
└────────────────┬───────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────────┐      ┌──────────────┐
│TaskExecution│      │  AIIdentity  │
│   Queue     │      │              │
├─────────────┤      ├──────────────┤
│ • Status    │      │ • Name       │
│ • Priority  │      │ • Email      │
│ • Identity  │      │ • Skills     │
│ • Opportunity      │ • Accounts   │
│ • Logs      │      │ • Spending   │
└─────────────┘      └──────────────┘
    │                         │
    └────────────┬────────────┘
                 │
                 ▼
         ┌──────────────┐
         │  ActivityLog │
         ├──────────────┤
         │ • All events │
         │ • Timestamps │
         │ • Outcomes   │
         │ • Metadata   │
         └──────────────┘
```

---

## Feature Availability by Page

| Feature | Dashboard | Opportunities | AutoPilot | AutopilotLogs | Identities | Wallet |
|---------|-----------|---------------|-----------|---------------|-----------|--------|
| View Opportunities | Yes | Yes | - | - | - | - |
| Execute | No | Yes | - | - | - | - |
| Queue Task | No | Yes | - | - | - | - |
| View Queue | No | No | **Yes** | Yes | - | - |
| Monitor Progress | Yes | No | **Yes** | - | - | - |
| View Logs | Yes | No | Yes | **Yes** | - | - |
| Manage Identities | No | No | No | No | **Yes** | - |
| Set Spending Limits | No | No | **Yes** | - | - | - |
| View Wallet | Yes | No | No | - | - | **Yes** |
| Track Payouts | Yes | No | No | - | - | **Yes** |
| Set Policy | No | No | **Yes** | - | - | **Yes** |
| AI Chat | No | No | No | - | - | No |

---

## Error Recovery Paths

```
┌─────────────────────────┐
│   Task Execution Error  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Error Category Analysis    │
└──┬──────────────┬───────────┘
   │              │
   ▼              ▼
RETRY         MANUAL
(Auto)        REVIEW
   │              │
   ▼              ▼
┌──────┐    ┌──────────┐
│ Retry│    │Escalate &│
│Queue │    │  Notify  │
└──────┘    │   User   │
            └──────────┘
                 │
                 ▼
            ┌─────────┐
            │  Mark   │
            │needs_   │
            │review   │
            └─────────┘
```

---

## System Health Indicators

| Status | Meaning | Action |
|--------|---------|--------|
| **🟢 Healthy** | All systems operational | Continue normal operation |
| **🟡 Warning** | Errors detected but recovering | Monitor queue, check logs |
| **🔴 Critical** | Multiple errors or failures | Review error log, consider stop |
| **⚫ Stopped** | Emergency stop engaged | Investigate, acknowledge, restart |

---

## Keyboard Shortcuts (When Implemented)

```
? .................. Help
Cmd+K or Ctrl+K ... Quick navigation
Cmd+Shift+E ....... Execute opportunity
Cmd+Shift+L ....... View logs
Cmd+Shift+Q ....... View queue
Cmd+/ ............. Toggle sidebar
```

---

## Mobile Responsive Breakpoints

```
Mobile (< 768px)
├─ Single column layout
├─ Stacked navigation
├─ Full-width cards
└─ Touch-optimized buttons

Tablet (768px - 1024px)
├─ 2-column layout
├─ Horizontal navigation
├─ Grouped cards
└─ Normal buttons

Desktop (> 1024px)
├─ 3+ column layout
├─ Full navigation bar
├─ Side panels
└─ All features visible
```

---

## Data Persistence (What Survives Restarts)

✅ **Survives:**
- User information
- UserGoals & preferences
- All opportunities
- TaskExecutionQueue state
- LinkedAccounts
- AIIdentities
- Wallet balance
- Transaction history
- ActivityLog/ExecutionLogs
- PlatformState
- CredentialVault
- WithdrawalPolicy

❌ **Lost (Session-based):**
- Current UI state
- Temporary notifications
- Unsaved form inputs
- Real-time queue visualization

---

## Related Documentation

- **Architecture:** `/docs/UNIFIED_SYSTEM_ARCHITECTURE.md`
- **Audit:** `/docs/PLATFORM_AUDIT.md`
- **Redesign:** `/docs/REDESIGN_COMPLETION.md`
- **Migration:** `/docs/MIGRATION_GUIDE.md`
- **Changes:** `/docs/CHANGES_SUMMARY.md`

---

## Support & Troubleshooting

**Issue:** Page won't load
**Solution:** Clear cache (Cmd+Shift+Delete), reload

**Issue:** Can't find feature
**Solution:** Check new page structure above

**Issue:** Execution not starting
**Solution:** Check AutoPilot status, review logs

**Issue:** Data missing
**Solution:** Check database snapshots, contact admin

---

Last Updated: March 16, 2026
Platform Version: Unified Autopilot v1.0