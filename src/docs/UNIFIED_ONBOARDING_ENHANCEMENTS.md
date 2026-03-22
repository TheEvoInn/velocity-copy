# Unified Onboarding System Enhancements

## Overview
The onboarding system has been completely redesigned to use **separated input fields for all data points**, **real-time auto-save**, **multi-identity support**, and **system-wide sync**.

## Key Features

### 1. Separated Input Fields ✓
Every onboarding step uses **individual, isolated input lines** for each data point:

#### Identity Information (Step 1)
- First Name
- Last Name
- Email Address
- Phone Number
- Date of Birth
- Street Address
- City
- State / Province
- Postal Code
- Country
- Preferred Communication Method

#### KYC Verification (Step 2)
- Government ID Type
- ID Number
- ID Expiration Date
- ID Document (Front)
- ID Document (Back)
- Selfie with ID
- Proof of Address

#### Platform Credentials (Step 3)
- Platform Name
- Platform URL
- Username / Login ID
- Password
- API Key (Optional)
- OAuth Token (Optional)
- 2FA Method
- Recovery Email
- Notes (Optional)

#### Autopilot Preferences (Step 4)
- Work Categories (comma-separated list)
- Risk Tolerance (Conservative/Balanced/Aggressive)
- Execution Mode (Manual/Semi-Auto/Fully Auto)
- Daily Earning Target ($)
- Max Task Value ($)
- Notification Method (Email/Push/Both/None)
- Notification Threshold (All/$10+/$25+/$50+)

#### Banking & Payout Setup (Step 5)
- Bank Name
- Account Type (Checking/Savings)
- Account Number
- Routing Number (9 digits, validated)
- Account Holder Name
- Crypto Wallet Address (Optional)
- Crypto Type (Ethereum/Bitcoin/USDC/Other)
- Payout Frequency (Daily/Weekly/Monthly)
- Minimum Payout Amount ($)

#### Confirmation (Step 6)
- Accept Terms of Service
- Enable Autopilot Immediately (Optional)

### 2. Auto-Save Progress ✓
All user inputs are **automatically persisted** in real-time:

- **Trigger**: Each field change auto-saves to `localStorage`
- **Key Format**: `onboarding_{identityId}_{fieldId}`
- **Restoration**: On page load, all saved fields are automatically restored
- **No Data Loss**: Refresh the page and resume exactly where you left off
- **No Repeated Steps**: Skip to any previously completed step

#### Implementation
```javascript
// LocalStorage auto-save in OnboardingFieldGroup.jsx
const handleChange = (e) => {
  const newValue = e.target.value;
  onChange?.(newValue);
  
  // Auto-save to localStorage
  if (identityId) {
    const key = `onboarding_${identityId}_${fieldId}`;
    localStorage.setItem(key, newValue);
  }
};

// Auto-restore on mount
useEffect(() => {
  if (identityId && !value) {
    const key = `onboarding_${identityId}_${fieldId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      onChange?.(saved);
    }
  }
}, [identityId, fieldId, value, onChange]);
```

### 3. Multi-Identity Support ✓
Each identity has **completely isolated onboarding progress**:

- **Per-Identity Progress**: Each identity maintains its own localStorage keys
- **Independent Credentials**: Each identity's credentials are stored separately
- **Unique Onboarding States**: No data sharing between identities
- **Parallel Onboarding**: Multiple identities can be onboarded simultaneously

#### Implementation
```javascript
// Each field uses identity-scoped localStorage keys
const key = `onboarding_${identityId}_${fieldId}`;

// When switching identities, old data is preserved
// When creating new identity, fresh onboarding cycle begins
```

### 4. Field-Level Validation ✓
Each input field has **independent validation**:

#### Validation Rules
- **Email**: Must match email regex pattern
- **Phone**: Must be 10+ characters of digits/hyphens/parens
- **Routing Number**: Must be exactly 9 digits
- **URL**: Must be valid HTTP/HTTPS URL
- **Crypto Address**: Supports Ethereum/Bitcoin formats
- **Custom Validators**: Per-field validation functions

#### Error Handling
- Real-time validation feedback
- Visual error state (red border + message)
- Success indicator (green checkmark)
- Contextual help text for each field

### 5. System Sync on Completion ✓
When onboarding completes, all data is synced to:

- **Identity Engine**: Profile setup and activation
- **Credential Vault**: Encrypted platform & bank credentials
- **Autopilot Engine**: Work categories and automation preferences
- **Task Reader**: Platform credentials for task execution
- **Wallet Engine**: Bank account and payout configuration
- **KYC System**: Identity verification records
- **Notification System**: User communication preferences

#### Sync Function: `onboardingSystemSync`
```javascript
// Location: functions/onboardingSystemSync
// Triggered after step 6 completion
// Syncs all onboarding_data across all modules
```

### 6. Import/Export Individual Fields ✓
Each field can be independently updated and exported:

```javascript
// All fields stored separately in localStorage
// Each field can be imported/exported individually
// Supports data migration and multi-account setup
```

## File Structure

```
components/onboarding/
├── OnboardingFieldGroup.jsx          # Reusable field with validation & auto-save
├── OnboardingStepForm.jsx            # Multi-step form manager
└── UnifiedOnboardingWizard.jsx       # Main wizard (6 steps, 50+ fields)

