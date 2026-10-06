import * as THREE from 'three';
import {createViewer} from './three-viewer.js';
import {woodPreviews} from './texture-previews.js';

const page=document.body.dataset.product;
const viewer=createViewer(document.querySelector('#product-viewer'));
const viewerCanvas=viewer.querySelector('canvas');viewerCanvas.style.visibility='hidden';
const ui={groups:document.querySelector('#material-groups'),details:document.querySelector('#material-details'),selection:document.querySelector('#selection'),notice:document.querySelector('#notice'),wheel:document.querySelector('#material-wheel'),wheelOptions:document.querySelector('#wheel-options')};
const asset=(path)=>new URL(path,import.meta.url).href;

const leather=[
  {id:'black-matte',label:'Siyah · Yarı Mat',image:asset('sofa/assets/black.webp'),roughness:.72,leather:true},
  {id:'black-glossy',label:'Siyah · ⅔ Parlak',image:asset('sofa/assets/black.webp'),roughness:.54,leather:true},
  {id:'brown-matte',label:'Koyu Kahverengi · Yarı Mat',image:asset('sofa/assets/brown.webp'),roughness:.72,leather:true},
  {id:'brown-glossy',label:'Koyu Kahverengi · ⅔ Parlak',image:asset('sofa/assets/brown.webp'),roughness:.54,leather:true},
  {id:'burgundy-matte',label:'Bordo · Yarı Mat',image:asset('sofa/assets/burgundy.webp'),roughness:.72,leather:true},
  {id:'burgundy-glossy',label:'Bordo · ⅔ Parlak',image:asset('sofa/assets/burgundy.webp'),roughness:.54,leather:true},
];
const wood=[
  {id:'original',label:'Mevcut Ahşap',original:true,color:'#966f50'},
  ...[['oak-nefrit','Meşe · Nefrit'],['oak-marrakesh','Meşe · Marrakesh'],['oak-muskat','Meşe · Muskat']].map(([id,label])=>({id,label,image:asset(`textures/wood/${id}.webp`),roughness:.78,factor:[1,1,1],wood:true})),
];
const solids=[
  {id:'white',label:'Düz Beyaz · Yarı Mat',color:'#eeeae1',factor:[.86,.84,.8],roughness:.38},
  {id:'anthracite',label:'Antrasit · Yarı Mat',color:'#34383d',factor:[.035,.041,.048],roughness:.38},
];
const metal=[
  {id:'black',label:'Siyah Boyalı · Mat',color:'#171a1e',factor:[.018,.022,.027],metalness:.35,roughness:.78},
  {id:'white',label:'Beyaz Boyalı · Mat',color:'#ecebe7',factor:[.84,.83,.79],metalness:.18,roughness:.78},
  {id:'bronze',label:'Bronz · Yarı Parlak',color:'#8d6949',factor:[.33,.19,.095],metalness:1,roughness:.32},
  {id:'gold',label:'Altın · Yarı Parlak',color:'#c9a34b',factor:[.73,.48,.13],metalness:1,roughness:.3},
  {id:'chrome',label:'Krom · Parlak',color:'#dce4e8',factor:[.78,.84,.88],metalness:1,roughness:.07},
  {id:'chrome-matte',label:'Krom · Mat',color:'#bec5c8',factor:[.58,.63,.65],metalness:1,roughness:.46},
];
const glass=[
  {id:'smoked-black',label:'Siyah Füme Cam',color:'#1b2027',factor:[.02,.025,.035],metalness:.05,roughness:.48,glass:true,opacity:.68},
  {id:'frosted-clear',label:'Şeffaf Buzlu Cam',color:'#d9e1e3',factor:[.62,.72,.74],metalness:0,roughness:.72,glass:true,opacity:.48},
];

