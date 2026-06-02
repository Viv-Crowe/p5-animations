---
title: A3 AI Use Appendix
type: output
tags: [output, ai-appendix, arch3345, submission]
created: 2026-06-03
updated: 2026-06-03
---

# Appendix — AI Use Disclosure
## ARCH3345 A3 — Building Interactive Digital Environments

---

### Summary of AI use

AI was used as a tool at several points across this project — for visual analysis, code generation, and implementation assistance. In each case I directed the prompts, evaluated the outputs, and made the design and technical decisions. AI did not determine what the piece is or how it works; it accelerated specific tasks where the bottleneck was translation (image → geometry spec, spec → code) or implementation detail rather than design judgement.

**Crystal layer — two-stage pipeline (30 May 2026)**

The most deliberate AI use was a two-stage process for generating the crystal forms. I had a reference SEM micrograph of real otoconia (Science Photo Library, C0116252) but needed a way to turn that visual reference into something a code generator could work from.

*Stage 1:* I provided the micrograph images to Claude (claude.ai) and asked it to describe the crystal geometry in technical detail — specifically framed for use by a coding agent. This produced a structured geometric specification covering aspect ratios, surface detail, population variation, and step-by-step algorithmic construction recommendations. Full prompt and response are included below.

*Stage 2:* I passed that specification directly to Claude with the prompt:

> *Write a p5.js function to draw crystals matching this specification: [pasted description from Stage 1]*

The resulting code was then integrated into the visualization and tuned — the parameter ranges, the density of crystals, and their behaviour under the fluid simulation required iteration and manual adjustment to look right at the scale and viewing distance of the piece.

This pipeline — using one AI pass to translate a visual reference into a structured description, then a second pass to translate that description into code — was something I devised as a workflow. The micrograph, the framing of the task, and all subsequent tuning decisions were mine.

**Coding assistance — Claude Code**

