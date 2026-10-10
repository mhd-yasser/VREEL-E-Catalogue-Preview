import * as THREE from './vendor/three.module.js';

// Tag at dependency creation time: GLTFLoader reduces its association map per scene.
// userData survives clones when a glTF node is shared by multiple scenes.
export function registerProductLoader(loader) {
  loader.register(parser => ({
    name:'VREEL_product_metadata',
    loadMesh(index) {
      return parser.loadMesh(index).then(root => {
        const meshes=[];root.traverse(n=>{if(n.isMesh)meshes.push(n);});
        meshes.forEach((mesh,primitive)=>{mesh.userData.gltfMesh=index;mesh.userData.gltfPrimitive=primitive;});
        return root;
      });
    },
    loadNode(index) {
      return parser.loadNode(index).then(node=>{
        node.userData.sourceNodeIndex=index;
        node.userData.sourceName=parser.json.nodes[index].name||'';
        return node;
      });
    }
  }));
}
export function normalizeDraft(d) {
  d.groups ||= [];d.componentGroups ||= [];d.componentAssets ||= [];
  // No name-based migration: old drafts retain their original node IDs and mappings.
  if(d.schemaVersion===2){d.scenes ||= [];d.materialVariants ||= [];d.animations ||= [];d.modelScale ||= 1;d.ar ||= {enabled:true};}
  return d;
}
export function sceneSettings(runtime) {
  return runtime.scenes.map(s=>({id:s.id,name:s.name,role:s.name==='0'?'shared':s.name==='noAR'?'decoration':'unassigned',measure:s.name!=='noAR'}));
}
export async function createProductRuntime(gltf) {
  const root=new THREE.Group();root.name='VREEL_Product';
  const scenes=gltf.scenes.map((node,index)=>{
    root.add(node);node.userData.excludeMeasurements=gltf.parser.json.scenes[index].name==='noAR';node.userData.excludeAR=gltf.parser.json.scenes[index].name==='noAR';node.userData.productScene=`scene-${index}`;
    return {id:`scene-${index}`,name:gltf.parser.json.scenes[index].name||`Sahne ${index+1}`,node};
  });
  const runtime={root,scenes,defaultScene:`scene-${gltf.parser.json.scene||0}`,json:gltf.parser.json,clips:gltf.animations,variants:[],bindings:[],motions:[],sources:[]};
  const declarations=runtime.json.extensions?.KHR_materials_variants?.variants||[];
  runtime.variants=declarations.map((v,index)=>({id:`variant-${index}`,index,name:v.name.trim()||`Malzeme ${index+1}`}));
  const pending=[];
  root.traverse(node=>{
    if(!node.isMesh)return;
    const primitive=runtime.json.meshes?.[node.userData.gltfMesh]?.primitives?.[node.userData.gltfPrimitive];
    const mappings=primitive?.extensions?.KHR_materials_variants?.mappings||[];
    if(!mappings.length)return;
    pending.push((async()=>{
      const materials=new Map();
      for(const mapping of mappings){
        const material=await gltf.parser.getDependency('material',mapping.material);
        // Reuse loader's geometry-dependent material flags (vertex color, skin, flat normals).
        const old=node.material;node.material=material;gltf.parser.assignFinalMaterial(node);
        const final=node.material;node.material=old;
        for(const i of mapping.variants)materials.set(`variant-${i}`,final);
      }
      runtime.bindings.push({node,original:node.material,materials});
    })());
  });
  await Promise.all(pending);
  // Retarget tracks to every actual scene instance, not just parser's default scene.
  const sourceNodes=await gltf.parser.getDependencies('node');
  for(let clipIndex=0;clipIndex<gltf.animations.length;clipIndex++){
    const clip=gltf.animations[clipIndex],tracks=[];
    for(let trackIndex=0;trackIndex<clip.tracks.length;trackIndex++){
      const track=clip.tracks[trackIndex],binding=THREE.PropertyBinding.parseTrackName(track.name);
      const source=sourceNodes.find(n=>n.name===binding.nodeName||n.uuid===binding.nodeName);
      if(!source)continue;
      root.traverse(target=>{
        if(target.userData.sourceNodeIndex!==source.userData.sourceNodeIndex)return;
        const copy=track.clone();copy.name=target.uuid+track.name.slice(track.name.lastIndexOf('.'));
        tracks.push({id:`animation-${clipIndex}-track-${trackIndex}-${target.uuid}`,key:`${clipIndex}:${trackIndex}`,track:copy,node:target,label:target.userData.sourceName||target.name,clipIndex,trackIndex});
      });
    }
    runtime.sources.push({id:`animation-${clipIndex}`,index:clipIndex,name:clip.name||`Hareket ${clipIndex+1}`,duration:clip.duration,tracks});
  }
  runtime.mixer=new THREE.AnimationMixer(root);
  return runtime;
}
export function collectScenes(root){const rt=root.productRuntime;return rt?rt.scenes.map(s=>({...s,path:s.name})):[];}
export function composeProduct(runtime,draft,selection=new Map(),ar=false){
  if(!runtime)return;
  const visible=node=>{for(let p=node;p;p=p.parent)if(!p.visible)return false;return true;};
  const previous=new Map((runtime.motions||[]).map(m=>[m,visible(m.target)]));
  runtime.root.scale.setScalar(Number(draft.modelScale)||1);
  const chosen=new Set();
  for(const group of draft.componentGroups||[]){const option=group.options.find(o=>o.id===(selection.get(group.id)||group.defaultId));if(option)chosen.add(option.assetId?`asset-${option.assetId}`:option.nodeId);}
  const settings=draft.scenes||[];
  for(const s of runtime.scenes){
    const config=settings.find(c=>c.id===s.id)||{role:'unassigned',measure:true};
    s.node.visible=config.role==='shared'||config.role==='decoration'&&!ar||chosen.has(s.id);
    if(ar&&(s.name==='noAR'||config.role==='decoration'))s.node.visible=false;
    s.node.userData.excludeMeasurements=config.measure===false||config.role==='decoration';
    s.node.userData.excludeAR=s.name==='noAR'||config.role==='decoration';
  }
  for(const [id,node] of runtime.external||[])node.visible=chosen.has(id);
  let reset=false;for(const [m,wasVisible] of previous){if(wasVisible===visible(m.target))continue;m.progress=0;m.direction=0;m.action.time=0;m.action.paused=true;reset=true;}
  if(reset)runtime.mixer.update(0);
  runtime.root.updateMatrixWorld(true);
}
export function importVariantSettings(runtime,existing=[]){
  // A glTF variant is a complete mapping, not an independent fabric/leg group.
  return runtime.variants.map(v=>({id:v.id,key:v.name,label:existing.find(e=>e.id===v.id)?.label||v.name}));
}
export function applyMaterialVariant(runtime,draft,requested){
  const settings=draft.materialVariants||[],fallback=draft.defaultVariant||null;
  const setting=requested===null?null:settings.find(v=>v.id===requested)||settings.find(v=>v.id===fallback);
  for(const binding of runtime.bindings){
    let sceneId;for(let p=binding.node;p;p=p.parent)if(p.userData.productScene){sceneId=p.userData.productScene;break;}
    const option=(draft.componentGroups||[]).flatMap(g=>g.options).find(o=>o.nodeId===sceneId);
    binding.node.material=setting?binding.materials.get(setting.id)||binding.materials.get(option?.defaultVariant||draft.defaultVariant)||binding.original:binding.original;
  }
  for(const external of runtime.externalRuntimes||[]){
    const match=external.variants.find(v=>v.name===setting?.key);
    const own=external.variants.find(v=>v.id===external.defaultVariant);
    for(const b of external.bindings)b.node.material=b.materials.get(match?.id||own?.id)||b.original;
  }
  runtime.materialChoice=setting?.id||null;
}
export function motionSettings(runtime){
  return runtime.sources.flatMap(s=>{const groups=new Map();for(const t of s.tracks){const key=t.node.userData.sourceNodeIndex??t.node.uuid;if(!groups.has(key))groups.set(key,{id:`${s.id}:${key}`,name:t.label,duration:s.duration,mode:'toggle',smooth:false,tracks:[]});const group=groups.get(key);if(!group.tracks.includes(t.key))group.tracks.push(t.key);}return [...groups.values()];});
}
export function configureMotions(runtime,settings){
  runtime.mixer.stopAllAction();runtime.motions=[];
  for(const setting of settings||[]){
    const list=runtime.sources.flatMap(s=>s.tracks).filter(t=>setting.tracks.includes(t.key));
    if(!list.length)continue;
    const targets=new Map();for(const t of list){if(!targets.has(t.node))targets.set(t.node,[]);targets.get(t.node).push(t);}
    for(const [target,list] of targets){
    const partSetting=targets.size>1?{...setting,id:`${setting.id}:${target.uuid}`,name:target.userData.sourceName||target.name||setting.name}:setting;
    const duration=Math.max(...list.map(t=>t.track.times[t.track.times.length-1]));
    const clip=new THREE.AnimationClip(setting.name,duration,list.map(t=>t.track.clone()));
    const action=runtime.mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
    runtime.motions.push({setting:partSetting,sourceId:setting.id,target,action,duration,progress:0,direction:0,tracks:list});
    }
  }
  runtime.mixer.update(0);
}
export function toggleMotion(runtime,id){for(const m of runtime.motions.filter(m=>m.setting.id===id||m.sourceId===id)){
  if(m.setting.mode==='once'){m.progress=0;m.direction=1;}else m.direction=m.direction?-m.direction:m.progress>=1?-1:1;
}}
export function updateMotions(runtime,delta){
  for(const m of runtime?.motions||[]){
    if(!m.direction)continue;
    m.progress=THREE.MathUtils.clamp(m.progress+delta/Math.max(.05,Number(m.setting.duration)||m.duration)*m.direction,0,1);
    const p=m.setting.smooth?m.progress*m.progress*(3-2*m.progress):m.progress;
    m.action.time=p*m.duration;m.action.paused=true;
    if(m.progress===0||m.progress===1)m.direction=0;
  }
  runtime?.mixer.update(0);
}
export function measuredBox(root){
  const box=new THREE.Box3();root.updateWorldMatrix(true,true);
  root.traverseVisible(node=>{if(!node.isMesh)return;for(let p=node;p;p=p.parent)if(p.userData.excludeMeasurements)return;
    if(node.isSkinnedMesh||node.isInstancedMesh){box.expandByObject(node);return;}
    node.geometry.computeBoundingBox();box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });return box;
}
export function snapshotProduct(root,ar=false){
  // Clone only visible branches. Preserve local transforms and the current animated pose.
  const copy=node=>{
    if(!node.visible||ar&&node.userData.excludeAR)return null;
    let result;
    if(node.isInstancedMesh){
      result=new THREE.Group();THREE.Object3D.prototype.copy.call(result,node,false);
      for(let i=0;i<node.count;i++){let materials=node.material;if(node.instanceColor){const color=new THREE.Color();node.getColorAt(i,color);materials=[materials].flat().map(m=>{const clone=m.clone();clone.color?.multiply(color);return clone;});if(!Array.isArray(node.material))materials=materials[0];}const mesh=new THREE.Mesh(node.geometry,materials);node.getMatrixAt(i,mesh.matrix);mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);result.add(mesh);}
    }else if(node.isSkinnedMesh||node.morphTargetInfluences){
      node.skeleton?.update();const geometry=node.geometry.clone(),position=geometry.attributes.position,vertex=new THREE.Vector3();
      for(let i=0;i<position.count;i++){node.getVertexPosition(i,vertex);position.setXYZ(i,vertex.x,vertex.y,vertex.z);}geometry.morphAttributes={};geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();geometry.computeBoundingBox();
      result=new THREE.Mesh(geometry,node.material);THREE.Object3D.prototype.copy.call(result,node,false);
    }else result=node.clone(false);
    result.userData={};
    for(const child of node.children){const c=copy(child);if(c)result.add(c);}
    return result;
  };
  root.updateMatrixWorld(true);return copy(root);
}
export function productErrors(d,runtime){
  const errors=[],used=new Set();
  for(const g of d.componentGroups||[]){
    if(!g.name?.trim()||g.options.length<2||!g.options.some(o=>o.id===g.defaultId))errors.push(`${g.name||'Grup'}: ad, iki alternatif ve varsayılan seçim gerekli.`);
    for(const o of g.options){if(!o.label?.trim())errors.push('Alternatif adı gerekli.');const id=o.assetId?`asset-${o.assetId}`:o.nodeId;if(used.has(id))errors.push('Bir sahne yalnızca bir alternatif grubuna atanabilir.');used.add(id);
      if(o.assetId){if(!d.componentAssets.some(a=>a.id===o.assetId))errors.push('Alternatif dosya eksik.');}
      else if(!d.scenes.some(s=>s.id===id&&s.role==='alternative'))errors.push('Alternatif sahne sınıflandırması geçersiz.');}
  }
  for(const s of d.scenes||[])if(s.role==='unassigned')errors.push(`${s.name}: ortak, dekor, alternatif veya hariç olarak sınıflandırın.`);else if(s.role==='alternative'&&!used.has(s.id))errors.push(`${s.name}: alternatif grubuna atanmalı.`);
  if(!Number.isFinite(Number(d.modelScale))||Number(d.modelScale)<=0)errors.push('Model ölçeği pozitif olmalı.');
  const validTracks=new Set(runtime?.sources.flatMap(s=>s.tracks.map(t=>t.key))||[]);
  if(d.defaultVariant&&!d.materialVariants.some(v=>v.id===d.defaultVariant))errors.push('Varsayılan malzeme seçeneği bulunamadı.');
  const claimed=new Set();for(const a of d.animations||[]){if(!a.name?.trim()||!(Number(a.duration)>0)||!a.tracks.length)errors.push('Hareket adı, pozitif süre ve en az bir yol gerekli.');for(const t of a.tracks){if(runtime&&!validTracks.has(t))errors.push('Hareket yolu dosyada bulunamadı.');if(claimed.has(t))errors.push('Bir hareket yolu birden fazla harekete atanamaz.');claimed.add(t);}}
  if(runtime&&measuredBox(runtime.root).isEmpty())errors.push('Seçilen bileşimde ölçülebilir ürün geometrisi yok.');
  if(!d.scaleConfirmed)errors.push('glTF metre ölçeğini önizlemede doğrulayın.');
  return [...new Set(errors)];
}