const materialName=(material)=>material.userData.vreelOriginalName||material.name;
const group=(label,materials,options,initial,target=()=>true)=>({label,materials,options,initial,target});
const configs={
  sofa:{title:'Lounge Duo',file:asset('sofa/model/Sofa.glb'),download:'VREEL_Lounge_Duo.glb',groups:{leather:group('Deri Yüzeyi',['Sofa_Fills_Leather_Black'],leather,'black-glossy')}},
  chair:{title:'Aura Yönetici Koltuğu',file:asset('chair/model/Chair.glb'),download:'VREEL_Aura_Yonetici_Koltugu.glb',groups:{
    leather:group('Deri Yüzeyi',['Material__2147483027'],leather,'brown-glossy'),
    wood:group('Ahşap Detay',['WD'],wood,'oak-nefrit'),
    metal:group('Metal Detay',['MetalBlackMatte'],metal,'chrome'),
  }},
  desk:{title:'Axis Executive Desk',file:asset('desk/model/Desk.glb'),download:'VREEL_Axis_Executive_Desk.glb',groups:{
    desktop:group('Masa Üstü',['Material__2147483063'],[...wood,...solids],'oak-muskat',node=>/^Top/.test(node.name)),
    woodLeg:group('Ahşap Ayaklar',['Material__2147483063'],[...wood,...solids],'oak-muskat',node=>/^Leg/.test(node.name)),
    cabinet:group('Keson Gövdesi',['Material__2147482989','Material__2147483063'],wood,'oak-muskat',node=>(node.userData.sourceName||node.name)==='KesonUnitBody'),
    cabinetFace:group('Keson Kapakları',['MDFBlack'],[...wood,...solids],'white',node=>(node.userData.sourceName||node.name)==='KesonUnitFaces'),
    frontPanel:group('Ön Panel',['Material__2147482989'],[...wood.filter(option=>!option.original),...solids,...glass],'frosted-clear',node=>node.name.startsWith('FrontPanel')),
    metal:group('Metal Ayaklar',['MetalBlackMatte'],metal,'white'),
  }},
};
const config=configs[page];
const state=Object.fromEntries(Object.entries(config.groups).map(([key,value])=>[key,value.initial]));
const textures=new Map(),projectedTextures=new Map();let pointerStart=null,wheelGroup=null,wheelObject=null,wheelPage=0,pdfDocument=null;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const choice=(key,id=state[key])=>config.groups[key].options.find(option=>option.id===id);
const previewImage=option=>option.wood&&woodPreviews[option.id]||option.image;
const swatch=option=>option.image?`background-image:url('${previewImage(option)}')`:`background-color:${option.color}`;
// Download the tiny default colors alongside the GLB instead of waiting for it.
const previewLoads=Promise.all(Object.keys(config.groups).map(key=>{
  const option=choice(key),url=previewImage(option);
  if(!url)return Promise.resolve();
  if(!textures.has(url))textures.set(url,viewer.createTexture(url));
  return textures.get(url);
}));

