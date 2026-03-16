# KYC (Know Your Customer) System - Comprehensive Guide

## Overview

The KYC (Know Your Customer) system enables the Profit Engine to operate legally and autonomously by securely managing verified legal identity information separate from persona identities. This ensures compliance with financial regulations while maintaining privacy and operational efficiency.

## System Architecture

### 1. Core Components

#### KYCVerification Entity
Stores encrypted verified legal identity information:
- Full legal name, date of birth, residential address
- Government-issued ID (encrypted storage)
- Phone number, verified email
- Tax ID / SSN (encrypted)
- Supporting documents (utility bills, bank statements)
- Verification status and results
- Access logs for compliance auditing

#### IdentityRoutingPolicy Entity
Defines rules for determining which identity type to use:
- Category-based routing (financial, grant, contest, etc.)
- Platform-specific rules (Stripe, Grant.gov, IRS, etc.)
- Keyword matching in opportunity descriptions
- Minimum payout thresholds for KYC requirements
- KYC reason classification (financial, tax, government, prize)

#### IdentityRoutingLog Entity
Audits every identity usage decision:
- Which identity was selected for each task
- Why the identity was selected
- Whether KYC was required/available
- Task status and outcomes
- Access timestamps for compliance

### 2. Encryption & Security

All sensitive data is encrypted:
- **At Rest**: AES-256 encryption for stored KYC data
- **In Transit**: HTTPS/TLS for all data transfer
- **Access Control**: Only authorized modules can access KYC data
- **Audit Logging**: Every access is logged with timestamp and purpose
- **Encryption Keys**: Managed separately and rotated regularly

### 3. Identity Separation

#### Persona Identity (Default)
Used for everyday tasks that don't require legal verification:
- Freelance job applications
- Marketplace accounts (eBay, Etsy)
- Contest entries (non-prize)
- Social profiles and creator accounts
- General applications
- Can be multiple instances (Student, Professional, Creator, etc.)

#### Legal Identity (KYC Mode)
Used only when legally required:
- Financial account creation (Stripe, PayPal)
- Payment onboarding and payouts
- Prize claiming
- Grant applications
- Tax form submission
- Government portal access
- Cannot be changed once verified

## User Workflow

### Step 1: KYC Submission

User navigates to **Legal Identity (KYC)** section and submits:

1. **Personal Information**
   - Full legal name (as on government ID)
   - Date of birth
   - Residential address with city, state, postal code

