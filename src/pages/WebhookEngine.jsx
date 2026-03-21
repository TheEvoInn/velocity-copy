/**
 * WEBHOOK ENGINE PAGE
 * Manage outbound webhooks for platform events
 */

import React from 'react';
import WebhookEngineComponent from '@/components/webhooks/WebhookEngine';

export default function WebhookEngine() {
  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <WebhookEngineComponent />
      </div>
    </div>
  );
}