# STARSHIP BRIDGE GAMIFICATION - SYSTEM DIAGRAMS

Complete visual architecture and interaction flows for the gamified upgrade.

---

## 1. COMPONENT ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                    StarshipBridge Page                              │
│                  (src/pages/StarshipBridge.jsx)                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐    ┌──────────────┐    ┌──────────────┐
    │ Sector  │    │ Starship     │    │ Other Pages  │
    │ Map     │    │ Bridge Scene │    │ (Dashboard)  │
    └─────────┘    └──────┬───────┘    └──────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ Three.js    │  │ Alert System │  │ HUD Overlay      │
    │ Scene       │  │ (Real-time)  │  │ (React 2D)       │
    └──────┬──────┘  └──────┬───────┘  └──────────────────┘
           │                │
    ┌──────┴────────────────┴──────────────────┐
    │         Real-time Data Layer             │
    │                                          │
    │  ┌─────────────┐  ┌─────────────────┐   │
    │  │ useUserGoal │  │ useBridgeAlerts │   │
    │  │ V2          │  │ (NEW)           │   │
    │  └─────────────┘  └─────────────────┘   │
    │                                          │
    │  ┌─────────────┐  ┌──────────────────┐  │
    │  │ useTasksV2  │  │ useIdentitiesV2  │  │
    │  └─────────────┘  └──────────────────┘  │
    └──────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│               Three.js 3D Scene Internals                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐    ┌──────────────────┐                 │
│  │ BridgePOV       │    │ BridgeParticle   │                 │
│  │ Controller      │    │ Manager          │                 │
│  │ (Camera Zoom)   │    │ (4 Layer System) │                 │
│  └────────┬────────┘    └────────┬─────────┘                 │
│           │                      │                            │
│        Camera                Particles                         │
│     (FOV, Position)     (700-1200 total)                       │
│                                                                │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │ BridgeAlert      │    │ BridgeScreen     │               │
│  │ System           │    │ Renderer         │               │
│  │ (Event Queue)    │    │ (Station Displays)               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                          │
│      Visual FX                Screen Data                    │
│    (Glows, Bursts)        (Financial/Identity/Tasks)        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. DATA FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────┐
│              Backend / Real-time Events                  │
│  (Task Completion, Errors, Milestones, Notifications)  │
└───────────────────┬──────────────────────────────────────┘
                    │
                    │ WebSocket / Polling
                    ▼
        ┌───────────────────────┐
        │  useBridgeAlerts      │ ← React Hook
        │  (Subscribes & Maps)  │
        └──────────┬────────────┘
                   │ Alert Event Object
                   │ {type, severity, station, timestamp}
                   ▼
        ┌──────────────────────────────┐
        │  BridgeAlertSystem           │
        │  (Routes to Effects)         │
        └──────┬──────┬─────────┬──────┘
               │      │         │
        ┌──────▼──┐  │  ┌──────▼──┐
        │Particle │  │  │Audio    │
        │Burst    │  │  │Engine   │
        └──────┬──┘  │  └─────┬───┘
               │     │        │
        ┌──────▼─────▼────────▼──────┐
        │  Visual Effect Chain       │
        │                            │
        │ 1. Color Flash            │
        │ 2. Particle Burst         │
        │ 3. Audio Beep             │
        │ 4. HUD Toast              │
        │ 5. Auto Dismiss (2-4s)    │
        └────────────────────────────┘
```

---

## 3. CAMERA ANIMATION FLOW

```
User Clicks Station
        │
        ▼
Raycaster Detects Click
        │
        ▼
BridgePOVController.focusStation(station)
        │
        ├─ Set animationStart = Date.now()
        ├─ Set targetFOV = 35 (from 75)
        ├─ Set targetPosition = screen normal (45°)
        ├─ Enable depthOfField (fStop 8.0)
        │
        ▼
Animation Loop (Every Frame)
        │
        ├─ Calculate elapsed time
        ├─ Calculate progress (0.0 → 1.0)
        ├─ Apply cubic easing
        ├─ Interpolate FOV
        ├─ Interpolate position
        ├─ Update DOF values
        ├─ Update camera
        │
        ▼
