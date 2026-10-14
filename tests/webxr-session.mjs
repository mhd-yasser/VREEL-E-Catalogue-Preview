// Exercises the real AR session coordinator with a mocked renderer/XR provider.
// It is not a GPU or physical-device test.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {readFileSync} from 'node:fs';
class Node {
 constructor(){this.style={cssText:''};this.children=[];this.events={};}
 append(...items){this.children.push(...items);}
 addEventListener(name,fn){this.events[name]=fn;}
 remove(){this.removed=true;}
}
let lastRenderer,lastSession,requestOptions;
class Renderer {
 constructor(){lastRenderer=this;this.domElement=new Node();this.eye=new THREE.PerspectiveCamera();this.eye.position.set(0,1.5,3);this.reference={events:{},addEventListener(n,fn){this.events[n]=fn;}};this.xr={setReferenceSpaceType(){},async setSession(){},getReferenceSpace:()=>this.reference,getCamera:()=>this.eye};}
 setSize(){} setPixelRatio(){} setAnimationLoop(fn){this.loop=fn;} dispose(){this.disposed=true;}
 render(scene){this.scene=scene;}
}
globalThis.window={addEventListener(){}};globalThis.document={body:new Node(),createElement:()=>new Node()};
globalThis.innerWidth=400;globalThis.innerHeight=800;globalThis.devicePixelRatio=1;
globalThis.XRRigidTransform=class{constructor(position,orientation){this.position=position;this.orientation=orientation;}};
Object.defineProperty(globalThis,'navigator',{value:{xr:{async isSessionSupported(){return true;},async requestSession(mode,options){requestOptions=options;lastSession={events:{},visibilityState:'visible',addEventListener(n,fn){this.events[n]=fn;},async requestReferenceSpace(){return {};},async requestHitTestSource(){return {cancel(){}};},async requestHitTestSourceForTransientInput(){return {cancel(){}};},async end(){this.events.end();}};return lastSession;}}},configurable:true});
globalThis.arTestThree={...THREE,WebGLRenderer:Renderer};
let source=readFileSync(new URL('../product-ar.js',import.meta.url),'utf8').replace("import * as THREE from './vendor/three.module.js';",'const THREE=globalThis.arTestThree;');
for(const file of ['ar-world-anchor.js?v=20261014-1','product-runtime.js?v=20261010-7','ar-environment.js','ar-placement.js'])source=source.replace(`'./${file}'`,JSON.stringify(new URL('../'+file,import.meta.url).href));
const {openProductAR}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function viewer(){const root=new THREE.Group();root.scale.setScalar(.5);root.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,1),new THREE.MeshStandardMaterial({metalness:1,roughness:.02})));return {model:{root,runtime:{ar:{placement:'floor'}}},arLighting:{texture:new THREE.Texture(),intensity:.8,exposure:1}};}
function frame(){
 const state={hitX:1,valid:true,tracked:true,creates:0,deletes:0};
 const native={anchorSpace:{},delete(){state.deletes++;}};let transform;
 const f={state,native,trackedAnchors:new Set([native]),getViewerPose(){return state.valid?{emulatedPosition:false}:null;},getHitTestResults(){return [{getPose(){return {transform:{matrix:new THREE.Matrix4().makeTranslation(state.hitX,0,-2).toArray()}};}}];},getHitTestResultsForTransientInput(){return [];},async createAnchor(t){state.creates++;transform=t;return native;},getPose(){return state.tracked?{transform}:null;}};
 return f;
}
for(const name of ['desk','chair','sofa']){
 const v=viewer(),f=frame();await openProductAR(v,()=>{},{worldLock:true});
 assert.deepEqual(requestOptions.optionalFeatures,['anchors']);lastRenderer.loop(0,f);
 lastSession.events.select({frame:f,inputSource:{}});lastRenderer.loop(1,f);await Promise.resolve();
 lastRenderer.loop(2,f);const holder=lastRenderer.scene.children.find(n=>n.isGroup),position=holder.position.clone();
 assert(holder.visible);assert.equal(f.state.creates,1);assert.deepEqual(v.model.root.scale.toArray(),[.5,.5,.5]);assert.deepEqual(holder.scale.toArray(),[1,1,1]);
 // Move camera and automatic hit location: a locked object must keep its anchor.
 lastRenderer.eye.position.set(3,1.5,-1);f.state.hitX=8;lastRenderer.loop(3,f);lastSession.events.select({frame:f,inputSource:{}});
 assert(holder.position.equals(position));assert.equal(f.state.creates,1);
 f.state.valid=false;lastRenderer.loop(4,f);assert(!holder.visible);assert(holder.position.equals(position));
 f.state.valid=true;lastRenderer.loop(5,f);assert(holder.visible);assert(holder.position.equals(position));
 f.state.tracked=false;lastRenderer.loop(6,f);assert(!holder.visible);assert(holder.position.equals(position));f.state.tracked=true;lastRenderer.loop(7,f);assert(holder.visible);
 const overlay=document.body.children.at(-1),panel=overlay.children[2],move=panel.children.find(n=>n.textContent==='Yerleştir / taşı'),lock=panel.children.find(n=>n.textContent==='Sabitle');
 const right=panel.children.find(n=>n.textContent==='5 cm →');right.onclick();assert(holder.position.equals(position));
 move.onclick();assert.equal(f.state.deletes,1);panel.events.pointerdown();lastRenderer.loop(8,f);lastSession.events.select({frame:f,inputSource:{}});assert(holder.position.equals(position));
 right.onclick();assert(holder.position.x>position.x);lock.onclick();lastRenderer.loop(9,f);await Promise.resolve();lastRenderer.loop(10,f);assert.equal(f.state.creates,2);
 lastRenderer.reference.events.reset();assert(!holder.visible);assert.equal(f.state.deletes,2);lastRenderer.loop(11,f);
 assert(!holder.visible);await lastSession.end();assert(lastRenderer.disposed);assert(overlay.removed);
 console.log(`PASS: ${name} AR lock, camera movement, ignored UI taps, intentional unlock/relock, tracking loss/recovery, reference reset, fixed scale and anchor cleanup (mocked).`);
}
const v=viewer(),f=frame();f.createAnchor=async()=>{throw new Error('unsupported');};await openProductAR(v,()=>{},{worldLock:true});lastRenderer.loop(0,f);lastSession.events.select({frame:f,inputSource:{}});lastRenderer.loop(1,f);await Promise.resolve();await Promise.resolve();lastRenderer.loop(2,f);
const overlay=document.body.children.at(-1);assert.match(overlay.children[1].textContent,/kullanılamadı/);await lastSession.end();
await openProductAR(viewer());assert.equal(requestOptions.optionalFeatures,undefined);lastRenderer.loop(0,frame());await lastSession.end();
console.log('PASS: unsupported-anchor warning and original non-opted-in AR startup preserved.');
