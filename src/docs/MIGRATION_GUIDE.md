# Platform Migration Guide: Unified Autopilot

## Quick Summary

The platform has been **unified and reorganized** to eliminate legacy contradictions between Autopilot and Agent Worker systems.

---

## What Changed?

### Navigation (Most Visible Change)

**Old Structure:**
```
Dashboard
Autopilot
Opportunities
Prizes (highlight)
Security (highlight)
MORE:
  └─ System Audit, Agent Worker, Negotiate, Payouts, etc.
```

**New Structure:**
```
Dashboard
Opportunities
Autopilot (PRIMARY)
Identities
Wallet & Payouts
MORE:
  └─ Prizes & Grants, Security, AI Assistant, System Audit
```

### Pages Removed

These pages no longer exist (consolidated):
- **AgentWorkerCenter** → Merged into AutoPilot
- **IdentityManager** → Merged into IdentityManagerExpanded
- **AIWorkLogPage** → Moved to AutopilotLogs
- **ActivityPage** → Moved to AutopilotLogs
- **GoalCenter** → Merged into AutoPilot Settings
- **AccountManager** → Merged into IdentityManagerExpanded
- **WithdrawalEngine** → Merged into WalletPage
- **NegotiationCenter** → Archived
- **Others** → Archived (System Audit, docs, etc.)

### Pages Enhanced

- **Dashboard** → Now shows "Autopilot Activity" (not generic "Activity Log")
- **Opportunities** → Direct "Execute with Autopilot" buttons
- **AutoPilot** → Central hub with unified controls
- **WalletPage** → Enhanced with payout tracking
- **IdentityManagerExpanded** → Enhanced with all identity features

### New Pages

- **AutopilotLogs** (`/AutopilotLogs`) → Complete execution history and queue status

---

## Terminology Changes

All UI text updated. No more "Agent Worker":

| Old | New | Where |
|-----|-----|-------|
| "Agent Worker" | "Autopilot" | Everywhere |
| "Run Worker" | "Execute with Autopilot" | Opportunity buttons |
| "Send to Worker" | "Send to Autopilot Queue" | Action buttons |
| "Worker Log" | "Autopilot Execution Log" | Logs page |
| "Activity Log" | "Autopilot Activity" | Dashboard |

---

## User Experience Changes

### Executing an Opportunity

**Before:** Multiple unclear paths
```
1. Find opportunity
2. Click "Execute Hub"
3. Unclear what happens next
```

**After:** Clear, direct path
```
1. Go to Opportunities or see on Dashboard
2. Click opportunity
3. Choose action:
   - [Execute with Autopilot] → Immediate execution
   - [Generate Proposal] → Create proposal
   - [Send to Autopilot Queue] → Queue for later
4. Track progress in Autopilot page or logs
```

### Monitoring Autopilot

**Before:** Multiple scattered pages
```
- Autopilot page (status)
- Activity Log page (history)
- Work Log page (tasks)
- Different views of same data
```

**After:** Unified central location
```
- /AutoPilot → Real-time status & controls
- /AutopilotLogs → Complete history & queue
- Single source of truth
```

### Managing Identities

**Before:** Duplicate pages
```
- IdentityManager
- IdentityManagerExpanded
- Confusion about which to use
```

**After:** Single page
```
- /IdentityManagerExpanded → All identity features
```

---

## For Developers

### Backend Changes

**No logic changes.** All execution still routes through:
```javascript
await base44.functions.invoke('unifiedOrchestrator', { 
  action: 'full_cycle' 
})
```

### Old Function Calls (Still Work)
```javascript
// These still work but now route through unified system
await base44.functions.invoke('autopilotCycle', {...})
// ↓ Internally routes to unifiedOrchestrator
```

### New Event Names
```javascript
// Old (avoid using)
window.dispatchEvent(new CustomEvent('openExecutionHub', {...}))

// New (preferred)
window.dispatchEvent(new CustomEvent('executeWithAutopilot', {...}))
window.dispatchEvent(new CustomEvent('generateProposal', {...}))
```

### Route Structure
```javascript
// Old routes (404 now)
/AgentWorkerCenter → Removed
/AIWorkLogPage → Removed
/ActivityPage → Removed
/GoalCenter → Removed

// New routes
/AutopilotLogs → NEW
/AutoPilot → Enhanced
/Dashboard → Enhanced
```

---

## Checklist for Users

### First Time After Update

- [ ] Clear browser cache (cmd+shift+delete or ctrl+shift+delete)
- [ ] Reload the app
- [ ] Check new navigation structure
- [ ] Update any bookmarks
- [ ] Test executing an opportunity

### What to Expect

- ✅ Everything works the same (improved UI)
- ✅ Autopilot starts ON automatically
- ✅ All data preserved
- ✅ Faster navigation (fewer pages)
- ✅ Clearer terminology
- ✅ Better organization

### What Changed (Visually)

- Navigation bar reorganized
- Some pages consolidated
- New "Autopilot Activity" log on Dashboard
- New "AutopilotLogs" page accessible from AutoPilot
- Opportunity execution buttons updated
- Terminology standardized

---

## FAQ

**Q: Will my data be lost?**
A: No. All data is preserved. The system just reorganizes how it's displayed.

**Q: Do I need to do anything?**
A: No. Just reload the app. The system handles everything.

**Q: Where did [old page] go?**
A: Consolidated into another page (see "Pages Removed" section above).

**Q: Why was Agent Worker removed?**
A: The system is now fully unified. There's only one automation engine: Autopilot.

**Q: Will my automations keep running?**
A: Yes. Autopilot starts ON by default. Everything continues automatically.

**Q: Where can I see execution logs?**
A: Two places:
1. Dashboard → "Autopilot Activity" widget
2. AutoPilot page → Click "Logs" button → AutopilotLogs page

**Q: How do I execute an opportunity?**
A: Click any opportunity card/detail → "Execute with Autopilot" button.

**Q: Can I still queue tasks?**
A: Yes. Click opportunity → "Send to Autopilot Queue" button.

**Q: Where's the [feature]?**
A: See docs or contact support. Most features moved to primary pages.

---

## Troubleshooting

### Pages Not Loading?
1. Clear cache (Cmd+Shift+Delete)
2. Reload (Cmd+Shift+R)
3. Check browser console for errors

### Old Links Broken?
All old URLs now return 404. Update bookmarks to new pages:
- `/Dashboard` ✅
- `/Opportunities` ✅
- `/AutoPilot` ✅
- `/AutopilotLogs` ✅ (NEW)
- `/IdentityManagerExpanded` ✅
- `/WalletPage` ✅
- `/PrizeDashboard` ✅
- `/SecurityDashboard` ✅

### Can't Find a Feature?
Check "Pages Removed" section above. Your feature likely moved to:
- AutoPilot page
- AutopilotLogs page
- IdentityManagerExpanded
- WalletPage
- Or was consolidated into another page

---

## Support

For issues:
1. Check this guide
2. Check `/docs/REDESIGN_COMPLETION.md`
3. Check `/docs/UNIFIED_SYSTEM_ARCHITECTURE.md`
4. Contact development team

---

## Timeline

**Redesign Date:** March 16, 2026

**Impact:** All users

**Backward Compatibility:** None. System unified and modernized.

**Rollback Plan:** Database snapshots available (see admin panel)

---

## Next Steps

After you get comfortable with the new system:
- Check out new AutopilotLogs page
- Set up notification preferences (coming soon)
- Configure autopilot settings
- Monitor execution history

Enjoy the streamlined platform! 🚀