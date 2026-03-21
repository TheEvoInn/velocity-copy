import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StarshipBridgeScene from '@/components/bridge/StarshipBridgeScene';
import CockpitControlPanel from '@/components/bridge/CockpitControlPanel';

export default function StarshipBridge() {
  const navigate = useNavigate();

  const handleModuleSelect = (moduleName) => {
    const moduleRoutes = {
      'AutoPilot': '/AutoPilot',
      'Discovery': '/Discovery',
      'Finance': '/Finance',
      'Control': '/Control',
      'Execution': '/Execution',
    };
    
    if (moduleRoutes[moduleName]) {
      navigate(moduleRoutes[moduleName]);
    }
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <div className="absolute inset-0">
        <StarshipBridgeScene onModuleSelect={handleModuleSelect} />
      </div>
      <CockpitControlPanel />
    </div>
  );
}