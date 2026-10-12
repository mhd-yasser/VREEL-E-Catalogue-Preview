import * as THREE from './vendor/three.module.js';
import {snapshotProduct} from './product-runtime.js?v=20261010-7';
import {placementSettings,surfacePose,preparePlacement,placeOnSurface,manualWallPose,intersectPlaneRay,projectToWall,moveAlongWall,rotateWall,PlacementTracking} from './ar-placement.js?v=20261012-1';
import {setupAREnvironment} from './ar-environment.js?v=20261012-1';
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
  // Scene-level lighting preserves shared GLTF materials, textures and variants.
  let releaseEnvironment=()=>{};
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,.85));
  const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-2,10,5);scene.add(key);
  const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:transparent;font-family:Alexandria,sans-serif;touch-action:none';
  const help=document.createElement('p');help.style.cssText='position:absolute;top:16px;left:16px;right:16px;color:white;background:#0f1b2dcc;padding:12px;pointer-events:none';help.setAttribute('role','status');
  const panel=document.createElement('div');panel.style.cssText='position:absolute;bottom:20px;left:16px;right:16px;display:flex;gap:8px;flex-wrap:wrap;max-height:48vh;overflow:auto';
  overlay.append(renderer.domElement,help,panel);document.body.append(overlay);
  let session,hitSource,touchSource,placed=false,moving=true,floorY=null,currentPose=null;
  let selectedWall=null,manual=false,firstPoint=null,manualCandidate=null,eye=null,eyeDirection=null;
  const tracking=new PlacementTracking();
  let disposed=false,reference=null,syncHeight=()=>{};
  const controls=[];
  const marker=new THREE.Mesh(new THREE.RingGeometry(.08,.1,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xb68a4c,side:THREE.DoubleSide}));marker.matrixAutoUpdate=false;marker.visible=false;scene.add(marker);
  const guide=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({color:0x42b5d6,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false}));guide.visible=false;scene.add(guide);
  const pointMarker=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0x42b5d6}));pointMarker.visible=false;scene.add(pointMarker);
  let notice='',uiBlockedUntil=0;
  panel.addEventListener('pointerdown',()=>{uiBlockedUntil=Infinity;});
  const releaseUI=()=>{uiBlockedUntil=performance.now()+200;};
  overlay.addEventListener('pointerup',releaseUI);overlay.addEventListener('pointercancel',releaseUI);
  function canInteract(){return tracking.usable;}
  function updateGuide(){
    guide.visible=!!selectedWall&&canInteract();
    if(!selectedWall)return;
    guide.position.copy(selectedWall.position);guide.position.y=placed?holder.position.y:floorY+1;
    guide.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),selectedWall.normal);
    guide.material.color.setHex(selectedWall.source==='manual'?0x42b5d6:0xb68a4c);
  }
  function instructions(){
    syncHeight();
    for(const b of controls)b.disabled=!canInteract();
    if(recoverButton)recoverButton.disabled=!tracking.tracked||!tracking.needsRecovery;
    if(!tracking.tracked){help.textContent='Kamera takibi yetersiz. Yerleştirme durduruldu; telefonu yavaşça hareket ettirin.';return;}
    if(tracking.needsRecovery){help.textContent='Takip geri geldi. Yerleşimi kontrol edin; devam etmek için Onayla düğmesine dokunun.';return;}
    const origin=selectedWall?(selectedWall.source==='manual'?'Elle tanımlanan tahmini duvar — fiziksel duvar algılanmadı.':'Otomatik duvar yüzeyi (AR hit-test).'):'';
    const task=wall&&floorY===null?'Önce zemini tarayın ve zemin işaretine dokunun.':manual?(firstPoint?'Aynı duvarın tabanında en az 30 cm uzaktaki ikinci noktaya nişan alın; Noktayı seç düğmesine dokunun.':'Duvarın zeminle birleştiği çizgide ilk noktaya nişan alın; Noktayı seç düğmesine dokunun.'):!placed?(wall?'Duvarı tarayın ve duvar işaretine dokunun. Beyaz duvar için Elle duvar seç kullanılabilir.':'Zemin işaretine dokunarak ürünü yerleştirin.'):moving?'Taşımak için dokunun / sürükleyin veya 5 cm düğmelerini kullanın.':'Yerleşim sabit. Taşı düğmesiyle devam edin.';
    const text=[notice,origin,task,'Ölçek sabit; fiziksel ölçüm doğruluğu cihaz takibine bağlıdır.'].filter(Boolean).join(' ');
    if(help.textContent!==text)help.textContent=text;
  }
  let recoverButton;
  function button(label,fn,requiresTracking=true){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:10px;border:0;border-radius:8px;font:inherit;background:#fff;color:#0f1b2d';b.addEventListener('beforexrselect',e=>e.preventDefault());b.onclick=()=>{if(requiresTracking&&!canInteract())return;notice='';fn();instructions();};panel.append(b);if(requiresTracking)controls.push(b);return b;}
  button('Yerleştir / taşı',()=>{moving=true;});
  button('Sabitle',()=>{moving=false;marker.visible=false;});
  for(const [label,amount] of [['← 5 cm',-.05],['5 cm →',.05]])button(label,()=>{
    if(!placed)return;
    if(selectedWall)moveAlongWall(holder,selectedWall,amount,0);
    else holder.position.addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(holder.quaternion),amount);
  });
  for(const [label,amount] of [['↓ 5 cm',-.05],['5 cm ↑',.05]])button(label,()=>{
    if(!placed)return;
    if(selectedWall){state.settings.heightOffset+=amount;moveAlongWall(holder,selectedWall,0,amount);}
    else holder.position.addScaledVector(new THREE.Vector3(0,0,1).applyQuaternion(holder.quaternion),amount);
  });
  for(const [label,amount] of [['↶ 5°',Math.PI/36],['5° ↷',-Math.PI/36]])button(label,()=>{
    if(!placed)return;
    // Wall products rotate IN the plane, never yaw out of contact with it.
    if(selectedWall)holder.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(selectedWall.normal,amount));
    else holder.rotation.y+=amount;
    holder.updateMatrixWorld(true);
  });
  if(wall){
    button('Elle duvar seç',()=>{
      if(floorY===null){notice='Elle duvar için önce zemini kalibre edin.';return;}
      manual=true;firstPoint=null;selectedWall=null;placed=false;holder.visible=false;moving=true;
    });
    button('Noktayı seç',()=>{
      if(!manual||!manualCandidate){notice='Zemin/duvar birleşimine aşağı doğru nişan alın (en fazla 8 m).';return;}
      if(!firstPoint){firstPoint=manualCandidate.clone();pointMarker.position.copy(firstPoint);pointMarker.visible=true;return;}
      const pose=manualWallPose(firstPoint,manualCandidate,eye);
      if(!pose){notice='İki nokta en az 30 cm ayrı olmalı.';return;}
      selectedWall=pose;manual=false;firstPoint=null;pointMarker.visible=false;
      placed=placeOnSurface(holder,pose,state,floorY);updateGuide();
    });
    for(const [label,amount] of [['Duvar açısı −5°',-Math.PI/36],['Duvar açısı +5°',Math.PI/36]])button(label,()=>{
      if(!placed||selectedWall?.source!=='manual'){notice='Duvar açısı yalnız elle tanımlanan duvarda değiştirilebilir.';return;}
      selectedWall=rotateWall({...selectedWall,position:holder.position.clone()},amount);
      holder.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),amount));holder.updateMatrixWorld(true);updateGuide();
    });
    const heightLabel=document.createElement('label');heightLabel.style.cssText='background:#fff;padding:8px;border-radius:8px';heightLabel.textContent='Yükseklik farkı (cm) ';
    const height=document.createElement('input');height.type='number';height.step='1';height.value=String(state.settings.heightOffset*100);height.style.width='65px';height.setAttribute('aria-label','Kayıtlı montaj yüksekliğine ek fark, santimetre');
    height.addEventListener('beforexrselect',e=>e.preventDefault());height.onchange=()=>{
      if(!canInteract()){height.value=String(state.settings.heightOffset*100);return;}
      const next=Number(height.value)/100;if(!Number.isFinite(next)||Math.abs(next)>10){height.value=String(state.settings.heightOffset*100);return;}
      const delta=next-state.settings.heightOffset;state.settings.heightOffset=next;if(placed&&selectedWall)moveAlongWall(holder,selectedWall,0,delta);
    };heightLabel.append(height);panel.append(heightLabel);controls.push(height);
    // Keep the numeric height in sync with the incremental controls.
    syncHeight=()=>{if(document.activeElement!==height)height.value=String(Math.round(state.settings.heightOffset*10000)/100);};
    button('Otomatik duvar / yeniden seç',()=>{manual=false;firstPoint=null;pointMarker.visible=false;selectedWall=null;placed=false;holder.visible=false;moving=true;updateGuide();});
    button('Zemini yeniden tara',resetPlacement);
  }
  recoverButton=button('Takibi onayla',()=>{tracking.confirm();updateGuide();},false);
  button('AR kapat',()=>session?.end(),false);
  function resetPlacement(){floorY=null;manual=false;firstPoint=null;pointMarker.visible=false;selectedWall=null;placed=false;moving=true;holder.visible=false;marker.visible=false;updateGuide();}
  function dispose(){
    if(disposed)return;disposed=true;hitSource?.cancel();touchSource?.cancel();renderer.setAnimationLoop(null);
    window.removeEventListener('resize',resize);releaseEnvironment();
    for(const mesh of [marker,guide,pointMarker]){mesh.geometry.dispose();mesh.material.dispose();}
    // Snapshot mostly borrows viewer resources; dispose only newly baked resources.
    const borrowed=new Set();viewer.model?.root.traverse(n=>{if(n.geometry)borrowed.add(n.geometry);for(const m of [n.material].flat())if(m)borrowed.add(m);});
    const owned=new Set();product.traverse(n=>{if(n.geometry&&!borrowed.has(n.geometry))owned.add(n.geometry);for(const m of [n.material].flat())if(m&&!borrowed.has(m))owned.add(m);});for(const r of owned)r.dispose();
    renderer.dispose();overlay.remove();
  }
  function resize(){renderer.setSize(innerWidth,innerHeight);}
  function place(pose){
    if(!canInteract()||!moving||!pose||manual)return;
    if(wall&&floorY===null){if(pose.kind!=='floor')return;floorY=pose.position.y;instructions();return;}
    if(selectedWall){holder.position.copy(projectToWall(pose.position,selectedWall));state.settings.heightOffset=holder.position.y-floorY;holder.updateMatrixWorld(true);return;}
    if(placeOnSurface(holder,pose,state,floorY)){placed=true;if(wall)selectedWall={...pose,normal:new THREE.Vector3(pose.normal.x,0,pose.normal.z).normalize(),source:'automatic'};updateGuide();instructions();}
  }
  function placeFromRay(frame,inputSource){
    const p=frame.getPose(inputSource.targetRaySpace,reference);if(!p||p.emulatedPosition)return false;
    const origin=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(p.transform.matrix));
    const direction=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().fromArray([p.transform.orientation.x,p.transform.orientation.y,p.transform.orientation.z,p.transform.orientation.w]));
    const point=intersectPlaneRay(origin,direction,selectedWall);if(point)place({position:point});return !!point;
  }
  try{
    session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test','dom-overlay'],domOverlay:{root:overlay}});
    session.addEventListener('end',dispose,{once:true});
    session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible'){tracking.update(false);holder.visible=false;marker.visible=false;guide.visible=false;pointMarker.visible=false;instructions();}});
    renderer.xr.setReferenceSpaceType('local');await renderer.xr.setSession(session);
    releaseEnvironment=setupAREnvironment(renderer,scene,viewer.arLighting);
    reference=renderer.xr.getReferenceSpace();
    // A reference-space reset invalidates the calibration; never silently reuse it.
    reference.addEventListener('reset',()=>{resetPlacement();notice='AR koordinatları değişti. Zemini ve duvarı yeniden seçin.';instructions();});
    const view=await session.requestReferenceSpace('viewer');hitSource=await session.requestHitTestSource({space:view,entityTypes:['plane']});
    if(session.requestHitTestSourceForTransientInput)try{touchSource=await session.requestHitTestSourceForTransientInput({profile:'generic-touchscreen',entityTypes:['plane']});}catch{}
    session.addEventListener('select',event=>{
      if(!canInteract()||!moving||manual||performance.now()<uiBlockedUntil)return;
      if(selectedWall){placeFromRay(event.frame,event.inputSource);return;}
      const touches=touchSource&&event.frame.getHitTestResultsForTransientInput(touchSource),hit=touches?.find(t=>t.inputSource===event.inputSource)?.results[0];
      if(hit){const p=hit.getPose(reference);if(p&&!p.emulatedPosition)place(surfacePose(new THREE.Matrix4().fromArray(p.transform.matrix),eye));}
      else if(marker.visible)place(currentPose);
    });
    window.addEventListener('resize',resize);
    instructions();renderer.setAnimationLoop((time,frame)=>{
      if(!frame)return;
      const viewPose=frame.getViewerPose(reference),valid=!!viewPose&&!viewPose.emulatedPosition&&session.visibilityState==='visible';
      if(!valid){tracking.update(false);holder.visible=false;marker.visible=false;guide.visible=false;pointMarker.visible=false;instructions();renderer.render(scene,camera);return;}
      tracking.update(true);
      const transform=viewPose.transform;eye=new THREE.Vector3(transform.position.x,transform.position.y,transform.position.z);
      eyeDirection=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(transform.orientation.x,transform.orientation.y,transform.orientation.z,transform.orientation.w));
      holder.visible=placed&&!tracking.needsRecovery;pointMarker.visible=!!firstPoint&&!tracking.needsRecovery;updateGuide();
      currentPose=null;manualCandidate=null;
      if(canInteract()&&manual){
        manualCandidate=intersectPlaneRay(eye,eyeDirection,{position:new THREE.Vector3(0,floorY,0),normal:new THREE.Vector3(0,1,0)});
        if(manualCandidate)marker.matrix.makeTranslation(...manualCandidate.toArray());
      }else if(canInteract()&&!selectedWall){
        const wanted=wall&&floorY===null?'floor':state.settings.placement;
        for(const hit of frame.getHitTestResults(hitSource)){
          const p=hit.getPose(reference);if(!p||p.emulatedPosition)continue;
          const matrix=new THREE.Matrix4().fromArray(p.transform.matrix),pose=surfacePose(matrix,eye);if(pose.kind!==wanted)continue;
          currentPose=pose;marker.matrix.copy(matrix);break;
        }
      }
      marker.visible=canInteract()&&moving&&!!(manual?manualCandidate:currentPose);
      if(canInteract()&&placed&&moving&&touchSource&&performance.now()>=uiBlockedUntil){
        for(const touch of frame.getHitTestResultsForTransientInput(touchSource)){
          if(selectedWall)placeFromRay(frame,touch.inputSource);
          else{const p=touch.results[0]?.getPose(reference);if(p&&!p.emulatedPosition)place(surfacePose(new THREE.Matrix4().fromArray(p.transform.matrix),eye));}
        }
      }
      instructions();renderer.render(scene,camera);
    });status('');
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
