# Parameter Reference

All tunable values across the sketch. GUI-exposed params can be adjusted live; constants require a code change and page reload.

---

## Input / Debug panel (GUI)

These control how raw tracking data is turned into wave disturbance.

| Parameter | GUI label | Default | Range | Effect |
|---|---|---|---|---|
| `appParams.inputSource` | Input Source | `'face'` | face / mouse / hand | Which input drives the signal. Falls back to mouse if the camera isn't ready yet. |
| `appParams.showDebugOverlay` | Show Debug Overlay | `true` | toggle | Shows/hides the 120 px debug strip at the top of the canvas. |
| `waveSurface.params.accelBoostScale` | Accel → Radial Boost | `300` | 0 – 1000 | Multiplier applied to `|accelX|` each frame. The result is added to `ampRadial`, so fast lateral movement creates larger radial ripples. Set to 0 to make the wave unresponsive to motion speed. |
| `waveSurface.params.accelBoostDecay` | Boost Decay (EMA) | `0.85` | 0 – 0.99 | Exponential moving average factor for the boost. `0` = instant (boost drops to zero the frame motion stops). `0.95` = ripples swell and fade over several seconds. Formula per frame: `boost = boost × decay + target × (1 − decay)`. |

### How input maps to the wave

1. **Position → ripple origin**  
   `signal.x` (canvas pixels, 0 → width) is mapped linearly to `inputX` in world space (−400 → +400 world units). `inputX` is the centre of the radial ripple — so the disturbance follows the tracked point left/right across the surface.

2. **Acceleration → ripple size**  
   Each frame, `|signal.accelX|` is multiplied by `accelBoostScale` to get a `target` boost. This target is blended into `#accelBoost` via the EMA: `#accelBoost = #accelBoost × decay + target × (1 − decay)`. The boost is added directly to `ampRadial` inside `waveHeight()`, so faster movement = bigger ripples, lingering based on `accelBoostDecay`.

---

## Wave Surface panel (GUI)

Wave physics parameters. These affect the idle/base wave shape regardless of input.

| Parameter | GUI label | Default | Range | Effect |
|---|---|---|---|---|
| `waveSurface.params.ampLinear` | Amp Linear | `4` | 0 – 30 | Amplitude of the background planar wave that rolls across the entire surface (left→right). |
| `waveSurface.params.kLinear` | k Linear | `0.012` | 0.005 – 0.04 | Spatial frequency of the linear wave. Higher = tighter wave crests. |
| `waveSurface.params.omegaLinear` | Omega Linear | `1.0` | 0.2 – 3.0 | Angular frequency (speed) of the linear wave. Higher = faster oscillation. |
| `waveSurface.params.ampRadial` | Amp Radial | `9.5` | 0 – 60 | Baseline amplitude of the radial ripple emanating from `inputX`. Combined with `accelBoost` at runtime. |
| `waveSurface.params.kRadial` | (code only) | `0.025` | — | Spatial frequency of the radial wave. |
| `waveSurface.params.omegaRadial` | (code only) | `1.8` | — | Angular frequency of the radial wave. |
| `waveSurface.params.radialDecay` | Radial Decay | `0.45` | 0.3 – 1.0 | Power-law decay exponent: `1 / r^radialDecay`. Lower = ripples carry further from origin. Higher = ripples die out quickly. |

### Wave height formula

```
h(wx, wz, t) =
    ampLinear  × sin(kLinear × wx − omegaLinear × t)           // planar wave
  + (ampRadial + accelBoost)
      × (1 / max(r, 0.5)^radialDecay)                          // falloff
      × sin(kRadial × r − omegaRadial × t)                     // radial ripple
```

where `r = sqrt((wx − inputX)² + wz²)` and `wx`, `wz` are world-space coordinates.

Vertices are rendered at `y = −h(wx, wz, t)` so positive height = upward in WEBGL space.

---

## Signal smoother (`SignalSmoother.js`)

Internal — not GUI-exposed. Edit `SignalSmoother.js` to change.

| Field | Default | Effect |
|---|---|---|
| `#aPos` | `0.15` | EMA alpha for position. Lower = more lag but smoother. |
| `#aVel` | `0.20` | EMA alpha for velocity. |
| `#aAccel` | `0.25` | EMA alpha for acceleration. |
| `#dzPos` | `1.5` px | Deadzone: position changes smaller than this are ignored. Prevents idle jitter from registering. |
| `#dzVel` | `0.08` px/frame | Deadzone for velocity. |
| `#dzAccel` | `0.008` px/frame² | Deadzone for acceleration. Values below this show as flat zero in the debug plot. |

**Output** — `state = { x, y, velX, velY, accelX, noSignal }`

---

## Scene constants (`WaveSurface.js`)

Code-only. Change and reload.

| Constant | Value | Effect |
|---|---|---|
| `GRID_X` | `60` | Number of columns in the wave mesh. Higher = smoother surface, slower. |
| `GRID_Z` | `60` | Number of rows. |
| `GRID_WIDTH` | `800` | World-space width of the surface. |
| `GRID_DEPTH` | `800` | World-space depth of the surface. |
| `CRYSTAL_COUNT` | `600` | Number of crystal sprites placed on the surface. |
| `EPS` (normal) | `2.0` | Finite-difference step (world units) used to estimate the surface normal for crystal tilt. Smaller = more accurate local tilt; larger = averages over more surface area. |

---

## Camera constants (`WaveSurface.js`)

Code-only.

| Constant | Value | Effect |
|---|---|---|
| `CAM_X/Y/Z` | `0, −30, −150` | Camera position. `CAM_Y = −30` places the camera 30 units above `y=0`, keeping the near edge of the surface in frame. |
| `LOOK_X/Y/Z` | `0, −30, 400` | Look-at point. Same Y as camera → horizontal look. Increasing `LOOK_Z` pans further into the field. |

---

## Debug overlay (`DebugOverlay.js`)

Code-only constants.

| Constant | Default | Effect |
|---|---|---|
| `DebugOverlay.H` | `120` px | Height of the debug strip. |
| `#WINDOW_MS` | `30 000` ms | accelX plot shows this rolling time window. |
| `#MAX_SAMPLES` | `2000` | Safety cap on stored samples (≈ 30 s at 60 fps). |
| `#yMax` (auto) | starts `0.005` | Plot y-scale: grows to match peak `|accelX|`, decays slowly (`× 0.9995` per frame). |