Claude Code (Anthropic's CLI tool) was used across several development sessions for implementation help and debugging. Specific areas included face tracking integration, WebGL 3D space placement and parameter tuning, fluid simulation setup, nerve layer animation, and general debugging. Session transcripts were not individually preserved. The design decisions throughout — what the piece represents, how interaction works, which approaches to pursue and which to abandon — were made by me; Claude Code was used to accelerate implementation of those decisions.

The project history in Section 3 documents the major iterations and what changed at each stage, including approaches that were tried and discarded.

---

### Transcript 1 — Crystal morphology analysis

**Tool:** Claude (claude.ai)  
**Date:** 30 May 2026  
**Purpose:** Generate a technical shape description of otoconia crystals from SEM micrographs, to serve as a specification for a procedural crystal generation algorithm.

---

**User prompt:**

> *[Images attached: C0116252-Balancing_stone_from_inner_ear_SEM.jpg, Otoconia-1.png]*
>
> Describe the crystal shapes in these images to great technical detail. Your description will be copied into a coding agent to create a crystal generating algorithm.

---

**Claude response:**

Otoconia Crystal — Technical Shape Description for Procedural Generation

**Overview**

Both images show otoconia (inner ear balance crystals, calcium carbonate — calcite polymorph), captured via scanning electron microscopy (SEM). Image 1 shows a population view; Image 2 shows a single specimen in high detail.

**Primary Geometry: Barrel-Ellipsoid with Truncated Bipyramidal Terminations**

*Core Body*

- Macroform: Prolate spheroid / elongated barrel — not a true ellipsoid; the midsection is slightly cylindrical with gentle convex bulging rather than a smooth ellipsoidal taper
- Aspect ratio: Approximately 2:1 to 3:1 (length:width), with most specimens clustering near 2.2:1
- Cross-section: Roughly hexagonal when viewed end-on — consistent with calcite's trigonal crystal system — but with heavily rounded edges, so it reads visually as near-circular
- Lateral surface: Subtly faceted with 6 longitudinal faces running the length of the body, each slightly convex (pillow-faced), separated by softly rounded edges — not sharp prismatic edges

*Terminations (Both Ends)*

- Each end is truncated — not pointed — forming a blunt bipyramidal cap
- The cap is asymmetric: one end (typically one pole) is slightly more rounded/domed; the other has slightly more defined facet edges — suggesting minor polar asymmetry
- Cap facets: typically 3 visible faces per termination (consistent with scalenohedron or rhombohedron-influenced termination)
- Transition from body to cap: a subtle shoulder — a very slight inward concavity or step where the prismatic body meets the pyramidal termination, like a mild "neck" or chamfer ring

*Surface Detail*

- Surface texture: matte, microporous — not glassy. Fine granular roughness at nanoscale, consistent with polycrystalline aggregate microstructure
- Scattered surface nodules: small hemispherical bumps (~1–3% of crystal diameter) distributed sparsely and somewhat randomly on the face surfaces — likely nucleation points or surface crystallite protrusions
- No visible cleavage steps or growth spirals at this resolution
- The cracked background material (otolithic membrane) creates high contrast — the crystal surface itself is smooth at meso-scale relative to the substrate

*Population Variation*

| Parameter | Range | Distribution |
|-----------|-------|--------------|
| Aspect ratio (L:W) | 1.6:1 → 3.2:1 | Log-normal, peak ~2.2 |
| End symmetry | Fully symmetric ↔ one end 20% more rounded | Slight bias toward asymmetry |
| Edge roundness (body) | Low ↔ high rounding | Gaussian, most specimens highly rounded |
| Cap flatness | Blunt/domed ↔ slightly more faceted | Uniform |
| Body facet visibility | Nearly cylindrical ↔ clearly hexagonal prism | Skewed toward cylindrical |
| Size | Relative scale spans ~3× across the population | Roughly normal |

Two morphological sub-clusters are visible: Type A (majority, pale lavender/green) — longer, more barrel-like, smoother. Type B (upper-left cluster, darker) — slightly shorter, stubbier, denser packing.

*Algorithmic Construction Recommendations*

1. Start with a hexagonal prism (6 sides), height = aspect_ratio × radius
2. Apply longitudinal convex inflation to each face: bulge_factor ≈ 0.05–0.12 × radius
3. Round all longitudinal edges: edge_radius ≈ 0.3–0.5 × face_width
4. Add bipyramidal caps: pyramid_height ≈ 0.15–0.25 × total_length
5. Truncate each pyramid tip: truncation ≈ 0.4–0.6 × pyramid_height (creating flat or slightly domed end face)
6. Introduce polar asymmetry: scale one cap by 0.85–1.0× vs the other
7. Add subtle waist/shoulder at body-cap junction: inward offset ≈ 1–3% of radius
8. Surface noise: low-amplitude Perlin noise on surface (amplitude ≈ 0.5–2% of radius)
9. Scatter 5–20 hemispherical micro-bumps per crystal face
10. Randomize all parameters per instance using distributions in table above

*Key Shape Summary*

A heavily rounded hexagonal barrel — like a vitamin capsule crossed with a well-worn river pebble — with two blunt, faceted, slightly asymmetric tips. Edges everywhere are soft. The overall silhouette from the side is a fat lens or a stadium shape. From the end: a rounded hexagon tending toward a circle.

---

### Transcript 2 — Crystal generation algorithm

**Tool:** Claude  
**Date:** 30 May 2026 (same session or immediately following Transcript 1)  
**Purpose:** Generate p5.js code to draw procedurally varied crystal forms from the geometric specification above.

**User prompt:**

> Write a p5.js function to draw crystals matching this specification: [pasted output from Transcript 1]

Full response transcript not recovered. The AI produced a p5.js drawing function implementing the hexagonal barrel geometry, polar asymmetry, and randomised parameter ranges described in the specification. This code was then integrated into the visualization and adjusted — crystal scale, count, and behaviour under the fluid simulation were tuned manually to suit the piece.

---

### Coding assistance — Claude Code sessions

[FILL: Either paste a share link to your Claude Code sessions (if shareable via claude.ai), or write a summary of the areas where AI assistance was used — e.g.:

- Face tracking integration: prompts to identify landmarks and map to layer displacement
- WebGL/3D box placement: debugging the close-up artifact and tuning the box parameters
- Fluid simulation setup: integrating the fluid library with the crystal layer
- Nerve layer animation: debugging the Affinity mask pipeline and outline animation
- General debugging throughout

If no transcripts are available, state this explicitly and describe the nature of the assistance.]

---
