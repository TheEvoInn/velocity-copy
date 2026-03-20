# AI Identity Manager — Complete Reference

## Overview
The AI Identity Manager enables users to create, configure, and swap virtual identities with distinct skill sets, backstories, and communication tones for autonomous Autopilot execution and manual task handling.

---

## Core Capabilities

### 1. **Identity Creation & Management**
**Location:** `/AIIdentityStudio` (pages/AIIdentityStudio)

#### Features:
- Create unlimited AI identities with unique personas
- Search & filter identities by name or role
- Manage identities through a 5-tab dashboard:
  - **Profile**: Basic identity info, role, skills, tone
  - **Brand**: Visual & communication branding assets
  - **Accounts**: Link platform accounts to each identity
  - **Keys**: Manage encrypted credentials per identity
  - **Data**: View execution logs & performance data

#### Basic Profile Configuration (IdentityProfileBuilder):
```javascript
{
  name: string                    // Identity display name (required)
  role_label: string              // e.g. "Freelancer", "Designer", "Developer"
  email: string                   // Contact email for this persona
  phone: string                   // Phone number
  avatar_url: string              // Profile image
  tagline: string                 // Short bio (1-2 lines)
  bio: string                     // Detailed background & experience
  skills: string[]                // Expertise areas (comma-separated, auto-parsed)
  communication_tone: enum        // professional | friendly | authoritative | casual | technical | persuasive | empathetic
  email_signature: string         // Formatted email closing
  proposal_style: string          // Guidelines for writing proposals
  color: hex                      // Brand color (#10b981, etc.)
  is_active: boolean              // Enabled for autopilot execution
}
```

---

### 2. **Brand Assets & Customization**
**Location:** BrandAssetsEditor (components/identity/BrandAssetsEditor)

#### Visual Branding:
- **Color Palette**: Primary, secondary, accent colors (hex values)
- **Typography**: Primary & secondary font families (8 options)
- **Graphic Style**: 8 styles (minimalist, bold, corporate, playful, luxury, technical, artistic, modern)
- **Layout Preferences**: Custom spacing, density, and whitespace rules
- **Logo URL**: Brand asset reference

#### Written & Communication Style:
- **Formality Level**: very_formal → formal → semi_formal → casual → very_casual
- **Vocabulary Style**: simple, technical, academic, conversational, industry_specific, creative
- **Signature Phrases**: Recurring phrases defining this identity's voice
- **Industry Language**: Domain-specific jargon & terminology
- **Forbidden Phrases**: Words/phrases this identity must never use

#### Professional Identity:
- **Industry Alignment**: technology, design, marketing, finance, healthcare, legal, education, e-commerce, consulting, creative_arts, real_estate, other
- **Preferred Project Types**: short_term, long_term, one_time, recurring, agency, enterprise, startup, nonprofit
- **Certifications**: Relevant credentials (AWS, PMP, Google Analytics, etc.)
- **Key Strengths**: Core capabilities (fast turnaround, pixel-perfect design, etc.)
- **Differentiators**: Competitive advantages
- **Portfolio References**: Links to past work
- **Work History Summary**: Experience narrative

#### AI Behavioral Rules:
- **Always Do**: Hard rules the AI must always follow
- **Never Do**: Strict restrictions on AI behavior
- **Custom Persona Instructions**: Full-text prompt injected into all AI calls for this identity

---

### 3. **Identity Switching & Selection**
**Location:** IdentitySettings (components/account/IdentitySettings)

#### User-Facing Controls:
- **Active Identity Display**: Shows currently selected identity with stats
- **Identity List**: Browsable grid with:
  - Identity name & role
  - Brief bio/description
  - Top 3 skills
  - Active/inactive status
  - Quick-switch button
- **Create New Identity Button**: Direct access to studio

#### Autopilot Identity Routing:
**Location:** AutoPilot → Identity Routines tab (IdentityRoutinePanel)

- **Per-Identity Strategy Configuration**: Enable/disable specific task types per identity
- **Strategy Types**:
  - 💼 Freelance Jobs (auto-apply to matching listings)
  - ✍️ Content Creation (generate & sell AI content)
  - ⚡ Arbitrage (buy low, sell high)
  - 🎯 Lead Generation (identify & qualify leads)
  - 🔄 Digital Flip (resell digital assets & domains)
  - 🛒 Resale (physical product resells)
  - 🏆 Contests & Grants (auto-enter eligibles)

