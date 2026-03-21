# STARSHIP BRIDGE GAMIFICATION - TECHNICAL ARCHITECTURE

## SYSTEM OVERVIEW

```
┌────────────────────────────────────────────────────────────────────┐
│                    StarshipBridge Master Component                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ BridgeScene (Three.js 3D Environment)                        │ │
│  │ ├─ Scene setup, renderer, camera, lighting                  │ │
│  │ ├─ Station geometry (Tactical, Comms, Log)                  │ │
│  │ ├─ Floor, walls, nebula skybox                              │ │
│  │ └─ Animation loop (60 FPS)                                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                           ↑                                        │
│                      (3D Canvas)                                   │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ BridgePOV        │  │ BridgeAlert      │  │ BridgeParticle │ │
│  │ Controller       │  │ System           │  │ Manager        │ │
│  │ ─────────────    │  │ ──────────────── │  │ ──────────────┘ │
│  │ • Camera zoom    │  │ • Event listener │  │ • Layer system │ │
│  │ • POV modes      │  │ • Visual queue   │  │ • Emission ctrl│ │
│  │ • DOF control    │  │ • Severity map   │  │ • Lifecycle    │ │
│  │ • Lens effects   │  │ • Audio triggers │  │ • Color themes │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│           ↑                     ↑                      ↑          │
│      (Camera)             (Alerts)              (Particles)       │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ BridgeScreen     │  │ BridgeHUD        │  │ BridgeAudio    │ │
│  │ Renderer         │  │ Overlay          │  │ Engine         │ │
│  │ ─────────────    │  │ ──────────────── │  │ ──────────────┘ │
│  │ • Station data   │  │ • Mini-map       │  │ • Alert sounds │ │
│  │ • Fullscreen RTT │  │ • Alert queue    │  │ • Ambient hum  │ │
│  │ • Scanlines      │  │ • Status bars    │  │ • Interaction  │ │
│  │ • Bloom shader   │  │ • Crosshair      │  │ • Feedback     │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│           ↑                     ↑                      ↑          │
│      (Screens)           (2D Overlay)            (Audio)          │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                      Real-time Data Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ useBridgeAlert│ │ useUserGoalsV2│ │ useTasksV2   │  (Hooks)   │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────────────────────────────────────────────┘
```

---

## COMPONENT RESPONSIBILITIES

### StarshipBridgeScene (Core)
**File:** `src/components/bridge/StarshipBridgeScene.jsx`

**Responsibilities:**
- Initialize Three.js scene, camera, renderer
- Create station meshes and lighting
- Manage animation loop
- Coordinate all subsystems
- Handle window resize/responsive layout

**Props In:**
```javascript
{
  walletBalance: number,
  activeIdentities: Array,
  recentTasks: Array,
  todayEarned: number,
  onStationFocus: Function,
  onOpenSectorMap: Function,
}
```

**Key Methods:**
```javascript
// Called every frame
animate() {
  // Update all subsystems
  povController.update()
  particleManager.update()
  alertSystem.update()
  renderer.render(scene, camera)
}

// Click detection
onStationClick(event) {
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(stations)
  povController.focusStation(intersects[0])
}
```

---

### BridgePOVController
**File:** `src/components/bridge/BridgePOVController.jsx`

**Responsibilities:**
- Manage camera state and animations
- Control 4 POV modes (Standard/Fullscreen/Orbit/Free-Look)
- Apply depth-of-field effects
- Handle lens distortion
- Smooth transitions between POVs

