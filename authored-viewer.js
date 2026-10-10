import {normalizeDraft,applyMaterialVariant,configureMotions,toggleMotion} from './product-runtime.js?v=20261010-3';
import {addARControls} from './product-ar.js?v=20261010-1';
import {mountAlternatives, applyComponentSelection} from './component-options.js?v=20261010-1';
import {getProduct} from './admin/store.js?v=20261010-1';
const urls=[];
const url=asset=>{const value=URL.createObjectURL(asset.blob);urls.push(value);return value;};
window.addEventListener('pagehide',()=>urls.forEach(value=>URL.revokeObjectURL(value)));
export async function loadAuthoredConfig(){
  const record=await getProduct(new URLSearchParams(location.search).get('view'));
  if(!record?.published){document.querySelector('#model-loading').textContent='Bu tarayıcıda yayın kopyası bulunamadı. Galeriden bir ürün seçin.';throw new Error('Published product unavailable');}
  const draft=normalizeDraft(record.published);
  return {draft,title:draft.name,file:url(draft.model),download:'VREEL_Product.glb',groups:Object.fromEntries((draft.features.configurable&&draft.schemaVersion!==2?draft.groups:[]).map(g=>[g.id,{label:g.name,initial:g.defaultId,targets:g.targets,options:g.options.map(o=>({...o,image:o.assetId?url(draft.assets.find(a=>a.id===o.assetId)):undefined}))}]))};
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
  viewer.productMode=config.draft.schemaVersion===2?"scenes":"legacy";
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
  viewer.measurementTargets=(d.componentGroups||[]).length?[]:d.dimensionTargets||[];
  $('#source-download').hidden=true;$('#reset-materials').hidden=!d.features.configurable&&!(d.componentGroups||[]).length;
  $('#add').hidden=!d.features.contact;$('#add').textContent='Teklif İste →';
  $('#add').addEventListener('click',event=>{event.stopImmediatePropagation();location.href=`mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(d.name+' — Teklif talebi')}`;});
}


export function updateAuthoredDimensions(config,viewer,guides=viewer.getMeasurementGuides()){
  if(!config.draft.features.dimensions||!guides?.length)return;
  const unit=config.draft.unit||'cm',factor={mm:1000,cm:100,m:1}[unit]||100;
  for(const guide of guides){guide.axis ||= guide.label?.trim()[0];if(!Number.isFinite(guide.value)){const cm=Number(guide.label?.match(/^[GDY]\s+([\d.]+)\s+cm$/)?.[1]);guide.value=Number.isFinite(cm)?cm/100:0;}const key={G:'width',D:'depth',Y:'height'}[guide.axis],manual=guide.part==='product'?Number(config.draft[key]):0;guide.label=`${guide.axis} ${manual>0?manual:Number((guide.value*factor).toFixed(2))} ${unit}`;}
  const values=[...new Set(guides.map(g=>g.part))].map(part=>`${guides.find(g=>g.part===part).partLabel||part}: ${guides.filter(g=>g.part===part).map(g=>g.label).join(' · ')}`).join(' / ');
  const row=[...document.querySelectorAll('#details dt')].find(el=>el.textContent==='Ölçüler');
  if(row)row.nextElementSibling.textContent=values;
}

export async function prepareAuthoredComponents(config,viewer,addCard,onChange){
  const groups=config.draft.componentGroups||[];
  const nodes=await mountAlternatives(viewer,config.draft,url), selection=new Map();
  config.selection=selection;config.runtime=viewer.model.runtime;
  if(config.draft.schemaVersion===2){configureMotions(config.runtime,config.draft.animations);applyMaterialVariant(config.runtime,config.draft,config.draft.defaultVariant);
    if(config.draft.features.configurable&&config.draft.materialVariants.length){const choices=[{id:'original',label:'Özgün malzemeler'},...config.draft.materialVariants];let chosen=config.draft.defaultVariant||'original';config.componentChoices={_native:{label:'Malzeme kombinasyonu',value:choices.find(v=>v.id===chosen).label}};const card=addCard('Malzeme kombinasyonu',choices,chosen,id=>{chosen=id;config.componentChoices._native.value=choices.find(v=>v.id===id).label;applyMaterialVariant(config.runtime,config.draft,id==='original'?null:id);viewer.requestUpdate();onChange();});config.nativeVariantCard=card;config.nativeReset=()=>card.querySelector(`[data-variant="${config.draft.defaultVariant||'original'}"]`).click();}

    if(config.draft.ar?.enabled!==false){const host=document.createElement('div');host.className='option-card product-ar-controls';document.querySelector('#material-groups').append(host);const status=document.createElement('p');status.setAttribute('role','status');host.append(status);addARControls(viewer,host,message=>status.textContent=message);}
  }
  applyComponentSelection(nodes,groups,selection);
  config.componentChoices={...config.componentChoices,...Object.fromEntries(groups.map(g=>[g.id,{label:g.name,value:g.options.find(o=>o.id===g.defaultId).label}]))};
  const cards=[];
  for(const [id,entry] of Object.entries(config.componentChoices)){
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=entry.label;dd.dataset.componentDetail=id;dd.textContent=entry.value;
    row.append(dt,dd);document.querySelector('#material-details').append(row);
  }
  for(const group of [...groups].reverse()){
    cards.push({group,card:addCard(group.name,group.options,group.defaultId,id=>{
      config.componentChoices[group.id].value=group.options.find(o=>o.id===id).label;
      selection.set(group.id,id);applyComponentSelection(nodes,groups,selection);
      viewer.reframe();viewer.requestUpdate();onChange();
    })});
  }
  if(groups.length)viewer.reframe();
  return ()=>{config.nativeReset?.();if(config.draft.schemaVersion===2)configureMotions(config.runtime,config.draft.animations);selection.clear();applyComponentSelection(nodes,groups);for(const {group,card} of cards){
    card.querySelectorAll('[data-variant]').forEach(b=>b.classList.toggle('active',b.dataset.variant===group.defaultId));
    config.componentChoices[group.id].value=group.options.find(o=>o.id===group.defaultId).label;
    card.querySelector('summary b').textContent=config.componentChoices[group.id].value;
  }viewer.reframe();onChange();};
}