components/identity/
└── IdentityOnboardingWizard.jsx      # Wrapper with modal UI

functions/
└── onboardingSystemSync              # Backend sync to all modules
```

## Usage Example

```jsx
import IdentityOnboardingWizard from '@/components/identity/IdentityOnboardingWizard';

// In your component
<IdentityOnboardingWizard
  identity={newIdentity}
  onComplete={() => {
    // Refresh identity list
    qc.invalidateQueries({ queryKey: ['identities'] });
  }}
  onSkip={() => {
    // User closed wizard
    setShowOnboarding(false);
  }}
/>
```

## Auto-Save Flow

1. **User enters data** in any field
2. **OnboardingFieldGroup validates** the input
3. **localStorage updates** immediately (key: `onboarding_{identityId}_{fieldId}`)
4. **Visual feedback** shows save status
5. **On form submit**, all localStorage data is collected
6. **Backend sync** propagates to all modules
7. **Data persists** across page refreshes and browser sessions

## Data Persistence

### During Onboarding
- All field data saved to `localStorage` in real-time
- Progress tracked per identity
- Can resume at any time

### After Completion
- Data migrated from `localStorage` to entity storage
- Synced to all required modules
- Available for task execution and automation

### Data Access
```javascript
// Get saved onboarding data
const key = `onboarding_${identityId}_${fieldId}`;
const savedValue = localStorage.getItem(key);

// All fields for an identity
const allFields = {};
STEPS.forEach(step => {
  step.fields.forEach(field => {
    const key = `onboarding_${identityId}_${field.id}`;
    const val = localStorage.getItem(key);
    if (val) allFields[field.id] = val;
  });
});
```

## Validation Examples

### Email Field
```javascript
{
  id: 'email',
  label: 'Email Address',
  type: 'email',
  required: true,
  validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email'
}
```

### Routing Number
```javascript
{
  id: 'routing_number',
  label: 'Routing Number',
  type: 'text',
  required: true,
  validate: (v) => /^\d{9}$/.test(v) || 'Must be 9 digits'
}
```

### Custom Validator
```javascript
{
  id: 'daily_earning_target',
  label: 'Daily Earning Target ($)',
  type: 'number',
  required: true,
  validate: (v) => (Number(v) > 0 ? true : 'Must be > 0')
}
```

## System Sync Details

When onboarding completes, `onboardingSystemSync` function:

1. **Updates AIIdentity** with verified personal data
2. **Creates CredentialVault** entries for platform credentials
3. **Configures Autopilot** with categories and preferences
4. **Sets up Wallet** with banking information
5. **Records KYC** verification status
6. **Configures Notifications** per user preferences
7. **Activates Identity** (if requested)
8. **Logs completion** to ActivityLog

## Benefits

✅ **Clarity**: Each data point has dedicated input with clear label  
✅ **Validation**: Individual field validation with real-time feedback  
✅ **Auto-Save**: No data loss on refresh or disconnect  
✅ **Multi-Identity**: Isolated progress per identity  
✅ **System Integration**: Automatic sync to all modules  
✅ **User-Friendly**: Progress visible, can skip and resume  
✅ **Secure**: Passwords hidden, credentials encrypted  
✅ **Scalable**: Easy to add new fields or steps  

## Testing Checklist

- [ ] Create new identity and start onboarding
- [ ] Fill multiple fields and refresh page - data persists
- [ ] Navigate between steps - progress saved
- [ ] Test field validation (invalid email, phone, etc.)
- [ ] Create second identity - onboarding isolated
- [ ] Complete onboarding - all data synced to backend
- [ ] Verify credentials stored in CredentialVault
- [ ] Check KYC record created
- [ ] Confirm Autopilot preferences configured
- [ ] Validate bank account settings saved

## Migration Notes

- Old onboarding system replaced entirely
- Existing identities with `onboarding_complete: true` unaffected
- New identities require full 6-step process
- LocalStorage keys isolated per identity (no conflicts)
- All data exported to backend on completion