**Core Logic:**
```javascript
class BridgePOVController {
  constructor(camera, scene, renderer) {
    this.camera = camera
    this.mode = 'standard' // standard | fullscreen | orbit | freelook
    this.targetFOV = 75
    this.targetPosition = {x:0, y:1.6, z:3}
    this.depthOfField = { enabled: false, fStop: 8.0 }
  }

  focusStation(station) {
    // Animate camera to station
    // FOV: 75 → 35
    // Position: center → screen normal
    // Duration: 1.2s
    // Easing: Power3.easeInOut
    this.animateToTarget(station.screenPosition, 35, 1200)
  }

  returnToCenter() {
    // Reverse animation
    this.animateToTarget({x:0, y:1.6, z:3}, 75, 1200)
  }

  update() {
    // Apply easing
    // Update FOV
    // Update position
    // Apply DOF calculations
  }

  setMode(mode) {
    this.mode = mode
    // Apply mode-specific effects
  }
}
```

**State Variables:**
```javascript
{
  mode: 'standard',              // Current POV mode
  isAnimating: boolean,          // In transition?
  targetFOV: number,             // Target field of view
  targetPosition: Vector3,       // Target camera position
  depthOfField: {
    enabled: boolean,
    focusDistance: number,       // Where to focus
    fStop: number,               // Blur strength (2.0-16.0)
  },
  animationProgress: 0.0,        // 0.0 - 1.0 animation timeline
  easingFunction: Function,      // Cubic/quad easing
}
```

---

### BridgeAlertSystem
**File:** `src/components/bridge/BridgeAlertSystem.jsx`

**Responsibilities:**
- Listen for alert events from backend
- Queue alerts by severity
- Trigger visual/audio responses
- Auto-dismiss old alerts
- Coordinate with particle system

**Alert Event Types:**
```javascript
const AlertTypes = {
  TASK_COMPLETED: {
    severity: 'info',
    color: 'green',
    duration: 2000,
    particleCount: 50,
    audio: 'chime',
  },
  TASK_FAILED: {
    severity: 'warning',
    color: 'yellow',
    duration: 2000,
    particleCount: 100,
    audio: 'alert',
  },
  CRITICAL_ERROR: {
    severity: 'critical',
    color: 'red',
    duration: 3000,
    particleCount: 300,
    audio: 'alarm',
  },
  MILESTONE_REACHED: {
    severity: 'success',
    color: 'gold',
    duration: 4000,
    particleCount: 200,
    audio: 'fanfare',
  },
}
```

**Hook Usage:**
```javascript
function useBridgeAlerts() {
  const [alerts, setAlerts] = useState([])
  const [alertQueue, setAlertQueue] = useState([])

  useEffect(() => {
    // Subscribe to alert events
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      const alert = mapEventToAlert(event)
      handleNewAlert(alert)
    })
    return unsubscribe
  }, [])

  const handleNewAlert = (alert) => {
    setAlerts(prev => [...prev, alert])
    triggerVisualEffects(alert)
    triggerAudio(alert)
    
    // Auto-dismiss after duration
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id))
    }, alert.duration)
  }

  return { alerts, alertQueue }
}
```

---

### BridgeParticleManager
**File:** `src/components/bridge/BridgeParticleManager.jsx`

**Responsibilities:**
- Manage multi-layer particle system
- Emit/destroy particles on demand
- Apply forces (drift, attraction, repulsion)
- Update particle properties (color, opacity, size)
- Optimize for performance

**Layer System:**
```javascript
class BridgeParticleManager {
  constructor(scene) {
    this.layers = {
      cosmicDust: new ParticleLayer({
        count: 200,
        size: 0.3-0.8,
        speed: 0.01-0.05,
        opacity: 0.2,
        color: [0xcccccc, 0x6699ff],
        lifespan: Infinity,
      }),
      
      energyParticles: new ParticleLayer({
        count: 500,
        size: 0.05-0.15,
        speed: 0.5-2.0,
        opacity: 0.8,
        color: [0x00e8ff, 0xff2ec4],
        lifespan: 3000-5000,
        emission: 'continuous',
      }),
      
      alertBurst: new ParticleLayer({
        count: 0, // On-demand
        size: 0.1-0.5,
        speed: 1.0-5.0,
        opacity: 1.0,
        color: 'dynamic',
        lifespan: 500-1000,
        emission: 'on-trigger',
      }),
      
      stationAura: new ParticleLayer({
        count: 0, // When focused
        size: 0.08-0.2,
        speed: 0.2,
        opacity: 0.6,
        color: 'station-color',
        lifespan: Infinity,
        pattern: 'orbit',
      }),
    }
  }

  triggerAlertBurst(position, color, count) {
    // Spawn particles at position
    // Radial expansion pattern
    // Fade and decay
  }

  focusStation(station) {
    // Activate station aura layer
    // Particles begin orbiting
    // Color matches station
  }

  unfocusStation() {
    // Fade out aura particles
    // Return to normal drift
  }

  update() {
    // Update all layers
    // Apply forces
    // Update positions
    // Handle lifespan
    // Render to screen
  }
}
```

