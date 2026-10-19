import {resolveCompatibility,allowedOptions,orderedGroups} from './option-compatibility.js';
import {is3DFile,fileLabel} from './file-labels.js?v=20261014-1';
import {normalizeDraft,applyMaterialVariant,configureMotions,toggleMotion} from './product-runtime.js?v=20261019-compatibility';
import {openProductAR,exportCurrentProduct} from './product-ar.js?v=20261014-1';
import {measurementLabel} from './dimensions.js';
import {loadCatalogueProduct} from './catalogue-store.js';
import {mountAlternatives, applyComponentSelection} from './component-options.js?v=20261019-compatibility';
import {getProduct} from './admin/store.js?v=20261014-1';
const urls=[];
const url=asset=>{if(asset.url)return new URL(asset.url,import.meta.url).href;const value=URL.createObjectURL(asset.blob);urls.push(value);return value;};
window.addEventListener('pagehide',()=>urls.forEach(value=>URL.revokeObjectURL(value)));
export async function loadAuthoredConfig(){
  const params=new URLSearchParams(location.search),catalogue=params.get('catalogue');
  const record=catalogue?await loadCatalogueProduct(catalogue):await getProduct(params.get('view'));
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
  $('.lead').textContent='Yüzeyleri ayrı ayrı seçin veya modeldeki bir parçaya dokunun.';
  if(d.brand)$('.panel-heading .eyebrow').textContent=`${d.brand} / ÜRÜN KOLEKSİYONU`;
  $('#details h2').textContent=d.name;$('#details p').textContent=d.description;
  $('#details .detail-list').replaceChildren();
  for(const [label,value] of [['Marka',d.brand],['Ürün kodu',d.code],['Kategori',d.category],...(d.features.dimensions?[['Ölçüler','Modelden hesaplanıyor…']]:[])].filter(([,value])=>value)){
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);$('#details .detail-list').append(row);
  }
  if(d.productSource){try{const source=new URL(d.productSource);if(source.protocol==='https:'){const a=document.createElement('a');a.className='product-source';a.href=source.href;a.target='_blank';a.rel='noopener';a.textContent='Üretici ürün bilgisi ↗';$('#details').append(a);}}catch{}}
  const hint=$('.viewer-hint');hint.textContent=d.animations?.length?'Döndürmek için sürükleyin. Açmak için kapak veya çekmeceye dokunun.':'Döndürmek için sürükleyin. Seçenekleri sağ panelden değiştirin.';
  $('#details h3').textContent='Ürün Dosyaları';$('.coming').hidden=true;$('.material-files').replaceChildren();
  if(d.features.downloads)for(const a of d.assets.filter(a=>a.kind==='attachments'&&a.public&&!is3DFile(a))){const link=document.createElement('a');link.textContent=fileLabel(a.name);link.href=url(a);link.download=a.name;$('.material-files').append(link);}
  $('#details h3').hidden=!$('.material-files').children.length;
  for(const a of d.assets.filter(a=>a.kind==='photos')){const img=document.createElement('img');img.src=url(a);img.alt=d.name;img.style.cssText='width:100%;height:auto;border-radius:12px;margin-top:16px';$('#details').append(img);}
  $('[data-action="dimensions"]').hidden=!d.features.dimensions;
  viewer.measurementTargets=(d.componentGroups||[]).length?[]:d.dimensionTargets||[];
  $('#source-download').hidden=!d.features.downloads;
  config.sourceFiles=d.assets.filter(a=>a.kind==='attachments'&&a.public&&is3DFile(a)).map(a=>({name:a.name,href:()=>url(a)}));
  config.downloadCurrent=async()=>{const blob=await exportCurrentProduct(viewer);const a=document.createElement('a');a.href=URL.createObjectURL(blob);urls.push(a.href);a.download=`${d.name}.glb`;a.click();};
  const ar=$('[data-action="ar"]');ar.hidden=d.ar?.enabled===false;ar.disabled=false;ar.title='AR ile görüntüle';ar.setAttribute('aria-label','Artırılmış gerçeklik');ar.addEventListener('click',async()=>{ar.disabled=true;try{await openProductAR(viewer,message=>$('#notice').textContent=message);}catch(e){$('#notice').textContent=fileLabel(e.message);}finally{ar.disabled=false;}});$('#reset-materials').hidden=!d.features.configurable&&!(d.componentGroups||[]).length;
  $('#add').hidden=!d.features.contact;$('#add').textContent='Teklif İste →';
  $('#add').addEventListener('click',event=>{event.stopImmediatePropagation();location.href=`mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(d.name+' — Teklif talebi')}`;});
}


