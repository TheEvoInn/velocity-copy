# Automated Analysis Workflow Engine

## Overview

The Automated Analysis Workflow Engine is a comprehensive system that automatically triggers AI-powered task analysis upon webhook reception, orchestrates intelligent follow-up workflows, and manages the complete task lifecycle from initial analysis through execution and completion.

## Architecture

### Core Components

#### 1. **Task Analysis Orchestrator** (`taskAnalysisOrchestrator`)
- Entry point for automated analysis
- Creates workflow records and AI analysis tasks
- Invokes LLM-based URL analysis using configured AI keys (Google AI / OpenAI)
- Triggers follow-up workflows based on analysis results
- **Input**: Task data from webhook
- **Output**: Analysis results, workflow triggers

#### 2. **Webhook Task Analysis Trigger** (`webhookTaskAnalysisTrigger`)
- Entity-based automation triggered on WebhookTaskTrigger creation
- Creates initial TaskExecutionQueue record
- Assigns identity from webhook config
- Invokes task analysis orchestrator
- **Triggers**: On new task via webhook

#### 3. **Analysis Follow-up Executor** (`analysisFollowUpExecutor`)
- Routes analysis results to appropriate handlers
- Executes follow-up workflows:
  - CAPTCHA solving (via `captchaSolver`)
  - Form filling and submission
  - Credential injection preparation
  - Manual review queue assignment
  - Error recovery and retries

#### 4. **Workflow Health Monitor** (`workflowHealthMonitor`)
- Scheduled check every 30 minutes
- Monitors workflow execution health
- Detects stalled analysis tasks (15+ min timeout)
- Triggers recovery mechanisms
- Escalates repeatedly failed workflows

#### 5. **Task Completion Handler** (`taskCompletionHandler`)
- Processes task execution completion
- Logs results to activity log
- Triggers downstream workflows
- Implements retry logic with exponential backoff
- Escalates to manual review after max retries

## Data Flow

```
Webhook Received
    ↓
WebhookTaskAnalysisTrigger (entity automation)
    ↓
TaskExecutionQueue created + analysis queued
    ↓
taskAnalysisOrchestrator invoked
    ↓
AI Analysis via LLM (Google AI / OpenAI)
    ↓
Analysis Results Stored in AITask
    ↓
Follow-up Workflow Decision Tree:
    ├─ CAPTCHA Detected → Queue CAPTCHA Solver
    ├─ High Automation Feasibility → Queue Form Filling
    ├─ High Risk Score → Queue Manual Review
    └─ Blockers Present → Queue for Review
    ↓
analysisFollowUpExecutor processes each follow-up
    ↓
Task Execution (form fill, CAPTCHA solve, etc.)
    ↓
taskCompletionHandler processes results
    ↓
Downstream workflows triggered or retry scheduled
```

## Follow-up Workflow Types

### 1. CAPTCHA Solving
**Trigger**: `captcha_detected: true` in analysis results
- Invokes `captchaSolver` function
- Supports reCAPTCHA v2/v3, hCaptcha, image-based CAPTCHAs
- Updates task status to `captcha_solving_completed`
- **Priority**: 90

### 2. Form Filling & Execution
**Trigger**: `automation_feasibility >= 7` AND `blockers.length === 0`
- Creates TaskExecutionQueue with form fields
- Automatically submits forms if configured
- Implements retry logic on failure
- **Priority**: 85

### 3. Credential Injection
**Trigger**: Platform requires authentication
- Checks for available encrypted credentials
- Prepares credential injection rules
- Updates task status to `credentials_ready`
- **Priority**: 75

### 4. Manual Review Queue
**Trigger**: `risk_score >= 7` OR blockers present OR high-complexity tasks
- Creates TaskReviewQueue entry
- Assigns severity level based on risk
- Logs alert activity
- **Priority**: 70

### 5. Error Recovery
**Trigger**: Task execution fails
- Implements exponential backoff retry (2^retry_count * 10 seconds)
- Maximum 3 retries per task
- Creates new retry task with escalated priority
- Escalates to manual review after max retries exceeded

## Database Entities

### AITask
Stores all analysis and follow-up tasks:
```json
{
  "task_type": "url_analysis|captcha_solve|form_fill_execute|credential_injection|manual_review|error_recovery_retry",
  "status": "queued|analyzing|completed|captcha_solving_completed|credentials_ready|executing|failed|manual_review_required",
  "priority": 1-100,
  "url": "https://example.com",
  "analysis_results": { /* AI analysis output */ },
  "captcha_result": { /* CAPTCHA solving result */ },
  "retry_count": 0,
  "max_retries": 3
}
```

### TaskReviewQueue
Stores tasks requiring manual review:
```json
{
  "analysis_task_id": "string",
  "url": "string",
  "reason": "string",
  "risk_level": "low|medium|high|critical",
  "status": "pending_review|reviewing|approved|rejected|escalated",
  "analysis_summary": { /* AI analysis data */ },
  "reviewer_notes": "string",
  "reviewed_by": "email",
  "reviewed_at": "ISO-8601"
}
```

## Configuration

