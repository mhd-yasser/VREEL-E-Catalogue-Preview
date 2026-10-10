import * as THREE from './vendor/three.module.js';
import {snapshotProduct} from './product-runtime.js?v=20261010-6';
import {placementSettings,surfacePose,preparePlacement,placeOnSurface} from './ar-placement.js';
const urls=[];
window.addEventListener('pagehide',()=>urls.forEach(u=>URL.revokeObjectURL(u)));
export async function exportCurrentProduct(viewer,format='glb'){
  const root=snapshotProduct(viewer.model.root,true);
  if(!root)throw new Error('AR için görünür ürün yok.');
  root.updateMatrixWorld(true);
  const scene=new THREE.Scene();scene.add(root);
  let bytes;
  if(format==='usdz'){const {USDZExporter}=await import('./vendor/addons/exporters/USDZExporter.js');bytes=await new USDZExporter().parseAsync(scene,{quickLookCompatible:true,ar:{anchoring:{type:'plane'},planeAnchoring:{alignment:placementSettings(viewer.model.runtime?.ar).placement==='wall'?'vertical':'horizontal'}}});}
  else {const {GLTFExporter}=await import('./vendor/addons/exporters/GLTFExporter.js');bytes=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});}
  return new Blob([bytes],{type:format==='usdz'?'model/vnd.usdz+zip':'model/gltf-binary'});
}
async function webXR(viewer,status){
  const product=snapshotProduct(viewer.model.root,true),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const state=preparePlacement(product,viewer.model.runtime?.ar),wall=state.settings.placement==='wall';
  const holder=new THREE.Group();holder.add(product);holder.visible=false;scene.add(holder);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.xr.enabled=true;
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(2,4,1);scene.add(key);
  const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:transparent;font-family:Alexandria,sans-serif;touch-action:none';
  const help=document.createElement('p');help.style.cssText='position:absolute;top:16px;left:16px;right:16px;color:white;background:#0f1b2dcc;padding:12px';
  const panel=document.createElement('div');panel.style.cssText='position:absolute;bottom:20px;left:16px;right:16px;display:flex;gap:8px;flex-wrap:wrap';
  overlay.append(renderer.domElement,help,panel);document.body.append(overlay);
  let session,hitSource,touchSource,placed=false,moving=true,floorY=null,currentPose=null;
  const marker=new THREE.Mesh(new THREE.RingGeometry(.08,.1,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xb68a4c,side:THREE.DoubleSide}));marker.matrixAutoUpdate=false;marker.visible=false;scene.add(marker);
  function instructions(){help.textContent=wall&&floorY===null?'Önce zemini tarayın ve zemin işaretine dokunun.':!placed?(wall?'Duvarı tarayın ve duvar işaretine dokunun.':'Zemin işaretine dokunarak ürünü yerleştirin.'):(moving?(touchSource?'Ürünü taşımak için işarete dokunun veya ekranda sürükleyin. Boyut 1:1 sabittir.':'İşarete dokunun veya 5 cm düğmeleriyle taşıyın. Boyut 1:1 sabittir.'):'Yerleşim sabit. Yeniden taşımak için Taşı düğmesine dokunun. Boyut 1:1 sabittir.');}
  function button(label,fn){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:12px;border:0;border-radius:8px;font:inherit;background:#fff;color:#0f1b2d';b.addEventListener('beforexrselect',e=>e.preventDefault());b.onclick=fn;panel.append(b);return b;}
  button('Yerleştir / taşı',()=>{moving=true;instructions();});
  button('Sabitle',()=>{moving=false;marker.visible=false;instructions();});
  for(const [label,amount] of [['← 5 cm',-.05],['5 cm →',.05]])button(label,()=>{if(!placed)return;const tangent=new THREE.Vector3(1,0,0).applyQuaternion(holder.quaternion);holder.position.addScaledVector(tangent,amount);});
  for(const [label,amount] of [['↓ 5 cm',-.05],['5 cm ↑',.05]])button(label,()=>{if(!placed)return;if(wall){state.settings.heightOffset+=amount;holder.position.y+=amount;}else holder.position.addScaledVector(new THREE.Vector3(0,0,1).applyQuaternion(holder.quaternion),amount);});
  if(!wall)for(const [label,amount] of [['↶ 5°',Math.PI/36],['5° ↷',-Math.PI/36]])button(label,()=>{if(placed)holder.rotation.y+=amount;});
  if(wall)button('Zemini yeniden tara',()=>{floorY=null;moving=true;holder.visible=false;placed=false;instructions();});
  button('AR kapat',()=>session?.end());
  const dispose=()=>{hitSource?.cancel();touchSource?.cancel();renderer.setAnimationLoop(null);renderer.dispose();overlay.remove();};
  function place(pose){if(!moving||!pose)return;if(wall&&floorY===null){if(pose.kind!=='floor')return;floorY=pose.position.y;instructions();return;}if(placeOnSurface(holder,pose,state,floorY)){placed=true;instructions();}}
  try{
    session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test','dom-overlay'],domOverlay:{root:overlay}});
    session.addEventListener('end',dispose,{once:true});
    renderer.xr.setReferenceSpaceType('local');await renderer.xr.setSession(session);
    const view=await session.requestReferenceSpace('viewer');hitSource=await session.requestHitTestSource({space:view});
    if(session.requestHitTestSourceForTransientInput)try{touchSource=await session.requestHitTestSourceForTransientInput({profile:'generic-touchscreen'});}catch{}
    session.addEventListener('select',event=>{if(!moving)return;const touches=touchSource&&event.frame.getHitTestResultsForTransientInput(touchSource);const hit=touches?.find(t=>t.inputSource===event.inputSource)?.results[0];if(hit){const pose=hit.getPose(renderer.xr.getReferenceSpace());if(pose)place(surfacePose(new THREE.Matrix4().fromArray(pose.transform.matrix),renderer.xr.getCamera().getWorldPosition(new THREE.Vector3())));}else if(marker.visible)place(currentPose);});
    instructions();renderer.setAnimationLoop((time,frame)=>{if(frame){const reference=renderer.xr.getReferenceSpace(),eye=renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());const wanted=wall&&floorY===null?'floor':state.settings.placement;
      currentPose=null;for(const hit of frame.getHitTestResults(hitSource)){const p=hit.getPose(reference);if(!p)continue;const matrix=new THREE.Matrix4().fromArray(p.transform.matrix),pose=surfacePose(matrix,eye);if(pose.kind!==wanted)continue;currentPose=pose;marker.matrix.copy(matrix);break;}marker.visible=moving&&!!currentPose;
      if(placed&&moving&&touchSource)for(const touch of frame.getHitTestResultsForTransientInput(touchSource)){const p=touch.results[0]?.getPose(reference);if(p)place(surfacePose(new THREE.Matrix4().fromArray(p.transform.matrix),eye));}
    }renderer.render(scene,camera);});status('');
  }catch(error){await session?.end().catch(()=>{});dispose();throw error;}
}
export async function openProductAR(viewer,status=()=>{}){
  status('AR hazırlanıyor…');
  if(!viewer.model)throw new Error('Önce ürünü yükleyin.');
  if(navigator.xr&&await navigator.xr.isSessionSupported('immersive-ar'))return webXR(viewer,status);
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1){
    const blob=await exportCurrentProduct(viewer,'usdz'),href=URL.createObjectURL(blob);urls.push(href);
    const link=document.createElement('a');link.rel='ar';link.href=href+'#allowsContentScaling=0';link.download='VREEL_Product.usdz';const image=document.createElement('img');image.src=viewer.toDataURL();link.append(image);document.body.append(link);link.click();link.remove();status('');return;
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