---

### BridgeScreenRenderer
**File:** `src/components/bridge/BridgeScreenRenderer.jsx`

**Responsibilities:**
- Render station screen content (RTT - Render-to-Texture)
- Display financial/identity/task data
- Apply shader effects (scanlines, bloom, glitch)
- Handle screen interactions
- Update content with real-time data

**Screen Types:**
```javascript
const ScreenTypes = {
  TACTICAL: {
    content: 'Financial Dashboard',
    layout: 'vertical-split',
    metrics: ['balance', 'today', 'weekly', 'transactions'],
    updateFrequency: 1000, // ms
  },
  COMMS: {
    content: 'Identity Management',
    layout: 'list',
    metrics: ['active_identities', 'status', 'last_used'],
    updateFrequency: 2000,
  },
  LOG: {
    content: 'Task Queue',
    layout: 'timeline',
    metrics: ['queued', 'running', 'completed', 'failed'],
    updateFrequency: 500,
  },
}
```

**Shader Pipeline:**
```glsl
// Fragment shader for station screens
void main() {
  vec4 color = texture2D(screenTexture, uv);
  
  // Apply scanlines
  color += scanlines(uv) * 0.1;
  
  // Apply bloom (screen edges)
  float bloom = smoothstep(0.5, 1.0, length(uv - 0.5)) * 0.3;
  color += vec4(vec3(bloom), 0.0);
  
  // Optional: chromatic aberration on alert
  if (uAlert > 0.0) {
    vec2 offset = vec2(sin(uv.y * 10.0) * 0.01, 0.0);
    vec4 r = texture2D(screenTexture, uv + offset);
    vec4 g = color;
    vec4 b = texture2D(screenTexture, uv - offset);
    color = vec4(r.r, g.g, b.b, 1.0);
  }
  
  // Apply glitch (random distortion)
  if (uGlitch > 0.0) {
    vec2 glitchOffset = vec2(
      sin(uv.y * 100.0 + uTime) * 0.02,
      sin(uv.x * 100.0 + uTime) * 0.01
    ) * uGlitch;
    color = mix(color, texture2D(screenTexture, uv + glitchOffset), uGlitch);
  }
  
  gl_FragColor = color;
}
```

---

### BridgeHUDOverlay
**File:** `src/components/bridge/BridgeHUDOverlay.jsx`

**Responsibilities:**
- Render 2D UI overlays on top of 3D scene
- Display mini-map (top-down station view)
- Show alert notification queue
- Render status bars and metrics
- Handle keyboard input (ESC, etc.)