function isolateMaterials(){viewer.model.root.traverse(node=>{if(!node.isMesh)return;const list=[node.material].flat().map(material=>{
  const clone=material.clone();clone.name=material.name;clone.userData.vreelOriginalName=material.name;clone.userData.vreelOriginal={map:material.map,color:material.color.clone(),metalness:material.metalness,roughness:material.roughness,transparent:material.transparent,opacity:material.opacity,depthWrite:material.depthWrite,roughnessMap:material.roughnessMap,metalnessMap:material.metalnessMap,normalMap:material.normalMap,bumpMap:material.bumpMap,bumpScale:material.bumpScale,side:material.side,transmission:material.transmission,thickness:material.thickness,alphaMap:material.alphaMap};return clone;
});node.material=Array.isArray(node.material)?list:list[0];});}
async function loadTexture(url,original,color=false){
  // All desk wood faces use the same world-space UV layout. Share GPU textures
  // across the many size variants instead of allocating a copy per mesh.
  const sharedKey=page==='desk'?`${url}|${color}|${original?.map?.channel??0}`:null;
  if(sharedKey&&projectedTextures.has(sharedKey))return projectedTextures.get(sharedKey);
  const pending=(async()=>{
    if(!textures.has(url))textures.set(url,viewer.createTexture(url));
    const base=await textures.get(url),texture=base.clone();texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    if(original?.map){texture.channel=original.map.channel;texture.offset.copy(original.map.offset);texture.repeat.copy(original.map.repeat);texture.center.copy(original.map.center);texture.rotation=original.map.rotation;texture.wrapS=original.map.wrapS;texture.wrapT=original.map.wrapT;}
    texture.needsUpdate=true;return texture;
  })();
  if(sharedKey)projectedTextures.set(sharedKey,pending);return pending;
}
function alignMaps(material,option,maps){if(!option.wood)return;for(const map of maps){if(!map)continue;map.wrapS=map.wrapT=THREE.RepeatWrapping;if(page==='desk'&&material.userData.boxWoodProjection){map.offset.set(0,0);map.repeat.set(1,1);map.rotation=0;}else{map.repeat.multiplyScalar(page==='chair'?4:2);}map.needsUpdate=true;}}
function semanticNode(node){for(let n=node;n;n=n.parent)if(n.userData.sourceName)return n;return node;}
function targetMaterials(node,key){const spec=config.groups[key];if(!node.isMesh||!spec.target(semanticNode(node)))return[];return [node.material].flat().filter(material=>key==='frontPanel'&&page==='desk'||spec.materials.includes(materialName(material)));}
async function paint(node,key,option,preview=false){for(const material of targetMaterials(node,key)){const original=material.userData.vreelOriginal;const revision=(material.userData.paintRevision||0)+1;material.userData.paintRevision=revision;if(option.original){material.map=original.map;material.color.copy(original.color);material.metalness=original.metalness;material.roughness=original.roughness;material.transparent=original.transparent;material.opacity=original.opacity;material.depthWrite=original.depthWrite;material.transmission=original.transmission??0;material.thickness=original.thickness??0;material.alphaMap=original.alphaMap;material.roughnessMap=original.roughnessMap;material.bumpMap=original.bumpMap;material.bumpScale=original.bumpScale;material.side=original.side;material.metalnessMap=original.metalnessMap;material.normalMap=original.normalMap;if(page==='chair'&&key==='wood'||page==='desk'&&['desktop','woodLeg','cabinet'].includes(key)){material.metalness=0;material.roughness=.35;material.normalScale.set(.1,.1);}}else{const [nextMap,roughMap,bumpMap,normalMap]=await Promise.all([option.image?loadTexture(preview?previewImage(option):option.image,original,true):null,!preview&&(option.wood||option.leather)?loadTexture(asset(`textures/pbr/${option.wood?option.id:'leather'}-gloss.webp`),original):null,!preview&&option.wood?loadTexture(asset(`textures/pbr/${option.id}-bump.webp`),original):null,!preview&&option.leather?loadTexture(asset('textures/pbr/leather-normal.webp'),original):null]);if(material.userData.paintRevision!==revision)return;material.map=nextMap;material.roughnessMap=roughMap;material.metalnessMap=null;material.normalMap=normalMap;material.normalScale.set(option.wood?.1:.3,option.wood?.1:.3);material.bumpMap=bumpMap;material.bumpScale=bumpMap?(option.wood?.003:.012):0;material.side=option.glass?THREE.DoubleSide:original.side;alignMaps(material,option,[nextMap,roughMap,bumpMap]);material.color.setRGB(...(option.factor||[1,1,1]));material.metalness=option.metalness??0;material.roughness=option.wood?(preview?(option.id==='oak-muskat'?.54:.35):(option.id==='oak-muskat'?1:.35)):(option.roughness??.55);material.transparent=Boolean(option.glass);material.opacity=option.opacity??1;material.depthWrite=!option.glass;if(key==='frontPanel'){material.transmission=option.glass?(original.transmission??0):0;material.thickness=option.glass?(original.thickness??0):0;material.alphaMap=option.glass?original.alphaMap:null;if(!option.glass){material.opacity=1;material.transparent=false;material.depthWrite=true;}}}material.userData.finishId=option.id;material.needsUpdate=true;}}
async function applyGroup(key,option=choice(key),single=null,preview=false){const jobs=[];(single?[single]:[viewer.model.root]).forEach(root=>root.traverse?root.traverse(node=>jobs.push(paint(node,key,option,preview))):jobs.push(paint(root,key,option,preview)));await Promise.all(jobs);viewer.requestUpdate();}
function buildMaterials(){ui.groups.replaceChildren();ui.details.replaceChildren();for(const [key,spec] of Object.entries(config.groups)){const card=document.createElement('details');card.className='option-card';card.dataset.group=key;card.open=key===Object.keys(config.groups)[0];card.innerHTML=`<summary><span>${esc(spec.label)}</span><b data-summary="${key}"></b></summary><div class="option-body swatches">${spec.options.map(option=>`<button type="button" class="swatch" data-material="${key}" data-value="${option.id}" aria-label="${esc(option.label)}"><i style="${swatch(option)}"></i><span>${esc(option.label)}</span></button>`).join('')}</div>`;ui.groups.append(card);const row=document.createElement('div');row.innerHTML=`<dt>${esc(spec.label)}</dt><dd data-detail="${key}"></dd>`;ui.details.append(row);}ui.groups.addEventListener('click',event=>{const button=event.target.closest('[data-material]');if(button)select(button.dataset.material,button.dataset.value);});updateText();}
function updateText(){ui.selection.textContent=Object.entries(config.groups).map(([key,spec])=>`${spec.label}: ${choice(key).label}`).join(' · ');for(const key of Object.keys(config.groups)){document.querySelectorAll(`[data-summary="${key}"],[data-detail="${key}"]`).forEach(node=>node.textContent=choice(key).label);document.querySelectorAll(`[data-material="${key}"]`).forEach(node=>node.classList.toggle('active',node.dataset.value===state[key]));}}
function select(key,id){state[key]=id;updateText();applyGroup(key);if(wheelGroup===key)renderWheel();}

