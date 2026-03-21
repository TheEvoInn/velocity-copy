import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Run email sending scheduler
    const result = await base44.asServiceRole.functions.invoke('emailSequenceOrchestrator', {
      action: 'send_scheduled_emails',
      data: {}
    });

    return Response.json({ 
      success: true, 
      message: 'Email scheduler executed',
      result: result.data 
    });
  } catch (error) {
    console.error('Scheduler error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});