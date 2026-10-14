# Demo preview candidate — 14 October 2026

Base: preview main `490b93409170ec4b895d77c16a2b77bcadd4fef2` (approved AR lighting restored).
Branch: `feature/demo-ar-downloads`. No production changes, merge or deployment.

## Included in this candidate

1. Product-facing labels use **3D File**. Internal extensions, validation and file formats are retained.
2. All four viewers open the same contact form from **3D İndir** (person, company/type, email and phone). A valid submission unlocks the current configured model and available public source attachments. Reopening or editing the form revokes the unlock. In this demo the form does not transmit or persist personal information; it is not authentication or a server-side access restriction.
3. Authored product detail tabs exclude 3D/source files and archives; public technical PDFs/images remain. BARI's source archive moves into the form-controlled download menu. Private attachments remain unavailable. Archives are treated conservatively as source files because their contents are not classified.
4. Desk, chair and sofa enable their existing unified AR button after initialization. Their current visible configuration and materials are snapshotted; the approved AR environment module is unchanged.
5. On WebXR these three products lock after a placement tap. **Yerleştir / taşı** unlocks intentional movement, and **Sabitle** relocks. Supported devices receive one session-owned world anchor per lock. Locked objects do not follow new hit-test results or viewer-space poses. Position updates come from that anchor's pose in the local reference space. Scale is never changed.
6. Missing/emulated viewer poses, lost anchors and backgrounded sessions hide the product without choosing a replacement location. Valid tracking can restore the same anchor. Reference-space resets clear the placement and request a fresh placement. A late anchor result after unlock/exit is deleted.
7. When anchors are unavailable or creation fails, placement stays fixed in local XR space with an explicit warning that stability depends on device tracking. This fallback cannot guarantee real-world stability. Quick Look remains native, with fixed-scale export; these WebXR controls do not change Apple's tracking.
8. BARI is not opted into the new anchoring behavior. Its current placement workflow and existing environment lighting are preserved.
9. **Yerel yayınlar** starts empty of old/seeded publications. Old records and draft files are retained. Only an explicit new local publish marks a record for this client-demo gallery. Catalogue/package imports start as editable drafts, without automatically creating gallery publications. The deployed three demos and ORKA section remain available.

## Validation

Passed Node checks: source download form/gating, authored detail filtering, local publication scope and blob preservation, anchor lifecycle/cancellation/fallback, mocked real WebXR session startup/placement/locking/tracking/reset/shutdown, source syntax and diff checks. Existing placement, environment/material, authored dimensions/materials, component, runtime, storage, package and catalogue tests also passed.

No full browser/GPU QA was performed: supported browser control was unavailable. The mocked renderer tests verify application logic, not physical tracking, visual fidelity or mobile performance. There is no build script in this static repository.

## Physical/device and interface checks before accepting a stable baseline

- Open desk, chair and sofa on the HTTPS preview. Change their dimensions/layout/modules/materials, then launch AR. Confirm the active configuration and visual lighting match the viewer.
- Place each product beside a visible floor reference, walk around it and return to the same viewing point. Check its real-world location and tape-measure scale. Test automatic lock, intentional movement, relock, camera obstruction and tracking recovery. Record whether the device provides anchors or the fallback warning.
- Open BARI: verify its existing AR placement and mirror lighting still behave as the user-approved version.
- In all four viewers, **3D İndir** must show the contact form before any download. Invalid/blank inputs must not unlock it. Reopening must require confirmation again. Check current model export and available BARI source archive.
- In **Ürün Detayları**, check the source archive/model download is absent and technical information/photos remain.
- With existing local BARI data, open the gallery: the old card should be absent, with drafts still available in the control panel. Publish one local draft and confirm exactly that client-demo card appears after returning to the gallery. Repeat a reload to check persistence.

This is a preserved, reviewable **candidate baseline**. Physical-device acceptance is still pending; no “stable on hardware” claim is made. Broad code cleanup and the future no-code demo-publishing redesign are intentionally deferred.
