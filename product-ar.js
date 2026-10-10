import * as THREE from './vendor/three.module.js';
import {snapshotProduct} from './product-runtime.js?v=20261010-4';
const urls=[];
window.addEventListener('pagehide',()=>urls.forEach(u=>URL.revokeObjectURL(u)));
export async function exportCurrentProduct(viewer,format='glb'){
  const root=snapshotProduct(viewer.model.root,true);
  if(!root)throw new Error('AR için görünür ürün yok.');
  root.updateMatrixWorld(true);
  const scene=new THREE.Scene();scene.add(root);
  let bytes;
  if(format==='usdz'){const {USDZExporter}=await import('./vendor/addons/exporters/USDZExporter.js');bytes=await new USDZExporter().parseAsync(scene,{quickLookCompatible:true});}
  else {const {GLTFExporter}=await import('./vendor/addons/exporters/GLTFExporter.js');bytes=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});}
  return new Blob([bytes],{type:format==='usdz'?'model/vnd.usdz+zip':'model/gltf-binary'});
}
async function webXR(viewer,status){
  // Snapshot includes selected materials and the current motion pose; desktop root is untouched.
  const product=snapshotProduct(viewer.model.root,true),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const holder=new THREE.Group();holder.add(product);holder.visible=false;scene.add(holder);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.xr.enabled=true;
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(2,4,1);scene.add(key);
  const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:transparent;font-family:Alexandria,sans-serif';
  const help=document.createElement('p');help.style.cssText='position:absolute;top:20px;left:20px;color:white;background:#0f1b2dcc;padding:12px';help.textContent='Zemini tarayın, ürünü yerleştirmek için dokunun.';
  const exit=document.createElement('button');exit.textContent='AR kapat';exit.style.cssText='position:absolute;bottom:25px;left:25px;padding:14px;font:inherit';overlay.append(renderer.domElement,help,exit);document.body.append(overlay);
  let session,hitSource,placed=false;
  const marker=new THREE.Mesh(new THREE.RingGeometry(.08,.1,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xb68a4c}));marker.matrixAutoUpdate=false;marker.visible=false;scene.add(marker);
  const dispose=()=>{hitSource?.cancel();renderer.setAnimationLoop(null);renderer.dispose();overlay.remove();};
  try{
    session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['dom-overlay'],domOverlay:{root:overlay}});
    session.addEventListener('end',dispose,{once:true});exit.onclick=()=>session.end();
    renderer.xr.setReferenceSpaceType('local');await renderer.xr.setSession(session);
    const view=await session.requestReferenceSpace('viewer');hitSource=await session.requestHitTestSource({space:view});
    session.addEventListener('select',()=>{if(!marker.visible)return;holder.position.setFromMatrixPosition(marker.matrix);holder.visible=true;placed=true;help.textContent='Yeniden konumlandırmak için zemine dokunun.';});
    // Exported product coordinates are retained. Placement anchors its ground center only.
    const box=new THREE.Box3().setFromObject(product),center=box.getCenter(new THREE.Vector3());product.position.add(new THREE.Vector3(-center.x,-box.min.y,-center.z));
    renderer.setAnimationLoop((time,frame)=>{if(frame){const hit=frame.getHitTestResults(hitSource)[0];marker.visible=!!hit;if(hit)marker.matrix.fromArray(hit.getPose(renderer.xr.getReferenceSpace()).transform.matrix);}renderer.render(scene,camera);});
    status('');
  }catch(error){await session?.end().catch(()=>{});dispose();throw error;}
}
export async function openProductAR(viewer,status=()=>{}){
  status('AR hazırlanıyor…');
  if(!viewer.model)throw new Error('Önce ürünü yükleyin.');
  if(navigator.xr&&await navigator.xr.isSessionSupported('immersive-ar'))return webXR(viewer,status);
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1){
    const blob=await exportCurrentProduct(viewer,'usdz'),href=URL.createObjectURL(blob);urls.push(href);
    const link=document.createElement('a');link.rel='ar';link.href=href;link.download='VREEL_Product.usdz';const image=document.createElement('img');image.src=viewer.toDataURL();link.append(image);document.body.append(link);link.click();link.remove();status('');return;
  }
  // Scene Viewer cannot fetch an IndexedDB/blob URL. Never launch the stale original GLB.
  status('Bu cihazda canlı AR desteklenmiyor. Güncel AR modeli indirilebilir; harici Scene Viewer için erişilebilir HTTPS dosyası gerekir.');
}
export function addARControls(viewer,host,status){
  const ar=document.createElement('button');ar.textContent='AR ile görüntüle';ar.type='button';
  ar.onclick=async()=>{ar.disabled=true;try{await openProductAR(viewer,status);}catch(e){status('AR: '+e.message);}finally{ar.disabled=false;}};
  const download=document.createElement('button');download.type='button';download.textContent='AR GLB indir';download.onclick=async()=>{download.disabled=true;try{const blob=await exportCurrentProduct(viewer),u=URL.createObjectURL(blob);urls.push(u);const a=document.createElement('a');a.href=u;a.download='VREEL_AR_Current.glb';a.click();status('Güncel seçimler ve hareket konumu dışa aktarıldı.');}catch(e){status(e.message);}finally{download.disabled=false;}};
  host.append(ar,download);
}