- **Active/Inactive Toggle**: Enable identity for autopilot execution
- **Real-time Stats**: Shows enabled strategies per identity

---

### 4. **Identity Routing Logic**
**Location:** Functions + IdentityRoutingPolicy entity

#### Automatic Identity Selection:
- **Category-Based Routing**: Route opportunities to best-suited identity
  - Freelance opportunities → Developer/Designer identity
  - Sales tasks → Sales Agent identity
  - Content tasks → Writer/Marketer identity
  - Contests → All-purpose identity
  - Financial tasks → Specialized financial identity (if KYC verified)

- **KYC-Aware Routing**: 
  - Financial, government, or high-value tasks require legal identity
  - Automatically selects legal identity vs. persona identities
  - Respects KYC verification status per identity

#### Manual Identity Selection:
- Users can manually assign identity to specific opportunities
- Stored in Opportunity.identity_id & TaskExecutionQueue.identity_id

---

### 5. **Credential Management Per Identity**
**Location:** CredentialKeyManager (components/identity/CredentialKeyManager)

#### Encrypted Credential Storage:
- **Platform Credentials**: Login/password for Upwork, Fiverr, etc.
- **API Keys**: Service-specific authentication
- **OAuth Tokens**: Authorized 3rd-party access
- **Session Cookies**: Browser-based authentication
- **Access Log**: Audit trail of all credential access

#### Linked Accounts:
- Associate platform accounts (Upwork, Fiverr, Freelancer, etc.) with each identity
- One identity can have multiple accounts on same platform
- Track account health, ratings, and job success rates

---

### 6. **Brand Injection into AI Outputs**
**Location:** lib/brandInjection.js + BrandAssetsEditor.buildBrandPrompt()

#### Automatic Implementation:
All AI outputs automatically receive brand context:
- **Proposals**: Formatted in identity's tone, style, vocabulary
- **Emails**: Signed with identity's email signature
- **Visuals**: Generated with identity's color palette, fonts, graphic style
- **Reports**: Branded with identity's logos, colors, layout preferences
- **Communications**: All text follows identity's rules (always/never), forbidden phrases, etc.

#### Injected Prompt Template:
```
=== IDENTITY BRAND PROFILE: [Name] ===
Role: [role_label]
Tagline: [tagline]
Bio: [bio]
Communication Tone: [communication_tone]
Skills: [skills]

PERSONA INSTRUCTIONS:
[ai_persona_instructions]

Formality: [formality_level]
Vocabulary: [vocabulary_style]
Industry: [industry_alignment]

Visual Style: [graphic_style]
Brand Colors: primary=[color], secondary=[...], accent=[...]
Typography: [font_primary] + [font_secondary]
Layout: [layout_preferences]

Signature Phrases: [phrases...]
Preferred Terms: [industry_language...]
FORBIDDEN: Never use: [forbidden_phrases...]

ALWAYS: [always_rules...]
NEVER: [never_rules...]

Credentials: [certifications...]
Strengths: [strengths...]
Differentiators: [differentiators...]
Experience: [work_history_summary]

PROPOSAL STYLE:
[proposal_style]

Email Signature:
[email_signature]

=== END BRAND PROFILE ===
```

---

### 7. **Integration Points**

#### With Autopilot Engine:
- **unifiedOrchestrator** function receives active identity
- Tasks automatically matched to best identity based on category
- Identity.is_active determines eligibility for autopilot execution
- Identity.auto_select_for_task_types filters which strategies run

#### With Task Execution:
- TaskExecutionQueue stores identity_id & identity_name
- All form filling, proposals, communications use identity's brand assets
- Retry logic preserves identity association
- Success/failure rates tracked per identity

#### With Opportunity Engine:
- Opportunity.identity_id pre-assigned or auto-routed
- Opportunities filtered by identity's auto_select_for_task_types
- Deadline & value routing respects identity's preferred categories

---

## User Workflows

### Creating a New Identity
1. Go to `/AIIdentityStudio`
2. Click "New Identity"
3. Fill in basic profile (name, role, skills, tone, bio)
4. Click "Create Identity"
5. Configure brand assets (optional but recommended)
6. Link platform accounts
7. Enable strategies in Autopilot → Identity Routines

### Switching Active Identity
**Option A — Quick Switch:**
1. Go to Control Hub → Identity Settings tab
2. Click on desired identity card
3. Switched immediately