**Layout:**
```
┌──── TOP-LEFT ────┐                ┌──── TOP-RIGHT ────┐
│ System Status    │                │ FPS: 60           │
│ Alerts: 2        │                │ Time: 14:32       │
└──────────────────┘                │ Network: Online   │
                                    └───────────────────┘

┌──── BOTTOM-LEFT ──────────┐
│ MINI-MAP                  │
│ ┌─────────────────────┐   │
│ │ ◯   ◯   ◯          │   │
│ │      ┌─────────┐   │   │
│ │ ◻─────┤ Focused │───┼──│   ← You are here
│ │      └─────────┘   │   │
│ │ ◻          ◻       │   │
│ └─────────────────────┘   │
│ TACTICAL | COMMS | LOG    │
└───────────────────────────┘

                         ┌──── BOTTOM-RIGHT ──────────┐
                         │ ALERTS                     │
                         │ ──────────────────────────│
                         │ ✓ Task Complete (2s)      │
                         │ ⚠ Low Balance (5s)        │
                         │ ✗ Failed Review (pending) │
                         └────────────────────────────┘

             ┌──── CENTER ────┐
             │      🎯        │
             │ Crosshair      │
             │ (dynamic color)│
             └────────────────┘
```

**React Implementation:**
```javascript
function BridgeHUDOverlay({ alerts, station, povMode, miniMap }) {
  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Top-Left Status */}
      <div className="absolute top-6 left-6 pointer-events-auto">
        <SystemStatus />
      </div>

      {/* Top-Right Info */}
      <div className="absolute top-6 right-6 text-right text-xs">
        <div>FPS: {fps}</div>
        <div>{currentTime}</div>
        <div>{networkStatus}</div>
      </div>

      {/* Bottom-Left Mini-Map */}
      <div className="absolute bottom-6 left-6 pointer-events-auto">
        <MiniMap stations={stations} focused={station} />
      </div>

      {/* Bottom-Right Alert Queue */}
      <div className="absolute bottom-6 right-6 space-y-2">
        {alerts.map(alert => (
          <AlertNotification key={alert.id} alert={alert} />
        ))}
      </div>

      {/* Center Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <DynamicCrosshair mode={povMode} focused={station} />
      </div>
    </div>
  )
}
```

---

### BridgeAudioEngine
**File:** `src/components/bridge/BridgeAudioEngine.jsx`

**Responsibilities:**
- Play alert sounds based on severity
- Manage ambient background audio
- Control volume and spatial audio
- Sync audio with visual effects

**Sound Map:**
```javascript
const SoundMap = {
  'info': '/audio/chime.mp3',        // 200ms
  'warning': '/audio/alert.mp3',     // 500ms
  'critical': '/audio/alarm.mp3',    // 1000ms
  'success': '/audio/fanfare.mp3',   // 2000ms
  'ambient': '/audio/bridge-hum.mp3', // looping
}

class BridgeAudioEngine {
  playAlert(severity) {
    const audio = new Audio(SoundMap[severity])
    audio.volume = VolumeMap[severity] // 0.3-0.8
    audio.play()
  }

  startAmbient() {
    this.ambientAudio = new Audio(SoundMap['ambient'])
    this.ambientAudio.loop = true
    this.ambientAudio.volume = 0.15
    this.ambientAudio.play()
  }

  stopAmbient() {
    this.ambientAudio.pause()
  }
}
```

---

## DATA FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Real-time Events)              │
│  • Task completions                                        │
│  • Wallet updates                                          │
│  • Identity status changes                                 │
│  • Error alerts                                            │
└────────────────┬────────────────────────────────────────────┘
                 │ WebSocket/Polling
                 ↓
         ┌──────────────────┐
         │ useBridgeAlerts  │ ← Custom Hook
         │ (Subscribes)     │
         └────────┬─────────┘
                  │ Alert Event Object
                  ↓
    ┌─────────────────────────────┐
    │ BridgeAlertSystem           │
    │ • Processes alert           │
    │ • Maps to severity          │
    │ • Queues visual effects     │
    └──┬──────────────┬───────────┘
       │              │
       │ (Particle)   │ (Visual)
       ↓              ↓
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │Particle  │   │POV Ctrl  │   │HUD       │
    │Manager   │   │(chromatic│   │Overlay   │
    │(burst)   │   │aberr.)   │   │(toast)   │
    └──────────┘   └──────────┘   └──────────┘
                        │
                  (Audio Event)
                        ↓
                   ┌──────────┐
                   │ Audio    │
                   │ Engine   │
                   │(plays    │
                   │ beep)    │
                   └──────────┘
