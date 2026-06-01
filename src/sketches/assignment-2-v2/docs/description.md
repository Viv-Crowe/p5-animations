# Vestibular System Installation — Technical Document v0.2

## Current Focus

**Active work: nerve layer animation.**

The nerve layer (bottom band) is the current development priority. The goal is a compelling, self-contained nerve animation — bioluminescent pulse propagation through a static nerve background image (`bg_neural_layer.png`) — before integrating it into the full layered scene.

Everything below the "Current Focus" section describes the full installation vision. Most of it is out of scope for now but kept here for future reference.

---

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
│         [OUT OF SCOPE FOR NOW]              │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│           GEL LAYER       (~1/6)            │
│         [otolithic membrane]                │
│         [OUT OF SCOPE FOR NOW]              │
├─────────────────────────────────────────────┤
│           NERVE NETWORK   (~1/6)   ← ACTIVE │
│         [hair cells + vestibular nerve]     │
└─────────────────────────────────────────────┘
```

---

## Layer 3 — Nerve Network (ACTIVE)

- Represents the hair cells and vestibular nerve fibres below the membrane
- **Background:** static image (`assets/nerves/bg_neural_layer.png`) — Golgi/Cajal-style nerve illustration
- **Active animation goal:** pulses of bioluminescent light travel through the network
    - **Horizontal movement → Colour A** (cool cyan/blue — utricle)
    - **Vertical movement → Colour B** (warm amber/gold — saccule)
- Firing intensity / frequency scales with acceleration of movement
- Resting state: occasional low-intensity spontaneous pulse (ambient / idle)

### Assets available

- `bg_neural_layer.png` — primary background (Golgi-style nerve illustration, processed)
- `Cajal_Retina.jpg`, `golgi-nervous-system.webp`, `golgi-olfactory-*.webp`, `Golgi_1885_Plate_*.webp` — reference/alternative backgrounds
- `41586_2013_BFnature12107_MOESM25_ESM.mov` — reference video of nerve firing

---

## Future Scope (not active)

### Layer 1 — Crystal Field (top ~67%)

- Filled with extended microscope imagery of otoconia (calcium carbonate crystals)
- Source: existing microscope images, extended via Photoshop Generative Fill and/or AI generation
- Crystals drift and shift subtly in resting state (slow parallax / breathing motion)
- On lateral acceleration: crystals slide in the direction of movement
- On vertical acceleration: crystals don't move (distant)

### Layer 2 — Gel Layer (middle ~17%)

- Represents the gelatinous otolithic membrane the crystals sit within
- Visual: semi-transparent, viscous, slightly refractive layer
- Behaviour: deforms in response to crystal movement above — lags behind, slow recovery
- Could be rendered as a spring-mesh or Verlet cloth simulation
- Resting state: very slow undulation

### Interaction Design — MediaPipe FaceMesh

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

**Calibration:** Camera position relative to the 3m screen needs careful calibration. Camera should be mounted separately (not embedded in screen), ideally at approximately participant head height, centred horizontally.

### Resting State (full scene)

- Slow, autonomous drift of crystal layer (very low amplitude)
- Gentle gel undulation
- Occasional spontaneous low-intensity nerve pulse (ambient / idle)

### Triggered State (full scene)

1. Crystal field displacement proportional to acceleration magnitude
2. Gel layer deformation (lagged, viscous recovery)
3. Nerve firing pulse — colour and intensity determined by movement axis

### Multiple Participants

With two participants, each face tracked independently:
- Average signals if both active simultaneously, or
- Each participant drives a separate region of the crystal field (left/right split)

### Asset Pipeline — Crystal Field

- **Source:** Existing microscope images of otoconia
- **Approach (in order of preference):**
    1. Photoshop Generative Fill — extend existing images
    2. AI generation (Midjourney / Stable Diffusion) — generate matching images at high resolution
    3. Tiling with variation — programmatic tiling with per-tile transform offsets

### Technical Stack

**Recommended:** p5.js (with WEBGL where needed)
- MediaPipe integration straightforward via ml5.js or direct JS interop
- Gel physics and crystal texture at screen resolution may hit performance ceiling — benchmark early

**Alternative:** Three.js
- Better for 3D model assets, shader effects, large texture manipulation

---

## Open Questions

1. **Screen aspect ratio** — confirm venue dimensions to finalise layer proportions
2. **Camera mounting** — position and height relative to screen
3. **Layer boundary treatment** — hard edge vs. soft dissolve between bands
4. **Gel simulation approach** — spring mesh (CPU) vs. GLSL displacement shader (GPU)
5. **Ambient audio?** — low hum / fluid sound design

---

## Prototype Milestones

|Phase|Goal|Status|
|---|---|---|
|P1|Static layout: crystal image, placeholder gel + nerve bands|done|
|P2|MediaPipe integration: face position + velocity|done|
|P3|Crystal layer responds to lateral movement|done (gel surface branch)|
|P4|**Nerve firing animation — two-colour axis differentiation**|**← active**|
|P5|Gel layer deformation (basic spring mesh)|future|
|P6|Vertical movement + saccule firing colour|future|
|P7|Resting state animations + idle nerve pulses|future|
|P8|Performance optimisation + camera calibration|future|

---

_Document version: 0.2 — updated to reflect active nerve animation focus_  
_v0.1: initial design conversations_
