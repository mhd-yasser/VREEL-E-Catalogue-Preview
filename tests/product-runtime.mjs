import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {composeProduct,applyMaterialVariant,configureMotions,toggleMotion,updateMotions,measuredBox,snapshotProduct,normalizeDraft} from '../product-runtime.js';
const root=new THREE.Group(),shared=new THREE.Group(),wide=new THREE.Group(),narrow=new THREE.Group(),wall=new THREE.Group();root.add(shared,wide,narrow,wall);
for(const [node,id] of [[shared,'scene-0'],[wall,'scene-1'],[wide,'scene-2'],[narrow,'scene-3']])node.userData.productScene=id;
const original=new THREE.MeshStandardMaterial({color:'white'}),red=new THREE.MeshStandardMaterial({color:'red'}),blue=new THREE.MeshStandardMaterial({color:'blue'});
const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),original);wide.add(mesh);const small=mesh.clone();small.scale.setScalar(.5);narrow.add(small);const decor=mesh.clone();decor.scale.setScalar(100);wall.add(decor);
const rt={root,scenes:[{id:'scene-0',name:'0',node:shared},{id:'scene-1',name:'noAR',node:wall},{id:'scene-2',name:'Wide',node:wide},{id:'scene-3',name:'Narrow',node:narrow}],bindings:[{node:mesh,original,materials:new Map([['variant-0',red],['variant-1',blue]])},{node:small,original,materials:new Map([['variant-0',red]])}],sources:[],mixer:new THREE.AnimationMixer(root)};
const d={schemaVersion:2,modelScale:1,scenes:[{id:'scene-0',role:'shared'},{id:'scene-1',role:'decoration'},{id:'scene-2',role:'alternative'},{id:'scene-3',role:'alternative'}],componentGroups:[{id:'width',defaultId:'narrow',options:[{id:'wide',nodeId:'scene-2'},{id:'narrow',nodeId:'scene-3',defaultVariant:'variant-0'}]}],materialVariants:[{id:'variant-0',key:'Red'},{id:'variant-1',key:'Blue'}],defaultVariant:'variant-1'};
composeProduct(rt,d);assert(!wide.visible&&narrow.visible&&wall.visible);applyMaterialVariant(rt,d,'variant-1');assert.equal(mesh.material,blue);assert.equal(small.material,red);assert.equal(decor.material,original);assert.equal(measuredBox(root).getSize(new THREE.Vector3()).x,.5);
const before=wall.visible,snapshot=snapshotProduct(root,true);assert.equal(wall.visible,before);assert(snapshot.children.every(n=>n.userData.productScene===undefined));assert.equal(snapshot.children.length,2);
const track=new THREE.VectorKeyframeTrack(mesh.uuid+'.position',[0,1],[0,0,0,0,1,0]);rt.sources=[{tracks:[{key:'0:0',track,node:mesh}]}];const motions=[{id:'open',name:'Open',duration:2,mode:'toggle',smooth:true,tracks:['0:0']}];configureMotions(rt,motions);toggleMotion(rt,'open');updateMotions(rt,.8);assert(Math.abs(mesh.position.y-.352)<1e-6);toggleMotion(rt,'open');updateMotions(rt,.2);assert(Math.abs(rt.motions[0].progress-.3)<1e-6);const posed=snapshotProduct(root);assert.equal(posed.children.length,3);
const legacy={groups:[{name:'Old'}]};normalizeDraft(legacy);assert.equal(legacy.schemaVersion,undefined);assert.equal(legacy.groups[0].name,'Old');
const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),original,2);instances.setMatrixAt(1,new THREE.Matrix4().makeTranslation(2,0,0));const baked=snapshotProduct(instances);assert(!baked.isInstancedMesh);assert.equal(baked.children.length,2);assert.equal(baked.children[1].position.x,2);
console.log('PASS: scene composition, per-alternative material fallback, fixed surfaces, decoration exclusion, unchanged normal view after AR snapshot, easing/reversal, legacy normalization, instance export.');

const otherTrack=new THREE.VectorKeyframeTrack(small.uuid+'.position',[0,1],[0,0,0,1,0,0]);
rt.sources=[{tracks:[{key:'0:0',track,node:mesh},{key:'0:1',track:otherTrack,node:small}]}];
configureMotions(rt,[{id:'combined',name:'All',duration:1,mode:'toggle',tracks:['0:0','0:1']}]);
assert.equal(rt.motions.length,2);toggleMotion(rt,rt.motions[0].setting.id);updateMotions(rt,.5);
assert.equal(rt.motions[0].progress,.5);assert.equal(rt.motions[1].progress,0);
console.log('PASS: combined animation splits into independently controlled target motions.');

composeProduct(rt,d,new Map([['width','wide']]));toggleMotion(rt,rt.motions[0].setting.id);updateMotions(rt,.4);assert(rt.motions[0].progress>0);
composeProduct(rt,d,new Map([['width','narrow']]));assert(rt.motions.every(m=>m.progress===0&&m.direction===0));
composeProduct(rt,d,new Map([['width','wide']]));assert(rt.motions.every(m=>m.progress===0&&m.direction===0));
console.log('PASS: switching alternatives resets outgoing and incoming target poses.');

const sharedDoor=mesh.clone();shared.add(sharedDoor);const sharedTrack=new THREE.VectorKeyframeTrack(sharedDoor.uuid+'.position',[0,1],[0,0,0,0,1,0]);
rt.sources[0].tracks.push({key:'0:2',track:sharedTrack,node:sharedDoor});configureMotions(rt,[{id:'all',name:'All',duration:1,mode:'toggle',tracks:['0:0','0:1','0:2']}]);
const sharedMotion=rt.motions.find(m=>m.target===sharedDoor);toggleMotion(rt,sharedMotion.setting.id);updateMotions(rt,.4);
composeProduct(rt,d,new Map([['width','narrow']]));assert.equal(sharedMotion.progress,.4);assert.equal(sharedMotion.direction,1);
console.log('PASS: changing an alternative preserves shared-element motion state.');