2. **Contact & ID Details**
   - Phone number
   - Verified email
   - Government ID type (passport, driver's license, etc.)
   - ID expiry date
   - ID number (encrypted)
   - Tax ID / SSN (optional, encrypted)

3. **Document Upload**
   - ID document front (encrypted image)
   - ID document back (encrypted image)
   - Selfie for face matching (encrypted image)
   - Supporting documents (utility bills, bank statements)

4. **Review & Submit**
   - Verify all information is accurate
   - Acknowledge legal terms
   - Submit for automated verification

### Step 2: Automated Verification Pipeline

The system automatically:

1. **Validates Document Authenticity**
   - Checks ID document format and security features
   - Detects tampering or forgery
   - Verifies document expiry
   - Returns: authentic/tampered status

2. **Performs Face Matching**
   - Compares selfie with ID photo
   - Generates confidence score (0-100%)
   - Flags mismatches for manual review
   - Returns: matched/not-matched with score

3. **Confirms Data Consistency**
   - Verifies name matches across documents
   - Checks address against residential address
   - Validates DOB consistency
   - Returns: consistent/discrepancies

4. **Stores Verification Results**
   - Updates KYC status (pending → submitted → under_review → verified → approved)
   - Stores all verification checks
   - Flags any discrepancies
   - Records timestamp and method

### Step 3: User Approval

Before Autopilot can use the legal identity:

1. User reviews KYC status and verification results
2. User explicitly approves for Autopilot usage
3. User selects which modules may access KYC (financial, tax, government, etc.)
4. Access is logged and compliance audit trail begins

## Identity Routing Engine

### Automatic Detection Logic

When the Autopilot encounters a task:

```
1. Analyze opportunity/task
   - Category (freelance, financial, grant, etc.)
   - Platform (upwork, stripe, grant.gov, etc.)
   - Keywords in description
   - Estimated value/payout

2. Check routing policies (priority order)
   - Category-specific rules
   - Platform-specific rules
   - Keyword matches
   - Minimum payout thresholds

3. Determine if KYC is required
   - Financial onboarding → Legal (required)
   - Payment payout > $500 → Legal (required)
   - Prize claim > $600 → Legal (required)
   - Grant application → Legal (required)
   - Tax form submission → Legal (required)
   - Government portal → Legal (required)
   - Freelance job → Persona (default)
   - Marketplace listing → Persona (default)

4. Select identity
   - If KYC required AND KYC approved → Use Legal Identity
   - If KYC required BUT KYC not approved → BLOCK task
   - If KYC not required → Use Active Persona

5. Log the decision
   - Record which identity was selected
   - Record why (routing policy match)
   - Record whether KYC was required
   - Record task execution outcome
```

### Routing Rules (Default Configuration)

| Rule | Category | Requires KYC | Reason | Priority |
|------|----------|--------------|--------|----------|
| Financial Onboarding | Financial | Yes | financial_onboarding | 100 |
| Government Compliance | Government | Yes | government_compliance | 95 |
| Payment Payout | General | Yes (>$500) | payment_payout | 95 |
| Prize Claiming | Contest | Yes (>$600) | prize_claiming | 90 |
| Grant Applications | Grant | Yes | grant_application | 90 |
| Tax Form Submission | General | Yes | tax_compliance | 85 |
| Freelance Services | Freelance | No | persona_identity | 50 |
| Contest Entries | Contest | No | persona_identity | 40 |
| Marketplace & Resale | Resale | No | persona_identity | 30 |
| Arbitrage & Market | Arbitrage | No | persona_identity | 20 |

### Runtime Routing Examples

**Example 1: Upwork Freelance Job**
```
Task: Apply for $3,000 freelance writing job on Upwork
→ Category: freelance
→ Platform: upwork
→ Check policies: "Freelance Services (Persona)" matches
→ Result: Use Active Persona
→ Proceeding with persona identity
```

**Example 2: Stripe Account Setup**
```
Task: Create Stripe account for payment processing
→ Category: financial
→ Platform: stripe
→ Check policies: "Financial Onboarding" matches (requires KYC)
→ KYC status: approved ✓
→ Result: Use Legal Identity
→ Switch to legal identity, auto-fill verified data, complete onboarding
```

**Example 3: Prize Claim ($1,200)**
```
Task: Claim $1,200 prize from contest
→ Category: contest
→ Estimated value: $1,200 > $600 threshold
→ Check policies: "Prize Claiming" matches (requires KYC)
→ KYC status: verified but not approved by user ✗
→ Result: BLOCK - cannot proceed
→ Message: "Prize claim requires approved KYC. Complete approval in Legal Identity section."
```

## Autopilot Integration

### Autopilot Behavior with KYC

The unified Autopilot:

1. **Automatically Detects KYC Requirements**
   ```javascript
   // When processing opportunity
   const identity = await routing.getIdentityForOpportunity(opportunity);
   
   if (identity.requires_kyc && !identity.kyc_approved) {
     // Block execution
     return { error: 'KYC verification required', can_proceed: false };
   }
   ```

2. **Switches Identity Transparently**
   ```javascript
   // Switch to legal identity for financial task
   await autopilot.routing.switchIdentity('legal');
   
   // Access verified KYC data
   const verified_data = await getKYCData();
   
   // Auto-fill forms with legal identity
   await fillFinancialForms(verified_data);
   ```

3. **Auto-Fills KYC Forms**
   - Full legal name (verified)
   - Residential address (verified)
   - ID documents (uploaded)
   - Tax ID (if available)
   - All form fields populated automatically

4. **Maintains Compliance**
   - Logs every KYC identity switch
   - Records which module accessed KYC data
   - Tracks task execution and outcomes
   - Generates audit trail for compliance

5. **Respects User Permissions**
   - Cannot use KYC without explicit approval
   - Can only use KYC for approved modules
   - Respects user deletion/revocation requests
   - Honors allowed_modules whitelist

## User Control & Permissions

### User Dashboard (KYC Management)

Users can:
- View KYC verification status
- See verification test results (face match, authenticity, consistency)
- View recent access logs
- Review active routing policies
- Monitor identity usage history
- Approve/deny Autopilot access
- Revoke access at any time
- Update documents if expired
- Delete all KYC data

### Approval Workflow

```
1. KYC Submitted
   Status: pending

2. Automated Verification (24-48 hours)
   Status: under_review
   Tests: Face match, authenticity, consistency

3. Verification Complete
   Status: verified
   User must approve for Autopilot

4. User Approves
   Status: approved
   Autopilot can now use legal identity

5. Automatic Expiration (yearly renewal)
   Status: expired
   User must resubmit
```

## Wallet & Payout Integration

The KYC system integrates with wallet/payout engine:

### Financial Payout Workflow

```
1. User earns money from task
2. Payout generated
3. Check if identity-verified payout required
   - High-value payout (>$1000) → Requires KYC
   - Financial platform payout → Requires KYC
   - Tax withholding required → Requires KYC

4. If KYC required:
   - Check KYC status
   - If approved: Auto-fill tax forms, process payout
   - If not approved: Hold payout, notify user

5. Tax form generation
   - 1099 form (if not employee)
   - Tax withholding calculation
   - Auto-submitted if available

6. Prize claim processing
   - ID verification
   - Age verification (if required)
   - Automatic claim submission
   - Payout routing to verified bank account

7. Grant onboarding
   - Identity verification
   - Address verification
   - Tax ID matching
   - Grant funding disbursement
```

## Compliance & Auditing

### Compliance Features

1. **Automated KYC Verification**
   - Uses industry-standard document verification
   - Face biometric matching
   - Liveness detection (optional)
   - Document authenticity checks

2. **Data Protection**
   - Encryption at rest and in transit
   - Separate encryption keys per user
   - Automatic key rotation
   - Secure credential deletion

3. **Access Auditing**
   - Every access logged with:
     - Timestamp
     - Accessing module/function
     - Purpose (why accessed)
     - Task ID (what task used it)
   - Immutable audit trail
   - Retention: indefinite

4. **Compliance Reporting**
   - User can view all access logs
   - Download audit trail
   - Verify no unauthorized access
   - Confirm module permissions

### Data Retention & Deletion

- **Retention**: KYC data retained for 7 years (IRS requirement for tax compliance)
- **User Deletion**: User can delete all KYC data at any time
  - Deletes encrypted KYC records
  - Maintains audit logs (for compliance)
  - Prevents future legal identity usage
  - Autopilot tasks requiring KYC will be blocked

## Best Practices

### For Users

1. **Keep KYC Updated**
   - Verify documents haven't expired
   - Update address if you move
   - Resubmit if marked as expired

2. **Selective Approval**
   - Approve only needed modules
   - Revoke access to unused modules
   - Review access logs regularly

3. **Separate Identities**
   - Don't use legal identity for non-required tasks
   - Keep personas for everyday tasks
   - Preserve legal identity privacy

4. **Monitor Automation**
   - Review routing logs
   - Confirm correct identity used
   - Alert if unusual access patterns

### For Operators

1. **Update Routing Policies**
   - Add new platforms as needed
   - Adjust KYC thresholds based on experience
   - Add category-specific rules

2. **Monitor Compliance**
   - Regular audit log review
   - Verify all KYC usage appropriate
   - Track rejection rates

3. **User Support**
   - Help with document re-submission
   - Explain routing decisions
   - Resolve access issues

## Troubleshooting

### Common Issues

**Issue**: KYC submission rejected
- **Solution**: Check rejection reason, correct discrepancies, resubmit

**Issue**: Task blocked due to missing KYC
- **Solution**: Complete KYC approval in Legal Identity section

**Issue**: Legal identity not switching
- **Solution**: Verify KYC is approved and module is whitelisted

**Issue**: Face match failed
- **Solution**: Resubmit clearer selfie, ensure good lighting

## Technical Details

### Database Schema

See KYCVerification, IdentityRoutingPolicy, IdentityRoutingLog entities.

### API Endpoints

- `POST /functions/identityRoutingEngine` - Routing detection & logging
- `GET /KYCManagement` - User dashboard
- `POST /functions/initializeKYCSystem` - Setup default policies

### Configuration

Default policies loaded at initialization. Customize in IdentityRoutingPolicy entity.

## Final Outcome

After KYC system implementation, the Profit Engine becomes:

✓ **Legally Compliant**: Can handle financial accounts, tax forms, government portals  
✓ **Privacy-Preserving**: Legal identity separate from personas  
✓ **Fully Autonomous**: AI automatically routes to correct identity  
✓ **Audit-Transparent**: All KYC usage logged and reviewable  
✓ **User-Controlled**: Explicit approval required, can revoke anytime  
✓ **Profit-Maximizing**: No opportunities blocked by missing identity  

This creates a legally capable, identity-aware, fully autonomous profit engine.