Progress = 1.0? (After 1200ms)
        │
        ├─ No  → Repeat animation loop
        │
        ├─ Yes → Animation complete
        │       │
        │       ├─ isAnimating = false
        │       ├─ Show fullscreen display
        │       └─ Fire onStationFocus callback
        │
        ▼
Focused Station Display
        │
        ├─ User sees fullscreen data
        ├─ Background blurred (DOF)
        ├─ Station glowing
        ├─ Particles orbiting
        │
        ▼
User Presses ESC or Clicks Background
        │
        ▼
BridgePOVController.returnToCenter()
        │
        ├─ Set animationStart = Date.now()
        ├─ Set targetFOV = 75 (from 35)
        ├─ Set targetPosition = (0, 1.6, 3)
        ├─ Disable depthOfField
        │
        ▼
Animation Loop (Reverse)
        │
        ├─ Calculate progress (0.0 → 1.0)
        ├─ Interpolate FOV (35 → 75)
        ├─ Interpolate position (screen → center)
        ├─ Fade out DOF
        │
        ▼
Progress = 1.0? (After 1200ms)
        │
        └─ Yes → Return to center, show HUD, reset state
```

---

## 4. PARTICLE SYSTEM LIFECYCLE

```
┌─────────────────────────────────────────────────────────┐
│        Particle System State Transitions                │
└─────────────────────────────────────────────────────────┘

INITIALIZATION
        │
        ├─ Layer 1: Cosmic Dust (200 particles)
        │   Position: Random in space
        │   Velocity: Slow drift (0.01-0.05)
        │   Status: Always active
        │
        ├─ Layer 2: Energy (500 particles)
        │   Position: Random in space
        │   Velocity: Medium (0.5-2.0)
        │   Status: Always emitting
        │
        ├─ Layer 3: Station Aura (0 particles)
        │   Status: Inactive (spawns on focus)
        │
        └─ Layer 4: Alert Burst (0 particles)
           Status: Inactive (spawns on alert)

USER BROWSING BRIDGE
        │
        ▼
Frame Update Loop
        │
        ├─ Update dust positions (slow drift)
        ├─ Update energy positions (medium flow)
        ├─ Update opacity (maintains values)
        │
        ▼
Layer Count: ~700 particles
FPS Impact: -7 to -8 fps


STATION FOCUSED (Click)
        │
        ├─ BridgePOVController.focusStation()
        │   Station begins glowing
        │
        ├─ BridgeParticleManager.focusStation()
        │   │
        │   ├─ Create 50 aura particles
        │   ├─ Orbit around station
        │   ├─ Color = station color
        │   └─ Add to scene
        │
        ├─ Particle density increases
        │   └─ ~750 particles total
        │
        ▼
Layer Count: ~750 particles
FPS Impact: -8 to -9 fps


ALERT TRIGGERED (Notification Event)
        │
        ├─ useBridgeAlerts() detects event
        │
        ├─ BridgeAlertSystem.handleAlert()
        │   │
        │   ├─ Determine severity (info/warning/critical)
        │   ├─ Select color (green/yellow/red)
        │   └─ Call triggerAlertBurst()
        │
        ├─ BridgeParticleManager.triggerAlertBurst()
        │   │
        │   ├─ Spawn 50-500 particles at position
        │   ├─ Radial explosion pattern
        │   ├─ Fast velocity (1.0-5.0)
        │   ├─ Color = severity color
        │   └─ Set lifespan = 500-1000ms
        │
        ├─ Particle burst explodes outward
        │   Density peaks at ~1200 particles
        │
        ▼
Layer Count: ~1200 particles (peak)
FPS Impact: -15 to -18 fps (temporary)


ALERT DECAY (500-1000ms)
        │
        ├─ Burst particles fade opacity
        ├─ Particles travel outward then slow
        ├─ Lifespan counter increments
        │
        ▼
Burst particles removed after lifespan
        │
        ├─ Layer 1: Still 200 (dust)
        ├─ Layer 2: Still 500 (energy)
        ├─ Layer 3: Still 50 (aura if focused)
        └─ Layer 4: Now 0 (burst decayed)


STATION UNFOCUSED (ESC or Click)
        │
        ├─ BridgePOVController.returnToCenter()
        │
        ├─ BridgeParticleManager.unfocusStation()
        │   │
        │   ├─ Begin fading aura particles
        │   ├─ Fade over 300ms
        │   └─ Remove from scene
        │
        ▼
