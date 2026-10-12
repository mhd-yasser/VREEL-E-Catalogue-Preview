import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {snapshotProduct} from '../product-runtime.js';
import {setupAREnvironment,createFallbackEnvironment} from '../ar-environment.js';
const root=new THREE.Group(),texture=new THREE.Texture();
const materials=[new THREE.MeshStandardMaterial({metalness:0,roughness:.8,map:texture}),new THREE.MeshStandardMaterial({metalness:1,roughness:.4}),new THREE.MeshStandardMaterial({metalness:1,roughness:.02}),new THREE.MeshPhysicalMaterial({metalness:0,roughness:.05,transparent:true,opacity:.25,transmission:1})];
for(const m of materials)root.add(new THREE.Mesh(new THREE.BoxGeometry(),m));
const before=materials.map(m=>m.toJSON()),snapshot=snapshotProduct(root,true),scene=new THREE.Scene(),renderer={};scene.add(snapshot);
const borrowed=new THREE.Texture();let released=false;borrowed.addEventListener('dispose',()=>released=true);
const dispose=setupAREnvironment(renderer,scene,{texture:borrowed,intensity:.8,rotation:.4,exposure:1.08});
assert.equal(scene.environment,borrowed);assert.equal(scene.background,null);assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping);
assert.deepEqual(materials.map(m=>m.toJSON()),before);
assert(snapshot.children.every((m,i)=>m.material===materials[i]));
// Variant selection is captured at AR entry, without changing the original binding.
root.children[0].material=materials[2];assert.equal(snapshotProduct(root,true).children[0].material,materials[2]);assert.equal(snapshot.children[0].material,materials[0]);
dispose();assert.equal(scene.environment,null);assert(!released);
const fallback=createFallbackEnvironment();assert(fallback.background.r>0);assert.equal(fallback.children.length,4);fallback.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
console.log('PASS: nonmetal, metal, mirror, transmission and variant snapshot properties preserved; borrowed lighting ownership and transparent background; offline reflection scene. GPU rendering requires browser/device verification.');
