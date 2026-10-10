# Product authoring pilot

This additive implementation supplies pages 3 and 4 at `/admin/` and a final review step. UI language, local Three.js r185, typography and colors follow the existing site. Existing public product viewers, their materials, and AR scripts are unchanged.

## Source and deployment evidence

The source is `mhd-yasser/2609-Armchair-Configurator`, based on main commit `36c852fef2a99fa3b31c0fffd923a28777d0952c`. Its `CNAME` is `portal.vreel.studio`, and its root redirect matches the live root response inspected on 2026-10-05. The repository's exact Pages deployment configuration was unavailable through the connector; these observations do not establish an exact live deployment SHA. `VREEL-E-Catalogue-Preview` is a separate Android AR test, not the full gallery source.

The implementation was ported to `VREEL-E-Catalogue-Preview` on `feature/product-authoring-preview` for isolated feature testing. The production repository and domain are not changed. The original Preview desk AR test is preserved at `ar-desk.html`, and its root GLBs are unchanged. No production CNAME is copied.

## Run

From the repository root: `python -m http.server 8000`, then open `http://localhost:8000/admin/`. The gallery's Add Product button opens this flow. Use the bundled example desk or upload a GLB with embedded assets.

## Implemented

- Product information, dimensions and units; GLB header / JSON / external dependency checks followed by a real load through the existing viewer, including Draco, Meshopt and KTX2 support already bundled in that viewer.
- Texture images, product images and attachments, with attachments private unless explicitly marked public. First product image appears in the local visitor preview.
- Persistent IndexedDB drafts including binary blobs. Explicit save; leaving a dirty editor warns before navigation. The selected record can be reopened for editing.
- Mapping groups with multiple mesh/material-slot targets. Targets use stable traversal and slot IDs rather than material names; each slot receives a cloned material so shared source materials can be configured independently. Conflicting group ownership is blocked.
- Original finish, solid color alternatives, uploaded base-color image alternatives, visitor labels, defaults, ordering, removal, click selection, highlighting and live preview. Normal/roughness/metalness and other original maps are retained. Image alternatives require UV coordinates.
- Review and local publication checks. A separately cloned publication is stored atomically alongside the draft, preserving the previous publication during editing. Local publications appear in a clearly labeled separate gallery section and open `?view=<id>` on the same origin/browser.
- Feature requirements checked before publication: dimensions, public downloadable files, configuration groups, and a valid contact email. Contact uses a mailto link; no request is submitted to a backend.

## Deliberate boundaries

This is a functional **local authoring pilot**, not a production content management system. Files do not upload to a server. Publications are not visible to other browsers or users. Browser data clearing removes local drafts and publications; server persistence, authentication, upload access rules, quotas, backup, and an approval/deployment API are still required for real shared publication. Public downloads only expose opted-in attachments, never the internal model/textures automatically.

AR is unavailable in this new authoring flow; existing independently tested AR pages remain unchanged. Entered dimensions are visitor information and do not rescale the GLB or verify AR size. Uploaded source files are GLB only; there is no SKP/Max conversion. No inferred automatic alternatives, orders, subscriptions, analytics, or standalone material library are added.

## Validation

`tests/authoring.cjs` is a Playwright integration test covering real GLB loading, multi-target configuration, color/image options, IndexedDB reload, isolated publication, private/public attachments, validation, responsive overflow and loading the existing chair viewer. Run `npm ci` and `npx playwright install chromium`, then start the HTTP server and run `npm run test:browser`. `npm run test:storage` checks GLB validation, group conflicts, binary persistence and publication isolation independently. `CHROMIUM_EXECUTABLE` can select an existing Chromium binary. Browser tests disable shadows and throttle frames for software WebGL; they verify real loading/material changes and layout, but not shadow appearance or AR.

## Portable product packages

Use **Ürün paketini indir** in the authoring sidebar to save the current draft and its distinct local publication as a `.vreel.json` package. Files are embedded once per SHA-256 hash; group names, ordering, defaults, material mappings, motions, AR settings and scale are preserved. **Ürün paketi aç** restores a new editable copy without replacing existing local drafts. This is a transfer/backup, not shared catalogue publication. BARI official product copy fills only empty product metadata; no options are generated from that copy.
