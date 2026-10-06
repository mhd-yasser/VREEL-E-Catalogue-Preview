import {getProduct} from './admin/store.js';
const urls=[];
const url=asset=>{const value=URL.createObjectURL(asset.blob);urls.push(value);return value;};
window.addEventListener('pagehide',()=>urls.forEach(value=>URL.revokeObjectURL(value)));
export async function loadAuthoredConfig(){
  const record=await getProduct(new URLSearchParams(location.search).get('view'));
  if(!record?.published){document.querySelector('#model-loading').textContent='Bu tarayıcıda yayın kopyası bulunamadı. Galeriden bir ürün seçin.';throw new Error('Published product unavailable');}
  const draft=record.published;
  return {draft,title:draft.name,file:url(draft.model),download:'VREEL_Product.glb',groups:Object.fromEntries((draft.features.configurable?draft.groups:[]).map(g=>[g.id,{label:g.name,initial:g.defaultId,targets:g.targets,options:g.options.map(o=>({...o,image:o.assetId?url(draft.assets.find(a=>a.id===o.assetId)):undefined}))}]))};
}
const textures=new Map();
export async function paintAuthored(material,option,viewer){
  const revision=(material.userData.paintRevision||0)+1;material.userData.paintRevision=revision;
  const original=material.userData.vreelOriginal;
  let map=original.map;
  if(!option.original&&option.image){
    if(!textures.has(option.image))textures.set(option.image,viewer.createTexture(option.image));
    const base=await textures.get(option.image);if(material.userData.paintRevision!==revision)return;
    map=base.clone();if(original.map){for(const key of ['repeat','offset','center'])map[key].copy(original.map[key]);for(const key of ['rotation','wrapS','wrapT','channel'])map[key]=original.map[key];}map.needsUpdate=true;
  }else if(!option.original)map=null;
  material.userData.authoredMap?.dispose();material.userData.authoredMap=map!==original.map?map:null;
  material.map=map;material.color.copy(original.color);if(!option.original)material.color.set(option.image?'#ffffff':option.color||'#ffffff');
  material.userData.finishId=option.id;material.needsUpdate=true;
}
export function prepareAuthoredPage(config,viewer){
  const d=config.draft,$=selector=>document.querySelector(selector);
  document.title=`VREEL | ${d.name}`;
  $('.panel-heading h1').textContent=d.name;$('.product-mark strong').textContent=d.name;
  $('.lead').textContent=d.features.configurable?'Yüzeyleri seçin veya modeldeki bir parçaya dokunun.':'Ürünü farklı açılardan inceleyin.';
  $('#details h2').textContent=d.name;$('#details p').textContent=d.description;
  $('#details .detail-list').replaceChildren();
  for(const [label,value] of [['Ürün kodu',d.code],['Kategori',d.category],...(d.features.dimensions?[['Ölçüler','Modelden hesaplanıyor…']]:[])]){
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);$('#details .detail-list').append(row);
  }
  $('#details h3').textContent='Ürün Dosyaları';$('.coming').hidden=true;$('.material-files').replaceChildren();
  if(d.features.downloads)for(const a of d.assets.filter(a=>a.kind==='attachments'&&a.public)){const link=document.createElement('a');link.textContent=a.name;link.href=url(a);link.download=a.name;$('.material-files').append(link);}
  for(const a of d.assets.filter(a=>a.kind==='photos')){const img=document.createElement('img');img.src=url(a);img.alt=d.name;img.style.cssText='width:100%;height:auto;border-radius:12px;margin-top:16px';$('#details').append(img);}
  $('[data-action="dimensions"]').hidden=!d.features.dimensions;
  viewer.measurementTargets=d.dimensionTargets||[];
  $('#source-download').hidden=true;$('#reset-materials').hidden=!d.features.configurable;
  $('#add').hidden=!d.features.contact;$('#add').textContent='Teklif İste →';
  $('#add').addEventListener('click',event=>{event.stopImmediatePropagation();location.href=`mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(d.name+' — Teklif talebi')}`;});
}


export function updateAuthoredDimensions(config,viewer,guides=viewer.getMeasurementGuides()){
  if(!config.draft.features.dimensions||!guides?.length)return;
  const unit=config.draft.unit||'cm',factor={mm:1000,cm:100,m:1}[unit]||100;
  for(const guide of guides){const key={G:'width',D:'depth',Y:'height'}[guide.axis],manual=Number(config.draft[key]);guide.label=`${guide.axis} ${manual>0?manual:Number((guide.value*factor).toFixed(2))} ${unit}`;}
  const values=guides.filter(g=>g.part==='product').map(g=>g.label).join(' · ');
  const row=[...document.querySelectorAll('#details dt')].find(el=>el.textContent==='Ölçüler');
  if(row)row.nextElementSibling.textContent=values;
}