function addVariantCard(title,options,initial,onChange){const card=document.createElement('details');card.className='option-card';card.open=true;card.innerHTML=`<summary><span>${title}</span><b>${options.find(x=>x.id===initial).label}</b></summary><div class="option-body variant-options">${options.map(x=>`<button type="button" data-variant="${x.id}" class="${x.id===initial?'active':''}">${x.label}</button>`).join('')}</div>`;ui.groups.prepend(card);card.addEventListener('click',event=>{const button=event.target.closest('[data-variant]');if(!button)return;card.querySelectorAll('[data-variant]').forEach(x=>x.classList.toggle('active',x===button));card.querySelector('summary b').textContent=options.find(x=>x.id===button.dataset.variant).label;onChange(button.dataset.variant);});return card;}
let resetConfiguration=()=>{};
function setupSofa(){
  const nodes=viewer.model.nodes;
  // Original GLB node IDs: every unit includes its multi-material body and pillow.
  const units=[[11,13,9],[5,7],[1,3]].map(ids=>ids.map(id=>nodes[id]));
  const apply=(count,initial=false)=>{units.forEach((unit,index)=>unit.forEach(node=>node.visible=index<count));closeWheel();if(initial)viewer.reframe();updateDimensions();viewer.requestUpdate();};
  const card=addVariantCard('Modül Sayısı',[{id:'one',label:'Tekli'},{id:'two',label:'İkili'},{id:'three',label:'Üçlü'}],'two',id=>apply({one:1,two:2,three:3}[id]));apply(2,true);
  resetConfiguration=()=>card.querySelector('[data-variant="two"]').click();
}
function setupDesk(){
 const n=viewer.model.nodes;let size='200',layout='storage-right';
 const stretch={160:[21,23],200:[1,3],240:[17,19]};
 // Recalculate world-space UV after the size or storage layout changes.
 // World coordinates keep the three desktop sections aligned; each cabinet
 // long face uses one image across its full length to avoid repeated knots.
 const woodMeshes=[];viewer.model.root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const name=semanticNode(mesh).userData.sourceName||semanticNode(mesh).name;
   if(!/^(Top|Leg|FrontPanel|KesonUnitBody|KesonUnitFaces)/.test(name))return;
   const materialNames=[mesh.material].flat().map(materialName);
   if(!materialNames.some(value=>['Material__2147483063','Material__2147482989','MDFBlack'].includes(value)))return;
   mesh.geometry=mesh.geometry.clone();woodMeshes.push(mesh);
   [mesh.material].flat().forEach(material=>{if(['Material__2147483063','Material__2147482989','MDFBlack'].includes(materialName(material)))material.userData.boxWoodProjection=true;});
 });
 const point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
 const projectWood=()=>{viewer.model.root.updateMatrixWorld(true);const cabinetBounds=new Map();for(const mesh of woodMeshes){
   const positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');
   if(!normals)continue;
   let uv=mesh.geometry.getAttribute('uv');
   if(!uv||uv.count!==positions.count){uv=new THREE.BufferAttribute(new Float32Array(positions.count*2),2);mesh.geometry.setAttribute('uv',uv);}
   normalMatrix.getNormalMatrix(mesh.matrixWorld);
   const owner=semanticNode(mesh),part=owner.userData.sourceName||owner.name;
   const cabinet=part.startsWith('Keson');
   if(cabinet&&!cabinetBounds.has(owner))cabinetBounds.set(owner,new THREE.Box3().setFromObject(owner));
   const bounds=cabinet?cabinetBounds.get(owner):null;
   const cabinetLength=bounds?Math.max(bounds.max.z-bounds.min.z,.725):0;
   const cabinetWidth=bounds?Math.max(bounds.max.x-bounds.min.x,.725):0;
   for(let i=0;i<positions.count;i++){
     point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
     normal.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
     const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z);
     if(ay>=ax&&ay>=az){
       // Cabinet and wooden leg top grain follows their depth, while the
       // three connected desktop pieces keep their grain along the length.
       const depthGrain=cabinet||part.startsWith('Leg');
       uv.setXY(i,cabinet?(point.x-bounds.min.x)/cabinetWidth:depthGrain?point.x/.725:point.z/.725,depthGrain?point.z/2.55:point.x/2.55);
     }else if(az>=ax)uv.setXY(i,cabinet?(point.x-bounds.min.x)/cabinetWidth:point.x/.725,point.y/2.55);
     // Map the complete veneer image across the cabinet back, rather than
     // magnifying its center and producing oversized grain.
     else uv.setXY(i,cabinet?(point.z-bounds.min.z)/cabinetLength:point.z/.725,point.y/2.55);
   }
   uv.needsUpdate=true;
 }};
 // LeftSide also includes the left storage body and drawer fronts.
 const moving=[9,11,13,29,31].map(id=>n[id]);const origins=moving.map(node=>node.position.clone());
 const apply=(initial=false)=>{Object.entries(stretch).forEach(([key,ids])=>ids.forEach(id=>n[id].visible=key===size));
 moving.forEach((node,i)=>{node.position.copy(origins[i]);node.position.x+=(Number(size)-200)/100;});
 n[13].visible=layout!=='storage-left';n[15].visible=layout!=='storage-right';
 [25,27].forEach(id=>n[id].visible=layout==='storage-right');[29,31].forEach(id=>n[id].visible=layout==='storage-left');
 projectWood();closeWheel();if(initial)viewer.reframe();updateDimensions();viewer.requestUpdate();};
 const sizes=addVariantCard('Masa Ölçüsü',[{id:'160',label:'160 cm'},{id:'200',label:'200 cm'},{id:'240',label:'240 cm'}],size,id=>{size=id;apply();});
 const layouts=addVariantCard('Ayak / Keson Düzeni',[{id:'storage-right',label:'Keson Sağda'},{id:'storage-left',label:'Keson Solda'},{id:'two-legs',label:'İki Metal Ayak'}],layout,id=>{layout=id;apply();});apply(true);
 resetConfiguration=()=>{sizes.querySelector('[data-variant="200"]').click();layouts.querySelector('[data-variant="storage-right"]').click();};
}

