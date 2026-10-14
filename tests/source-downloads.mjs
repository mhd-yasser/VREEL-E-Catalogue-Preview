import assert from 'node:assert/strict';
import {bindSourceDownloads} from '../source-downloads.js';
import {is3DFile,fileLabel} from '../file-labels.js';
class Element {
 constructor(){this.events={};this.children=[];this.dataset={};this.hidden=false;this.textContent='';this.valid=true;this.value='';this.type='text';}
 addEventListener(type,fn){this.events[type]=fn;}
 append(...nodes){this.children.push(...nodes);}
 prepend(node){this.children.unshift(node);}
 replaceChildren(...nodes){this.children=nodes;}
 querySelector(s){if(s==='.source-actions')return this.actions;if(s==='[name="person"]')return this.person;}
 querySelectorAll(s){return s==='input'?this.inputs||[]:this.children.filter(n=>n.dataset.sourceFormat);}
 reportValidity(){return this.valid;}
 setAttribute(){}
 focus(){this.focused=true;}
 click(){this.clicked=true;}
 async fire(type){return this.events[type]?.({preventDefault(){}});}
}
function fixture(){
 const nodes=Object.fromEntries(['#source-modal','#source-form','#source-downloads','#source-status','#source-download','[data-close-source]'].map(s=>[s,new Element()]));
 nodes['#source-form'].person=new Element();nodes['#source-form'].inputs=[nodes['#source-form'].person];nodes['#source-form'].person.value=' Person ';
 nodes['#source-downloads'].actions=new Element();const created=[];
 const root={querySelector:s=>nodes[s],createElement(){const el=new Element();created.push(el);return el;}};
 return {nodes,root,created};
}
let calls=0,assets=0;const {nodes,root,created}=fixture();
bindSourceDownloads({page:'authored',config:{draft:{},sourceFiles:[{name:'BARI.max.zip',href(){assets++;return 'https://example.test/file';}}]},root,downloadCurrent:async()=>calls++});
const buttons=nodes['#source-downloads'].actions.children;
await buttons[0].fire('click');assert.equal(calls,0);
await nodes['#source-download'].fire('click');assert(nodes['#source-downloads'].hidden);assert(nodes['#source-form'].person.focused);
nodes['#source-form'].valid=false;await nodes['#source-form'].fire('submit');await buttons[0].fire('click');assert.equal(calls,0);
nodes['#source-form'].valid=true;await nodes['#source-form'].fire('submit');assert.equal(nodes['#source-form'].person.value,'Person');await buttons[0].fire('click');assert.equal(calls,1);
await buttons[1].fire('click');assert.equal(assets,1);assert(created.some(n=>n.clicked&&n.download==='BARI.max.zip'));
await nodes['#source-form'].fire('input');await buttons[1].fire('click');assert.equal(assets,1);
await nodes['#source-form'].fire('submit');await nodes['[data-close-source]'].fire('click');await buttons[0].fire('click');assert.equal(calls,1);
await nodes['#source-download'].fire('click');assert(nodes['#source-downloads'].hidden);
assert(is3DFile({name:'BARI.max.zip'}));assert(is3DFile({name:'MODEL.GLB'}));assert(!is3DFile({name:'technical.pdf'}));assert(!is3DFile({name:'photo.png'}));assert.equal(fileLabel('MODEL.GLB'),'MODEL — 3D File');
for(const page of ['desk','chair','sofa']){
 const f=fixture(),format=new Element();format.dataset.sourceFormat='fbx';format.textContent='FBX İndir';f.nodes['#source-downloads'].actions.append(format);let fetches=0;
 bindSourceDownloads({page,root:f.root,config:{download:'Product.glb'},downloadCurrent:async()=>{},fetchFile:async()=>{fetches++;return {ok:true};}});
 await format.fire('click');assert.equal(fetches,0);await f.nodes['#source-download'].fire('click');await f.nodes['#source-form'].fire('submit');await format.fire('click');assert.equal(fetches,1);
}
console.log('PASS: all four viewers require a valid contact form; reopening/editing revokes download permission; source archives are gated, PDFs/photos stay technical assets; 3D File labels.');
globalThis.window={addEventListener(){}};globalThis.indexedDB={open(){return {};}};
const detailsNodes=new Map();globalThis.document={createElement:()=>new Element(),querySelector(s){if(!detailsNodes.has(s))detailsNodes.set(s,new Element());return detailsNodes.get(s);}};
const {prepareAuthoredPage}=await import('../authored-viewer.js');
const config={draft:{schemaVersion:2,name:'BARI',features:{downloads:true,dimensions:false,configurable:false},assets:[{kind:'attachments',public:true,name:'BARI.max.zip',url:'https://example.test/source.zip'},{kind:'attachments',public:true,name:'technical.pdf',url:'https://example.test/technical.pdf'},{kind:'attachments',public:false,name:'private.max',url:'https://example.test/private.max'}]}};
prepareAuthoredPage(config,{});
assert.deepEqual(detailsNodes.get('.material-files').children.map(n=>n.textContent),['technical.pdf']);
assert.deepEqual(config.sourceFiles.map(f=>f.name),['BARI.max.zip']);assert.equal(typeof config.downloadCurrent,'function');
console.log('PASS: authored detail tab has no 3D/source archive download; public technical PDF remains; private source excluded.');
