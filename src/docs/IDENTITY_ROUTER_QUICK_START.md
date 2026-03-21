# Identity Router - Quick Start Guide

## 3-Minute Setup

### Step 1: Create Your First Identity
1. Go to **Control Hub → Identity Manager**
2. Click **"New Identity"**
3. Fill in: Name, Role (Freelancer/Designer/etc), Communication Tone
4. Click **Create**

### Step 2: Configure Routing Policies (Optional)
1. Scroll to **"Intelligent Identity Router"** section
2. Click **"New Rule"** 
3. Set up rules like:
   - **High-value grants** → Use Legal Identity (requires KYC)
   - **Freelance jobs** → Use Persona Identity
   - **Contests** → Auto-detect best match

### Step 3: Enable in Autopilot
1. Go to **Execution → Autopilot Panel**
2. Toggle **"Enable Autopilot"**
3. System will automatically use best identity for each task

---

## How It Works

```
Discovery finds opportunity
         ↓
Intelligent Router analyzes
         ↓
Recommends best identity (scores 0-100)
         ↓
Evaluates:
  • Skills match
  • Platform experience
  • Account health
  • KYC requirements
  • Past performance
         ↓
Routes to task queue with selected identity
         ↓
Task executes using that identity
```

---

## Features at a Glance

| Feature | What It Does |
|---------|--------------|
| **Fit Score** | 0-100 rating of identity suitability (A=80+, B=70+, C=60+) |
| **Auto Routing** | Automatically selects best identity in autopilot |
| **Routing Policies** | Custom rules by category/platform (grants, freelance, contests, etc.) |
| **KYC Handling** | Automatically detects if legal identity needed |
| **Performance Tracking** | Prioritizes identities with high success rates |
| **Alternatives** | Suggests backup identities if best one unavailable |
| **Audit Log** | Track which identity was used for each task |

---

## Common Tasks

### "I want to use one identity for grants only"
1. Go to **Identity Manager → Intelligent Identity Router**
2. Click **"New Rule"**
3. Set Category: `grant`, Identity Type: `legal`
4. Save

### "I want to see why an identity was chosen"
1. Go to **Execution → Task Queue**
2. Click on task, view **"Routing Reason"**
3. Check **"Why this identity?"** section

### "I want to test identity selection manually"
1. Go to **Execution → Autopilot Identity Selector**
2. Select opportunity from list
3. Click **"Evaluate"** to see detailed breakdown
4. Click **"Use & Queue"** to queue task with that identity

### "An identity keeps getting low scores"
1. Go to **Identity Manager → [Your Identity]**
2. Click **Edit**
3. Add/update skills matching the opportunities
4. Link more accounts (Platform-specific)
5. Complete more tasks to build history

---

## Performance Grades

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 80-100 | Excellent fit - highest priority |
| **B** | 70-79 | Good fit - use when A unavailable |
| **C** | 60-69 | Acceptable - fallback option |
| **D** | <60 | Poor fit - avoid |

---

## What Each Score Component Means

- **Skill Match** (25%) - How many identity skills match opportunity
- **Platform Xp** (30%) - Past success rate on this platform
- **Performance** (25%) - Overall task completion rate
- **Account Health** (15%) - Linked account status
- **KYC Clearance** (5%) - Legal identity available if needed

---

## Troubleshooting

**Q: "No identities available"**
- A: Create at least one identity first (Identity Manager → New Identity)

**Q: "Low scores for my identity"**
- A: Update skills, link accounts, complete more tasks

**Q: "Wrong identity was chosen"**
- A: Check routing policies, verify KYC status, review scoring factors

**Q: "Identity marked as 'needs repair'"**
- A: Account may be banned/suspended. Create new account or deactivate identity

---

## Pro Tips

1. **Create role-specific identities** - Designer, Writer, Developer, Marketer
2. **Link multiple accounts per platform** - Rotate them for better rates
3. **Keep skills updated** - Router matches against opportunity keywords
4. **Monitor performance** - Check audit logs to see what's working
5. **Use routing policies** - Define exact rules for your workflow

---

## Dashboard Locations

| Task | Where to Go |
|------|------------|
| Create identity | **Control Hub → Identity Manager** |
| Set routing rules | **Control Hub → Identity Manager → Intelligent Identity Router** |
| Auto-route tasks | **Execution → Autopilot Identity Selector** |
| View audit trail | **Control Hub → Identity Manager → [Identity] → Audit Log** |
| Test router manually | **Execution → Autopilot Identity Selector → Evaluate** |

---

## Need Help?

- Check **System Documentation** for detailed info
- View **Identity Audit Logs** to understand routing decisions
- Review **Routing Policies** to verify rules are set up correctly
- Test identities manually in **Autopilot Identity Selector**

---

**Happy automating! 🚀**