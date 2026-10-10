# Scene product pipeline (schema 2)

The authoring flow remains four steps: product/files, scene alternatives, imported materials and motion setup, then review/local publish. All authoring and visitor controls use Alexandria.

## Implemented

- Loader reads every glTF scene without flattening nodes or changing local transforms. Metadata is attached as dependencies are created, before GLTFLoader reduces scene associations. Shared nodes cloned across scenes retain source identities.
- Scene `0` is shared; `noAR` is visible decoration, excluded from measurements and AR. Other scenes must be classified as shared, alternative, decoration, or excluded. Alternative groups select exactly one default. Classification and group IDs have no product-specific meanings.
- External GLBs retain exported coordinates by default; center alignment is optional. XYZ offsets are entered in metres. Multi-scene external files offer a scene selector, keeping their `0`/`noAR` content. Alternative materials fall back to a configurable original/variant when the current variant name is unavailable.
- KHR_materials_variants is imported across hidden scenes and external assets. Labels/defaults are editable, mappings are not recreated. Variants are complete material combinations, not fabricated fabric/leg groups. Unmapped surfaces retain original materials. Files without the extension retain their original materials.
- Animation tracks bind to actual scene nodes by source identity and runtime UUID. Authors can split by target, rename, assign paths to custom groups, set duration, toggle/once playback, and enable smoothstep time easing. Toggle reverses from the current normalized progress. Easing does not invent additional source keyframes or correct bad source motion.
- Visitor and review share composition, material and motion helpers. Measurements and camera framing exclude decoration; manual per-axis dimension overrides remain available.
- AR takes a snapshot of the current visible composition, selected materials and motion pose. It excludes `noAR`/decoration without altering the normal viewer. Instancing is expanded and morph/skin positions are baked for static exports.
- WebXR uses hit-test placement at physical scale. Quick Look receives a generated USDZ. The current AR GLB can also be downloaded. Android Scene Viewer is deliberately not launched with a blob URL or the stale source model: it needs an externally reachable HTTPS asset, which local IndexedDB publishing does not provide.
- Loading/decoder errors are reported, with a 90-second parser timeout. glTF uses metres. Since source Max units cannot be inferred reliably, authoring shows per-scene bounds and offers explicit 1 / 0.01 / 0.001 scale correction and confirmation.

## Storage and compatibility

The IndexedDB database stays `vreel-authoring`, object store `products`; the serialized draft adds `schemaVersion: 2`, `scenes`, `materialVariants`, `defaultVariant`, `animations`, `modelScale`, `scaleConfirmed`, and `ar`. Existing blobs and separate published snapshots remain unchanged. Record normalization is additive: old products keep their node-based component groups and manual material settings, and are covered by a browser regression test. Uploading a new model starts schema 2. P_ discovery only remains in this explicit legacy compatibility path.

Relationships, conditional alternatives and modular placement are deferred. No subscription backend or shared publication is added.

## Validation

`npm run test:scene-browser` runs a local test server and browser, with generated GLBs: multiple part scenes, materials-only, parts without material variants, external GLB, and a preexisting legacy record. It exercises upload/configure/publish/reopen/visitor, material colors, motion reversal, measurement exclusion and nonempty current-state GLB/USDZ exports.

Optional private-asset check:

```
CHROMIUM_EXECUTABLE=/path/to/chromium node tests/scene-diagnostics.cjs compressed.glb uncompressed.glb
```

BARI_KHRONOS1 was tested with 11 scenes, 5 variants and 14 motion paths. 175 local source matrices matched after loading. Changing its default scene left all scene bounds, variants and animation tracks unchanged. A decoded uncompressed copy matched Draco scene bounds within 0.005 source units. This verifies our loader; it does not establish the exact cause of the earlier Khronos viewer behavior.

BARI100 bounds are 100 glTF units wide, so interpreting that source as metres yields 100 metres. Choosing the explicit 0.01 correction makes the width one metre. The file should ideally be exported correctly in metres.

Phone hardware validation is still required for WebXR tracking/placement and iOS Quick Look. Static USDZ export does not transfer interactive playback, and cross-format material rendering can differ. Current selected motion pose is transferred. Desktop browser/export checks are not a physical AR test.

Vendor exporters and fflate are from three@0.185.0, matching the repository's bundled Three.js revision; their upstream license headers are retained.
