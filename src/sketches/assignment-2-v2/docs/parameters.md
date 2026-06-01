# Parameter Reference

All tunable values across the sketch. GUI-exposed params can be adjusted live; constants require a code change and page reload.

> **Current focus:** nerve layer animation (NerveLayer.js). No GUI params yet — see NerveLayer.js directly.  
> The gel surface and crystal layer params below are retained for future work but are not the active priority.

---

## Input / Debug panel (GUI)

These control how raw tracking data is turned into wave disturbance.

| Parameter | GUI label | Default | Range | Effect |
|---|---|---|---|---|
| `appParams.inputSource` | Input Source | `'face'` | face / mouse / hand | Which input drives the signal. Falls back to mouse if the camera isn't ready yet. |
| `appParams.showDebugOverlay` | Show Debug Overlay | `true` | toggle | Shows/hides the 120 px debug strip at the top of the canvas. |
| `waveSurface.params.useVelocity` | Use Velocity (not Accel) | `false` | toggle | Switches the input signal driving the gel surface. `false` = `accelX`, `true` = `velX`. |
| `waveSurface.params.responseAlpha` | Response EMA | `0.95` | 0.5 – 0.99 | EMA factor for both the peak position and amplitude rolling averages. Higher = more sluggish/inertial response. |

### How input maps to the gel surface

Both the **peak position** and the **amplitude** of the bell curve are driven by a single rolling average (EMA) of the chosen input signal:

1. **Signed EMA → peak position**  
   `#muEMA = #muEMA × α + input × (1−α)` — the signed running average of `accelX` (or `velX`). Multiplied by `muScale` to get the peak X position in world space. When the user moves right, `muEMA` grows positive → bell peak shifts right. When motion stops, EMA decays back toward zero → peak drifts back to centre.

2. **Unsigned EMA → amplitude**  
   `#ampEMA = #ampEMA × α + |input| × (1−α)` — the magnitude EMA. Multiplied by `amplitudeScale` → bell height. Fast movement = tall bell. Stillness = flat surface (only idle background wave remains).

3. **Asymmetry (gamma-like shape)**  
   The leading edge (same direction as current displacement) uses a smaller σ (steeper). The trailing edge uses a larger σ (longer tail). This mimics the physical gel: the membrane is compressed on the leading side and stretched on the trailing side.

---

## Gel Surface panel (GUI)  *(branch: feat/gel-surface)*

Replaces the oscillating wave physics with a gamma-like bell curve whose peak and amplitude track the user's movement.

| Parameter | GUI label | Default | Range | Effect |
|---|---|---|---|---|
| `waveSurface.params.amplitudeScale` | Amplitude Scale | `300` | 0 – 1000 | `#ampEMA × this` → bell height. Set higher for more dramatic surface deformation. |
| `waveSurface.params.muScale` | Peak Position Scale | `1500` | 0 – 5000 | `#muEMA × this` → peak X in world units. Higher = bell shifts further per unit of input. |
| `waveSurface.params.sigma` | Bell Width (σ) | `180` | 10 – 400 | Half-width of the bell in world units. σ=180 covers ~45% of the 800-unit grid width. |
| `waveSurface.params.asymmetryScale` | Asymmetry | `0.5` | 0 – 1 | `0` = symmetric Gaussian. `1` = strong gamma-like shape (steep leading edge, long trailing tail). |
| `waveSurface.params.bgAmplitude` | Idle Wave Amp | `2.5` | 0 – 20 | Amplitude of the background roll when there is no motion. |
| `waveSurface.params.bgSpeed` | Idle Wave Speed | `0.4` | 0 – 2 | Angular frequency of the background Z-direction roll. |
| `waveSurface.params.bgFreq` | Idle Wave Freq | `0.008` | 0 – 0.03 | Spatial frequency of the background wave. |

### Height formula (gel surface)

```
σ_eff = σ × max(0.1,  1 − asymmetry × 0.45 × sign(muEMA) × sign(d))
bell  = ampEMA × amplitudeScale × exp(−d² / (2 σ_eff²))
bg    = bgAmplitude × sin(bgFreq × wz − bgSpeed × t)
h     = bell + bg
```

where `d = wx − muEMA × muScale` and `wz` is the world depth coordinate.

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
