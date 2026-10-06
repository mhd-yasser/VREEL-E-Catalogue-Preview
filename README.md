# VREEL E-Catalogue Preview

Isolated feature-testing repository. Root opens the product gallery; Add Product opens `admin/`. Original Android desk AR test remains at `ar-desk.html`, using the unchanged root GLB.

Product setup, multi-part material mapping, and local visitor previews were ported from production repository PR #4, commit b0e4f099ae990de0eea9d9e3dbc908d208e95d30. Production has not been merged or modified.

Drafts, uploads and publication are browser-local IndexedDB data, not shared server publication. See `admin/README.md` for functionality, limitations, and tests.

Run `python -m http.server 8000`, then open `/products/` or `/admin/`. Run `npm ci`, `npm run test:storage`, and `npm run test:browser` (requires Playwright Chromium).