function inferGroup(object,material){return Object.keys(config.groups).find(key=>targetMaterials(object,key).includes(material.raw))||Object.keys(config.groups).find(key=>config.groups[key].materials.includes(materialName(material.raw))&&config.groups[key].target(object));}
function renderWheel(){const spec=config.groups[wheelGroup],pages=Math.ceil(spec.options.length/8);wheelPage=Math.max(0,Math.min(wheelPage,pages-1));const options=spec.options.slice(wheelPage*8,wheelPage*8+8);ui.wheelOptions.innerHTML='';options.forEach((option,index)=>{const theta=(-90+360*index/options.length)*Math.PI/180,button=document.createElement('button');button.className='wheel-swatch';button.style.setProperty('--x',`${Math.cos(theta)*(ui.wheel.clientWidth/2-34)}px`);button.style.setProperty('--y',`${Math.sin(theta)*(ui.wheel.clientWidth/2-34)}px`);button.style.cssText+=`;${swatch(option)}`;button.dataset.value=option.id;button.title=option.label;ui.wheelOptions.append(button);});document.querySelector('#wheel-title').textContent=spec.label;let selected;wheelObject.traverse(node=>{if(!selected)selected=targetMaterials(node,wheelGroup)[0]?.userData.finishId;});document.querySelector('#wheel-current').textContent=spec.options.find(o=>o.id===selected)?.label||'Mevcut';ui.wheelOptions.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.value===selected));document.querySelector('#wheel-prev').disabled=wheelPage===0;document.querySelector('#wheel-next').disabled=wheelPage===pages-1;ui.wheel.querySelector('.wheel-pages').hidden=pages<2;document.querySelector('#wheel-page').textContent=`${wheelPage+1} / ${pages}`;}
function closeWheel(){ui.wheel.hidden=true;wheelGroup=null;wheelObject=null;}
function openWheel(key,object,x,y){wheelGroup=key;wheelObject=semanticNode(object);wheelPage=0;const box=ui.wheel.parentElement.getBoundingClientRect(),radius=matchMedia('(max-width:500px)').matches?125:147;ui.wheel.style.left=`${Math.max(radius,Math.min(x-box.left,box.width-radius))}px`;ui.wheel.style.top=`${Math.max(radius+25,Math.min(y-box.top,box.height-radius-30))}px`;ui.wheel.hidden=false;renderWheel();}
ui.wheelOptions.addEventListener('click',event=>{const button=event.target.closest('[data-value]');if(!button||!wheelGroup||!wheelObject)return;
 const key=wheelGroup,option=choice(key,button.dataset.value);
 // A finish selected from the model covers the entire named product part,
 // including hidden size variants and the mirrored cabinet.
 state[key]=option.id;updateText();applyGroup(key,option).then(()=>{if(wheelGroup===key)renderWheel();});
});
const wheelHandle=document.querySelector('#wheel-drag');let dragWheel=null;
wheelHandle.addEventListener('pointerdown',event=>{event.preventDefault();wheelHandle.setPointerCapture(event.pointerId);dragWheel={x:event.clientX,y:event.clientY,left:parseFloat(ui.wheel.style.left),top:parseFloat(ui.wheel.style.top)};});
wheelHandle.addEventListener('pointermove',event=>{if(!dragWheel)return;const area=ui.wheel.parentElement.getBoundingClientRect(),radius=ui.wheel.offsetWidth/2;ui.wheel.style.left=`${Math.max(radius,Math.min(area.width-radius,dragWheel.left+event.clientX-dragWheel.x))}px`;ui.wheel.style.top=`${Math.max(radius,Math.min(area.height-radius,dragWheel.top+event.clientY-dragWheel.y))}px`;});
wheelHandle.addEventListener('pointerup',()=>{dragWheel=null;});wheelHandle.addEventListener('pointercancel',()=>{dragWheel=null;});
ui.wheel.querySelector('#wheel-close').addEventListener('click',closeWheel);document.querySelector('#wheel-prev').addEventListener('click',()=>{wheelPage--;renderWheel();});document.querySelector('#wheel-next').addEventListener('click',()=>{wheelPage++;renderWheel();});
viewer.addEventListener('pointerdown',event=>pointerStart={x:event.clientX,y:event.clientY});viewer.addEventListener('pointerup',event=>{if(!pointerStart||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>7)return;const hit=viewer.materialFromPoint(event.clientX,event.clientY);const key=hit&&inferGroup(hit.object,hit);if(key)openWheel(key,hit.object,event.clientX,event.clientY);else closeWheel();});

