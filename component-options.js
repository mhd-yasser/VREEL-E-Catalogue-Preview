import {composeProduct,measuredBox} from './product-runtime.js?v=20261010-1';
import * as THREE from './vendor/three.module.js';

// Source node IDs remain stable even when the loader sanitizes or duplicates names.
export function collectComponents(root) {
  const result = [];
  root.traverse(node => {
    for(let p=node.parent;p;p=p.parent)if(p.userData.productScene&&!p.visible)return;
    const name = node.userData.sourceName || node.name;
    if (node.userData.componentAssetChild || !Number.isInteger(node.userData.sourceNodeIndex) || !name?.startsWith('P_')) return;
    const path = [];
    for (let p = node; p && p !== root; p = p.parent)
      path.unshift(p.userData.sourceName || p.name || 'Grup');
    result.push({id: `node-${node.userData.sourceNodeIndex}`, name, path: path.join(' / '), node});
  });
  return result;
}
export function componentMap(root) {
  const map = new Map(collectComponents(root).map(c => [c.id, c.node]));
  root.traverse(node => {if (node.userData.componentAsset) map.set(`asset-${node.userData.componentAsset}`, node);});
  return map;
}
export function materialTargetId(node, index, slot) {
  return node.userData.componentMaterialPrefix
    ? `${node.userData.componentMaterialPrefix}-mesh-${node.userData.componentMeshIndex}-slot-${slot}`
    : `mesh-${index}-slot-${slot}`;
}
export function alignAlternative(root, reference, parent) {
  parent.updateWorldMatrix(true, true);
  reference.updateWorldMatrix(true, true);
  root.updateWorldMatrix(true, true);
  const target = new THREE.Box3().setFromObject(reference).getCenter(new THREE.Vector3());
  if(new THREE.Box3().setFromObject(root).isEmpty()) throw new Error('Alternatif dosyada görünür geometri bulunamadı.');
  const wrapper = new THREE.Group();
  wrapper.add(root);
  parent.add(wrapper);
  parent.updateWorldMatrix(true, true);
  const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  // Convert the world-space displacement to the parent's local coordinates.
  wrapper.position.copy(parent.worldToLocal(target.clone()).sub(parent.worldToLocal(center.clone())));
  wrapper.updateWorldMatrix(true, true);
  return wrapper;
}
export async function mountAlternatives(viewer, draft, assetUrl) {
  const runtime=viewer.model.runtime;
  const components = draft.schemaVersion===2?new Map(runtime.scenes.map(s=>[s.id,s.node])):componentMap(viewer.model.root);
  if(draft.schemaVersion===2){components.runtime=runtime;components.draft=draft;runtime.external=new Map();runtime.externalRuntimes=[];}
  for (const group of draft.componentGroups || []) {
    for (const option of group.options) {
      if (!option.assetId) continue;
      const asset = (draft.componentAssets || []).find(a => a.id === option.assetId);
      const reference = components.get(option.referenceId);
      if (!asset || !reference) throw new Error(`${group.name}: alternatif dosya veya referans parça bulunamadı.`);
      const root = await viewer.loadAdditionalModel(assetUrl(asset));
      let wrapper;
      if(draft.schemaVersion===2){
        const ext=root.productRuntime;for(const s of ext.scenes)s.node.visible=s.name==='0'||s.name==='noAR'||s.id===(option.sceneId||ext.defaultScene);
        wrapper=new THREE.Group();wrapper.add(root);viewer.model.root.add(wrapper);
        if(option.alignment==='center'){viewer.model.root.updateWorldMatrix(true,true);const wasVisible=reference.visible;reference.visible=true;const a=measuredBox(reference).getCenter(new THREE.Vector3()),b=measuredBox(root).getCenter(new THREE.Vector3());reference.visible=wasVisible;wrapper.position.copy(viewer.model.root.worldToLocal(a).sub(viewer.model.root.worldToLocal(b)));}
        wrapper.position.add(new THREE.Vector3().fromArray(option.offset||[0,0,0]).divideScalar(Number(draft.modelScale)||1));
        ext.defaultVariant=option.defaultVariant||null;runtime.externalRuntimes.push(ext);runtime.external.set(`asset-${asset.id}`,wrapper);
        for(const v of ext.variants)if(!runtime.variants.some(other=>other.name===v.name))runtime.variants.push({...v,id:`asset-${asset.id}-${v.id}`});
        for(const src of ext.sources){src.id=`asset-${asset.id}-${src.id}`;src.tracks.forEach(t=>t.key=`asset-${asset.id}:${t.key}`);runtime.sources.push(src);}
      }else wrapper = alignAlternative(root, reference, viewer.model.root);
      wrapper.userData.componentAsset = asset.id;
      let index = 0;
      root.traverse(node => {
        node.userData.componentAssetChild = true;
        if (!node.isMesh) return;
        node.userData.componentMaterialPrefix = `asset-${asset.id}`;
        node.userData.componentMeshIndex = index++;
      });
      // External nodes are whole-file alternatives, not extra selectable P_ nodes.

      components.set(`asset-${asset.id}`, wrapper);
    }
  }
  return components;
}
export function applyComponentSelection(components, groups, selection = new Map()) {
  if(components.runtime){composeProduct(components.runtime,components.draft,selection,components.arPreview);return;}
  for (const group of groups || []) {
    const selected = selection.get(group.id) || group.defaultId;
    for (const option of group.options) {
      const key = option.assetId ? `asset-${option.assetId}` : option.nodeId;
      const node = components.get(key);
      if (node) node.visible = option.id === selected;
    }
  }
}
export function componentErrors(draft, available) {
  const errors = [], used = new Set();
  const ids = new Set(available.map(c => c.id));
  const assigned = [];
  for (const group of draft.componentGroups || []) {
    if (!group.name?.trim()) errors.push('Her alternatif grubu için bir ad gerekli.');
    if (group.options.length < 2) errors.push(`${group.name}: en az iki alternatif gerekli.`);
    if (!group.options.some(o => o.id === group.defaultId)) errors.push(`${group.name}: varsayılan alternatif gerekli.`);
    for (const option of group.options) {
      if (!option.label?.trim()) errors.push(`${group.name}: alternatif adı gerekli.`);
      const key = option.assetId ? `asset-${option.assetId}` : option.nodeId;
      if (used.has(key)) errors.push('Bir parça yalnızca bir alternatif grubuna bağlanabilir.');
      used.add(key);
      if (option.assetId) {
        if (!(draft.componentAssets || []).some(a => a.id === option.assetId)) errors.push(`${group.name}: alternatif dosya eksik.`);
        if (!group.options.some(o => o.nodeId === option.referenceId) || !ids.has(option.referenceId)) errors.push(`${group.name}: referans parça gerekli.`);
      } else {
        if (!ids.has(option.nodeId)) errors.push(`${group.name}: modelde bulunamayan parça.`);
        const component = available.find(c => c.id === option.nodeId);
        if(component) assigned.push(component);
      }
    }
  }
  for (const c of assigned) for (let p = c.node?.parent; p; p = p.parent)
    if (assigned.some(other => other.node === p)) errors.push('İç içe alternatif seçimleri bu sürümde desteklenmiyor. Yalnızca bir seçim seviyesi kullanın.');
  return [...new Set(errors)];
}
