import * as THREE from './vendor/three.module.js';

// Offline, neutral studio approximation, generated once per AR session.
// This is image based lighting, never a reflection of the camera feed.
export function createFallbackEnvironment(){
  const room=new THREE.Scene();room.background=new THREE.Color(.45,.45,.45);
  const shell=new THREE.Mesh(new THREE.BoxGeometry(12,8,12),new THREE.MeshBasicMaterial({color:0xb8b8b8,side:THREE.BackSide}));room.add(shell);
  for(const [position,scale,intensity] of [ [[-5,1,0],[.1,5,6],2],[[5,2,1],[.1,3,4],1.2],[[0,3.8,0],[5,.1,5],1.5] ]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(...scale),new THREE.MeshBasicMaterial({color:new THREE.Color(intensity,intensity,intensity)}));panel.position.set(...position);room.add(panel);
  }
  return room;
}
export function setupAREnvironment(renderer,scene,lighting={}){
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=lighting.exposure??1;
  scene.environmentIntensity=lighting.intensity??.8;
  scene.environmentRotation.y=lighting.rotation??0;
  let target=null;
  if(lighting.texture){scene.environment=lighting.texture;}
  else {
    const room=createFallbackEnvironment(),generator=new THREE.PMREMGenerator(renderer);
    try{target=generator.fromScene(room,.02,.1,100,{size:128});scene.environment=target.texture;}
    finally{generator.dispose();room.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});}
  }
  return ()=>{scene.environment=null;target?.dispose();};
}
