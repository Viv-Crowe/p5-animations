# Vestibular System Installation — Technical Document v0.1

## Concept Summary

A wide-format interactive installation that immerses participants in a close-up, alien-feeling world they gradually discover is inside their own head. The visual is a cross-section of the otolith organ — the structure responsible for detecting linear acceleration — blown up to fill a large screen. Participant movement drives the animation in real time.

The experience is intentionally ambiguous at first: a strange, beautiful microscopic landscape. The biology reveals itself through interaction and, later, through supporting screens.

---

## Screen Specification

**Physical dimensions:** Approx. 3m high × wide landscape format (aspect ratio TBD based on venue)  
**Rendering environment:** Browser-based (p5.js or Three.js — see stack notes)  
**Interaction input:** Webcam + MediaPipe FaceMesh (v1); depth sensor upgrade planned  
**Participants:** 1–2 at a time, walking past the screen

---

## Visual Layout

The screen is divided into three horizontal bands, read top to bottom as a cross-section of the macula (otolith organ):

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│           CRYSTAL FIELD   (~4/6)            │
│         [otoconia — calcium crystals]       │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│           GEL LAYER       (~1/6)            │
│         [otolithic membrane]                │
├─────────────────────────────────────────────┤
│           NERVE NETWORK   (~1/6)            │
│         [hair cells + vestibular nerve]     │
└─────────────────────────────────────────────┘
```

### Layer 1 — Crystal Field (top ~67%)

- Filled with extended microscope imagery of otoconia (calcium carbonate crystals)
- Source: existing microscope images, extended via Photoshop Generative Fill and/or AI generation to cover full screen dimensions
- Crystals drift and shift subtly in resting state (slow parallax / breathing motion)
- On lateral acceleration (main interaction): crystals slide in the direction of movement — mass displacement effect
- On vertical acceleration: crystals dont move on vertical acceleration, distant

### Layer 2 — Gel Layer (middle ~17%)

- Represents the gelatinous otolithic membrane the crystals sit within
- Visual: semi-transparent, viscous, slightly refractive layer
- has cell structures reaching in, can see a landscape of hairs reaching up into the matrix
- Behaviour: deforms in response to crystal movement above — lags behind, slow recovery
- Could be rendered as a spring-mesh or Verlet cloth simulation
- Resting state: very slow undulation

### Layer 3 — Nerve Network (bottom ~17%)

- Represents the hair cells and vestibular nerve fibres below the membrane
- Visual: labyrinthine, branching network — organic, dense, slightly bioluminescent feel
- Could use existing 3D model assets rendered flat, flat images/bit maps, or procedurally generated branching
- **Nerve firing animation:** pulses of light travel through the network when triggered
    - **Horizontal movement → Colour A** (e.g. cool cyan/blue — utricle) fires along the assests/generation branches
    - **Vertical movement → Colour B** (e.g. warm amber/gold — saccule), a faint glow appears on the sides of the screen over the crystal layer to give effect of a different nerve type firing in the distance
- Firing intensity / frequency scales with acceleration of movement

---

## Interaction Design

### Detection — MediaPipe FaceMesh

|Signal|Derived from|Used for|
|---|---|---|
|Lateral position|Face centroid X|Absolute position in frame|
|Lateral velocity|ΔX per frame|Horizontal acceleration proxy|
|Lateral acceleration|ΔΔX|Crystal displacement magnitude|
|Vertical position|Face centroid Y|Absolute position in frame|
|Vertical velocity|ΔY per frame|Vertical movement detection|
|Rough depth|Face bounding box size|Scale compensation (pre-depth sensor)|
|Head tilt / orientation|FaceMesh landmarks|Optional: fine-grain crystal tilt response|

**Smoothing:** Raw mediapipe values will need exponential smoothing or a low-pass filter to avoid jitter driving visual noise.

**Calibration:** Camera position relative to the 3m screen needs careful calibration — face tracking quality degrades significantly off-centre at this scale. Camera should be mounted separately (not embedded in screen), ideally at approximately participant head height, centred horizontally.

### Resting State

When no participant is detected, or participant is stationary:

- Slow, autonomous drift of crystal layer (very low amplitude)
- Gentle gel undulation
- Occasional spontaneous low-intensity nerve pulse (ambient / idle)

### Triggered State

Movement above a threshold velocity drives:

1. Crystal field displacement proportional to acceleration magnitude
2. Gel layer deformation (lagged, viscous recovery)
3. Nerve firing pulse — colour and intensity determined by movement axis

### Multiple Participants

With two participants, each face tracked independently. Consider:

- Averaging signals if both active simultaneously
- Or: each participant drives a separate region of the crystal field (left/right split)

---

## Asset Pipeline

### Crystal Field Images

- **Source:** Existing microscope images of otoconia
- **Challenge:** Insufficient resolution/coverage for full screen at desired scale
- **Approach (in order of preference):**
    1. Photoshop Generative Fill — extend existing images; works well for repeating crystalline textures
    2. AI generation (Midjourney / Stable Diffusion) — generate matching crystal bed images at high resolution, stitch with originals
    3. Tiling with variation — programmatic tiling with per-tile transform offsets to reduce repetition
- **Target output:** Single high-res texture (or tileable set) at screen native resolution

### Gel Layer

- Rendered programmatically (no static asset needed)
- Spring-mesh simulation in p5.js or shader-based in Three.js/GLSL

### Nerve Network

- **Option A:** Use existing 3D model assets — render as flat/projected view, stylise
- **Option B:** Procedural generation — L-system or recursive branching in p5.js
- **Option C:** Hybrid — use 3D model as reference, trace/redraw procedurally

---

## Technical Stack

### Recommended: p5.js (with WEBGL where needed)

- Sufficient for 2D crystal texture + spring simulation + nerve rendering
- Easier to prototype and iterate
- MediaPipe integration straightforward via ml5.js or direct JS interop
- **Limitation:** Gel physics and crystal texture manipulation at screen resolution may hit performance ceiling — benchmark early

### Alternative: Three.js

- Better suited if 3D model assets are used for nerve layer
- More performant for large texture manipulation and shader effects
- Steeper iteration overhead
- **Recommended if:** gel simulation needs to be shader-based, or 3D model integration becomes central

### Hybrid approach (likely eventual)

- p5.js for interaction logic and 2D layers
- Three.js / GLSL fragment shaders for gel deformation and nerve glow effects

### MediaPipe

- FaceMesh via `@mediapipe/face_mesh` or ml5.js wrapper
- Run in-browser, no server required
- Target: 30fps tracking, decouple from render loop if needed

---

## Open Questions

1. **Screen aspect ratio** — confirm venue dimensions to finalise layer proportions
2. **Camera mounting** — position and height relative to screen; affects tracking reliability
3. **Layer boundary treatment** — hard edge vs. soft dissolve between crystal / gel / nerve bands
4. **Gel simulation approach** — spring mesh (CPU) vs. GLSL displacement shader (GPU); test both
5. **Nerve asset decision** — procedural vs. model-derived; affects timeline significantly
6. **Ambient audio?** — low hum / fluid sound design could reinforce the immersive quality

---

## Prototype Milestones

|Phase|Goal|
|---|---|
|P1|Static layout: crystal image filling top band, placeholder gel + nerve bands|
|P2|MediaPipe integration: face position + velocity derived, logged to console|
|P3|Crystal layer responds to lateral movement (translation / parallax)|
|P4|Nerve firing animation triggered by movement, two-colour axis differentiation|
|P5|Gel layer deformation (basic spring mesh)|
|P6|Vertical movement detection + saccule (vertical) firing colour|
|P7|Resting state animations + idle nerve pulses|
|P8|Performance optimisation + camera calibration for full-scale screen|

---

_Document version: 0.1 — based on initial design conversations_  
_Next review: after asset pipeline decisions confirmed_