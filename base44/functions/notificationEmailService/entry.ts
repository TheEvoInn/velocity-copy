import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Notification Email Service
 * Handles email template rendering and delivery for all notification types
 */

const EMAIL_TEMPLATES = {
  compliance_alert: {
    subject: '⚠️ {{title}}',
    html: `<div style="font-family: Arial; color: #333;">
      <h2>{{title}}</h2>
      <p>{{message}}</p>
      {{#action_required}}<p><strong>Action Required:</strong> {{action_required}}</p>{{/action_required}}
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">This is a critical compliance notification. Please review immediately.</p>
    </div>`
  },
  autopilot_execution: {
    subject: '✅ {{title}}',
    html: `<div style="font-family: Arial; color: #333;">
      <h2>{{title}}</h2>
      <p>{{message}}</p>
      <div style="background: #f0f8ff; padding: 15px; border-left: 4px solid #00e8ff; margin: 15px 0;">
        <strong>Autopilot Execution Update</strong><br/>
        Your autonomous task has been processed successfully.
      </div>
      <a href="{{dashboard_link}}" style="display: inline-block; background: #00e8ff; color: #000; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin: 15px 0;">View Details</a>
    </div>`
  },
  user_action_required: {
    subject: '🔔 {{title}}',
    html: `<div style="font-family: Arial; color: #333;">
      <h2>{{title}}</h2>
      <p>{{message}}</p>
      <div style="background: #fff8f0; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0;">
        <strong>Action Required</strong><br/>
        {{action_description}}
      </div>
      <a href="{{action_link}}" style="display: inline-block; background: #ff9800; color: #fff; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin: 15px 0;">Take Action</a>
    </div>`
  },
  opportunity_alert: {
    subject: '🎯 {{title}}',
    html: `<div style="font-family: Arial; color: #333;">
      <h2>{{title}}</h2>
      <p>{{message}}</p>
      <div style="background: #f0fff4; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0;">
        <strong>Opportunity Detected</strong><br/>
        {{opportunity_details}}
      </div>
      <a href="{{opportunity_link}}" style="display: inline-block; background: #10b981; color: #fff; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin: 15px 0;">Review Opportunity</a>
    </div>`
  },
  default: {
    subject: '📩 {{title}}',
    html: `<div style="font-family: Arial; color: #333;">
      <h2>{{title}}</h2>
      <p>{{message}}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">You received this notification from VELOCITY Autopilot System.</p>
    </div>`
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      // Allow service role calls
      user = { email: 'system@velocitysystem.io', role: 'admin' };
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, notification_id, user_email, notification_data } = await req.json();

    if (action === 'send_email') {
      return await sendNotificationEmail(base44, user, notification_id, notification_data);
    }

    if (action === 'test_template') {
      return await testEmailTemplate(notification_data);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Email service error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function sendNotificationEmail(base44, user, notificationId, notifData) {
  try {
    const notification = notifData || await base44.asServiceRole.entities.Notification.read(notificationId);
    if (!notification) {
      return Response.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Get email template
    const template = EMAIL_TEMPLATES[notification.type] || EMAIL_TEMPLATES.default;
    
    // Render email subject
    const subject = renderTemplate(template.subject, {
      title: notification.title,
      message: notification.message
    });

    // Render email body
    const html = renderTemplate(template.html, {
      title: notification.title,
      message: notification.message,
      action_required: notification.action_type !== 'none' ? 'This notification requires your attention' : '',
      action_description: notification.action_data?.description || '',
      action_link: generateActionLink(notification),
      opportunity_details: notification.action_data?.opportunity_summary || '',
      opportunity_link: generateOpportunityLink(notification),
      dashboard_link: 'https://app.velocitysystem.io/Dashboard'
    });

    // Send email via Core integration
    const emailResult = await base44.integrations.Core.SendEmail({
      to: user.email,
      subject,
      body: html
    });

    // Mark email as sent in notification
    await base44.asServiceRole.entities.Notification.update(notificationId, {
      email_sent: true,
      email_sent_at: new Date().toISOString()
    }).catch(() => {});

    return Response.json({
      success: true,
      message: 'Email sent successfully',
      email_to: user.email
    });
  } catch (error) {
    console.error('Send email error:', error.message);
    return Response.json(
      { error: `Failed to send email: ${error.message}` },
      { status: 500 }
    );
  }
}

async function testEmailTemplate(notifData) {
  try {
    const template = EMAIL_TEMPLATES[notifData.type] || EMAIL_TEMPLATES.default;
    const subject = renderTemplate(template.subject, notifData);
    const html = renderTemplate(template.html, notifData);

    return Response.json({
      success: true,
      subject,
      html,
      preview: html.substring(0, 200) + '...'
    });
  } catch (error) {
    return Response.json(
      { error: `Template test failed: ${error.message}` },
      { status: 400 }
    );
  }
}

function renderTemplate(template, data) {
  let result = template;
  
  // Replace simple variables
  Object.keys(data).forEach(key => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '');
  });
  
  // Handle conditionals {{#key}}...{{/key}}
  Object.keys(data).forEach(key => {
    const pattern = new RegExp(`{{#${key}}}(.*?){{/${key}}}`, 'gs');
    if (data[key]) {
      result = result.replace(pattern, '$1');
    } else {
      result = result.replace(pattern, '');
    }
  });

  return result;
}

function generateActionLink(notification) {
  const baseUrl = 'https://app.velocitysystem.io';
  
  if (notification.related_entity_type === 'LinkedAccountCreation') {
    return `${baseUrl}/UserAccessPage?tab=compliance&action=verify&account=${notification.related_entity_id}`;
  }
  if (notification.related_entity_type === 'Opportunity') {
    return `${baseUrl}/Execution?opportunity=${notification.related_entity_id}`;
  }
  if (notification.related_entity_type === 'KYCVerification') {
    return `${baseUrl}/KYCManagement?id=${notification.related_entity_id}`;
  }
  
  return `${baseUrl}/UserAccessPage`;
}

function generateOpportunityLink(notification) {
  const baseUrl = 'https://app.velocitysystem.io';
  if (notification.related_entity_id) {
    return `${baseUrl}/Opportunities?id=${notification.related_entity_id}`;
  }
  return `${baseUrl}/Discovery`;
}