```

---

## STATE MANAGEMENT STRATEGY

**Local Component State** (Managed by React hooks):
- Current POV mode
- Focused station
- Alert queue
- Camera animation progress
- Particle emissions

**Real-time Data** (Via React Query/custom hooks):
- Wallet balance
- Task list
- Identity list
- Transactions
- Notifications

**Derived State** (Computed from above):
- Screen content (tactical/comms/log)
- Alert severity thresholds
- Mini-map positions
- HUD metrics

```javascript
// Hook structure
function useBridgeState() {
  const [povMode, setPovMode] = useState('standard')
  const [focusedStation, setFocusedStation] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [animationProgress, setAnimationProgress] = useState(0)

  // Real-time data
  const { goals } = useUserGoalsV2()
  const { tasks } = useTasksV2()
  const { identities } = useAIIdentitiesV2()

  // Derived state
  const screenContent = useMemo(() => {
    if (focusedStation === 'tactical') {
      return getFinancialContent(goals, tasks)
    }
    // ... other stations
  }, [focusedStation, goals, tasks])

  return {
    povMode, focusedStation, alerts, animationProgress,
    goals, tasks, identities, screenContent
  }
}
```

---

## PERFORMANCE OPTIMIZATION

**GPU Optimization:**
- Use InstancedMesh for repeated geometry
- Batch particle updates in compute shader (if WebGL2)
- Use LOD (Level of Detail) for distant objects
- Frustum culling for off-screen elements

**CPU Optimization:**
- Throttle alert processing (max 1 alert per 100ms)
- Use requestAnimationFrame for smooth 60 FPS
- Lazy load screen textures
- Debounce window resize (200ms)

**Memory Optimization:**
- Reuse particle buffers (don't create new arrays)
- Pool alert objects (create/destroy reuse)
- Limit alert history to last 10
- Dispose unused geometries/materials

---

## TESTING STRATEGY

**Unit Tests:**
```javascript
describe('BridgePOVController', () => {
  it('should smoothly animate camera to station', () => {
    const controller = new BridgePOVController(camera)
    controller.focusStation(mockStation)
    
    // Progress to 50%
    controller.update(600)
    expect(controller.animationProgress).toBe(0.5)
    
    // Check position interpolation
    const midPos = controller.camera.position
    expect(midPos).toApproximatelyEqual(expectedMidpoint, 0.1)
  })
})

describe('BridgeAlertSystem', () => {
  it('should queue alerts by severity', () => {
    const system = new BridgeAlertSystem()
    system.handleAlert(mockCriticalAlert)
    
    expect(system.alerts).toContain(mockCriticalAlert)
    expect(system.audioEngine.lastPlayed).toBe('critical')
  })
})
```

**Integration Tests:**
```javascript
describe('StarshipBridge Full Integration', () => {
  it('should handle click-to-focus workflow', () => {
    render(<StarshipBridge />)
    
    const tacticalStation = screen.getByTestId('tactical-station')
    fireEvent.click(tacticalStation)
    
    // Should show fullscreen screen after animation
    waitFor(() => {
      expect(screen.getByTestId('tactical-screen')).toBeVisible()
    })
  })
})
```

---

## NEXT STEPS

1. ✅ **Audit Complete** - Current state documented
2. ✅ **Plan Complete** - Architecture designed
3. → **Phase 1 Implementation** - BridgePOVController
4. → **Phase 1 Implementation** - BridgeParticleManager
5. → **Phase 1 Implementation** - BridgeAlertSystem
6. → **Phase 2 Implementation** - BridgeScreenRenderer
7. → **Phase 3 Implementation** - BridgeAudioEngine
8. → **Testing & Polish** - Optimization & refinement