Layer Count: ~700 particles
FPS Impact: -7 to -8 fps (normal)


FRAME RATE SCALING (Performance Optimization)
        │
        Detected FPS < 50?
        │
        ├─ Yes → Reduce particle count
        │   ├─ Dust: 200 → 100
        │   ├─ Energy: 500 → 250
        │   └─ Burst: Capped at 100 particles
        │
        └─ No → Keep full particle count
```

---

## 5. ALERT EVENT PROCESSING PIPELINE

```
Backend Event
(Task Completed, Error, Milestone, etc)
        │
        ▼
Notification Entity Change
(Real-time subscription)
        │
        ▼
useBridgeAlerts Hook
        │
        ├─ Detects event type
        ├─ Maps to AlertType
        └─ Calls onAlert callback
        
        ▼
BridgeAlertSystem.handleAlert()
        │
        ├─ Create alert object
        ├─ Add to queue
        ├─ Set timestamp
        ├─ Determine duration
        │
        ├─ Call triggerVisualEffects()
        │   │
        │   ├─ Get particle count by severity
        │   ├─ Get color by alert type
        │   ├─ Call particleManager.triggerAlertBurst()
        │   │   └─ 50-500 particles explode
        │   │
        │   ├─ For CRITICAL: Trigger glitch shader
        │   └─ Set station highlight
        │
        ├─ Call triggerAudio()
        │   │
        │   └─ Play sound by severity
        │       ├─ info → chime (200ms)
        │       ├─ warning → alert (500ms)
        │       ├─ critical → alarm (1000ms)
        │       └─ success → fanfare (2000ms)
        │
        └─ Call onHUDUpdate()
            │
            ├─ Show toast notification
            ├─ Add to alert queue
            ├─ Schedule auto-dismiss
            │
            ▼ (After duration expires)
            │
            ├─ Remove from queue
            ├─ Update HUD
            └─ Alert cycle complete
```

---

## 6. HUD OVERLAY LAYOUT

```
┌───────────────────────────────────────────────────────────────────┐
│                    SCREEN VIEWPORT                               │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─ TOP-LEFT ────────┐                 ┌──── TOP-RIGHT ─────────┐ │
│ │ SYS STAT          │                 │ FPS: 60               │ │
│ │ ⚠ Alerts: 2       │                 │ Time: 14:32           │ │
│ └───────────────────┘                 │ Network: Online       │ │
│                                       └───────────────────────┘ │
│                                                                   │
│                   🎯                                              │
│               (Dynamic Crosshair)                                │
│             (Changes color by state)                             │
│                                                                   │
│ ┌─ BOTTOM-LEFT ──────────────────┐                             │
│ │ MINI-MAP                        │                             │
│ │ ┌─────────────────────────────┐ │                             │
│ │ │ ◯   ◯   ◯                   │ │                             │
│ │ │    ┌──────────┐              │ │                             │
│ │ │ ◻─  │ FOCUSED  │── ◯         │ │ ← Station Positions        │
│ │ │    └──────────┘              │ │   (Top-down view)          │
│ │ │ ◻              ◻             │ │                             │
│ │ └─────────────────────────────┘ │                             │
│ │ [TAC] | [COM] | [LOG]           │                             │
│ └─────────────────────────────────┘                             │
│                                                                   │
│                                    ┌─ BOTTOM-RIGHT ───────────┐ │
│                                    │ ALERTS                  │ │
│                                    │ ──────────────────────  │ │
│                                    │ ✓ Task Done (1s)       │ │
│                                    │ ⚠ Low Balance (4s)     │ │
│                                    │ ✗ Failed Review        │ │
│                                    │   (pending)            │ │
│                                    └────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

