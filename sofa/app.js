import {createViewer} from '../three-viewer.js';

const viewer=createViewer(document.querySelector('#product-viewer'));
const wheel=document.querySelector('#material-wheel');
const wheelOptions=document.querySelector('#wheel-options');
const groupsContainer=document.querySelector('#material-groups');
const detailsContainer=document.querySelector('#material-details');
const selection=document.querySelector('#selection');
const notice=document.querySelector('#notice');
const leather=[
  {id:'black-matte',label:'Siyah · Mat',image:'black.webp',roughness:.82},
  {id:'black-glossy',label:'Siyah · Parlak',image:'black.webp',roughness:.2},
  {id:'brown-matte',label:'Koyu Kahverengi · Mat',image:'brown.webp',roughness:.82},
  {id:'brown-glossy',label:'Koyu Kahverengi · Parlak',image:'brown.webp',roughness:.2},
  {id:'burgundy-matte',label:'Bordo · Mat',image:'burgundy.webp',roughness:.82},
  {id:'burgundy-glossy',label:'Bordo · Parlak',image:'burgundy.webp',roughness:.2},
];
const groups={leather:{label:'Tüm deri yüzeyleri',materials:['Sofa_Fills_Leather_Black'],options:leather,initial:'black-matte'}};
const state={leather:groups.leather.initial};
const originalMaterials=new Map();
const textures=new Map();
let wheelGroup=null,wheelPage=0,pointerStart=null,modelBlob=null,pdfDocument=null,pdfPreviewUrl='';
const studio={environment:'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/brown_photostudio_02_1k.hdr',exposure:1.12,shadow:1.35,softness:.72};
const option=()=>groups.leather.options.find(item=>item.id===state.leather);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const swatchStyle=item=>`background-image:url('assets/${item.image}')`;
function activate(selector,current){document.querySelectorAll(selector).forEach(item=>{const active=item===current;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});}
function buildGroups(){
  const card=document.createElement('details');card.className='option-card';card.open=true;card.dataset.group='leather';
  card.innerHTML=`<summary><span>${groups.leather.label}</span><b data-summary="leather"></b></summary><div class="option-body swatches">${leather.map(item=>`<button type="button" class="swatch" data-material="leather" data-value="${item.id}" aria-label="${esc(item.label)}"><i style="${swatchStyle(item)}"></i><span>${esc(item.label)}</span></button>`).join('')}</div>`;
  groupsContainer.append(card);
  detailsContainer.innerHTML='<div><dt>Deri yüzeyi</dt><dd data-detail="leather"></dd></div>';
  groupsContainer.addEventListener('click',event=>{const button=event.target.closest('[data-material]');if(button)choose(button.dataset.value);});
}
function updateText(){const current=option();selection.textContent=`Deri: ${current.label}`;document.querySelector('[data-summary="leather"]').textContent=current.label;document.querySelector('[data-detail="leather"]').textContent=current.label;document.querySelectorAll('[data-material="leather"]').forEach(item=>{const active=item.dataset.value===state.leather;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});}
async function textureFor(url){if(!textures.has(url))textures.set(url,viewer.createTexture(url));return textures.get(url);}
async function applyLeather(){
  if(!viewer.model)return;
  const selected=option();
  const texture=await textureFor(`assets/${selected.image}`);
  if(option()!==selected)return;
  for(const material of viewer.model.materials){
    if(!groups.leather.materials.includes(material.name))continue;
    const raw=material.raw;raw.map=texture;raw.color.setRGB(1,1,1);raw.metalness=0;raw.roughness=selected.roughness;raw.roughnessMap=null;
    const normal=await textureFor('assets/normal.webp');raw.normalMap=normal;raw.normalScale.set(.7,.7);raw.needsUpdate=true;
  }
  viewer.requestUpdate?.();
}
function choose(value){if(!leather.some(item=>item.id===value))return;state.leather=value;updateText();applyLeather();if(wheelGroup==='leather')renderWheel();}
function renderWheel(){
  if(!wheelGroup)return;const items=leather;wheelOptions.replaceChildren();
  items.forEach((item,index)=>{const theta=(-90+360*index/items.length)*Math.PI/180;const button=document.createElement('button');button.type='button';button.className='wheel-swatch';const radius=window.matchMedia('(max-width:500px)').matches?89:111;button.style.setProperty('--x',`${Math.cos(theta)*radius}px`);button.style.setProperty('--y',`${Math.sin(theta)*radius}px`);button.style.cssText+=`;${swatchStyle(item)}`;button.dataset.value=item.id;button.setAttribute('aria-label',item.label);button.setAttribute('aria-pressed',String(state.leather===item.id));button.title=item.label;wheelOptions.append(button);});
  document.querySelector('#wheel-title').textContent=groups.leather.label;document.querySelector('#wheel-current').textContent=option().label;wheel.querySelector('.wheel-pages').hidden=true;
}
function closeWheel(){wheel.hidden=true;wheelGroup=null;}
function openWheel(x,y){const box=wheel.parentElement.getBoundingClientRect();wheelGroup='leather';const radius=window.matchMedia('(max-width:500px)').matches?125:147;const clamp=(point,extent,min,max)=>extent<=radius*2?extent/2:Math.max(min,Math.min(point,max));wheel.style.left=`${clamp(x-box.left,box.width,radius,box.width-radius)}px`;wheel.style.top=`${clamp(y-box.top,box.height,radius+25,box.height-radius-30)}px`;wheel.hidden=false;renderWheel();document.querySelector('[data-group="leather"]')?.setAttribute('open','');}
wheelOptions.addEventListener('click',event=>{const button=event.target.closest('[data-value]');if(button)choose(button.dataset.value);});
wheel.querySelector('#wheel-close').addEventListener('click',closeWheel);document.addEventListener('keydown',event=>{if(event.key==='Escape')closeWheel();});
viewer.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
viewer.addEventListener('pointerup',event=>{if(!pointerStart||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>7)return;const material=viewer.materialFromPoint?.(event.clientX,event.clientY);if(material?.name===groups.leather.materials[0])openWheel(event.clientX,event.clientY);else closeWheel();});
viewer.addEventListener('load',()=>{document.querySelector('#model-loading').hidden=true;originalMaterials.clear();for(const material of viewer.model.materials){originalMaterials.set(material.name,{roughness:material.raw?.roughness});}applyLeather();updateText();notice.textContent='';updateDimensions();});
viewer.addEventListener('error',()=>{notice.textContent='3D model yüklenemedi. Lütfen sayfayı yenileyin.';document.querySelector('#model-loading').textContent=notice.textContent;});
viewer.addEventListener('progress',event=>{const bar=viewer.querySelector('.progress'),span=bar?.querySelector('span');if(span)span.style.width=`${event.detail.totalProgress*100}%`;if(event.detail.totalProgress===1&&bar)bar.hidden=true;});
function updateDimensions(){const dims=viewer.getDimensions?.();if(!dims)return;const el=document.querySelector('#dimensions');el.innerHTML=`<span>G <b>${Math.round(dims.x)} cm</b></span><span>Y <b>${Math.round(dims.y)} cm</b></span><span>D <b>${Math.round(dims.z)} cm</b></span>`;}
function cleanCapture(){const wasOpen=!wheel.hidden;wheel.hidden=true;return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(wasOpen))));}
function dataUrlToBlob(url){const [meta,data]=url.split(',');const bytes=atob(data);const arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:meta.match(/:(.*?);/)[1]});}
async function capturePng(download=true){const wasOpen=await cleanCapture();const url=viewer.toDataURL('image/png',1);wheel.hidden=!wasOpen;if(download){const link=document.createElement('a');link.href=URL.createObjectURL(dataUrlToBlob(url));link.download='VREEL_Lounge_Sofa.png';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}return url;}
async function makePdf(){const imageUrl=await capturePng(false);const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);ctx.fillStyle='#0f1b2d';ctx.fillRect(0,0,1240,148);ctx.fillStyle='#fff';ctx.font='700 52px Alexandria, Arial';ctx.fillText('VREEL',82,92);ctx.fillStyle='#b68a4c';ctx.font='600 25px Alexandria, Arial';ctx.fillText('ETKİLEŞİMLİ TASARIM',275,90);const image=new Image();image.src=imageUrl;await image.decode();ctx.fillStyle='#eef1f4';ctx.fillRect(82,200,1076,650);const scale=Math.min(1076/image.width,650/image.height);const w=image.width*scale,h=image.height*scale;ctx.drawImage(image,82+(1076-w)/2,200+(650-h)/2,w,h);ctx.fillStyle='#0f1b2d';ctx.font='700 42px Alexandria, Arial';ctx.fillText('Lounge Sofa',82,930);ctx.fillStyle='#697383';ctx.font='400 24px Alexandria, Arial';ctx.fillText(`Deri: ${option().label}`,82,974);pdfPreviewUrl=canvas.toDataURL('image/jpeg',.92);const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});pdf.addImage(pdfPreviewUrl,'JPEG',0,0,210,297,undefined,'FAST');return pdf;}
async function loadModel(){notice.textContent='3D model yükleniyor…';try{modelBlob=await fetch('model/Sofa.glb').then(response=>{if(!response.ok)throw new Error(response.status);return response.blob();});viewer.src=URL.createObjectURL(modelBlob);}catch(error){console.error(error);notice.textContent='3D model yüklenemedi. Lütfen sayfayı yenileyin.';}}
buildGroups();loadModel();viewer.environmentImage=studio.environment;viewer.exposure=studio.exposure;viewer.shadowIntensity=studio.shadow;viewer.shadowSoftness=studio.softness;viewer.setRotationSpeed(40);
document.querySelector('[data-action="rotate"]').addEventListener('click',event=>{const on=event.currentTarget.getAttribute('aria-pressed')!=='true';viewer.setAutoRotate(on);event.currentTarget.setAttribute('aria-pressed',String(on));});
document.querySelector('#rotation-speed').addEventListener('input',event=>{viewer.setRotationSpeed(event.target.value);event.target.nextElementSibling.value=`${event.target.value}°/sn`;});
document.querySelector('[data-action="shadow"]').addEventListener('click',event=>{const on=event.currentTarget.getAttribute('aria-pressed')!=='true';viewer.shadowIntensity=on?studio.shadow:0;event.currentTarget.setAttribute('aria-pressed',String(on));});
document.querySelectorAll('[data-lighting]').forEach(button=>button.addEventListener('click',()=>{viewer.lightingPreset=button.dataset.lighting;document.querySelectorAll('[data-lighting]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));}));
document.querySelector('[data-action="theme"]').addEventListener('click',event=>{const dark=event.currentTarget.getAttribute('aria-pressed')!=='true';viewer.parentElement.classList.toggle('dark-scene',dark);viewer.sceneTheme=dark?'dark':'light';event.currentTarget.setAttribute('aria-pressed',String(dark));});
document.querySelector('[data-action="fullscreen"]').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await viewer.parentElement.requestFullscreen();}catch{notice.textContent='Tam ekran açılamadı.';}});
document.querySelector('[data-action="reset"]').addEventListener('click',()=>{viewer.cameraOrbit='35deg 66deg auto';viewer.cameraTarget='auto';viewer.jumpCameraToGoal?.();});
document.querySelector('[data-action="zoom-in"]').addEventListener('click',()=>{const orbit=viewer.getCameraOrbit();viewer.cameraOrbit=`${orbit.theta}rad ${orbit.phi}rad ${Math.max(orbit.radius*.82,.2)}m`;});
document.querySelector('[data-action="zoom-out"]').addEventListener('click',()=>{const orbit=viewer.getCameraOrbit();viewer.cameraOrbit=`${orbit.theta}rad ${orbit.phi}rad ${orbit.radius*1.22}m`;});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const views={orbit:'35deg 66deg auto',front:'0deg 75deg auto',side:'90deg 75deg auto',top:'0deg 10deg auto'};viewer.cameraOrbit=views[button.dataset.view];viewer.jumpCameraToGoal?.();activate('[data-view]',button);}));
document.querySelector('[data-action="dimensions"]').addEventListener('click',event=>{const box=document.querySelector('#dimensions');box.hidden=!box.hidden;event.currentTarget.setAttribute('aria-pressed',String(!box.hidden));updateDimensions();});
document.querySelector('[data-action="ar"]').addEventListener('click',()=>{notice.textContent='AR deneyimi yakında etkinleşecek.';});
document.querySelector('[data-action="snapshot"]').addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await capturePng(true);notice.textContent='PNG görseli indirildi.';}catch{notice.textContent='Görsel oluşturulamadı.';}event.currentTarget.disabled=false;});
document.querySelector('#datasheet').addEventListener('click',async()=>{notice.textContent='Teknik föy hazırlanıyor…';try{pdfDocument=await makePdf();document.querySelector('#pdf-preview').innerHTML=`<div class="pdf-sheet"><img src="${pdfPreviewUrl}" alt="Ürün teknik föyü önizlemesi"></div>`;document.querySelector('#pdf-modal').hidden=false;notice.textContent='';}catch{notice.textContent='Teknik föy oluşturulamadı.';}});
document.querySelector('#download-pdf').addEventListener('click',()=>pdfDocument?.save('VREEL_Lounge_Sofa.pdf'));document.querySelector('#pdf-modal .modal-close').addEventListener('click',()=>document.querySelector('#pdf-modal').hidden=true);document.querySelector('#pdf-modal').addEventListener('click',event=>{if(event.target.id==='pdf-modal')event.currentTarget.hidden=true;});
document.querySelectorAll('.download-glb').forEach(button=>button.addEventListener('click',()=>{if(!modelBlob){notice.textContent='Model henüz hazır değil.';return;}const url=URL.createObjectURL(modelBlob),link=document.createElement('a');link.href=url;link.download='VREEL_Lounge_Sofa.glb';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notice.textContent='GLB dosyası indirildi.';}));
document.querySelector('#add').addEventListener('click',()=>{document.querySelector('#order-summary').textContent=`Deri: ${option().label}`;document.querySelector('#order-modal').hidden=false;});document.querySelector('[data-close-order]').addEventListener('click',()=>document.querySelector('#order-modal').hidden=true);document.querySelector('#order-modal').addEventListener('click',event=>{if(event.target.id==='order-modal')event.currentTarget.hidden=true;});document.querySelector('#order-form').addEventListener('submit',event=>{event.preventDefault();document.querySelector('#order-status').textContent='Talep gönderilmedi: sipariş alıcısı henüz bağlı değil.';});
document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{activate('.tab',button);document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===button.dataset.tab));}));
updateText();
