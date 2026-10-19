import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {measurementKey,measurementLabel} from '../dimensions.js';
import {exportProductPackage,importProductPackage} from '../admin/product-package.js';
import {loadCatalogueProduct} from '../catalogue-store.js';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('catalogue/index.json',root)));
const config=JSON.parse(await readFile(new URL(manifest[0].config,root)));
const draft=config.draft;
assert.deepEqual(draft.componentGroups.map(g=>g.name),['Banyo Dolabı','Ayna']);
assert.equal(draft.modelScale,.01);
assert.equal(draft.ar.placement,'wall');
for(const asset of [draft.model,...draft.assets,...draft.componentAssets]){
 const bytes=await readFile(new URL(asset.url,root));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.name);
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{try{return new Response(await readFile(new URL(input)),{status:200});}catch{return new Response('',{status:404});}};
const record=await loadCatalogueProduct('orka-bari',true);
globalThis.fetch=originalFetch;
assert(record.draft.model.blob instanceof Blob);
assert(!record.draft.model.url);
assert.deepEqual(record.draft.componentGroups,draft.componentGroups);
assert.deepEqual(record.published.materialVariants,draft.materialVariants);
const key=measurementKey({id:'scene-2'},{userData:{sourceNodeIndex:42}},0);
assert.equal(key,measurementKey({id:'scene-2'},{userData:{sourceNodeIndex:42}},99));
assert.notEqual(key,measurementKey({id:'scene-3'},{userData:{sourceNodeIndex:42}},0));
record.draft.elementDimensions={[key]:{width:.85,height:.72}};
const guide={part:key,axis:'G',value:1};
for(const [unit,label] of [['cm','G 85 cm'],['mm','G 850 mm'],['m','G 0.85 m']]){
 record.draft.unit=unit;assert.equal(measurementLabel(record.draft,guide),label);
}
assert.equal(measurementLabel({...record.draft,unit:'cm'},{part:key,axis:'D',value:.47}),'D 47 cm');
const restored=await importProductPackage(await exportProductPackage(record));
assert.deepEqual(restored.draft.elementDimensions,record.draft.elementDimensions);
assert.deepEqual(restored.draft.componentGroups,record.draft.componentGroups);
assert.deepEqual(restored.published.componentGroups,record.published.componentGroups);
assert.equal(restored.published.elementDimensions,undefined,'editing a draft must preserve its publication');
assert.equal(restored.draft.model.blob.size,(await readFile(new URL(draft.model.url,root))).length);
console.log('PASS: catalogue binary integrity, editable hydration, preserved ORKA configuration, stable per-element dimensions, unit conversion, package persistence and publication isolation.');