NOTE: All HUD elements are positioned FIXED (don't move with 3D camera)
      They layer on top of the 3D canvas with pointer-events control
```

---

## 7. PHASE IMPLEMENTATION PROGRESSION

```
PHASE 1: Core (11h)
├─ Week 1 (8h)
│  ├─ BridgePOVController (4h)
│  │  └─ Camera zoom from 75° → 35°
│  │  └─ Pan to station (1.2s)
│  │  └─ Enable DOF blur
│  │
│  ├─ BridgeParticleManager (3h)
│  │  ├─ Layer 1: Cosmic dust
│  │  ├─ Layer 2: Energy particles
│  │  └─ Layer 3: Station aura (stub)
│  │
│  └─ Integration (1h)
│     └─ Inject into StarshipBridgeScene
│
└─ Week 2 (3h)
   ├─ BridgeAlertSystem (3h)
   │  ├─ Queue alerts
   │  ├─ Trigger bursts
   │  └─ Manage lifecycle
   │
   └─ useBridgeAlerts Hook (1h)
      └─ Subscribe to Notifications

   STATUS: ✅ Click-to-focus works with particles & alerts


PHASE 2: Polish (12h)
├─ Week 3 (8h)
│  ├─ BridgeScreenRenderer (5h)
│  │  ├─ Financial display
│  │  ├─ Identity management
│  │  └─ Task tracking
│  │
│  └─ PostProcessing Shaders (3h)
│     ├─ Bloom effect
│     ├─ Chromatic aberration
│     └─ Glitch distortion
│
└─ Week 3/4 (4h)
   ├─ BridgeHUDOverlay (3h)
   │  ├─ Mini-map
   │  ├─ Alert queue
   │  └─ Dynamic crosshair
   │
   └─ Testing (1h)
      └─ FPS optimization

   STATUS: ✅ Fullscreen immersive displays


PHASE 3: Audio (5h)
└─ Week 4 (5h)
   ├─ BridgeAudioEngine (2h)
   │  ├─ Alert beeps
   │  ├─ Ambient hum
   │  └─ Interaction sounds
   │
   └─ Final Testing (3h)
      ├─ Performance
      ├─ Cross-browser
      └─ Device compatibility

   STATUS: ✅ Complete immersive experience
```

---

## 8. PERFORMANCE MONITORING DIAGRAM

```
Frame Rate Monitoring Loop
        │
        ▼
Measure FPS (60 target)
        │
        ├─ Current FPS ≥ 55?
        │  │
        │  ├─ Yes → Continue normal mode
        │  │   └─ 700 particles
        │  │   └─ Full quality
        │  │
        │  └─ No → Enter reduced mode
        │      ├─ 350 particles (50% dust, 50% energy)
        │      ├─ Reduce burst caps (max 100)
        │      ├─ Reduce alert burst size
        │      └─ Disable LOD effects
        │
        ▼
Next Frame
        │
        └─ Repeat monitoring
```

---

## 9. FILE DEPENDENCY DIAGRAM

```
StarshipBridge.jsx (Page)
        │
        ├─ imports→ StarshipBridgeScene.jsx
        │              │
        │              ├─ imports→ BridgePOVController.jsx
        │              │              (uses: camera, scene)
        │              │
        │              ├─ imports→ BridgeParticleManager.jsx
        │              │              (uses: scene)
        │              │
        │              ├─ imports→ BridgeAlertSystem.jsx
        │              │              (uses: particleManager, audioEngine)
        │              │
        │              ├─ imports→ BridgeHUDOverlay.jsx
        │              │              (uses: alerts state)
        │              │
        │              ├─ imports→ BridgeAudioEngine.jsx
        │              │              (uses: audio API)
        │              │
        │              └─ imports→ useBridgeAlerts.js (Hook)
        │                         (uses: base44.entities.Notification)
        │
        └─ imports→ SectorMapView.jsx (existing)
```

---

## 10. STATE TREE DIAGRAM

```
StarshipBridgeScene Component State
│
├─ focusedStation: string | null
│  ├─ "tactical" → Display financial data
│  ├─ "comms" → Display identities
│  ├─ "log" → Display tasks
│  └─ null → Show normal view
│
├─ cameraAnimating: boolean
│  ├─ true → Camera in motion (locked)
│  └─ false → Camera idle (clickable)
│
├─ alerts: Array<Alert>
│  ├─ Alert { id, type, message, severity, timestamp }
│  └─ Max 5 visible in HUD
│
├─ povMode: 'standard' | 'fullscreen' | 'orbit' | 'freelook'
│  └─ Controls camera behavior
│
└─ particleState: Object
   ├─ dustActive: true (always)
   ├─ energyActive: true (always)
   ├─ auraActive: boolean (when focused)
   └─ burstActive: boolean (when alert)
```

---

**Diagrams Complete** ✓  
All visual system architecture documented.