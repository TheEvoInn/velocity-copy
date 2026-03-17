/**
 * n8n MCP Server Bridge
 * Proxies MCP protocol calls to the n8n cloud MCP server at velocitypulse.app.n8n.cloud
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const N8N_MCP_URL = 'https://velocitypulse.app.n8n.cloud/mcp-server/http';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = Deno.env.get('N8N_MCP_BEARER_TOKEN');
    if (!token) return Response.json({ error: 'n8n MCP token not configured' }, { status: 500 });

    const body = await req.json();

    // Forward the MCP request to n8n
    const response = await fetch(N8N_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});