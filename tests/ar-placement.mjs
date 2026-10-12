import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {surfacePose,preparePlacement,placeOnSurface} from '../ar-placement.js';
const eye=new THREE.Vector3(0,1,3),floor=new THREE.Matrix4().makeTranslation(0,0,1),vertical=new THREE.Matrix4().makeRotationX(Math.PI/2);vertical.setPosition(1,1.5,0);
assert.equal(surfacePose(floor,eye).kind,'floor');const wall=surfacePose(vertical,eye);assert.equal(wall.kind,'wall');assert(wall.normal.z>0);
const root=new THREE.Group();root.scale.setScalar(.01);const mesh=new THREE.Mesh(new THREE.BoxGeometry(100,70,40));mesh.position.set(10,65,20);root.add(mesh);
const state=preparePlacement(root,{placement:'wall',back:'-z'}),holder=new THREE.Group();holder.add(root);
assert(!placeOnSurface(holder,wall,state,null));assert(!placeOnSurface(holder,surfacePose(floor,eye),state,0));assert(placeOnSurface(holder,wall,state,.2));
const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());assert(Math.abs(size.x-1)<1e-6);assert(Math.abs(box.min.z)<1e-6);assert(Math.abs(box.min.y-.5)<1e-6);
state.settings.heightOffset=.1;placeOnSurface(holder,wall,state,.2);assert(Math.abs(new THREE.Box3().setFromObject(root).min.y-.6)<1e-6);assert.deepEqual(root.scale.toArray(),[.01,.01,.01]);
const sideWall=surfacePose(new THREE.Matrix4().makeRotationZ(-Math.PI/2),new THREE.Vector3(2,1,0));placeOnSurface(holder,sideWall,state,0);const normal=new THREE.Vector3(0,0,1).applyQuaternion(holder.quaternion);assert(normal.distanceTo(sideWall.normal)<1e-6);assert.equal(holder.scale.x,1);
console.log('PASS: floor/wall filtering, floor calibration required, wall contact, exported suspended height, height adjustment, wall yaw, fixed metre scale.');

const {manualWallPose,intersectPlaneRay,projectToWall,moveAlongWall,rotateWall}=await import('../ar-placement.js');
const a=new THREE.Vector3(-1,.2,0),b=new THREE.Vector3(1,.2,0),manual=manualWallPose(a,b,eye);
assert.equal(manual.source,'manual');assert.equal(manual.normal.y,0);assert(manual.normal.z>0);
assert.equal(manualWallPose(a,a.clone().add(new THREE.Vector3(.29,0,0)),eye),null);
assert(manualWallPose(a,b,new THREE.Vector3(0,1,-3)).normal.z<0);
const floorPlane={position:new THREE.Vector3(0,.2,0),normal:new THREE.Vector3(0,1,0)};
assert.equal(intersectPlaneRay(eye,new THREE.Vector3(0,0,-1),floorPlane),null);
assert.equal(intersectPlaneRay(eye,new THREE.Vector3(0,1,0),floorPlane),null);
assert.equal(intersectPlaneRay(eye,new THREE.Vector3(0,-.09,-1).normalize(),floorPlane),null);
const ray=intersectPlaneRay(eye,new THREE.Vector3(0,-1,-1).normalize(),floorPlane);assert(Math.abs(ray.y-.2)<1e-8);
assert(Math.abs(projectToWall(new THREE.Vector3(2,1,4),manual).z)<1e-8);
for(const back of ['-z','+z','-x','+x']){
 const p=new THREE.Mesh(new THREE.BoxGeometry(1,.7,.4));p.scale.setScalar(.75);
 const st=preparePlacement(p,{placement:'wall',back}),h=new THREE.Group();h.add(p);placeOnSurface(h,manual,st,.2);
 const originalScale=p.scale.clone(),originalQuaternion=h.quaternion.clone();
 moveAlongWall(h,manual,.35,.4);
 assert(Math.abs(h.position.clone().sub(manual.position).dot(manual.normal))<1e-8);
 assert(h.quaternion.equals(originalQuaternion));assert(p.scale.equals(originalScale));assert.deepEqual(h.scale.toArray(),[1,1,1]);
 const rotated=rotateWall({...manual,position:h.position.clone()},Math.PI/4);
 h.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4));moveAlongWall(h,rotated,.05,.1);
 assert(Math.abs(h.position.clone().sub(rotated.position).dot(rotated.normal))<1e-8);
 // In-plane product rotation must preserve the normal of every selectable back.
 const outward=new THREE.Vector3(back.includes('x')?(back==='-x'?1:-1):0,0,back.includes('z')?(back==='-z'?1:-1):0);
 h.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(rotated.normal,.15));
 assert(outward.applyQuaternion(h.quaternion).distanceTo(rotated.normal)<1e-8);
}
console.log('PASS: two-point gravity-aligned manual calibration, minimum baseline, ray rejection, constrained movement, all back axes, wall angle, in-plane rotation, unchanged scale.');
const {PlacementTracking}=await import('../ar-placement.js');const tracking=new PlacementTracking();
assert(!tracking.usable);tracking.update(true);assert(tracking.usable);tracking.update(false);assert(!tracking.usable);
tracking.confirm();assert(tracking.needsRecovery);tracking.update(true);assert(!tracking.usable);tracking.confirm();assert(tracking.usable);
tracking.update(false);tracking.update(false);tracking.update(true);assert(!tracking.usable);
console.log('PASS: missing pose and recovery pause placement; confirmation cannot bypass missing tracking.');