viewer.addEventListener('load',async()=>{try{isolateMaterials();if(page==='sofa')setupSofa();if(page==='desk')setupDesk();await previewLoads;await Promise.all(Object.keys(config.groups).map(key=>applyGroup(key,choice(key),null,true)));updateText();ui.notice.textContent='';viewerCanvas.style.visibility='visible';document.querySelector('#model-loading').hidden=true;
  // Let the browser paint the lightweight result before requesting PBR maps.
  setTimeout(()=>{Promise.all(Object.keys(config.groups).map(key=>applyGroup(key))).catch(console.error);},200);
}catch(error){console.error(error);ui.notice.textContent='Malzemeler yüklenemedi. Lütfen sayfayı yenileyin.';}});
viewer.addEventListener('error',()=>{ui.notice.textContent='3D model yüklenemedi. Lütfen sayfayı yenileyin.';});viewer.addEventListener('progress',event=>{const bar=viewer.querySelector('.progress'),span=bar?.querySelector('span');if(span)span.style.width=`${event.detail.totalProgress*100}%`;if(bar)bar.hidden=event.detail.totalProgress===1;});
ui.notice.textContent='3D model yükleniyor…';viewer.src=config.file;

const studio={environment:'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/brown_photostudio_02_1k.hdr',shadow:1.35,softness:.72};viewer.environmentImage=studio.environment;viewer.shadowIntensity=studio.shadow;viewer.shadowSoftness=studio.softness;viewer.setRotationSpeed(40);
const activate=(selector,current)=>document.querySelectorAll(selector).forEach(node=>node.classList.toggle('active',node===current));
document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{activate('.tab',button);document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===button.dataset.tab));}));
document.querySelector('[data-action="rotate"]').addEventListener('click',event=>{const on=event.currentTarget.getAttribute('aria-pressed')!=='true';viewer.setAutoRotate(on);event.currentTarget.setAttribute('aria-pressed',on);});document.querySelector('#rotation-speed').addEventListener('input',event=>{viewer.setRotationSpeed(event.target.value);event.target.nextElementSibling.value=`${event.target.value}°/sn`;});
document.querySelectorAll('[data-lighting]').forEach(button=>button.addEventListener('click',()=>{viewer.lightingPreset=button.dataset.lighting;document.querySelectorAll('[data-lighting]').forEach(node=>node.setAttribute('aria-pressed',node===button));}));const lighting=document.querySelector('.lighting-presets');document.querySelector('[data-action="lighting-menu"]').addEventListener('click',()=>lighting.hidden=!lighting.hidden);
document.querySelector('[data-action="fullscreen"]').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():viewer.parentElement.requestFullscreen());document.querySelector('[data-action="reset"]').addEventListener('click',()=>viewer.reframe());document.querySelector('[data-action="zoom-in"]').addEventListener('click',()=>{const o=viewer.getCameraOrbit();viewer.cameraOrbit=`${o.theta}rad ${o.phi}rad ${o.radius*.82}m`;});document.querySelector('[data-action="zoom-out"]').addEventListener('click',()=>{const o=viewer.getCameraOrbit();viewer.cameraOrbit=`${o.theta}rad ${o.phi}rad ${o.radius*1.22}m`;});document.querySelector('[data-action="pan-left"]').addEventListener('click',()=>viewer.panView(-1));document.querySelector('[data-action="pan-right"]').addEventListener('click',()=>viewer.panView(1));document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const views={front:'0deg 75deg auto',side:'90deg 75deg auto',top:'0deg 10deg auto'};viewer.cameraOrbit=views[button.dataset.view];activate('[data-view]',button);}));
document.querySelector('[data-action="snapshot"]').addEventListener('click',()=>{const link=document.createElement('a');link.href=viewer.toDataURL();link.download=config.download.replace('.glb','.png');link.click();});document.querySelector('[data-action="snapshot-4k"]').addEventListener('click',()=>{const link=document.createElement('a');link.href=viewer.to4KDataURL();link.download=config.download.replace('.glb','_4K.png');link.click();});document.querySelector('[data-action="dimensions"]').addEventListener('click',event=>{const box=document.querySelector('#dimensions-overlay');box.hidden=!box.hidden;updateDimensions();event.currentTarget.setAttribute('aria-pressed',!box.hidden);});
const resetModal=document.querySelector('#reset-modal'),sourceModal=document.querySelector('#source-modal');
document.querySelector('#reset-materials').addEventListener('click',()=>resetModal.hidden=false);
document.querySelector('#cancel-reset').addEventListener('click',()=>resetModal.hidden=true);
document.querySelector('#confirm-reset').addEventListener('click',async()=>{resetModal.hidden=true;resetConfiguration();for(const [key,spec] of Object.entries(config.groups)){state[key]=spec.initial;await applyGroup(key);}updateText();closeWheel();});
document.querySelector('#source-download').addEventListener('click',()=>sourceModal.hidden=false);
document.querySelector('[data-close-source]').addEventListener('click',()=>sourceModal.hidden=true);
document.querySelector('#source-form').addEventListener('submit',event=>{event.preventDefault();document.querySelector('#source-downloads').hidden=false;document.querySelector('#source-status').textContent='';});
document.querySelectorAll('[data-source-format]').forEach(button=>button.addEventListener('click',()=>{const format=button.dataset.sourceFormat;const path=`${page}/files/${format}/${config.download.replace(/\.glb$/i,format==='max'?'.max':`.${format}`)}`;fetch(`../${path}`,{method:'HEAD'}).then(response=>{if(!response.ok)throw new Error('missing');const link=document.createElement('a');link.href=`../${path}`;link.download='';link.click();document.querySelector('#source-status').textContent='';}).catch(()=>document.querySelector('#source-status').textContent=`${button.textContent.replace(' İndir','')} dosyası henüz hazır değil.`);}));
async function makeProductSheet(){
  await document.fonts.load('700 42px Alexandria');
  await document.fonts.load('400 24px Alexandria');
  await document.fonts.load('600 23px Alexandria');
  const image=new Image();image.src=viewer.toDataURL();await image.decode();
  const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);
  ctx.fillStyle='#0f1b2d';ctx.fillRect(0,0,1240,148);
  ctx.fillStyle='#fff';ctx.font='700 52px Alexandria';ctx.fillText('VREEL',82,93);
  ctx.fillStyle='#dbbc88';ctx.font='600 23px Alexandria';ctx.fillText('ETKİLEŞİMLİ TASARIM',312,91);
  ctx.fillStyle='#b68a4c';ctx.fillRect(82,183,62,4);
  ctx.fillStyle='#0f1b2d';ctx.font='700 43px Alexandria';ctx.fillText(config.title,82,270);
  ctx.fillStyle='#697383';ctx.font='400 23px Alexandria';ctx.fillText('ÜRÜN TEKNİK FÖYÜ',82,311);
  ctx.fillStyle='#f3f5f6';ctx.fillRect(82,356,1076,665);
  // Crop excess viewer background while preserving the entire object in the central frame.
  const cropWidth=image.width*.86,cropHeight=image.height*.86;
  const scale=Math.min(1030/cropWidth,620/cropHeight);
  const width=cropWidth*scale,height=cropHeight*scale;
  ctx.drawImage(image,(image.width-cropWidth)/2,(image.height-cropHeight)/2,cropWidth,cropHeight,82+(1076-width)/2,356+(665-height)/2,width,height);
  ctx.fillStyle='#b68a4c';ctx.fillRect(82,1087,1076,3);
  ctx.fillStyle='#0f1b2d';ctx.font='700 29px Alexandria';ctx.fillText('Seçilen Malzemeler',82,1150);
  const rows=Object.entries(config.groups).map(([key,spec])=>[spec.label,choice(key).label]);
  rows.forEach(([name,value],index)=>{
    const y=1210+index*70;
    ctx.fillStyle='#697383';ctx.font='400 21px Alexandria';ctx.fillText(name,82,y,435);
    ctx.fillStyle='#0f1b2d';ctx.font='600 21px Alexandria';ctx.fillText(value,505,y,645);
    ctx.fillStyle='#e2e5e9';ctx.fillRect(82,y+21,1076,2);
  });
  ctx.fillStyle='#697383';ctx.font='400 19px Alexandria';
  ctx.fillText(`Oluşturma tarihi: ${new Date().toLocaleDateString('tr-TR')}`,82,1669);
  ctx.textAlign='right';ctx.fillText('VREEL tarafından geliştirilen etkileşimli ürün deneyimi',1158,1669);
  const preview=canvas.toDataURL('image/jpeg',.94);
  const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  pdf.addImage(preview,'JPEG',0,0,210,297,undefined,'FAST');
  return {pdf,preview};
}
document.querySelector('#datasheet').addEventListener('click',async()=>{
  const button=document.querySelector('#datasheet');button.disabled=true;
  try{
    const {pdf,preview}=await makeProductSheet();pdfDocument=pdf;
    const img=document.createElement('img');img.src=preview;img.alt='Ürün teknik föyü önizlemesi';
    document.querySelector('#pdf-preview').replaceChildren(img);
    document.querySelector('#pdf-modal').hidden=false;
  }catch(error){console.error(error);ui.notice.textContent='PDF teknik föyü oluşturulamadı.';}
  finally{button.disabled=false;}
});
document.querySelector('#download-pdf').addEventListener('click',()=>pdfDocument?.save(config.download.replace('.glb','.pdf')));
document.querySelector('#pdf-modal .modal-close').addEventListener('click',()=>document.querySelector('#pdf-modal').hidden=true);
document.querySelector('#add').addEventListener('click',()=>document.querySelector('#order-modal').hidden=false);
document.querySelector('[data-close-order]').addEventListener('click',()=>document.querySelector('#order-modal').hidden=true);
document.querySelector('#order-form').addEventListener('submit',event=>{event.preventDefault();document.querySelector('#order-status').textContent='Talep gönderilmedi: sipariş alıcısı henüz bağlı değil.';});
buildMaterials();

