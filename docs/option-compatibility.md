# Conditional product options — experimental branch

This branch adds ID-based compatibility between component groups. Products without
`group.compatibility` keep independent options. No material-variant or model-file
changes are required.

## BARI trial configuration

The following same-size mapping is an **experimental assumption**, not an ORKA
manufacturer-approved compatibility table. Confirm it before merging.

| Cabinet | Allowed mirrors | Fallback when the old mirror is incompatible |
| --- | --- | --- |
| BARI65 | BARI65A, BARI65AD | BARI65AD |
| BARI85 | BARI85A, BARI85AD | BARI85AD |
| BARI100 | BARI100A, BARI100AD | BARI100AD |

A compatible mirror remains selected. An incompatible mirror changes to the
explicit fallback, and the visitor sees a Turkish notice. Disabled mirrors remain
visible with an explanation. Summaries, detail labels, geometry, measurements and
the composition exported to AR use the resolved selection. Reset restores the
product defaults and recalculates availability.

## Try it without changing production

1. In GitHub Desktop, fetch and check out `feature/orka-option-compatibility`.
2. Open the repository in a terminal and run `python -m http.server 8019`.
3. Open `http://localhost:8019/product/?catalogue=orka-bari`.
4. Change the cabinet among 100, 85 and 65, then choose A versus AD. Only the two
   matching mirrors should be enabled. Check the notice, summary and visible model.
5. Use the reset confirmation and verify BARI100 + BARI100AD.
6. Open `http://localhost:8019/admin/?catalogue=orka-bari`, go to step 2 and select
   Ayna. Under **Koşullu uyumluluk**, edit each cabinet's allowed mirrors and
   fallback. Save, reopen, then verify in step 4.

Use a fresh local origin/port for the first trial: existing browser-local drafts
are deliberately retained and are not overwritten by this catalogue change.
Saving or local publishing on localhost does not update the production catalogue.

## Data and validation

The dependent group's `compatibility` contains `sourceGroupId` and a `choices`
object keyed by source option ID. Each entry has `allowedIds` and `defaultId`.
These fields survive the existing draft/publication/package serialization.

The shared rule engine resolves groups in dependency order before applying
visibility. A saved incompatible choice is corrected. Missing/empty rules have no
valid target: no arbitrary option is substituted. Publishing validation rejects
missing source groups/options, invalid targets/fallbacks and cycles. Repair rules
after removing referenced groups/options. To clear all rules, choose **Bağımsız**.

Run `npm run test:compatibility` for rule-engine, scene/legacy composition and
public-card interaction checks. `node tests/catalogue.mjs` verifies package
round trips, asset integrity and publication isolation. These are automated Node
tests; a visual browser review and physical-device AR check remain manual.
