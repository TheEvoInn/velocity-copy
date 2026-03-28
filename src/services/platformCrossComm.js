export const PLATFORM_EVENTS = {
  OPPORTUNITY_FOUND: 'OPPORTUNITY_FOUND',
  OPPORTUNITY_QUEUED: 'OPPORTUNITY_QUEUED',
  OPPORTUNITY_EXECUTED: 'OPPORTUNITY_EXECUTED',
  OPPORTUNITY_COMPLETED: 'OPPORTUNITY_COMPLETED',
  SCAN_STARTED: 'SCAN_STARTED',
  SCAN_COMPLETED: 'SCAN_COMPLETED',
  MARKET_UPDATE: 'MARKET_UPDATE',
  PLATFORM_DISCOVERED: 'PLATFORM_DISCOVERED',
};

export const platformComm = {
  subscribe: () => () => {},
  unsubscribe: () => {},
  emit: () => {},
  getEventHistory: () => [],
  getPlatformStats: () => ({}),
  getReadyForExecution: () => false,
  broadcastOpportunity: () => {},
  notifyQueueing: () => {},
  notifyCompletion: () => {},
};
