# User Data Persistence & Indefinite Storage System

## Overview

The platform now features a **comprehensive user data persistence layer** that ensures all user preferences, settings, identities, goals, and security codes are saved indefinitely and survive all system changes, platform updates, and redesigns.

This document describes how the system works, what data is protected, and how to use it.

---

## Core Principles

1. **Permanent Storage**: All user data is saved indefinitely in the database
2. **Version Control**: Complete audit trail of all changes with timestamps
3. **User Consent**: No data is modified without explicit user action
4. **Integrity Protection**: Checksums and validation ensure data is never corrupted
5. **Disaster Recovery**: Automatic repair and backups prevent data loss
6. **System Independence**: Data survives platform reloads, redesigns, and backend updates

---

## What Data Is Stored

### 1. UI Preferences
- Theme (light/dark)
- Sidebar state
- Notification preferences
- Compact mode
- Custom colors

**Persistence**: Permanent. Survives UI redesigns.

### 2. Autopilot Preferences
- Autopilot enabled/disabled state
- Execution mode (continuous, scheduled, manual)
- Review requirements
- Max concurrent tasks
- Daily spend limits
- Preferred categories
- Retry behavior preferences
- Notification settings

**Persistence**: Permanent. Autopilot always uses saved preferences.

### 3. Identity & Persona Management
- All persona identities (name, bio, skills, etc.)
- Legal KYC identity
- Preferred default identity
- Auto-switch settings
- Persona-specific credentials
- Identity routing preferences

**Persistence**: Permanent. Never lost across resets.

### 4. Security & Authentication
- Two-factor authentication settings
- PIN codes (encrypted)
- Recovery codes (encrypted)
- Trusted devices
- Session timeout preferences

**Persistence**: Permanent and encrypted. Cannot be lost.

### 5. Wallet & Financial Settings
- Default payout method
- Payout frequency
- Tax classification
- Tax withholding percentage
- Currency preference
- Minimum payout thresholds

**Persistence**: Permanent. Financial setup is never lost.

### 6. Execution Rules
- Opportunity filters
- Success probability thresholds
- Minimum profit thresholds
- Captcha/KYC skipping preferences
- Maximum wait times
- Category-specific rules

**Persistence**: Permanent. Autopilot uses these rules for every task.

### 7. Goals & Targets
- Daily profit targets
- AI daily targets
- User daily targets
- Risk tolerance levels
- Preferred categories
- Available capital

**Persistence**: Permanent until user updates them.

---

## How It Works

### Data Storage Architecture

```
┌─────────────────────────────────────────────────────┐
│         User Interface (Pages & Components)         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│      usePersistentUserData Hook (React Layer)       │
│  - Reads/writes user data with React Query caching  │
│  - Manages local state sync                         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│   userDataPersistenceManager Function (API Layer)   │
│  - Validates all updates                            │
│  - Enforces user consent                            │
│  - Calculates checksums                             │
│  - Manages audit logs                               │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│      UserDataStore Entity (Permanent Storage)       │
│  - Stores all user preferences with version history │
│  - Modification log tracks every change             │
│  - Checksum validates data integrity                │
│  - Per-user isolated records                        │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│    UserDataAuditLog Entity (Audit Trail)            │
│  - Complete history of all data access              │
│  - Tracks who changed what and when                 │
│  - Flags explicit user consent                      │
│  - Records system maintenance actions               │
└─────────────────────────────────────────────────────┘
```

### Data Flow for Updates

```
User Changes Setting (UI)
    ↓
usePersistentUserData Hook
    ↓
updateField('autopilot_preferences', {...})
    ↓
userDataPersistenceManager Invoked
    ↓
Fetch Current UserDataStore
    ↓
Log Old Value
    ↓
Update Field + Timestamp + Checksum
    ↓
Save to UserDataStore
    ↓
Create Audit Log Entry (explicit_user_consent=true)
    ↓
Return Success to Frontend
    ↓
UI Updates with New Value
    ↓
React Query Invalidates Cache
    ↓
All Components Re-fetch Latest Data
```

---

