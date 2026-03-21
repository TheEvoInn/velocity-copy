import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export function useSectorMapData() {
  const [pois, setPois] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load POIs from Opportunity entity (discovered opportunities)
        const opportunities = await base44.entities.Opportunity.filter(
          { status: { $ne: 'expired' } },
          '-updated_date',
          50
        );

        const poiData = opportunities.map((opp, idx) => ({
          id: opp.id,
          name: opp.title || `POI-${idx}`,
          type: 'opportunity',
          position: {
            x: (Math.random() - 0.5) * 100,
            z: (Math.random() - 0.5) * 100
          },
          data: opp
        }));

        setPois(poiData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load sector map data:', error);
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to opportunity changes for real-time updates
    const unsubscribe = base44.entities.Opportunity.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        loadData();
      }
    });

    return unsubscribe;
  }, []);

  return { pois, zones, loading };
}