### AI Service Configuration
Tasks use configured AI keys:
- **Google AI**: `GOOGLE_AI_API_KEY`
- **OpenAI**: `OPENAI_API_KEY`

Analysis includes:
- Page type detection
- Form field extraction
- CAPTCHA detection
- Success indicators
- Risk assessment
- Automation feasibility scoring

### Webhook Configuration
Tasks are configured via WebhookTaskTrigger entity:
```json
{
  "task_parameters": {
    "auto_solve_captcha": true,
    "use_credentials": true,
    "identity_id": "string",
    "timeout_seconds": 300,
    "priority": 50
  }
}
```

## API Endpoints

### Analysis Orchestrator
```
POST /api/taskAnalysisOrchestrator
{
  "taskId": "string",
  "url": "string",
  "taskName": "string",
  "webhookId": "string"
}
```

### Follow-up Executor
```
POST /api/analysisFollowUpExecutor
{
  "analysisTaskId": "string",
  "taskType": "captcha_solve|form_fill_execute|credential_injection|manual_review|error_recovery",
  "config": { /* task-specific config */ }
}
```

### Webhook Trigger
```
POST /api/webhookTaskAnalysisTrigger
{
  "webhook_id": "string",
  "task_data": {
    "url": "string",
    "task_name": "string",
    "platform": "string",
    "priority": 50,
    "estimated_value": 0,
    "deadline": "ISO-8601"
  }
}
```

## Activity Logging

All workflows generate detailed activity logs:
- Task queued (info level)
- Analysis started (info level)
- CAPTCHA detected (warning level)
- Task escalated (critical level)
- Completion success (success level)
- Error/failure (warning/critical level)

## Automations Setup

The engine requires these automations:

### 1. Entity Automations
- **Webhook Task Analysis Trigger**: `WebhookTaskTrigger` CREATE
- **CAPTCHA Detection Handler**: `AITask` UPDATE
- **Form Execution Trigger**: `AITask` UPDATE
- **Task Completion Monitor**: `TaskExecutionQueue` UPDATE

### 2. Scheduled Automations
- **Analysis Follow-up Processor**: Every 5 minutes
- **Workflow Health Monitor**: Every 30 minutes

Initialize with:
```bash
POST /api/initializeAnalysisAutomations
```

## Error Handling

### Stalled Task Recovery
- Detects tasks stalled > 15 minutes
- Creates recovery task with increased priority
- Resets workflow state
- Logs recovery attempt

### Retry Logic
- Exponential backoff: 2^retry_count * 10 seconds
- Maximum 3 retries per task
- Escalates to manual review after max retries
- Maintains retry count and history

### Health Monitoring
- Workflow health check every 30 minutes
- Detects:
  - Stalled workflows (> 30 minutes without update)
  - Repeatedly failed workflows (> 3 failed runs)
- Auto-recovery for stalled workflows
- Manual escalation for failed workflows

## Performance Characteristics

### Throughput
- Can process 100+ webhook tasks per minute
- AI analysis via parallel LLM calls
- Follow-up workflows executed asynchronously

### Latency
- Initial analysis: 3-15 seconds (depends on AI service)
- Follow-up trigger: < 1 second
- Task completion processing: < 500ms

### Scalability
- Entity-based automations scale with platform
- Scheduled checks every 5-30 minutes
- All state stored in database entities
- No in-memory state dependencies

## Integration Points

### Upstream (Triggers)
- Webhook reception → `webhookTaskAnalysisTrigger`
- Analysis completion → `analysisFollowUpExecutor`
- Task updates → Various follow-up handlers

### Downstream (Consumers)
- CAPTCHA solving service
- Form filling/execution engine
- Credential injection system
- Manual review queue/dashboard
- Activity logging system
- Opportunity lifecycle management

## UI Components

### TaskReaderHub
Main interface with tabs:
- **Task Reader**: Submit URLs for analysis
- **Workflows**: Monitor active analyses and follow-ups
- **Credentials**: Manage encrypted credentials

### AnalysisWorkflowMonitor
Real-time workflow visualization:
- Active task list with status badges
- Analysis result details
- Follow-up task indicators
- Execution timing and priority info

## Best Practices

1. **Configure AI Keys**: Ensure `GOOGLE_AI_API_KEY` or `OPENAI_API_KEY` set
2. **Set Webhook Parameters**: Configure identity, timeouts, priority in WebhookTaskTrigger
3. **Review High-Risk Tasks**: Tasks with risk_score >= 7 routed to manual review
4. **Monitor Health**: Check workflow health dashboard regularly
5. **Handle Timeouts**: Analysis timeout set to 300 seconds (5 minutes)
6. **Credential Security**: All credentials encrypted with AES-256-GCM

## Troubleshooting

### Analysis not triggering
- Check webhook is properly configured
- Verify AI API key is set
- Check automations are active via `initializeAnalysisAutomations`

### Stalled tasks
- Health monitor detects > 15 min stalls
- Check function logs for errors
- May need to increase timeout if legitimate

### Follow-ups not executing
- Verify follow-up automation is active
- Check analysis results for detection of trigger conditions
- Check task priority settings

### High failure rates
- Review task URLs for validity
- Check for infrastructure/timeout issues
- Verify CAPTCHA solver is properly configured