## Using the Persistence System

### Reading Persistent Data

```javascript
import { usePersistentUserData } from '@/hooks/usePersistentUserData';

function MyComponent() {
  const { userData, loading } = usePersistentUserData();

  if (loading) return <div>Loading...</div>;

  // Access any stored preference
  const autopilotEnabled = userData?.autopilot_preferences?.enabled;
  const theme = userData?.ui_preferences?.theme;
  
  return <div>Theme: {theme}</div>;
}
```

### Updating Persistent Data

```javascript
const { updateField } = usePersistentUserData();

// Update a nested field
await updateField('autopilot_preferences', {
  ...userData.autopilot_preferences,
  enabled: true,
  mode: 'continuous'
});

// This will:
// 1. Save the new value
// 2. Create an audit log entry
// 3. Calculate a new checksum
// 4. Update last_modified_at
// 5. Trigger UI updates
```

### Resetting Data to Defaults

```javascript
const { resetField } = usePersistentUserData();

// Reset a field to its default values
await resetField('autopilot_preferences');

// This will:
// 1. Restore defaults for that field
// 2. Log the reset action
// 3. Preserve other fields unchanged
// 4. Update modification log
```

### Validating Data Integrity

```javascript
const { validateIntegrity } = usePersistentUserData();

const result = await validateIntegrity();
// Returns: { valid: true, message: '...', checksum_match: true }
```

---

## Autopilot Integration

The Unified Autopilot **always** uses the persistent user data layer:

### Pre-Execution Sync

```javascript
// Before every Autopilot cycle:
await base44.functions.invoke('autopilotPersistenceSync', {});

// This returns:
{
  status: 'loaded',
  preferences: {
    autopilot: { enabled: true, mode: 'continuous', ... },
    identity: { default_identity_id: '...', ... },
    execution: { skip_opportunities_with_captcha: true, ... },
    security: { require_pin_for_sensitive_actions: true, ... },
    wallet: { payout_frequency: 'weekly', ... }
  },
  timestamp: '2026-03-16T10:00:00Z'
}
```

### Guaranteed Behavior

- ✅ Autopilot reads user's saved preferences on every execution
- ✅ Autopilot respects identity routing preferences
- ✅ Autopilot follows execution rules
- ✅ Autopilot never overwrites user settings
- ✅ Autopilot logging creates audit trail entries

---

## Data Integrity & Protection

### Checksum Validation

Every UserDataStore record includes a SHA-256 checksum:

```javascript
checksum = SHA256(JSON.stringify(store, excluding: ['checksum', 'backup_copies']))
```

This ensures:
- Data cannot be secretly modified
- Corruption is immediately detected
- Any tampering fails integrity checks

### Automatic Repair

The system runs a daily integrity check that:

1. **Validates Required Fields**: Ensures all critical fields exist
2. **Repairs Missing Data**: Auto-adds defaults for missing fields
3. **Verifies Modification Log**: Ensures audit trail consistency
4. **Checks Timestamps**: Validates date fields
5. **Recalculates Checksums**: Updates hashes if data was repaired

