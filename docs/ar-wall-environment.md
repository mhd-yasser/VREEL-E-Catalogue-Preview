# AR wall placement and environment changes

Preview-only branch: `feature/ar-wall-environment`, based on preview main `6c49462`.
No deployment or merge to portal.vreel.studio.

## Architecture and diagnosis

`openProductAR()` explicitly probes immersive WebXR support. Supported browsers use the existing Three.js WebXR renderer with hit tests and a required DOM overlay. Apple devices fall back to exported USDZ / Quick Look. Google Scene Viewer is not launched: current snapshots are blob URLs that it cannot fetch. Chrome alone does not establish XR support.

The previous WebXR scene had hemisphere/directional lights but no `scene.environment`, while the normal viewer loads a studio HDR environment. Missing image based lighting is a plausible cause of black metallic mirrors; actual appearance of the BARI mirror has not been inspected on a physical device. No exporter/material rewrite is justified from this diagnosis alone.

Automatic placement already classified hit-test normals into floor and wall. Plane-only hit-test requests now make that requirement explicit. WebXR hit testing relies on device-reported surfaces; this change cannot force a white wall to be recognized and does not add a competing tracking engine.

## Implemented behavior

- Automatic placement remains the default. A floor calibration is required for wall mounting, preserving the existing saved elevation and height-offset convention.
- Manual wall calibration requires a tracked camera pose and a calibrated floor. The user aims the center reticle at two locations on the floor/wall junction, at least 30 cm apart. Each ray is intersected with the calibrated floor; the baseline and gravity define a vertical plane. Parallel, backward and overly distant intersections are rejected.
- This is a user-estimated wall, explicitly marked blue and labelled as manually defined. It is not a physical wall detection, and depth/orientation accuracy depends on the user and tracking. It cannot operate with no valid floor calibration.
- Once a wall is selected, taps/drags intersect that same plane. Five-centimetre buttons move along the horizontal wall tangent or vertically. No movement control changes scale. Existing authoring/manual dimensions are preserved.
- Rotation of wall products is in the wall plane to preserve back-face contact. Separate manual-wall angle controls rotate the estimated plane and product together. Automatically selected walls must be reselected to change their normal.
- Height controls adjust the saved mounting elevation by an explicit centimetre offset, rather than rewriting the model's original elevation.
- Missing/emulated viewer poses and session visibility loss pause movement and hide placement geometry. Recovery requires an explicit confirmation. Reference-space resets invalidate calibration and require selecting the floor/wall again. WebXR does not expose a universal continuous tracking confidence score; valid poses can still drift.
- AR borrows the normal viewer's environment texture, exposure, intensity and rotation when available. Otherwise it generates a small neutral studio PMREM (128-pixel cube face) once per session, offline. The camera background remains transparent. This is simulated environment lighting, not a reflection of the physical room or camera feed.
- No GLB bytes, PBR properties, glass settings or variant bindings are rewritten. Current visible components, selected materials and animated pose are snapshotted at AR entry, as before. Live variant switching inside the XR overlay was not an existing feature and has not been added; exit AR, change the variant and reopen.
- Source environment textures are borrowed without disposal; session-owned maps, reticles and baked snapshot resources are released on exit. No new dependency or renderer architecture was introduced.
- Quick Look continues to control its own rendering/placement; these custom wall controls and WebXR environment do not extend to Quick Look. No replacement engine was needed for the supported WebXR path.

## Modified files

| File | Purpose |
| --- | --- |
| `product-ar.js` | XR workflow, manual calibration UI, constrained interaction, tracking recovery, lifecycle and lighting integration |
| `ar-placement.js` | Wall geometry, ray intersection, plane movement/rotation and tracking state |
| `ar-environment.js` | Reuse viewer lighting or generate offline studio PMREM |
| `three-viewer.js` | Read-only lighting configuration exposed to AR |
| `authored-viewer.js`, `viewer-app.js`, `admin/author.js` | Refresh affected module URLs |
| `product/index.html`, `desk/index.html`, `chair/index.html`, `sofa/index.html` | Refresh viewer module entry URLs |
| `tests/ar-placement.mjs`, `tests/ar-environment.mjs`, `package.json` | Mathematical, tracking-state and material preservation checks |

## Checks run

Passed: `npm run test:ar`, `npm run test:runtime`, `npm run test:authored`, `npm run test:components`, `npm run test:storage`, JavaScript syntax checks and `git diff --check`.

These checks cover plane classification, calibration baseline, ray rejection, wall movement for all four back axes, rotation/alignment, scale preservation, tracking loss/confirmation transitions, material properties for nonmetal/metal/mirror/glass, variant snapshots, manual dimensions, component visibility, export snapshots and storage.

This static repository has no build script. Browser/GPU tests were not run: the supported browser QA capability is unavailable in this session. No physical Android or iOS device was available. Automated material preservation tests do not prove GPU appearance or mobile performance.

## Physical Android verification — still required

Use an HTTPS preview on an ARCore-compatible Android device. Record phone/browser version and product dimensions. For each case record actual outcome; none below is reported as passed yet.

1. Textured wall: calibrate floor, acquire an automatic wall hit, place product. Confirm automatic label and back-face alignment.
2. White wall: verify failure/unreliable hits are not presented as an accurate wall; use manual mode. Aim at two floor/wall junction points from different positions. Check cyan plane against the physical wall; repeat with an intentionally short baseline.
3. Move horizontally/vertically using taps, drag and 5 cm controls. Check back contact on the same plane, numeric height offset and mounting alignment. Test each supported back axis and manual wall-angle adjustments.
4. Check rotation in the plane and floor-product yaw. Measure actual width/height/depth with a tape measure; unchanged transform scale alone does not prove physical scale accuracy.
5. Obscure the camera / background the session / relocalize: movement must pause, controls must disable, and recovery must require confirmation. After a reference-space reset recalibrate both surfaces.
6. Nonmetal, metal, mirror (metalness 1 / roughness .02), glass/transmission: compare normal viewer with AR. Check for black mirrors, washed-out highlights, glass artifacts and excessive reflections. Repeat with HDR loading blocked to exercise the offline environment.
7. Change `KHR_materials_variants` and component/scene selections before AR entry, reopen and confirm the new snapshot. Confirm normal viewer state and materials remain unchanged after exit.
8. Repeat session entry/exit and compare frame rate, responsiveness, startup time and memory. Environment generation is one-time, but performance remains unmeasured on hardware.
9. Verify Quick Look separately on physical iOS; native lighting and wall anchoring are not controlled by this WebXR implementation.

## References

- WebXR Hit Test: https://www.w3.org/TR/webxr-hit-test-1/
- WebXR Device API (poses/reference spaces): https://www.w3.org/TR/webxr/
- Three.js PMREM: https://threejs.org/docs/pages/PMREMGenerator.html
- Three.js scene environment: https://threejs.org/docs/pages/Scene.html
