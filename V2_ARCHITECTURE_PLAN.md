# Interactive Bouncing Ball Installation: V2 Architecture Plan

This document outlines the technical strategy for upgrading the current 2D CV-based installation into a robust, auto-calibrating 3D spatial experience in the browser.

---

## Part 1: Advanced Camera Calibration Capabilities
*Currently, calibration relies on manual click-and-drag for the 4 corners and manual eyedropper tools for color isolation. We will upgrade this to a "Pro" pipeline.*

### 1.1 Auto-Mapping via Fiducial Markers (ArUco / QR)
Instead of forcing the user to manually click the 4 corners of their projection/screen area:
*   **Implementation:** We will display 4 small ArUco markers (or custom high-contrast QR-style patterns) in the absolute corners of the browser window.
*   **Detection:** The webcam feed will use a lightweight marker detection algorithm to automatically find these 4 points in physical space.
*   **Result:** Zero-click, instant screen-mapping. If the projector or camera bumps, it automatically recalibrates on the fly.

### 1.2 Mathematical Homography (3x3 Matrix Projection)
*   **Current State:** We use a simple bilinear interpolation script. It works for slight angles but distorts at extreme camera angles.
*   **Upgrade:** Implement a true 3x3 Perspective Transform Matrix (similar to `cv2.findHomography` and `cv2.warpPerspective`). 
*   **Result:** Flawless 1:1 mapping of physical masking tape to the screen, even if the webcam is mounted at a steep 45-degree angle.

### 1.3 Adaptive Lighting & Auto-HSV Tuning
*   **Current State:** Hardcoded HSV bounds that break if a cloud blocks the sun or room lighting changes.
*   **Upgrade:** 
    *   *Auto-Exposure Compensation:* Normalize the brightness (Value) channel of the webcam feed before processing.
    *   *Flood-Fill Calibration:* When a user clicks the tape, instead of a static `+/- 20` HSV radius, we use a region-growing algorithm (flood fill) to automatically calculate the exact HSV variance of the tape in current lighting.

### 1.4 Semantic Color Routing (Multi-Tape Physics)
*   **Feature:** Track multiple tape colors simultaneously and assign different physics properties.
    *   **Green Tape:** High restitution (super bouncy).
    *   **Blue Tape:** Low friction (ice slides).
    *   **Red Tape:** Synthesizer pitch modulators (changes the scale when hit).

---

## Part 2: The 3D Engine Migration (2D -> 3D)
*Moving from `Matter.js` + `Canvas2D` to a fully hardware-accelerated WebGL 3D environment.*

### 2.1 The 3D Technology Stack
*   **Renderer:** `Three.js` wrapped in `@react-three/fiber` (R3F) for seamless React integration.
*   **Physics Engine:** `@react-three/rapier` (A blazing fast, WASM-based 3D physics engine that replaces Matter.js).
*   **Post-Processing:** `@react-three/postprocessing` for high-end visual effects (Bloom, Chromatic Aberration).

### 2.2 The "2.5D" Dimensionality Bridge
How do we turn flat 2D webcam polygons into a 3D world?
*   **Z-Axis Extrusion:** When the CV engine detects a 2D shape (like a triangle of tape), we use `THREE.ExtrudeGeometry` to stretch that 2D polygon backward into the Z-axis, creating a solid 3D "cliff" or "wall".
*   **Physics Confinement:** We constrain the balls to mostly operate on the X/Y plane (so they don't bounce out towards the camera), creating a 2.5D "shadow box" or "pinball machine" effect. 

### 2.3 Next-Gen Visuals & Shaders
*   **True Neon:** Replace standard 2D canvas drawing with `MeshStandardMaterial` utilizing high `emissive` values.
*   **Dynamic Lighting:** Every bouncing ball will have a small `PointLight` attached to it. As balls bounce near the physical tape platforms, they will cast real-time shadows and illuminate the extruded walls.
*   **Volumetric Bloom:** The entire scene will run through an Unreal Engine-style bloom pass, making the neon balls physically glow against the dark background.

### 2.4 Spatial Audio Synthesis (3D Sound)
*   **Current State:** Stereo panning based on X-axis.
*   **Upgrade:** We will attach Web Audio `PannerNode`s directly to the 3D meshes. As a ball bounces deep in the Z-axis or far to the left, the pentatonic synth chord will dynamically pan and muffle using HRTF (Head-Related Transfer Function) spatial audio.

---

## Part 3: Step-by-Step Implementation Strategy

If you approve this plan, we will execute it in the following atomic phases to ensure stability:

**Phase 1: The 3D Foundation (Parity)**
*   Uninstall `matter-js`, install `three`, `@react-three/fiber`, and `@react-three/rapier`.
*   Replace `CanvasStage` with a `<Canvas>` scene.
*   Implement 3D sphere physics and bloom post-processing.
*   *Milestone:* The current preset layouts work, but look like glowing 3D objects.

**Phase 2: 3D Extrusion Pipeline**
*   Bridge the existing CV polygon data to `THREE.ExtrudeGeometry`.
*   Connect the extruded meshes to Rapier 3D static colliders.
*   *Milestone:* Webcam masking tape now creates thick 3D glass/neon walls.

**Phase 3: The "Pro" CV Pipeline**
*   Implement the 3x3 Homography Matrix for perfect perspective warp.
*   Add the auto-lighting normalization algorithm.
*   *Milestone:* Flawless, robust camera tracking regardless of angle.

**Phase 4 (Optional Polish): Multi-Color Semantic Tape**
*   Refactor the HSV pipeline to track 3 distinct colors.
*   Map different audio scales and physics materials to each color.
