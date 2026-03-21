# WEBHOOK ENGINE - QUICK REFERENCE

## 📌 What Is It?

Webhook Engine sends **real-time notifications** to external systems when platform events occur (task completion, transactions, onboarding).

## 🎯 Events

| Event | Trigger | When |
|-------|---------|------|
| `task.completed` | Task finishes | TaskExecutionQueue status = "completed" |
| `task.failed` | Task errors | TaskExecutionQueue status = "failed" |
| `transaction.created` | New transaction | Transaction entity created |
| `onboarding.completed` | User finishes setup | UserGoals.onboarded = true |
| `opportunity.new` | Opportunity found | Opportunity entity created |
| `wallet.added` | New wallet | CryptoWallet entity created |
| `credential.added` | New credential | EncryptedCredential entity created |

## 🚀 Quick Start (5 min)

1. **Create entity automations** (runs once):
   ```javascript
   // In your admin panel or backend
   create_automation({
     automation_type: "entity",
     name: "Webhook: Task Completed",
     function_name: "webhookEventAutomation",
     entity_name: "TaskExecutionQueue",
     event_types: ["update"]
   });
   // Repeat for Transaction, UserGoals, Opportunity entities
   ```

2. **Access Webhook Engine**:
   - Navigate to `/WebhookEngine` in app
   - Or use navigation menu

3. **Register webhook**:
   - Click "Register Endpoint"
   - URL: `https://your-endpoint.com/webhook`
   - Events: Select desired events
   - Auth: Configure if needed
   - Create

4. **Test**:
   - Click "Test" button
   - Should see success notification
   - Check your endpoint for incoming data

## 📦 Webhook Payload Structure

```json
{
  "event": "task.completed",
  "timestamp": "2026-03-21T10:30:00Z",
  "summary": "Task completed with value: $150",
  "data": {
    "id": "task_123",
    "status": "completed",
    "estimated_value": 150,
    "platform": "upwork"
  }
}
```

## 🔒 Authentication

Choose one:
- **Bearer Token**: `Authorization: Bearer token123`
- **API Key**: `X-API-Key: key123`
- **None**: Public endpoint

## 📊 Monitoring

In Webhook Engine:
1. **Active** tab: See all active webhooks
2. **Inactive** tab: See disabled webhooks
3. **Analytics** tab: View delivery stats
4. **View Details**: Click eye icon to see recent deliveries

## 🧪 Testing

```javascript
// Test via backend
const result = await base44.functions.invoke('webhookEventEngine', {
  action: 'test_webhook',
  data: {
    webhook_id: 'webhook_id',
    event_type: 'task.completed'
  }
});
```

Or use the "Test" button in the UI.

## 🔧 Configuration

### Per-Webhook Settings
- **Max Retries**: 3 (default)
- **Retry Delay**: 5 seconds (default)
- **Backoff Multiplier**: 2x
- **Timeout**: 30 seconds (default)

### Custom Headers
Add via WebhookConfig entity:
```javascript
{
  "headers": {
    "X-Custom": "value"
  }
}
```

## 📈 Performance

- Event → Webhook: < 1 second
- Delivery time: 0.5-3 seconds
- Retries: Up to ~30 seconds total
- Throughput: 1000+ events/min

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook not triggering | Check entity automations are enabled |
| Connection refused | Verify endpoint URL and firewall |
| 401 Unauthorized | Check authentication token |
| 30s timeout | Endpoint too slow, optimize |
| Still failing | Check external system logs |

## 📚 Full Docs

- **Integration Guide**: `WEBHOOK_ENGINE_INTEGRATION.md`
- **Setup Guide**: `WEBHOOK_ENGINE_SETUP.md`
- **Deployment**: `WEBHOOK_ENGINE_DEPLOYMENT.md`
- **Summary**: `WEBHOOK_ENGINE_SUMMARY.md`

## ✅ Integration Examples

### Slack
```
URL: https://hooks.slack.com/services/YOUR/WEBHOOK
Events: task.completed, onboarding.completed
Auth: None
```

### Google Sheets
```
URL: https://script.google.com/macros/s/YOUR_ID/usercontent
Events: transaction.created
Auth: None
```

### External CRM
```
URL: https://crm.example.com/webhooks/velocity
Events: task.completed, opportunity.new
Auth: Bearer Token: your_token
```

## 🔄 Existing System Impact

✅ **No Changes**:
- Inbound webhooks still work
- WebhookTaskTrigger still active
- WebhookDispatcher still processing
- WebhookConfiguration page still available

✅ **New**:
- Outbound webhooks (WebhookEventEngine)
- Entity automation bridge (webhookEventAutomation)
- WebhookEngine page & component

## 💡 Common Use Cases

1. **Sync to CRM**: Completed tasks → Salesforce
2. **Notify Team**: Onboarding → Slack message
3. **Track Earnings**: Transactions → Google Sheets
4. **External Analytics**: Events → Analytics platform
5. **SMS/Email**: Milestones → Twilio/SendGrid

## 🎯 Next Steps

1. Create entity automations (one-time setup)
2. Register first webhook
3. Test delivery
4. Monitor analytics
5. Integrate external systems

---

**Quick Reference v1.0**
**Last Updated**: 2026-03-21
**Status**: ✅ Ready to Use