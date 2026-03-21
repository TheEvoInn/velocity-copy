import { base44 } from '@/api/base44Client';

class CockpitDataBinding {
  constructor(scene, povController) {
    this.scene = scene;
    this.povController = povController;
    this.subscriptions = [];
    this.departmentObjects = new Map();
    this.realTimeData = {
      autopilot: { active: false, taskCount: 0 },
      wallet: { balance: 0, dailyEarnings: 0 },
      identity: { activeIdentity: null },
      discovery: { opportunities: 0 },
      ned: { active: false },
      vipz: { active: false }
    };
  }

  async initialize() {
    await this.bindAutopilotData();
    await this.bindWalletData();
    await this.bindIdentityData();
    await this.bindOpportunityData();
  }

  async bindAutopilotData() {
    try {
      const subscription = base44.entities.AITask.subscribe((event) => {
        if (event.type === 'create' || event.type === 'update') {
          const count = event.data?.status === 'queued' ? 1 : 0;
          this.realTimeData.autopilot.taskCount += count;
          this.updateDepartmentVisualization('autopilot');
        }
      });
      this.subscriptions.push(subscription);
    } catch (error) {
      console.error('Autopilot binding failed:', error);
    }
  }

  async bindWalletData() {
    try {
      const subscription = base44.entities.CryptoTransaction.subscribe((event) => {
        if (event.type === 'create') {
          this.realTimeData.wallet.dailyEarnings += event.data?.value_usd || 0;
          this.updateDepartmentVisualization('wallet');
          this.pulseEnergyCore();
        }
      });
      this.subscriptions.push(subscription);
    } catch (error) {
      console.error('Wallet binding failed:', error);
    }
  }

  async bindIdentityData() {
    try {
      const user = await base44.auth.me();
      if (user) {
        this.realTimeData.identity.activeIdentity = user.id;
      }
    } catch (error) {
      console.error('Identity binding failed:', error);
    }
  }

  async bindOpportunityData() {
    try {
      const subscription = base44.entities.Opportunity.subscribe((event) => {
        if (event.type === 'create') {
          this.realTimeData.discovery.opportunities += 1;
          this.updateDepartmentVisualization('discovery');
        }
      });
      this.subscriptions.push(subscription);
    } catch (error) {
      console.error('Opportunity binding failed:', error);
    }
  }

  updateDepartmentVisualization(department) {
    const obj = this.departmentObjects.get(department);
    if (!obj) return;

    const mesh = obj.children[0];
    const intensity = this.calculateActivityIntensity(department);
    
    if (mesh.material) {
      mesh.material.emissiveIntensity = 0.3 + intensity * 0.5;
    }
  }

  calculateActivityIntensity(department) {
    const data = this.realTimeData[department];
    if (!data) return 0;

    if (department === 'autopilot') {
      return Math.min(data.taskCount / 10, 1);
    }
    if (department === 'wallet') {
      return Math.min(data.dailyEarnings / 1000, 1);
    }
    if (department === 'discovery') {
      return Math.min(data.opportunities / 50, 1);
    }
    return 0;
  }

  pulseEnergyCore() {
    const core = this.scene.children.find(c => c.userData?.energyCore);
    if (core) {
      const sphere = core.children[0];
      if (sphere.material) {
        sphere.material.emissiveIntensity = 1;
        setTimeout(() => {
          if (sphere.material) {
            sphere.material.emissiveIntensity = 0.8;
          }
        }, 300);
      }
    }
  }

  registerDepartmentObject(department, object) {
    this.departmentObjects.set(department, object);
  }

  navigateToDepartment(department) {
    const obj = this.departmentObjects.get(department);
    if (obj && this.povController) {
      this.povController.targetPosition = obj.position.clone().add({ x: 0, y: 2, z: 3 });
      this.povController.focusStation(obj);
    }
  }

  getRealTimeData() {
    return this.realTimeData;
  }

  dispose() {
    this.subscriptions.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
  }
}

export default CockpitDataBinding;