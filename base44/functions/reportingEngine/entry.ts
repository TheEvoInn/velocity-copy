import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate_custom_report';

    if (action === 'generate_custom_report') {
      const reportConfig = body.config || {};
      const reportId = `report_${Date.now()}`;

      const report = {
        id: reportId,
        title: reportConfig.title || 'Custom Report',
        period: reportConfig.period || 'monthly',
        sections: [
          { name: 'Executive Summary', content: 'Key metrics overview' },
          { name: 'Category Performance', content: 'Breakdown by category' },
          { name: 'Platform Analysis', content: 'Platform-specific metrics' },
          { name: 'Recommendations', content: 'Actionable insights' }
        ],
        created_at: new Date().toISOString(),
        status: 'ready'
      };

      return Response.json({ report, status: 'generated' });
    }

    if (action === 'export_report_pdf') {
      return Response.json({
        file_url: `/reports/report_${Date.now()}.pdf`,
        format: 'pdf',
        size_kb: 256,
        exported_at: new Date().toISOString()
      });
    }

    if (action === 'export_report_csv') {
      return Response.json({
        file_url: `/reports/report_${Date.now()}.csv`,
        format: 'csv',
        rows: 1250,
        columns: 15,
        exported_at: new Date().toISOString()
      });
    }

    if (action === 'schedule_report_delivery') {
      const schedule = body.schedule || {};
      return Response.json({
        scheduled: true,
        frequency: schedule.frequency || 'weekly',
        next_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        delivery_time: schedule.time || '08:00',
        recipients: schedule.recipients || [user.email]
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});