# Centralized Notification Center Integration Guide

## Overview
A real-time notification system that alerts users when:
- Auto-execute rules trigger
- Account verification steps are required
- Critical errors occur during onboarding

## Components

### Backend Functions
- `notificationCenter.js` - Main notification hub with CRUD operations
- `autoExecuteRuleMonitor.js` - Monitors rule execution and sends notifications

### Frontend
- `NotificationBell.jsx` - Dropdown bell icon with unread count
- `NotificationsCenter.jsx` - Full notification center page
- `useNotifications.js` - React hook for notification management
- `notificationService.js` - Service layer for API communication

## Usage

### 1. Notify Rule Triggered (Auto-Execute)
```javascript
import NotificationService from '@/services/notificationService';

await NotificationService.notifyRuleTriggered(
  'rule-123',
  'High Velocity Arbitrage',
  'opp-456',
  'Amazon Resale Opportunity',
  'pending'
);
```

### 2. Notify Verification Required
```javascript
await NotificationService.notifyVerificationRequired(
  'account-789',
  'upwork',
  'email_verification',
  [
    'Verify email address',
    'Complete identity check',
    'Add phone number'
  ]
);
```

### 3. Notify Onboarding Error
```javascript
await NotificationService.notifyOnboardingError(
  'account-789',
  'fiverr',
  'gigs_setup',
  'Failed to create gig: Profile incomplete',
  'profile_error',
  'Complete your profile and try again'
);
```

### 4. Custom Notification
```javascript
await NotificationService.createNotification(
  'Custom Title',
  'Detailed message',
  'user_action_required',
  'warning',
  'SomeEntity',
  'entity-id-123',
  'user_input_required',
  { customData: 'value' }
);
```

## Integration Points

### In Account Creation Engine
```javascript
// After onboarding step completion
await base44.asServiceRole.entities.Notification.create({
  type: 'user_action_required',
  severity: 'info',
  title: `${platform} Setup Progress`,
  message: `Step completed. ${stepsRemaining} step(s) remaining.`,
  related_entity_type: 'LinkedAccountCreation',
  related_entity_id: account_id
});
```

### In Auto-Execute Rules
```javascript
// When rule triggers
await base44.functions.invoke('autoExecuteRuleMonitor', {
  action: 'notify_rule_triggered',
  rule_id: rule.id,
  rule_name: rule.rule_name,
  opportunity_id: opp.id,
  opportunity_title: opp.title,
  execution_status: 'processing'
});
```

## Notification Types
- `autopilot_execution` - Rule triggered/completed
- `user_action_required` - Verification steps needed
- `compliance_alert` - Onboarding errors, account activated
- `system_alert` - System-level events
- `opportunity_alert` - Opportunity updates
- `integration_alert` - Integration failures

## Severity Levels
- `info` - Informational (priority: 25)
- `warning` - Warning (priority: 50)
- `urgent` - Urgent action needed (priority: 75)
- `critical` - Critical errors (priority: 100)

## Real-time Features
- Auto-refresh every 30 seconds for unread notifications
- Unread badge counter
- Severity-based color coding
- Quick dismiss/mark-as-read actions
- Filter by severity level
- Bulk dismiss by type

## Database Integration
Uses existing `Notification` entity with full audit trail:
- Timestamps (created, read, dismissed)
- Source module tracking
- Related entity links
- Action metadata
- Delivery channels (in_app, email)