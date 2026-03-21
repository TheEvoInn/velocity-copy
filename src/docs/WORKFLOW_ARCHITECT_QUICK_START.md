# Workflow Architect - Quick Start

## 🚀 Getting Started in 5 Minutes

### Step 1: Access Workflow Architect
Navigate to `/WorkflowArchitect` from the main menu or click the "Workflow Architect" link in the Command Center.

### Step 2: Create Your First Workflow
1. Click **"Create Workflow"** button
2. Your visual editor opens with a blank canvas
3. The **Node Library** on the right shows all available nodes

### Step 3: Build Your Workflow

**Add a Trigger Node:**
- Click **"Triggers"** in the Node Library
- Click **"Manual Start"** or **"On Schedule"**
- Node appears on canvas

**Add an Action Node:**
- Click **"Autopilot"** in the Node Library
- Click **"Start Execution"** or any other action
- Node appears on canvas

**Connect Nodes:**
- Click and hold the **output dot** (right side of trigger node)
- Drag to the **input dot** (left side of action node)
- Connection line appears
- You can add a condition to the connection if needed

**Add Conditions:**
- Click **"Conditions"** in the Node Library
- Add **IF**, **AND**, or **OR** nodes between other nodes
- Conditions evaluate based on previous node results

### Step 4: Configure Nodes

**Select a Node:**
- Click any node on the canvas
- Properties appear in the right panel
- Edit the configuration

### Step 5: Validate Your Workflow

1. Click the **"Validate"** button (top right)
2. Any errors appear in the validation panel
3. Common errors:
   - Isolated nodes (not connected)
   - Circular dependencies
   - Missing triggers

### Step 6: Test in Simulation Mode

1. Click **"Simulate"** button
2. Click **"Run"** to execute the workflow
3. Watch execution logs update in real-time
4. See which nodes succeeded/failed
5. Verify logic before activating

### Step 7: Save Your Workflow

1. Click **"Save Workflow"** (top right)
2. Workflow is stored with current status
3. You can edit, delete, or run it anytime

## 📊 Common Workflows

### Workflow 1: Auto-Execute High-Profit Opportunities
```
Manual Start
    ↓
IF opportunity.profit > $500
    ↓
Autopilot: Apply to Job
    ↓
Send Notification
```

### Workflow 2: Smart Capital Allocation
```
On Earnings
    ↓
IF wallet_balance > $1000
    ↓
NED: Stake Tokens
    ↓
Update Dashboard
```

### Workflow 3: Funnel Optimization Loop
```
On Schedule (hourly)
    ↓
VIPZ: Get Conversion Data
    ↓
IF conversion_rate < 2%
    ↓
VIPZ: Optimize Funnel
    ↓
Log Event
```

### Workflow 4: Multi-Department Arbitrage
```
NED: Detect Arbitrage
    ↓
IF spread > 5%
    ↓
Autopilot: Allocate Funds
    ↓
NED: Execute Trade
    ↓
AND wallet_update_success
    ↓
Send Alert
```

## 🔍 Deep Space Mode

### Access Deep Space
1. Go to Command Center (Dashboard)
2. Hover over any planet (Autopilot, NED, VIPZ, Discovery)
3. Click the planet to enter **Deep Space mode**
4. You now see the real-time "engine room" of that department

### What You See in Deep Space

**Execution Logs Tab:**
- Real-time workflow events
- Task execution details
- Error messages
- System status updates

**API Throughput Tab:**
- Live API call rates
- Response times
- Error rates
- Rate limit status

**Micro Transactions Tab:**
- All earnings/spend
- Crypto staking rewards
- Landing page conversions
- Task completion payouts

**Department Metrics Tab:**
- Department-specific dashboards
- Custom visualizations
- Real-time KPIs

### Example Deep Space Views

**Autopilot Deep Space:**
- Task queue: 24 queued, 8 running, 324 completed, 3 failed
- Execution timeline: Initialize → Validate → Execute → Finalize
- Identity routing map: Which identities are active

**NED Deep Space:**
- Mining yield curve (24-hour performance)
- Active stakes (ETH 3.2% APY, SOL 4.5% APY)
- Staking rewards: $3.45/day from ETH, $2.10/day from SOL

**VIPZ Deep Space:**
- Funnel: 8,420 visitors → 1,240 leads (14.7%) → 87 customers (7%)
- Sales today: $2.1K | This week: $14.5K | This month: $67.3K

**Discovery Deep Space:**
- Opportunities found today: 340
- Total in database: 2,847
- Average profit per opportunity: $127
- Success rate: 84%

## ⚡ Quick Tips

1. **Start Simple** - Create a 2-3 node workflow first
2. **Test Always** - Use simulation mode before activating
3. **Monitor Execution** - Check Deep Space logs for issues
4. **Version Control** - Each save creates a backup version
5. **Use Conditions** - They prevent wasted execution on bad data
6. **Cross-Department** - Workflows are most powerful with multiple departments
7. **Automation** - Set triggers to "On Schedule" for hands-off execution

## 🛡️ Safety

- All workflows are validated before execution
- Identity Studio permissions are enforced
- Sensitive data (credentials, keys) never exposed
- Each execution is logged with timestamp and user
- You can pause/delete workflows anytime

## 📈 Monitoring Your Workflows

After activation, monitor in the workflow list:
- **Total runs** - How many times executed
- **Success rate** - Percentage of successful executions
- **Last run** - When did it last execute

Click workflow to see:
- Detailed execution history
- Error logs
- Performance metrics

## 🎯 Next Steps

1. ✅ Create your first workflow
2. ✅ Test in simulation
3. ✅ Activate it
4. ✅ Monitor in Deep Space
5. ✅ Optimize based on data
6. ✅ Create more complex workflows
7. ✅ Connect multiple departments

---

**Need Help?** Check `/docs/WORKFLOW_ARCHITECT_GUIDE.md` for comprehensive documentation.