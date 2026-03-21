import { base44 } from '@/api/base44Client';

/**
 * Internal n8n MCP Integration Service
 * Absorbed into Velocity AI core for enhanced automation capabilities
 */
class N8nIntegration {
  /**
   * Execute an n8n MCP method via JSON-RPC
   */
  static async execute(method, params = {}) {
    try {
      const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      };
      const res = await base44.functions.invoke('n8nMcp', payload);
      return res.data;
    } catch (error) {
      console.error(`N8n MCP execution failed (${method}):`, error.message);
      throw error;
    }
  }

  /**
   * List all available n8n tools
   */
  static async listTools() {
    return this.execute('tools/list', {});
  }

  /**
   * Call a specific n8n tool
   */
  static async callTool(name, arguments_obj = {}) {
    return this.execute('tools/call', {
      name,
      arguments: arguments_obj,
    });
  }

  /**
   * List n8n workflows
   */
  static async listWorkflows() {
    return this.callTool('list_workflows', {});
  }

  /**
   * Execute an n8n workflow
   */
  static async executeWorkflow(workflowId, data = {}) {
    return this.callTool('execute_workflow', {
      workflow_id: workflowId,
      data,
    });
  }

  /**
   * Get workflow execution history
   */
  static async listExecutions(limit = 10) {
    return this.callTool('list_executions', { limit });
  }

  /**
   * Get workflow execution details
   */
  static async getExecution(executionId) {
    return this.callTool('get_execution', { execution_id: executionId });
  }

  /**
   * Retry a failed workflow execution
   */
  static async retryExecution(executionId) {
    return this.callTool('retry_execution', { execution_id: executionId });
  }

  /**
   * Stop a running workflow execution
   */
  static async stopExecution(executionId) {
    return this.callTool('stop_execution', { execution_id: executionId });
  }

  /**
   * Create a webhook in n8n
   */
  static async createWebhook(name, workflowId, description = '') {
    return this.callTool('create_webhook', {
      name,
      workflow_id: workflowId,
      description,
    });
  }

  /**
   * Delete a webhook
   */
  static async deleteWebhook(webhookId) {
    return this.callTool('delete_webhook', { webhook_id: webhookId });
  }

  /**
   * Get workflow trigger configuration
   */
  static async getWorkflowTrigger(workflowId) {
    return this.callTool('get_workflow_trigger', { workflow_id: workflowId });
  }

  /**
   * Update workflow trigger configuration
   */
  static async updateWorkflowTrigger(workflowId, config) {
    return this.callTool('update_workflow_trigger', {
      workflow_id: workflowId,
      config,
    });
  }

  /**
   * Enable/disable a workflow
   */
  static async setWorkflowActive(workflowId, active) {
    return this.callTool('set_workflow_active', {
      workflow_id: workflowId,
      active,
    });
  }

  /**
   * Get workflow credentials
   */
  static async getWorkflowCredentials(workflowId) {
    return this.callTool('get_workflow_credentials', { workflow_id: workflowId });
  }

  /**
   * Batch execute multiple workflows
   */
  static async batchExecute(workflows) {
    return Promise.all(
      workflows.map(({ id, data }) => this.executeWorkflow(id, data))
    );
  }
}

export default N8nIntegration;