import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function OptimizationDashboard() {
  const [activeTab, setActiveTab] = useState('deployments');
  const [optimizations, setOptimizations] = useState([]);
  const [enhancements, setEnhancements] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [optRes, enhRes, roadmapRes] = await Promise.all([
        base44.functions.invoke('optimizationDeploymentEngine', { action: 'list_pending_optimizations' }),
        base44.functions.invoke('enhancementActivationManager', { action: 'list_pending_enhancements' }),
        base44.functions.invoke('phasePlanningOrchestrator', { action: 'get_phase_roadmap' })
      ]);

      setOptimizations(optRes.data?.optimizations || []);
      setEnhancements(enhRes.data?.enhancements || []);
      setRoadmap(roadmapRes.data?.roadmap || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const deployOptimization = async (optId) => {
    try {
      await base44.functions.invoke('optimizationDeploymentEngine', {
        action: 'deploy_optimization',
        optimization_id: optId,
        phased_rollout: true
      });
      loadData();
    } catch (error) {
      console.error('Deployment failed:', error);
    }
  };

  const activateEnhancement = async (enhId) => {
    try {
      await base44.functions.invoke('enhancementActivationManager', {
        action: 'activate_enhancement',
        enhancement_id: enhId
      });
      loadData();
    } catch (error) {
      console.error('Activation failed:', error);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Optimization & Deployment</h1>
          <p className="text-muted-foreground">Monitor platform optimizations, enhancements, and phase planning</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deployments">Optimizations</TabsTrigger>
            <TabsTrigger value="enhancements">Enhancements</TabsTrigger>
            <TabsTrigger value="roadmap">Phase Roadmap</TabsTrigger>
          </TabsList>

          <TabsContent value="deployments" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {optimizations.map((opt) => (
                <Card key={opt.id} className="glass-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{opt.name}</CardTitle>
                        <CardDescription>{opt.category}</CardDescription>
                      </div>
                      <Badge variant={opt.status === 'pending' ? 'outline' : 'default'}>
                        {opt.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold">Impact</p>
                          <p className="text-lg text-cyan-400">{opt.impact}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Risk Level</p>
                          <p className="text-lg">{opt.risk}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Est. Time</p>
                          <p className="text-lg">{opt.estimated_deployment_time}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Rollback</p>
                          <p className="text-lg">{opt.rollback_available ? '✓ Available' : 'N/A'}</p>
                        </div>
                      </div>
                      {opt.status === 'pending' && (
                        <Button 
                          onClick={() => deployOptimization(opt.id)}
                          className="w-full btn-cosmic"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Deploy Now
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="enhancements" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {enhancements.map((enh) => (
                <Card key={enh.id} className="glass-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{enh.name}</CardTitle>
                        <CardDescription>{enh.description}</CardDescription>
                      </div>
                      <Badge variant={enh.status === 'pending' ? 'secondary' : 'outline'}>
                        {enh.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold">Priority</p>
                          <p className="text-lg">{enh.priority}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Est. Time</p>
                          <p className="text-lg">{enh.estimated_activation_time}</p>
                        </div>
                      </div>
                      {enh.dependencies?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-2">Dependencies</p>
                          <div className="flex flex-wrap gap-2">
                            {enh.dependencies.map((dep) => (
                              <Badge key={dep} variant="outline">{dep}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {enh.status === 'pending' && (
                        <Button 
                          onClick={() => activateEnhancement(enh.id)}
                          className="w-full btn-cosmic"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Activate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="roadmap" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {roadmap.map((phase) => (
                <Card key={phase.phase} className="glass-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>Phase {phase.phase}: {phase.name}</CardTitle>
                        <CardDescription>Duration: {phase.duration_weeks} weeks</CardDescription>
                      </div>
                      <Badge variant={
                        phase.status === 'planning' ? 'default' :
                        phase.status === 'design' ? 'secondary' :
                        'outline'
                      }>
                        {phase.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold mb-2">Focus Areas</p>
                        <div className="flex flex-wrap gap-2">
                          {phase.focus_areas?.map((area) => (
                            <Badge key={area} variant="outline">{area}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">Key Deliverables</p>
                        <ul className="space-y-1">
                          {phase.key_deliverables?.map((deliverable) => (
                            <li key={deliverable} className="text-sm flex items-start">
                              <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-cyan-400" />
                              {deliverable}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-black/30 p-3 rounded">
                        <p className="text-sm">
                          <span className="font-semibold">Estimated Improvement: </span>
                          <span className="text-cyan-400">{phase.estimated_improvement}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}