import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();

    // CREATE NEW SEQUENCE
    if (action === 'create_sequence') {
      const { name, sequence_type, offer_type, target_product_id, days_between } = data;

      // Generate 5-email sequence based on type
      const emails = await generateSequenceEmails(
        sequence_type,
        offer_type,
        target_product_id,
        name,
        base44
      );

      const sequence = await base44.entities.EmailSequence.create({
        name,
        sequence_type,
        offer_type,
        target_product_id,
        days_between_emails: days_between || 2,
        total_emails: emails.length,
        emails,
        status: 'draft',
        identity_id: data.identity_id || null,
        sender_name: data.sender_name || user.full_name,
        sender_email: data.sender_email || user.email,
        reply_to_email: data.reply_to_email || user.email,
        brand_colors: data.brand_colors || {
          primary: '#7c3aed',
          secondary: '#2563eb',
          accent: '#06b6d4'
        }
      });

      return Response.json({ success: true, sequence_id: sequence.id, sequence });
    }

    // ENROLL LEAD IN SEQUENCE
    if (action === 'enroll_lead') {
      const { sequence_id, lead_email, first_name, last_name, source, storefront_id, personalization_data } = data;

      const lead = await base44.entities.EmailCampaignLead.create({
        email_sequence_id: sequence_id,
        lead_email,
        first_name,
        last_name,
        source,
        storefront_id,
        status: 'active',
        enrollment_date: new Date().toISOString(),
        current_email_number: 0,
        personalization_data
      });

      // Schedule first email
      const sequence = await base44.entities.EmailSequence.list();
      const seq = sequence.find(s => s.id === sequence_id);
      
      if (seq && seq.emails && seq.emails.length > 0) {
        const firstEmail = seq.emails[0];
        const delayMs = (firstEmail.delay_days || 0) * 24 * 60 * 60 * 1000;
        const nextEmailTime = new Date(Date.now() + delayMs);

        await base44.entities.EmailCampaignLead.update(lead.id, {
          next_email_scheduled: nextEmailTime.toISOString()
        });
      }

      return Response.json({ success: true, lead_id: lead.id, lead });
    }

    // SEND SCHEDULED EMAILS
    if (action === 'send_scheduled_emails') {
      const now = new Date();
      const leads = await base44.entities.EmailCampaignLead.filter({
        status: 'active'
      });

      let sent = 0;
      let failed = 0;

      for (const lead of leads) {
        // Check if email is scheduled for now
        if (!lead.next_email_scheduled) continue;
        
        const scheduledTime = new Date(lead.next_email_scheduled);
        if (scheduledTime > now) continue;

        try {
          // Get sequence
          const seqs = await base44.entities.EmailSequence.list();
          const seq = seqs.find(s => s.id === lead.email_sequence_id);
          
          if (!seq || !seq.emails) continue;

          const nextEmailNumber = (lead.current_email_number || 0) + 1;
          if (nextEmailNumber > seq.emails.length) {
            // Sequence complete
            await base44.entities.EmailCampaignLead.update(lead.id, {
              status: 'converted',
              completion_date: new Date().toISOString()
            });
            continue;
          }

          const emailTemplate = seq.emails[nextEmailNumber - 1];

          // Send email with personalization
          const emailBody = personalizeEmail(
            emailTemplate.body,
            lead.first_name,
            lead.last_name,
            lead.personalization_data
          );

          const subject = personalizeEmail(
            emailTemplate.subject,
            lead.first_name,
            lead.last_name,
            lead.personalization_data
          );

          const response = await base44.integrations.Core.SendEmail({
            to: lead.lead_email,
            subject: subject,
            body: emailBody,
            from_name: seq.sender_name
          });

          if (response) {
            sent++;

            // Schedule next email
            const nextEmail = seq.emails[nextEmailNumber];
            const nextDelay = nextEmail ? (nextEmail.delay_days || seq.days_between_emails) : 0;
            const nextTime = new Date(Date.now() + nextDelay * 24 * 60 * 60 * 1000);

            await base44.entities.EmailCampaignLead.update(lead.id, {
              current_email_number: nextEmailNumber,
              emails_sent: (lead.emails_sent || 0) + 1,
              last_email_sent_at: new Date().toISOString(),
              next_email_scheduled: nextTime.toISOString()
            });
          }
        } catch (error) {
          failed++;
          console.error(`Failed to send email to ${lead.lead_email}:`, error);
        }
      }

      return Response.json({ success: true, sent, failed });
    }

    // GET SEQUENCE METRICS
    if (action === 'get_metrics') {
      const { sequence_id } = data;

      const leads = await base44.entities.EmailCampaignLead.filter({
        email_sequence_id: sequence_id
      });

      const seqs = await base44.entities.EmailSequence.list();
      const sequence = seqs.find(s => s.id === sequence_id);

      const metrics = {
        total_enrolled: leads.length,
        active: leads.filter(l => l.status === 'active').length,
        converted: leads.filter(l => l.status === 'converted').length,
        unsubscribed: leads.filter(l => l.status === 'unsubscribed').length,
        bounced: leads.filter(l => l.status === 'bounced').length,
        avg_open_rate: leads.reduce((sum, l) => sum + (l.email_opens || 0), 0) / Math.max(leads.length, 1),
        conversion_rate: (leads.filter(l => l.conversion_status === 'purchased').length / Math.max(leads.length, 1)) * 100,
        total_revenue: leads.reduce((sum, l) => sum + (l.purchase_amount || 0), 0),
        unsubscribe_rate: (leads.filter(l => l.status === 'unsubscribed').length / Math.max(leads.length, 1)) * 100,
        bounce_rate: (leads.filter(l => l.status === 'bounced').length / Math.max(leads.length, 1)) * 100
      };

      return Response.json({ success: true, metrics, sequence });
    }

    // ACTIVATE SEQUENCE
    if (action === 'activate_sequence') {
      const { sequence_id } = data;

      await base44.entities.EmailSequence.update(sequence_id, {
        status: 'active',
        last_sent_at: new Date().toISOString()
      });

      return Response.json({ success: true, message: 'Sequence activated' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Generate 5-email sequence based on type
async function generateSequenceEmails(sequenceType, offerType, productId, productName, base44) {
  const templates = {
    digital_product: [
      {
        sequence_number: 1,
        subject: `You're missing out on {{product_name}}`,
        preview_text: 'Here is what {{first_name}} needs to know...',
        delay_days: 0,
        cta_text: 'Learn More',
        body: `<h1>Hi {{first_name}},</h1><p>Thanks for your interest in {{product_name}}. Most people don't realize the biggest mistake they're making...</p><p>That's where {{product_name}} comes in. It solves this exact problem.</p>`
      },
      {
        sequence_number: 2,
        subject: `Why {{first_name}} specifically needs this`,
        preview_text: 'This is probably you...',
        delay_days: 2,
        cta_text: 'See How It Works',
        body: `<h1>The {{product_name}} Method</h1><p>Here's how {{first_name}} can get results faster:</p><p>Step 1: Understand the framework<br/>Step 2: Apply it to your situation<br/>Step 3: Watch the results</p>`
      },
      {
        sequence_number: 3,
        subject: `Real results from real customers like {{first_name}}`,
        preview_text: 'See what they accomplished...',
        delay_days: 4,
        cta_text: 'Read Their Stories',
        body: `<h1>Success Stories</h1><p>Sarah increased her profits by 240% in 3 months. John saved 15 hours per week. {{first_name}}, you could be next.</p>`
      },
      {
        sequence_number: 4,
        subject: `Everything included in {{product_name}}`,
        preview_text: 'Here is the complete breakdown...',
        delay_days: 6,
        cta_text: 'See Full Details',
        body: `<h1>What You Get</h1><p>Module 1: Foundations<br/>Module 2: Advanced techniques<br/>Module 3: Scaling to 6-figures<br/>Plus: Lifetime updates & community access</p>`
      },
      {
        sequence_number: 5,
        subject: `Last chance: {{product_name}} closes in 48 hours`,
        preview_text: 'This offer expires soon...',
        delay_days: 8,
        cta_text: 'Get Access Now',
        body: `<h1>Final Day {{first_name}}!</h1><p>This is your last chance to join {{first_name}}. After tomorrow, this offer closes and pricing goes back to normal.</p><p>Don't miss out. Secure your access now.</p>`
      }
    ],
    affiliate_offer: [
      {
        sequence_number: 1,
        subject: `{{first_name}}, I found something you'll love`,
        preview_text: 'This solved my biggest problem...',
        delay_days: 0,
        cta_text: 'Check It Out',
        body: `<h1>Hi {{first_name}},</h1><p>I just discovered this tool that completely changed how I work. I had to share it with you because I think you'll love it too.</p>`
      },
      {
        sequence_number: 2,
        subject: `Why top performers use this (and why {{first_name}} should too)`,
        preview_text: 'This is what separates winners...',
        delay_days: 2,
        cta_text: 'Learn Why',
        body: `<h1>The Secret Advantage</h1><p>The top 10% of professionals use this. Here's why it makes such a difference...</p>`
      },
      {
        sequence_number: 3,
        subject: `{{first_name}}, see the difference yourself`,
        preview_text: 'Before and after comparison...',
        delay_days: 4,
        cta_text: 'See The Comparison',
        body: `<h1>Before vs After</h1><p>What changed when I started using this? Everything.</p>`
      },
      {
        sequence_number: 4,
        subject: `Special offer just for {{first_name}}`,
        preview_text: 'Limited time bonus inside...',
        delay_days: 6,
        cta_text: 'Claim Your Bonus',
        body: `<h1>Exclusive Bonus</h1><p>As someone in our community, you get exclusive access to bonuses not available anywhere else.</p>`
      },
      {
        sequence_number: 5,
        subject: `{{first_name}}, your access expires in 24 hours`,
        preview_text: 'Do not lose this opportunity...',
        delay_days: 8,
        cta_text: 'Get Access Today',
        body: `<h1>Last Chance {{first_name}}!</h1><p>Your exclusive access and bonus expires tomorrow. Don't miss this.</p>`
      }
    ]
  };

  const sequence = templates[sequenceType] || templates.digital_product;
  return sequence.map(email => ({
    ...email,
    ai_generated: true,
    created_at: new Date().toISOString()
  }));
}

// Personalize email content with merge tags
function personalizeEmail(content, firstName, lastName, customData = {}) {
  let personalized = content
    .replace(/\{\{first_name\}\}/g, firstName || 'there')
    .replace(/\{\{last_name\}\}/g, lastName || '')
    .replace(/\{\{full_name\}\}/g, `${firstName || ''} ${lastName || ''}`.trim());

  // Custom data merge tags
  for (const [key, value] of Object.entries(customData)) {
    personalized = personalized.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return personalized;
}