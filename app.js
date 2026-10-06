import {createViewer} from './three-viewer.js';
const viewer = createViewer(document.querySelector('#product-viewer'));
const selection = document.querySelector('#selection');
const notice = document.querySelector('#notice');
const wheel = document.querySelector('#material-wheel');
const wheelOptions = document.querySelector('#wheel-options');
const groupContainer = document.querySelector('#material-groups');
const detailsContainer = document.querySelector('#material-details');
// A future product dashboard can set these flags before app.js loads.
const viewerFeatures={screenshot:true,screenshot4K:true,fullscreen:true,dimensions:true,ar:false,...window.VREEL_VIEWER_FEATURES};
for(const [feature,action] of Object.entries({screenshot:'snapshot',screenshot4K:'snapshot-4k',fullscreen:'fullscreen',dimensions:'dimensions'})){
  if(!viewerFeatures[feature])document.querySelector(`[data-action="${action}"]`)?.setAttribute('hidden','');
}

const wood = [
  {id:'original',label:'Mevcut Ahşap',color:'#a98061',original:true},
  {id:'fine',label:'Açık Ahşap',image:'wood_fine.jpg'},
  {id:'dark1',label:'Koyu Ahşap I',image:'wood_dark1.jpg'},
  {id:'dark3',label:'Koyu Ahşap III',image:'wood_dark3.jpg'},
  {id:'ply',label:'Kontrplak',image:'wood_ply.jpg'},
];
const mdf = [
  {id:'black',label:'Mat Siyah MDF',color:'#222429',colorFactor:[.027,.027,.027,1],roughness:.65,metallic:0},
  {id:'white',label:'Mat Beyaz MDF',color:'#e7e6e2',colorFactor:[.84,.83,.8,1],roughness:.65,metallic:0},
];
const metal = [
  {id:'black',label:'Mat Siyah',color:'#20242a',colorFactor:[.035,.038,.044,1],metallic:.18,roughness:.76},
  {id:'white',label:'Mat Beyaz',color:'#e6e7e5',colorFactor:[.85,.86,.85,1],metallic:.12,roughness:.78},
  {id:'aluminum',label:'Yarı Parlak Alüminyum',color:'#b5bec5',colorFactor:[.68,.71,.73,1],metallic:1,roughness:.34},
  {id:'chrome',label:'Parlak Krom',color:'#d8e1e6',colorFactor:[.84,.89,.93,1],metallic:1,roughness:.08},
  {id:'gold',label:'Parlak Altın',color:'#dbb965',colorFactor:[.83,.59,.23,1],metallic:1,roughness:.13},
];
const fabric = [
  {id:'original',label:'Mevcut Döşeme',color:'#383232',original:true},
  ...[
    ['suede1','Süet I'],['suede2','Süet II'],
    ['leather1','Deri I'],['leather2','Deri II'],['leather3','Deri III'],
    ['leather4','Deri IV'],['leather5','Deri V'],
    ['linen1','Keten I'],['linen2','Keten II'],
    ['cotton1','Pamuk I'],['cotton2','Pamuk II'],
  ].map(([id,label])=>({id,label,image:`${id}.jpg`})),
];
const groups = {
  desktop:{label:'Masa Üstü',materials:['VREEL_desktop'],options:[...wood,...mdf],initial:'original'},
  cabinet:{label:'Keson · Çekmece Kapakları',materials:['VREEL_cabinet_fronts','VREEL_cabinet'],options:[...mdf,...wood],initial:'black'},
  deskMetal:{label:'Masa Ayağı · Metal',materials:['VREEL_deskMetal'],options:metal,initial:'black'},
  frontPanel:{label:'Masa Ön Paneli',materials:['VREEL_frontPanel'],options:[...wood,...mdf],initial:'original'},
  chairFabric:{label:'Koltuk Kumaşı',materials:['VREEL_chairFabric'],options:fabric,initial:'original'},
  chairWood:{label:'Koltuk Ahşabı',materials:['VREEL_chairWood'],options:wood,initial:'original'},
  chairMetal:{label:'Koltuk Metali',materials:['VREEL_chairMetal'],options:metal,initial:'black'},
};
const state = Object.fromEntries(Object.entries(groups).map(([key,group])=>[key,group.initial]));
const originalMaterials = new Map();
const textures = new Map();
const mappedTextures = new Map();
let wheelGroup = null;
let wheelPage = 0;
let pointerStart = null;
let modelBlob = null;
const studio={environment:'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/brown_photostudio_02_1k.hdr',exposure:1.12,shadow:1.35,softness:.72};
function option(key){return groups[key].options.find(o=>o.id===state[key]);}
function escapeText(value){return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function swatchStyle(o){return o.image?`background-image:url('textures/${o.image}')`:`background-color:${o.color}`;}
function activate(selector,current){document.querySelectorAll(selector).forEach(b=>{const on=b===current;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
function buildGroups(){
  for(const [key,group] of Object.entries(groups)){
    const card=document.createElement('details');card.className='option-card';card.dataset.group=key;
    if(key==='desktop'||key==='cabinet')card.open=true;
    card.innerHTML=`<summary><span>${escapeText(group.label)}</span><b data-summary="${key}"></b></summary><div class="option-body swatches">${group.options.map(o=>`<button type="button" class="swatch" data-material="${key}" data-value="${o.id}" aria-label="${escapeText(group.label)}: ${escapeText(o.label)}"><i style="${swatchStyle(o)}"></i><span>${escapeText(o.label)}</span></button>`).join('')}</div>`;
    groupContainer.append(card);
    const row=document.createElement('div');row.innerHTML=`<dt>${escapeText(group.label)}</dt><dd data-detail="${key}"></dd>`;detailsContainer.append(row);
  }
  groupContainer.addEventListener('click',e=>{const button=e.target.closest('button[data-material]');if(button)choose(button.dataset.material,button.dataset.value);});
}
function updateText(){
  selection.textContent=Object.keys(groups).map(key=>`${groups[key].label}: ${option(key).label}`).join(' · ');
  for(const key of Object.keys(groups)){
    document.querySelectorAll(`[data-summary="${key}"],[data-detail="${key}"]`).forEach(el=>el.textContent=option(key).label);
    document.querySelectorAll(`[data-material="${key}"]`).forEach(el=>{const selected=el.dataset.value===state[key];el.classList.toggle('active',selected);el.setAttribute('aria-pressed',String(selected));});
  }
}
async function textureFor(image){
  if(!textures.has(image))textures.set(image,viewer.createTexture(`textures/${image}`,'image/jpeg'));
  return textures.get(image);
}
async function mappedTextureFor(image,materialName,originalTexture){
  const cacheKey=`${image}:${materialName}`;
  if(!mappedTextures.has(cacheKey))mappedTextures.set(cacheKey,(async()=>{
    const texture=(await textureFor(image)).clone();
    if(originalTexture){
      texture.offset.copy(originalTexture.offset);
      texture.repeat.copy(originalTexture.repeat);
      texture.center.copy(originalTexture.center);
      texture.rotation=originalTexture.rotation;
      texture.wrapS=originalTexture.wrapS;
      texture.wrapT=originalTexture.wrapT;
      texture.channel=originalTexture.channel;
    }
    texture.needsUpdate=true;
    return texture;
  })());
  return mappedTextures.get(cacheKey);
}
function currentMaterials(key){return viewer.model?.materials.filter(m=>groups[key].materials.includes(m.name))||[];}
async function applyMaterial(key){
  if(!viewer.model)return;
  const o=option(key);
  try{
    for(const material of currentMaterials(key)){
      const original=originalMaterials.get(material.name);
      const texture=o.image?await mappedTextureFor(o.image,material.name,original?.texture):null;
      // Texture loading is asynchronous. Ignore an older choice finishing late.
      if(option(key)!==o)return;
      const pbr=material.pbrMetallicRoughness;
      if(key==='cabinet'&&material.name==='VREEL_cabinet'&&!o.image){
        pbr.baseColorTexture.setTexture(original?.texture||null);
        pbr.setBaseColorFactor(original?.color||[1,1,1,1]);
        pbr.setMetallicFactor(original?.metallic??0);
        pbr.setRoughnessFactor(original?.roughness??.65);
        continue;
      }
      pbr.baseColorTexture.setTexture(o.original?(original?.texture||null):(texture||null));
      pbr.setBaseColorFactor(o.original?(original?.color||[1,1,1,1]):(o.colorFactor||[1,1,1,1]));
      pbr.setMetallicFactor(o.original?(original?.metallic??0):(o.metallic??0));
      pbr.setRoughnessFactor(o.original?(original?.roughness??.65):(o.roughness??.72));
      if(key==='chairFabric'&&o.image)material.setAlphaMode('OPAQUE');
    }
    viewer.requestUpdate?.();
  }catch(error){console.error('Texture could not be applied',key,error);notice.textContent=`${groups[key].label} malzemesi yüklenemedi.`;}
}
function choose(key,value){
  if(!groups[key]?.options.some(o=>o.id===value))return;
  state[key]=value;updateText();applyMaterial(key);
  if(wheelGroup===key)renderWheel();
}
function renderWheel(){
  if(!wheelGroup)return;
  const group=groups[wheelGroup],pageCount=Math.ceil(group.options.length/8);
  wheelPage=Math.max(0,Math.min(wheelPage,pageCount-1));
  const items=group.options.slice(wheelPage*8,wheelPage*8+8);
  wheelOptions.replaceChildren();
  items.forEach((o,index)=>{
    const theta=(-90+360*index/items.length)*Math.PI/180;
    const button=document.createElement('button');button.type='button';button.className='wheel-swatch';
    const orbit=window.matchMedia('(max-width:500px)').matches?89:111;
    button.style.setProperty('--x',`${Math.cos(theta)*orbit}px`);
    button.style.setProperty('--y',`${Math.sin(theta)*orbit}px`);
    button.style.cssText+=`;${swatchStyle(o)}`;
    button.dataset.value=o.id;button.setAttribute('aria-label',o.label);
    button.setAttribute('aria-pressed',String(state[wheelGroup]===o.id));
    button.title=o.label;wheelOptions.append(button);
  });
  document.querySelector('#wheel-title').textContent=group.label;
  document.querySelector('#wheel-current').textContent=option(wheelGroup).label;
  const pager=wheel.querySelector('.wheel-pages');pager.hidden=pageCount<2;
  document.querySelector('#wheel-page').textContent=`${wheelPage+1} / ${pageCount}`;
  document.querySelector('#wheel-prev').disabled=wheelPage===0;
  document.querySelector('#wheel-next').disabled=wheelPage===pageCount-1;
}
function closeWheel(){wheel.hidden=true;wheelGroup=null;}
function openWheel(key,x,y){
  const box=wheel.parentElement.getBoundingClientRect();
  wheelGroup=key;wheelPage=Math.floor(Math.max(0,groups[key].options.findIndex(o=>o.id===state[key]))/8);
  const radius=window.matchMedia('(max-width:500px)').matches?125:147;
  const clamp=(point,extent,min,max)=>extent<=radius*2?extent/2:Math.max(min,Math.min(point,max));
  wheel.style.left=`${clamp(x-box.left,box.width,radius,box.width-radius)}px`;
  wheel.style.top=`${clamp(y-box.top,box.height,radius+25,box.height-radius-30)}px`;
  wheel.hidden=false;renderWheel();
  document.querySelector(`[data-group="${key}"]`)?.setAttribute('open','');
}
wheelOptions.addEventListener('click',e=>{const b=e.target.closest('button[data-value]');if(b&&wheelGroup)choose(wheelGroup,b.dataset.value);});
wheel.querySelector('#wheel-prev').addEventListener('click',()=>{wheelPage--;renderWheel();});
wheel.querySelector('#wheel-next').addEventListener('click',()=>{wheelPage++;renderWheel();});
wheel.querySelector('#wheel-close').addEventListener('click',closeWheel);
let wheelDrag=null;
const dragHandle=wheel.querySelector('#wheel-drag');
dragHandle.addEventListener('pointerdown',e=>{
  e.preventDefault();e.stopPropagation();dragHandle.setPointerCapture(e.pointerId);
  wheelDrag={x:e.clientX,y:e.clientY,left:parseFloat(wheel.style.left),top:parseFloat(wheel.style.top)};
});
dragHandle.addEventListener('pointermove',e=>{
  if(!wheelDrag)return;
  const box=wheel.parentElement.getBoundingClientRect(),radius=wheel.offsetWidth/2;
  const clamp=(value,min,max)=>min>max?(min+max)/2:Math.max(min,Math.min(max,value));
  wheel.style.left=`${clamp(wheelDrag.left+e.clientX-wheelDrag.x,radius,box.width-radius)}px`;
  wheel.style.top=`${clamp(wheelDrag.top+e.clientY-wheelDrag.y,radius+25,box.height-radius-30)}px`;
});
for(const event of ['pointerup','pointercancel'])dragHandle.addEventListener(event,()=>wheelDrag=null);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeWheel();});
viewer.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});
viewer.addEventListener('pointerup',e=>{
  if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>7)return;
  const material=viewer.materialFromPoint?.(e.clientX,e.clientY);
  const group=Object.keys(groups).find(key=>groups[key].materials.includes(material?.name));
  if(group)openWheel(group,e.clientX,e.clientY);else closeWheel();
});
viewer.addEventListener('load',()=>{
  document.querySelector('#model-loading').hidden=true;
  originalMaterials.clear();
  for(const material of viewer.model.materials){
    const pbr=material.pbrMetallicRoughness;
    originalMaterials.set(material.name,{texture:pbr.baseColorTexture?.texture||null,color:pbr.baseColorFactor,metallic:pbr.metallicFactor,roughness:pbr.roughnessFactor});
  }
  for(const key of Object.keys(groups))applyMaterial(key);
  updateText();notice.textContent='';
});
viewer.addEventListener('error',()=>{notice.textContent='3D model yüklenemedi. Lütfen sayfayı yenileyin.';document.querySelector('#model-loading').textContent=notice.textContent;});
viewer.addEventListener('progress',e=>{const bar=viewer.querySelector('.progress'),span=bar?.querySelector('span');if(bar)bar.hidden=false;if(span)span.style.width=`${e.detail.totalProgress*100}%`;if(e.detail.totalProgress===1&&bar)bar.hidden=true;});
buildGroups();
async function loadModel(){
  notice.textContent='3D model yükleniyor…';
  try{
    const manifestResponse=await fetch('model/desk-setup-parts/manifest.json');
    if(!manifestResponse.ok)throw new Error('Model manifest unavailable');
    const manifest=await manifestResponse.json();
    const parts=await Promise.all(Array.from({length:manifest.parts},(_,index)=>fetch(`model/desk-setup-parts/part-${String(index).padStart(2,'0')}.bin`).then(response=>{
      if(!response.ok)throw new Error(`Model part ${index}: ${response.status}`);
      return response.arrayBuffer();
    })));
    modelBlob=new Blob(parts,{type:'model/gltf-binary'});
    viewer.src=URL.createObjectURL(modelBlob);
  }catch(error){console.error(error);notice.textContent='3D model yüklenemedi. Lütfen sayfayı yenileyin.';document.querySelector('#model-loading').textContent=notice.textContent;}
}
loadModel();
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{activate('.tab',b);document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===b.dataset.tab));}));
function cleanCapture(){const wasOpen=!wheel.hidden;wheel.hidden=true;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(wasOpen))));}
function dataUrlToBlob(url){const [meta,data]=url.split(',');const mime=meta.match(/:(.*?);/)[1];const bytes=atob(data);const arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:mime});}
async function capturePng(download=true,highResolution=false){const wheelWas=await cleanCapture();let url;
  try{url=highResolution?viewer.to4KDataURL():viewer.toDataURL('image/png',1);}finally{wheel.hidden=!wheelWas;}
  if(download){const a=document.createElement('a');a.href=URL.createObjectURL(dataUrlToBlob(url));a.download=`VREEL_Desk_Setup${highResolution?'_4K':''}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}return url;}
viewer.environmentImage=studio.environment;viewer.exposure=studio.exposure;viewer.shadowIntensity=studio.shadow;viewer.shadowSoftness=studio.softness;
document.querySelector('[data-action="rotate"]').addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';viewer.setAutoRotate(on);e.currentTarget.setAttribute('aria-pressed',String(on));});
document.querySelector('#rotation-speed').addEventListener('input',e=>{viewer.setRotationSpeed(e.target.value);e.target.nextElementSibling.value=`${e.target.value}°/sn`;});
viewer.setRotationSpeed(40);
document.querySelectorAll('[data-lighting]').forEach(button=>button.addEventListener('click',()=>{
  viewer.lightingPreset=button.dataset.lighting;
  document.querySelectorAll('[data-lighting]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
}));
const lightingMenu=document.querySelector('.lighting-presets');
document.querySelector('[data-action="lighting-menu"]').addEventListener('click',()=>{lightingMenu.hidden=!lightingMenu.hidden;});
document.addEventListener('click',e=>{if(!e.target.closest('.lighting-presets,[data-action="lighting-menu"]'))lightingMenu.hidden=true;});
const fullscreenButton=document.querySelector('[data-action="fullscreen"]');
fullscreenButton.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await viewer.parentElement.requestFullscreen();}catch{notice.textContent='Tam ekran açılamadı.';}});
document.addEventListener('fullscreenchange',()=>{const active=Boolean(document.fullscreenElement);fullscreenButton.querySelector('use').setAttribute('href',active?'#ico-collapse':'#ico-expand');fullscreenButton.title=active?'Tam ekrandan çık':'Tam ekran';fullscreenButton.setAttribute('aria-label',fullscreenButton.title);fullscreenButton.classList.toggle('active',active);});
document.querySelector('[data-action="reset"]').addEventListener('click',()=>{viewer.cameraOrbit='35deg 66deg auto';viewer.cameraTarget='auto auto auto';viewer.fieldOfView='auto';viewer.jumpCameraToGoal?.();});
document.querySelector('[data-action="zoom-in"]').addEventListener('click',()=>{const o=viewer.getCameraOrbit();viewer.cameraOrbit=`${o.theta}rad ${o.phi}rad ${Math.max(o.radius*.82,.2)}m`;});
document.querySelector('[data-action="zoom-out"]').addEventListener('click',()=>{const o=viewer.getCameraOrbit();viewer.cameraOrbit=`${o.theta}rad ${o.phi}rad ${o.radius*1.22}m`;});
document.querySelector('[data-action="pan-left"]').addEventListener('click',()=>viewer.panView(-1));
document.querySelector('[data-action="pan-right"]').addEventListener('click',()=>viewer.panView(1));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{const views={orbit:'35deg 66deg auto',front:'0deg 75deg auto',side:'90deg 75deg auto',top:'0deg 10deg auto'};viewer.cameraOrbit=views[b.dataset.view];viewer.jumpCameraToGoal?.();activate('[data-view]',b);}));
document.querySelector('[data-action="snapshot"]').addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await capturePng(true);notice.textContent='PNG görseli indirildi.';}catch{notice.textContent='Görsel oluşturulamadı. Lütfen tekrar deneyin.';}e.currentTarget.disabled=false;});
document.querySelector('[data-action="snapshot-4k"]').addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await capturePng(true,true);notice.textContent='4K PNG indirildi.';}catch{notice.textContent='4K görüntü oluşturulamadı. Cihazınızın grafik belleği yetersiz olabilir.';}e.currentTarget.disabled=false;});
const dimensionOverlay=document.querySelector('#dimensions-overlay');
document.querySelector('[data-action="dimensions"]').addEventListener('click',e=>{dimensionOverlay.hidden=!dimensionOverlay.hidden;e.currentTarget.setAttribute('aria-pressed',String(!dimensionOverlay.hidden));});
function updateDimensions(){if(!dimensionOverlay.hidden){const guides=viewer.getMeasurementGuides();
  if(guides){if(dimensionOverlay.querySelectorAll('span').length!==guides.length){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');
      dimensionOverlay.replaceChildren(svg,...guides.map(()=>document.createElement('span')));}
    const svg=dimensionOverlay.querySelector('svg');svg.setAttribute('viewBox',`0 0 ${viewer.clientWidth} ${viewer.clientHeight}`);
    svg.replaceChildren(...guides.flatMap(({start,end,offset})=>{const a={x:start.x+offset.x,y:start.y+offset.y},b={x:end.x+offset.x,y:end.y+offset.y};
      return [[a,b,'measure-main'],[start,a,'measure-witness'],[end,b,'measure-witness']].map(([p,q,kind])=>{
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',p.x);line.setAttribute('y1',p.y);line.setAttribute('x2',q.x);line.setAttribute('y2',q.y);line.setAttribute('class',kind);return line;});}));
    guides.forEach(({label,start,end,offset},i)=>{const tag=dimensionOverlay.querySelectorAll('span')[i];tag.textContent=label;tag.style.left=`${Math.max(30,Math.min(viewer.clientWidth-30,(start.x+end.x)/2+offset.x))}px`;tag.style.top=`${Math.max(80,Math.min(viewer.clientHeight-58,(start.y+end.y)/2+offset.y))}px`;});}
  else dimensionOverlay.textContent='Model henüz yüklenmedi.';}requestAnimationFrame(updateDimensions);}requestAnimationFrame(updateDimensions);

let pdfDocument=null,pdfPreviewUrl='';
async function makePdf(){
  const productImage=await capturePng(false),canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);ctx.fillStyle='#0f1b2d';ctx.fillRect(0,0,1240,148);ctx.fillStyle='#fff';ctx.font='700 52px Arial';ctx.fillText('VREEL',82,92);ctx.fillStyle='#b68a4c';ctx.font='600 25px Arial';ctx.fillText('ETKİLEŞİMLİ TASARIM',275,90);
  const img=new Image();img.src=productImage;await img.decode();ctx.fillStyle='#eef1f4';ctx.fillRect(82,200,1076,650);const scale=Math.min(1076/img.width,650/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,82+(1076-w)/2,200+(650-h)/2,w,h);
  ctx.fillStyle='#0f1b2d';ctx.font='700 42px Arial';ctx.fillText('Yönetici Masası',82,930);ctx.fillStyle='#697383';ctx.font='400 24px Arial';ctx.fillText('Seçilen ürün yapılandırmasına göre hazırlanan teknik föy',82,974);ctx.fillStyle='#b68a4c';ctx.fillRect(82,1008,1076,3);
  const rows=Object.entries(groups).map(([key, group]) => [group.label, option(key).label]);rows.forEach((r,i)=>{const y=1080+i*72;ctx.fillStyle='#697383';ctx.font='400 22px Arial';ctx.fillText(r[0],82,y);ctx.fillStyle='#0f1b2d';ctx.font='700 22px Arial';ctx.fillText(r[1],500,y);ctx.fillStyle='#e2e5e9';ctx.fillRect(82,y+28,1076,2);});
  ctx.fillStyle='#8b929c';ctx.font='400 20px Arial';ctx.fillText(`Oluşturma tarihi: ${new Date().toLocaleDateString('tr-TR')}`,82,1665);ctx.textAlign='right';ctx.fillText('VREEL tarafından geliştirilen etkileşimli ürün deneyimi',1158,1665);ctx.textAlign='left';
  pdfPreviewUrl=canvas.toDataURL('image/jpeg',.92);const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});pdf.addImage(pdfPreviewUrl,'JPEG',0,0,210,297,undefined,'FAST');return pdf;
}
document.querySelector('#datasheet').addEventListener('click',async()=>{notice.textContent='Teknik föy hazırlanıyor…';try{pdfDocument=await makePdf();const preview=document.querySelector('#pdf-preview');preview.innerHTML=`<div class="pdf-sheet"><img src="${pdfPreviewUrl}" alt="Ürün teknik föyü önizlemesi"></div>`;document.querySelector('#pdf-modal').hidden=false;notice.textContent='';}catch{notice.textContent='Teknik föy oluşturulamadı.';}});
document.querySelector('#download-pdf').addEventListener('click',()=>pdfDocument?.save('VREEL_Desk_Setup.pdf'));
document.querySelector('.modal-close').addEventListener('click',()=>document.querySelector('#pdf-modal').hidden=true);
document.querySelector('#pdf-modal').addEventListener('click',e=>{if(e.target.id==='pdf-modal')e.currentTarget.hidden=true;});
const resetModal=document.querySelector('#reset-modal');
document.querySelector('#reset-materials').addEventListener('click',()=>resetModal.hidden=false);
document.querySelector('#cancel-reset').addEventListener('click',()=>resetModal.hidden=true);
resetModal.addEventListener('click',e=>{if(e.target===resetModal)resetModal.hidden=true;});
document.querySelector('#confirm-reset').addEventListener('click',()=>{for(const [key,group] of Object.entries(groups))choose(key,group.initial);resetModal.hidden=true;notice.textContent='Malzemeler varsayılan seçeneklere döndü.';});
const sourceModal=document.querySelector('#source-modal');
const sourceFiles={dwg:'downloads/Desk-Setup.dwg',max:'downloads/Desk-Setup.max',fbx:'downloads/Desk-Setup.fbx'};
document.querySelector('#source-download').addEventListener('click',()=>{sourceModal.hidden=false;document.querySelector('#source-form [name="company"]').focus();});
sourceModal.querySelector('[data-close-source]').addEventListener('click',()=>sourceModal.hidden=true);
sourceModal.addEventListener('click',e=>{if(e.target===sourceModal)sourceModal.hidden=true;});
document.querySelector('#source-form').addEventListener('submit',e=>{
  e.preventDefault();document.querySelector('#source-downloads').hidden=false;
  document.querySelector('#source-status').textContent='Dosya türünü seçin. Bilgileriniz gönderilmedi.';
});
document.querySelectorAll('[data-source-format]').forEach(button=>button.addEventListener('click',async()=>{
  const format=button.dataset.sourceFormat,url=sourceFiles[format],status=document.querySelector('#source-status');
  button.disabled=true;status.textContent='Dosya kontrol ediliyor…';
  try{const response=await fetch(url,{method:'HEAD'});if(!response.ok||!response.headers.get('content-type')?.includes('application')&&response.headers.get('content-type')?.includes('text/html'))throw Error('unavailable');
    const link=document.createElement('a');link.href=url;link.download=url.split('/').pop();link.click();status.textContent=`${format.toUpperCase()} indirmesi başladı.`;
  }catch{status.textContent=`${format.toUpperCase()} dosyası henüz hazır değil.`;}
  button.disabled=false;
}));
const orderModal=document.querySelector('#order-modal');
document.querySelector('#add').addEventListener('click',()=>{
  document.querySelector('#order-summary').textContent=Object.keys(groups).map(key=>`${groups[key].label}: ${option(key).label}`).join(' · ');
  orderModal.hidden=false;document.querySelector('#order-form [name="name"]').focus();
});
orderModal.querySelector('[data-close-order]').addEventListener('click',()=>orderModal.hidden=true);
orderModal.addEventListener('click',e=>{if(e.target===orderModal)orderModal.hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){orderModal.hidden=true;sourceModal.hidden=true;resetModal.hidden=true;lightingMenu.hidden=true;}});
document.querySelectorAll('[data-order-tab]').forEach(button=>button.addEventListener('click',()=>{
  activate('[data-order-tab]',button);
  document.querySelector('#order-account-note').textContent=button.dataset.orderTab==='login'
    ?'Giriş hizmeti henüz bağlı değil. Bu sayfa şifre istemez.'
    :'Kayıt hizmeti henüz bağlı değil. Bilgileriniz hesap oluşturmaz.';
}));
document.querySelector('#order-form').addEventListener('submit',e=>{
  e.preventDefault();document.querySelector('#order-status').textContent='Talep gönderilmedi: sipariş alıcısı ve üyelik hizmeti bağlanmalıdır.';
});
updateText();
