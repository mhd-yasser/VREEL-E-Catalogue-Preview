import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveCompatibility,allowedOptions,compatibilityErrors} from '../option-compatibility.js';
import {applyComponentSelection} from '../component-options.js';
import {composeProduct,productErrors} from '../product-runtime.js';
import * as THREE from '../vendor/three.module.js';
const config=JSON.parse(await readFile(new URL('../catalogue/orka/bari/config.json',import.meta.url))),d=config.published;
assert.deepEqual(d.componentGroups,config.draft.componentGroups);
assert.deepEqual(compatibilityErrors(d),[]);
const [cabinet,mirror]=d.componentGroups;
const choose=(group,label)=>group.options.find(o=>o.label===label).id;
const selection=new Map();resolveCompatibility(d,selection);
assert.equal(selection.get(mirror.id),choose(mirror,'BARI100AD'));
for(const size of ['65','85','100']){
 selection.set(cabinet.id,choose(cabinet,`BARI${size}`));
 const changes=resolveCompatibility(d,selection);assert.equal(changes.length,1);
 assert.deepEqual(allowedOptions(mirror,selection).map(o=>o.label).sort(),[`BARI${size}A`,`BARI${size}AD`].sort());
 assert.equal(selection.get(mirror.id),choose(mirror,`BARI${size}AD`));
 selection.set(mirror.id,choose(mirror,`BARI${size}A`));assert.deepEqual(resolveCompatibility(d,selection),[]);
 assert.equal(selection.get(mirror.id),choose(mirror,`BARI${size}A`));
}
// Saved/forged incompatible combinations are corrected before geometry or exports see them.
selection.set(cabinet.id,choose(cabinet,'BARI65'));selection.set(mirror.id,choose(mirror,'BARI100A'));
const root=new THREE.Group();const scenes=d.scenes.map(s=>{const node=new THREE.Group();root.add(node);return {...s,node};});
const runtime={root,scenes,motions:[],external:new Map()};composeProduct(runtime,d,selection);
assert.equal(selection.get(mirror.id),choose(mirror,'BARI65AD'));
assert.equal(scenes.find(s=>s.name==='BARI65AD').node.visible,true);
assert.equal(scenes.find(s=>s.name==='BARI100A').node.visible,false);
composeProduct(runtime,d,selection,true);assert(!scenes.find(s=>s.name==='noAR').node.visible);
// Both schema generations share the rule engine, independent of group order and labels.
const reversed=structuredClone(d);reversed.componentGroups.reverse();assert.deepEqual(compatibilityErrors(reversed),[]);
const fresh=new Map();resolveCompatibility(reversed,fresh);assert.equal(fresh.get(mirror.id),choose(mirror,'BARI100AD'));
const legacy=structuredClone(d);delete legacy.schemaVersion;
const nodes=new Map(legacy.componentGroups.flatMap(g=>g.options.map(o=>[o.nodeId,{visible:true}])));
const legacySelection=new Map([[cabinet.id,choose(cabinet,'BARI85')]]);applyComponentSelection(nodes,legacy.componentGroups,legacySelection);
assert.equal(nodes.get('scene-7').visible,false);assert.equal(nodes.get('scene-8').visible,true);
// A shared compatible option is preserved even when a parent's choice changes.
const shared=structuredClone(d),[sg,tg]=shared.componentGroups;
for(const rule of Object.values(tg.compatibility.choices))rule.allowedIds.push(choose(mirror,'BARI100A'));
const keep=new Map([[sg.id,choose(cabinet,'BARI100')],[tg.id,choose(mirror,'BARI100A')]]);
resolveCompatibility(shared,keep);keep.set(sg.id,choose(cabinet,'BARI65'));assert.deepEqual(resolveCompatibility(shared,keep),[]);
// Names/dimensions never drive the rules.
shared.componentGroups.forEach(g=>{g.name='Renamed';g.options.forEach(o=>o.label='Renamed option');});assert.deepEqual(compatibilityErrors(shared),[]);
const bad=structuredClone(d);bad.componentGroups[1].compatibility.choices[cabinet.defaultId].allowedIds=[];
assert(compatibilityErrors(bad).length);assert(productErrors(bad).some(e=>e.includes('uyumlu seçenekler')));
const invalid=new Map();resolveCompatibility(bad,invalid);assert.equal(invalid.get(mirror.id),null);
const dangling=structuredClone(d);dangling.componentGroups.shift();assert(compatibilityErrors(dangling).length);
const cycle=structuredClone(d);cycle.componentGroups[0].compatibility={sourceGroupId:mirror.id,choices:{}};assert(compatibilityErrors(cycle).some(e=>e.includes('döngüsel')));
const plain={componentGroups:[{id:'independent',defaultId:'b',options:[{id:'a'},{id:'b'}]}]};const old=new Map();resolveCompatibility(plain,old);assert.equal(old.get('independent'),'b');
console.log('PASS: all BARI sizes, fallback and preserved choices, reverse group order, legacy/scenes geometry, AR composition, invalid saved choices, renamed labels, missing rules, deleted groups, cycles and unchanged independent products.');
// Public cards: disabled options cannot change geometry; parent changes synchronize
// summary, active state, detail labels and notice in the same transaction.
globalThis.window={addEventListener(){}};
globalThis.indexedDB={open(){return {};}};
const notice={textContent:''};
globalThis.document={createElement(){return {dataset:{},append(){}};},querySelector(selector){return selector==='#notice'?notice:{append(){}};}};
const {prepareAuthoredComponents}=await import('../authored-viewer.js');
const uiDraft=structuredClone(d);delete uiDraft.schemaVersion;
const uiRoot=new THREE.Group();
for(const group of uiDraft.componentGroups)for(const option of group.options){const index=Number(option.nodeId.split('-')[1]);option.nodeId=`node-${index}`;const node=new THREE.Group();node.userData={sourceName:`P_${index}`,sourceNodeIndex:index};uiRoot.add(node);}
const cards=new Map(),handlers=new Map();let changed=0;
const viewer={model:{root:uiRoot},requestUpdate(){},reframe(){}};
const uiConfig={draft:uiDraft};
const reset=await prepareAuthoredComponents(uiConfig,viewer,(title,options,_initial,handler)=>{
 const buttons=options.map(option=>({dataset:{variant:option.id},classList:{toggle(_name,value){this.active=value;}},setAttribute(){}}));
 const summary={textContent:''},card={buttons,summary,append(){},querySelectorAll(){return buttons;},querySelector(){return summary;}};
 cards.set(title,card);handlers.set(title,handler);return card;
},()=>changed++);
const mirrorCard=cards.get(mirror.name),cabinetHandler=handlers.get(cabinet.name);
assert.equal(mirrorCard.buttons.filter(b=>!b.disabled).length,2);
handlers.get(mirror.name)(choose(mirror,'BARI65A'));assert.equal(changed,0);
cabinetHandler(choose(cabinet,'BARI85'));
assert.equal(mirrorCard.summary.textContent,'BARI85AD');assert.equal(uiConfig.componentChoices[mirror.id].value,'BARI85AD');assert(notice.textContent.includes('BARI85AD'));
assert.equal(mirrorCard.buttons.find(b=>b.dataset.variant===choose(mirror,'BARI85AD')).classList.active,true);
handlers.get(mirror.name)(choose(mirror,'BARI85A'));assert.equal(mirrorCard.summary.textContent,'BARI85A');
cabinetHandler(choose(cabinet,'BARI85'));assert.equal(mirrorCard.summary.textContent,'BARI85A');
reset();assert.equal(mirrorCard.summary.textContent,'BARI100AD');assert.equal(mirrorCard.buttons.filter(b=>!b.disabled).length,2);assert.equal(notice.textContent,'');
console.log('PASS: public card restrictions, blocked clicks, synchronized summaries/labels, fallback notice, compatible choice preservation and reset.');
