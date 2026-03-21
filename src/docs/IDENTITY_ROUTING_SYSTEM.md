# Intelligent Identity Routing System

## Overview

The Intelligent Identity Routing System automatically selects the most appropriate AI identity for each task based on comprehensive analysis of:

- **Skill Matching** - Compares identity skills with opportunity requirements
- **Platform Experience** - Evaluates past performance on specific platforms
- **Account Health** - Assesses linked account status and availability
- **KYC Requirements** - Automatically routes legal identity when needed
- **Performance History** - Prioritizes high-success identities
- **Custom Policies** - Applies user-defined routing rules

## Architecture

### Core Components

#### 1. **Intelligent Identity Router** (`functions/intelligentIdentityRouter`)
- **recommend_identity** - Analyzes opportunity and returns best identity with fit score (0-100)
- **evaluate_identity_fit** - Detailed breakdown of identity suitability metrics
- **get_routing_policies** - Retrieves user's custom routing rules
- **create_routing_policy** - Defines category/platform-specific routing logic
- **switch_and_queue** - Switches to identity and creates task queue entry

#### 2. **UI Components**

##### IntelligentIdentityRouter Component
- Real-time opportunity analysis
- Recommendation display with fit score
- Alternative identity suggestions
- Detailed evaluation modal
- One-click task queueing

##### IdentityRoutingPolicyBuilder Component
- Create/edit routing rules by category/platform
- Configure KYC requirements per opportunity type
- Set identity type preference (auto, persona, legal)
- Manage rule priority and enabled status

##### AutopilotIdentitySelector Component
- Process queue of opportunities
- Auto-recommend identity for each task
- Batch queue with optimal identities
- Progress tracking and status updates
- Integration with autopilot execution

### Data Models

#### IdentityRoutingPolicy Entity
```json
{
  "rule_name": "High-value grants require KYC",
  "category": "grant",
  "platform": "grants.gov",
  "requires_kyc": true,
  "kyc_reason": "grant_application",
  "identity_type": "auto_detect",
  "priority": 80
}
```

#### IdentityRoutingLog Entity
```json
{
  "opportunity_id": "opp_123",
  "identity_used": "persona|legal",
  "identity_name": "Alex Developer",
  "routing_reason": "High skill match + platform experience",
  "required_kyc": false,
  "kyc_verified": true,
  "auto_detected": true,
  "status": "executed"
}
```

## Scoring Algorithm

The router calculates identity fit on a 0-100 scale:

```
Fit Score = (SkillMatch × 0.25) + 
            (PlatformXP × 0.30) + 
            (Performance × 0.25) + 
            (AccountHealth × 0.15) +
            (KYCClearance × 0.05)

Grade: A (80+), B (70+), C (60+), D (<60)
```

## Integration Points

### 1. **Execution Department**
- AutopilotIdentitySelector in `/Execution` page
- Processes queued opportunities
- Auto-queues with optimal identities
- Real-time progress updates

### 2. **Discovery Department**
- Available via `IntelligentIdentityRouter` component
- Can be embedded in opportunity review panels
- Supports manual testing and evaluation

### 3. **Control Department**
- IdentityRoutingPolicyBuilder in `/IdentityManager`
- Manage routing rules
- Configure per-category/platform logic

### 4. **Autopilot Cycle**
- Called during `opportunityAutoWorkflow`
- Automatically selects identity before task creation
- Logs routing decision to audit trail

## Usage Examples

### Backend Function Call
```javascript
const res = await base44.functions.invoke('intelligentIdentityRouter', {
  action: 'recommend_identity',
  opportunity: {
    id: 'opp_123',
    title: 'Write Technical Blog Post',
    category: 'service',
    platform: 'upwork',
    profit_estimate_high: 500
  }
});

// Returns:
{
  recommended_identity_id: 'id_789',
  recommended_identity: { name: 'Alex Developer', ... },
  fit_score: 85,
  routing_reason: { ... },
  alternatives: [ ... ]
}
```

### React Component Integration
```jsx
<IntelligentIdentityRouter 
  opportunity={selectedOpportunity}
  onIdentitySelected={(identity) => {
    // Handle identity selection
  }}
/>
```

### Batch Processing
```jsx
<AutopilotIdentitySelector 
  opportunities={newOpportunities}
  autoExecute={true}
  onTasksQueued={(count) => {
    console.log(`Queued ${count} tasks`);
  }}
/>
```

## Key Features

### ✓ Automatic Identity Selection
- No manual routing needed
- Intelligent best-match algorithm
- Configurable by category/platform

### ✓ Custom Routing Policies
- Define rules by opportunity type
- Configure KYC requirements
- Set identity type preferences
- Manage rule priority

### ✓ Performance-Based Routing
- Tracks success rate per platform
- Prioritizes high-performing identities
- Avoids struggling identities

### ✓ KYC-Aware Routing
- Automatically detects KYC requirements
- Routes legal identity when needed
- Prevents unauthorized submissions

### ✓ Fallback Support
- Alternative identities suggested
- Handles missing or unhealthy accounts
- Graceful degradation

### ✓ Full Audit Trail
- Log every routing decision
- Track which identity used for each task
- Understand why identity was selected

## Configuration

### Enable in Autopilot
User can enable intelligent routing in autopilot settings:
- Toggle: `autopilot_enabled`
- Set default target: `ai_daily_target`
- Configure max concurrent: `max_concurrent_tasks`

### Create Routing Policies
1. Go to Identity Manager → Intelligent Identity Router
2. Click "New Rule"
3. Set category, platform, KYC requirements
4. Configure identity type preference
5. Save and enable

## Metrics & Monitoring

Track router effectiveness:
- Success rate by identity
- Platform-specific performance
- KYC handling accuracy
- Policy compliance rate
- Average fit scores

## Future Enhancements

- Machine learning-based score refinement
- Historical performance weight adjustment
- Dynamic policy suggestions
- A/B testing framework
- Cross-platform identity pooling

## Troubleshooting

### "No identities available"
- Create at least one identity in Identity Manager
- Ensure identity is not deleted

### Low fit scores
- Update identity skills to match opportunities
- Link more accounts to identity
- Complete more successful tasks with identity

### Wrong identity selected
- Review and adjust routing policies
- Check identity skill tags
- Verify account health status

## Security Notes

- Identity credentials encrypted in vault
- Routing decisions logged for audit
- KYC verification always validated
- No credentials exposed in frontend
- All decisions made server-side

---

**Version**: 1.0
**Last Updated**: 2026-03-21
**Status**: Production Ready