export function updateAuthoredDimensions(config,viewer,guides=viewer.getMeasurementGuides()){
  if(!config.draft.features.dimensions||!guides?.length)return;
  for(const guide of guides){guide.axis ||= guide.label?.trim()[0];if(!Number.isFinite(guide.value)){const cm=Number(guide.label?.match(/^[GDY]\s+([\d.]+)\s+cm$/)?.[1]);guide.value=Number.isFinite(cm)?cm/100:0;}guide.label=measurementLabel(config.draft,guide);}
  const values=[...new Set(guides.map(g=>g.part))].map(part=>`${guides.find(g=>g.part===part).partLabel||part}: ${guides.filter(g=>g.part===part).map(g=>g.label).join(' · ')}`).join(' / ');
  const row=[...document.querySelectorAll('#details dt')].find(el=>el.textContent==='Ölçüler');
  if(row)row.nextElementSibling.textContent=values;
}

export async function prepareAuthoredComponents(config,viewer,addCard,onChange){
  const groups=config.draft.componentGroups||[];
  const nodes=await mountAlternatives(viewer,config.draft,url), selection=new Map();
  config.selection=selection;config.runtime=viewer.model.runtime;
  if(config.draft.schemaVersion===2){configureMotions(config.runtime,config.draft.animations);const requested=config.draft.defaultVariant||groups.flatMap(g=>g.options.filter(o=>o.id===g.defaultId)).find(o=>o.defaultVariant)?.defaultVariant;const initialVariant=config.draft.materialVariants.find(v=>v.id===requested)?.id||config.draft.materialVariants[0]?.id;applyMaterialVariant(config.runtime,config.draft,initialVariant);
    if(config.draft.features.configurable&&config.draft.materialVariants.length){const choices=config.draft.materialVariants;let chosen=choices.some(v=>v.id===initialVariant)?initialVariant:choices[0].id;config.componentChoices={_native:{label:'Malzeme kombinasyonu',value:choices.find(v=>v.id===chosen).label}};const card=addCard('Malzeme kombinasyonu',choices,chosen,id=>{chosen=id;config.componentChoices._native.value=choices.find(v=>v.id===id).label;applyMaterialVariant(config.runtime,config.draft,id==='original'?null:id);viewer.requestUpdate();onChange();});config.nativeVariantCard=card;config.nativeReset=()=>card.querySelector(`[data-variant="${initialVariant}"]`).click();}


  }
  resolveCompatibility(config.draft,selection);
  applyComponentSelection(nodes,groups,selection);
  config.componentChoices={...config.componentChoices,...Object.fromEntries(groups.map(g=>[g.id,{label:g.name,value:g.options.find(o=>o.id===selection.get(g.id))?.label||'Seçenek yok'}]))};
  const cards=[];
  function refreshCards(){
    for(const {group,card} of cards){
      const allowed=new Set(allowedOptions(group,selection).map(o=>o.id));
      const value=group.options.find(o=>o.id===selection.get(group.id))?.label||'Seçenek yok';
      config.componentChoices[group.id].value=value;
      card.querySelector('summary b').textContent=value;
      card.querySelectorAll('[data-variant]').forEach(b=>{
        b.disabled=!allowed.has(b.dataset.variant);
        b.setAttribute?.('aria-disabled',String(b.disabled));
        b.title=b.disabled?'Seçili ürün seçeneğiyle uyumlu değil.':'';
        b.classList.toggle('active',b.dataset.variant===selection.get(group.id));
        b.setAttribute?.('aria-pressed',String(b.dataset.variant===selection.get(group.id)));
      });
    }
  }
  for(const [id,entry] of Object.entries(config.componentChoices)){
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=entry.label;dd.dataset.componentDetail=id;dd.textContent=entry.value;
    row.append(dt,dd);document.querySelector('#material-details').append(row);
  }
  for(const group of [...orderedGroups(config.draft)].reverse()){
    cards.push({group,card:addCard(group.name,group.options,selection.get(group.id)||group.defaultId,id=>{
      if(!allowedOptions(group,selection).some(o=>o.id===id))return;
      selection.set(group.id,id);
      const adjustments=resolveCompatibility(config.draft,selection);
      applyComponentSelection(nodes,groups,selection);refreshCards();
      const notice=document.querySelector('#notice');
      if(notice)notice.textContent=adjustments.length?adjustments.map(change=>{
        const dependent=groups.find(g=>g.id===change.groupId);
        const label=dependent.options.find(o=>o.id===change.next)?.label||'Seçenek yok';
        return `${dependent.name}, seçiminize uyacak şekilde değiştirildi: ${label}.`;
      }).join(' '):'';
      viewer.requestUpdate();onChange();
    })});
  }
  refreshCards();
  for(const {group,card} of cards)if(group.compatibility){
    const note=document.createElement('p');note.className='helper';
    note.textContent='Pasif seçenekler, seçili ürün seçeneğiyle uyumlu değildir.';card.append(note);
  }
  if(groups.length)viewer.reframe();
  return ()=>{
    config.nativeReset?.();
    if(config.draft.schemaVersion===2)configureMotions(config.runtime,config.draft.animations);
    selection.clear();resolveCompatibility(config.draft,selection);applyComponentSelection(nodes,groups,selection);
    refreshCards();const notice=document.querySelector('#notice');if(notice)notice.textContent='';
    viewer.reframe();onChange();
  };
}
