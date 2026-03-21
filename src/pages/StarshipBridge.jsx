import { useEffect, useRef, useState } from 'react';
import StarshipBridgeScene from '@/components/bridge/StarshipBridgeScene';

export default function StarshipBridge() {
  return (
    <div className="w-full h-screen bg-black">
      <StarshipBridgeScene />
    </div>
  );
}