**Schedule**: Daily at 2:00 AM (user's local timezone)

**Automatic Repairs**:
```javascript
// Example: Missing autopilot_preferences
if (!store.autopilot_preferences) {
  store.autopilot_preferences = { enabled: false };
  // Save and log the repair
}
```

### Audit Trail

Every data operation is logged in UserDataAuditLog:

| Field | Value | Example |
|-------|-------|---------|
| event_type | data_read, data_created, data_updated, data_deleted, integrity_check, system_access | data_updated |
| entity_type | Always "UserDataStore" | UserDataStore |
| field_modified | Which field changed | autopilot_preferences |
| old_value | Previous value | { enabled: false } |
| new_value | Current value | { enabled: true } |
| modification_source | Who changed it | user_action, autopilot, system_repair |
| explicit_user_consent | Was it user-initiated? | true |
| timestamp | When did it happen | 2026-03-16T10:00:00Z |

---

## Viewing the Audit Trail

Navigate to **Data Persistence Audit** page to see:

- Complete history of all data modifications
- Filter by event type (updates, creates, reads, etc.)
- Search by field name or change description
- See old vs. new values for updates
- Timestamps for every change
- Source of each modification
- Export audit logs

---

## Disaster Recovery

### Automatic Backups

Backup references are stored in UserDataStore:

```javascript
backup_copies: [
  {
    timestamp: "2026-03-16T02:00:00Z",
    data_hash: "abc123..."
  },
  ...
]
```

### Recovery Process

If data becomes corrupted:

1. **Detection**: Integrity check fails checksum validation
2. **Logging**: Issue is logged in UserDataAuditLog
3. **Automatic Repair**: System attempts to fix common issues
4. **Manual Restore**: If needed, user can restore from backup timestamp

---

## System Changes & Persistence

### Platform Reloads
✅ All data persists across page reloads
✅ State is NOT stored in session memory
✅ Every reload syncs with database

### UI Redesigns
✅ UI preferences are preserved
✅ Old field names still work (backward compatible)
✅ Redesign only affects display, not storage

### Backend Updates
✅ Data schema is versioned
✅ Migration functions handle upgrades
✅ Old data remains valid after updates

### Autopilot Resets
✅ Autopilot state resets don't clear preferences
✅ User settings are independent of execution state
✅ Goals remain unchanged

### Identity Switching
✅ Switching identities doesn't lose preferences
✅ Identity data is separate from preferences
✅ All persona identities are independently stored

---

## Best Practices

### For Developers

1. **Always Use the Hook**
   ```javascript
   const { userData, updateField } = usePersistentUserData();
   ```

2. **Update Complete Objects**
   ```javascript
   // GOOD
   await updateField('autopilot_preferences', {
     ...userData.autopilot_preferences,
     enabled: true
   });

   // BAD
   await updateField('autopilot_preferences.enabled', true);
   ```

3. **Let Users Control Data**
   ```javascript
   // GOOD - User explicitly clicks button
   const handleToggleAutopilot = async () => {
     await updateField('autopilot_preferences', { enabled: true });
   };

   // BAD - Autopilot forces settings
   // Don't call updateField from Autopilot without permission
   ```

4. **Check Integrity Regularly**
   ```javascript
   const { validateIntegrity } = usePersistentUserData();
   const result = await validateIntegrity();
   if (!result.valid) {
     console.warn('Data integrity issue detected');
   }
   ```

### For Users

1. **Your Data Is Safe**
   - All preferences are saved permanently
   - No data loss on updates
   - Full audit trail of changes

2. **Changes Are Permanent**
   - Updated preferences persist forever
   - Only reset if you explicitly choose to
   - No automatic reversions

3. **View Your Audit Trail**
   - Go to Data Persistence Audit page
   - See complete history of all changes
   - Verify what changed and when

4. **Trust the System**
   - All data has integrity protection
   - Daily automated validation
   - Automatic repairs if needed

---

## Troubleshooting

### Data Seems Lost
1. Check Data Persistence Audit page
2. Look for recent modifications
3. Verify UserDataStore exists
4. Run manual integrity validation

### Settings Keep Resetting
1. Don't clear browser cache/cookies
2. Don't use incognito mode
3. Ensure you have proper permissions
4. Check modification log for forced resets

### Audit Log Shows Unexpected Changes
1. Check modification_source field
2. Look for system_repair vs. user_action
3. Review timestamp to see when it happened
4. Check if it was an integrity repair

---

## Summary

The User Data Persistence System provides:

✅ **Permanent Storage**: All data saved indefinitely  
✅ **System Stability**: Survives all platform changes  
✅ **User Control**: Only modified with explicit consent  
✅ **Audit Trail**: Complete history of every change  
✅ **Integrity Protection**: Checksums detect corruption  
✅ **Automatic Repair**: Daily validation and fixes  
✅ **Autopilot Integration**: Always uses saved preferences  
✅ **Disaster Recovery**: Backup and restore capabilities  

The platform now operates as a **true long-term autonomous assistant** with persistent, user-controlled data that survives anything.