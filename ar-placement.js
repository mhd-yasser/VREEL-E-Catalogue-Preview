import * as THREE from './vendor/three.module.js';
export function placementSettings(settings={}){return {placement:settings.placement==='wall'?'wall':'floor',back:settings.back||'-z',heightOffset:Number(settings.heightOffset)||0};}
export function surfacePose(matrix,viewerPosition){const normal=new THREE.Vector3().setFromMatrixColumn(matrix,1).normalize(),position=new THREE.Vector3().setFromMatrixPosition(matrix);if(normal.dot(viewerPosition.clone().sub(position))<0)normal.negate();return {position,normal,kind:Math.abs(normal.y)>.85?'floor':Math.abs(normal.y)<.25?'wall':'other'};}
export function preparePlacement(product,settings){const box=new THREE.Box3().setFromObject(product),center=box.getCenter(new THREE.Vector3()),s=placementSettings(settings);const anchor=center.clone();anchor.y=s.placement==='wall'?0:box.min.y;let outward=0;
 if(s.placement==='wall'){if(s.back==='-x'){anchor.x=box.min.x;outward=Math.PI/2;}else if(s.back==='+x'){anchor.x=box.max.x;outward=-Math.PI/2;}else if(s.back==='+z'){anchor.z=box.max.z;outward=Math.PI;}else anchor.z=box.min.z;}
 product.position.sub(anchor);return {settings:s,outward};}
export function placeOnSurface(holder,pose,state,floorY){if(pose.kind!==state.settings.placement)return false;if(state.settings.placement==='wall'){if(!Number.isFinite(floorY))return false;holder.rotation.set(0,Math.atan2(pose.normal.x,pose.normal.z)-state.outward,0);holder.position.copy(pose.position);holder.position.y=floorY+state.settings.heightOffset;}else{holder.position.copy(pose.position);holder.position.y+=state.settings.heightOffset;}holder.visible=true;holder.updateMatrixWorld(true);return true;}

// Both points are intersections with a calibrated horizontal floor, chosen by
// the user at the wall base. Gravity supplies vertical orientation; no wall hit
// is implied. A meaningful baseline avoids an unstable wall normal.
export function manualWallPose(a,b,eye){
 const tangent=b.clone().sub(a);tangent.y=0;if(tangent.length()<.3)return null;
 tangent.normalize();const normal=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,1,0));
 const position=a.clone().add(b).multiplyScalar(.5);if(normal.dot(eye.clone().sub(position))<0)normal.negate();
 return {position,normal,kind:'wall',source:'manual'};
}
export function intersectPlaneRay(origin,direction,plane,maxDistance=8){
 const denominator=plane.normal.dot(direction);if(Math.abs(denominator)<.08)return null;
 const distance=plane.position.clone().sub(origin).dot(plane.normal)/denominator;
 if(distance<.05||distance>maxDistance)return null;
 return origin.clone().addScaledVector(direction,distance);
}
export function projectToWall(point,wall){
 return point.clone().addScaledVector(wall.normal,-point.clone().sub(wall.position).dot(wall.normal));
}
export function moveAlongWall(holder,wall,horizontal=0,vertical=0){
 const tangent=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),wall.normal).normalize();
 holder.position.addScaledVector(tangent,horizontal);holder.position.y+=vertical;
 holder.position.copy(projectToWall(holder.position,wall));holder.updateMatrixWorld(true);
}
export function rotateWall(wall,angle){
 return {...wall,position:wall.position.clone(),normal:wall.normal.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle)};
}

export class PlacementTracking {
 constructor(){this.tracked=false;this.needsRecovery=false;this.everTracked=false;}
 update(valid){if(!valid&&this.tracked&&this.everTracked)this.needsRecovery=true;this.tracked=valid;this.everTracked ||= valid;}
 confirm(){if(this.tracked)this.needsRecovery=false;}
 get usable(){return this.tracked&&!this.needsRecovery;}
}