**Option B — Full Configuration:**
1. Go to `/AIIdentityStudio`
2. Select identity from sidebar
3. Edit any tab
4. Identity becomes active for future tasks

### Configuring Autopilot Per Identity
1. Go to `/AutoPilot`
2. Click "Identity Routines" tab
3. Expand desired identity
4. Toggle strategy types (Freelance, Content, Arbitrage, etc.)
5. Changes apply immediately

### Testing Identity Brand Output
1. In `/AIIdentityStudio` → Brand tab
2. Scroll to "Preview: Brand injection context..."
3. Expand details to see full prompt that will be injected
4. Verify tone, rules, and instructions are correct

---

## Entity Schema Reference

### AIIdentity
```javascript
{
  id: string                              // Auto-generated
  name: string                            // Persona name (required)
  role_label: string                      // Role type
  is_active: boolean                      // Eligible for autopilot
  email: string                           // Contact email
  phone: string                           // Phone
  avatar_url: string                      // Profile image
  tagline: string                         // Short bio
  bio: string                             // Full background
  communication_tone: enum                // Voice style
  email_signature: string                 // Email closing
  proposal_style: string                  // Writing guidelines
  skills: string[]                        // Expertise list
  preferred_platforms: string[]           // Preferred job platforms
  preferred_categories: string[]          // Preferred opportunity categories
  linked_account_ids: string[]            // Associated platform accounts
  auto_select_for_task_types: string[]    // Enabled autopilot strategies
  color: string                           // Brand color (hex)
  icon: string                            // Emoji or icon
  tasks_executed: number                  // Career stats
  total_earned: number                    // Career earnings
  brand_assets: {
    primary_color: string
    secondary_color: string
    accent_color: string
    font_primary: string
    font_secondary: string
    graphic_style: string[]
    layout_preferences: string
    logo_url: string
    formality_level: enum
    vocabulary_style: string[]
    signature_phrases: string[]
    writing_rules: string[]
    industry_language: string[]
    forbidden_phrases: string[]
    always_rules: string[]
    never_rules: string[]
    ai_persona_instructions: string
    industry_alignment: string[]
    certifications: string[]
    portfolio_references: string[]
    work_history_summary: string
    preferred_project_types: string[]
    strengths: string[]
    differentiators: string[]
  }
  notes: string
  created_date: ISO8601
  created_by: email
}
```

---

## Advanced Features

### Identity Performance Tracking
- **tasks_executed**: Total autonomous tasks completed
- **total_earned**: Revenue generated by this identity
- **success_rate**: Computed from completed vs. failed tasks
- **linked_accounts**: Associated Upwork, Fiverr profiles, etc.

### Identity Cloning
- Duplicate an identity as a starting point
- Modify copy without affecting original
- Useful for creating role variations

### Batch Identity Operations
- Create multiple identities for different roles
- Each identity can have different KYC verification status
- Autopilot intelligently routes tasks based on requirements

### Identity Conflict Resolution
- If multiple identities match an opportunity, select highest:
  1. Success rate on that platform
  2. Enabled autopilot strategies
  3. KYC verification status
  4. Availability (not at daily limit)

---

## Security & Compliance

### Credential Encryption
- All stored credentials use AES-256-GCM encryption
- Decrypted only when executing tasks
- Access logged for audit trail

### Identity Separation
- Each identity has isolated credential set
- Platform accounts linked per identity
- No credential sharing between identities

### KYC-Aware Routing
- Financial tasks routed only to KYC-verified identities
- Government opportunities route to legal identity only
- Respects compliance & regulatory requirements

---

## Support & Troubleshooting

### Identity Not Appearing in Autopilot
- Confirm `is_active: true`
- Confirm at least one strategy is enabled
- Check UserGoals.autopilot_enabled is true

### Brand Assets Not Applied
- Verify brand_assets are saved (check Brand tab preview)
- Check ai_persona_instructions are populated
- Verify identity is assigned to task

### Tasks Assigning to Wrong Identity
- Check IdentityRoutingPolicy rules
- Verify opportunity category matches identity.preferred_categories
- Check linked account availability on platform

---

## Summary
The AI Identity Manager is a complete, production-ready system for creating, configuring, and autonomously deploying multiple distinct AI personas. Each identity operates independently with its own credentials, brand rules, communication style, and execution strategies, enabling sophisticated multi-persona automation for diverse task types.