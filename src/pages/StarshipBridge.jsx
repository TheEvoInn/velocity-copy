/**
 * STARSHIP BRIDGE
 * 
 * Master dashboard page - first-person 3D immersive environment
 * Users land here on login and navigate the bridge via interactive workstations
 */

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  useUserGoalsV2,
  useOpportunitiesV2,
  useTasksV2,
  useTransactionsV2,
  useAIIdentitiesV2,
} from '@/lib/velocityHooks';
import StarshipBridgeScene from '@/components/bridge/StarshipBridgeScene';
import SectorMapView from '@/components/bridge/SectorMapView';
import TacticalPanel from '@/components/bridge/TacticalPanel';
import CommsPanel from '@/components/bridge/CommsPanel';
import LogPanel from '@/components/bridge/LogPanel';

export default function StarshipBridge() {
  const { goals: userGoals = {} } = useUserGoalsV2();
  const { opportunities = [] } = useOpportunitiesV2();
  const { tasks = [] } = useTasksV2();
  const { transactions = [] } = useTransactionsV2();
  const { identities = [] } = useAIIdentitiesV2();
  const [showSectorMap, setShowSectorMap] = useState(false);

  // Derived metrics
  const walletBalance = userGoals?.wallet_balance ?? 0;
  const todayEarned = Array.isArray(transactions)
    ? transactions
        .filter(t => new Date(t?.timestamp || 0).toDateString() === new Date().toDateString())
        .reduce((s, t) => s + (t?.value_usd || 0), 0)
    : 0;

  const recentTasks = Array.isArray(tasks)
    ? tasks.filter(t => ['queued', 'processing', 'navigating', 'filling', 'submitting'].includes(t?.status))
    : [];

  const activeIdentities = Array.isArray(identities)
    ? identities.filter(i => i?.is_active)
    : [];

  const handleStationFocus = (stationName, stationData) => {
    console.log(`Focused on ${stationName}:`, stationData);
    // Station focus logic handled in modal
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      {showSectorMap ? (
        <SectorMapView
          onClose={() => setShowSectorMap(false)}
          activeIdentities={activeIdentities.length}
          walletBalance={walletBalance}
          taskCount={recentTasks.length}
        />
      ) : (
        <StarshipBridgeScene
          walletBalance={walletBalance}
          activeIdentities={activeIdentities}
          recentTasks={recentTasks}
          todayEarned={todayEarned}
          onStationFocus={handleStationFocus}
          onOpenSectorMap={() => setShowSectorMap(true)}
        />
      )}
    </div>
  );
}