function updateDimensions(){
  const overlay=document.querySelector('#dimensions-overlay'),visible=!overlay.hidden;
  const guides=visible?viewer.getMeasurementGuides():null;
  viewer.setDimensionsVisible(visible&&!guides?.length);
  if(!guides?.length){overlay.replaceChildren();return;}
  if(matchMedia('(max-width:600px)').matches){
    const card=document.createElement('div');card.className='mobile-measurements';
    for(const [part,title] of [['desk','Masa'],['cabinet','Keson'],['product',page==='chair'?'Koltuk':'Kanepe']]){
      const partGuides=guides.filter(guide=>guide.part===part);
      if(!partGuides.length)continue;
      const row=document.createElement('div');row.className='mobile-measurements-row';
      const heading=document.createElement('strong');heading.textContent=title;row.append(heading);
      for(const guide of partGuides){const value=document.createElement('span');value.textContent=guide.label;row.append(value);}
      card.append(row);
    }
    overlay.replaceChildren(card);return;
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox',`0 0 ${viewer.clientWidth} ${viewer.clientHeight}`);
  for(const guide of guides){
    const {start,end,offset}=guide;
    const x1=start.x+offset.x,y1=start.y+offset.y,x2=end.x+offset.x,y2=end.y+offset.y;
    const shortWitness=(sourceX,sourceY,lineX,lineY)=>{const dx=sourceX-lineX,dy=sourceY-lineY,length=Math.hypot(dx,dy);return length?[lineX,lineY,lineX+dx*Math.min(12,length)/length,lineY+dy*Math.min(12,length)/length]:[lineX,lineY,lineX,lineY];};
    for(const [a,b,c,d,kind] of [[x1,y1,x2,y2,'measure-main'],[...shortWitness(start.x,start.y,x1,y1),'measure-witness'],[...shortWitness(end.x,end.y,x2,y2),'measure-witness']]){
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',a);line.setAttribute('y1',b);line.setAttribute('x2',c);line.setAttribute('y2',d);line.setAttribute('class',kind);svg.append(line);
    }
  }
  overlay.replaceChildren(svg);
  for(const guide of guides){const label=document.createElement('span');label.textContent=guide.label;label.style.left=`${(guide.start.x+guide.end.x)/2+guide.offset.x}px`;label.style.top=`${(guide.start.y+guide.end.y)/2+guide.offset.y}px`;overlay.append(label);}
}
setInterval(updateDimensions,250);
