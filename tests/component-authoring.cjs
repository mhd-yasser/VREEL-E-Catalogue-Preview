const {chromium}=require('playwright');
const assert=require('node:assert/strict');
// Embedded geometry avoids depending on a customer's GLB or proprietary assets.
function fixture(external=false){
  const bin=Buffer.alloc(36);[-.5,0,0,.5,0,0,0,1,.5].forEach((v,i)=>bin.writeFloatLE(v,i*4));
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:external?[0]:[0,2,4]}],
    nodes:external?[{name:'External',mesh:0,translation:[100,0,0]}]:[{name:'P_100',children:[1]},{name:'Body',mesh:0},{name:'P_65',children:[3]},{name:'Body',mesh:0,scale:[.65,1,1]},{name:'P_Tall',mesh:0,translation:[2,0,0]}],
    meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{name:'Wood',doubleSided:true}],
    buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-.5,0,0],max:[.5,1,.5]}]};
  let data=Buffer.from(JSON.stringify(json));data=Buffer.concat([data,Buffer.alloc((4-data.length%4)%4,32)]);
  const buffer=Buffer.alloc(28+data.length+bin.length);buffer.writeUInt32LE(0x46546c67,0);buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(data.length,12);buffer.writeUInt32LE(0x4e4f534a,16);data.copy(buffer,20);buffer.writeUInt32LE(bin.length,20+data.length);buffer.writeUInt32LE(0x004e4942,24+data.length);bin.copy(buffer,28+data.length);return buffer;
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/admin/');await page.locator('#name').fill('Component test');await page.locator('#dimensions').check();
  await page.locator('#model-file').setInputFiles({name:'components.glb',mimeType:'model/gltf-binary',buffer:fixture()});
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Model hazır'));
  await page.locator('#next').click();assert.equal(await page.locator('#step-label').textContent(),'ADIM 02 / 04');
  await page.locator('#add-component-group').click();await page.locator('#component-group-name').fill('Cabinet size');
  const check=page.locator('#component-nodes input');assert.equal(await check.count(),3);await check.nth(0).check();await check.nth(1).check();
  await page.locator('#component-options input[aria-label="Alternatif adı"]').nth(0).fill('100 cm');
  await page.locator('#component-options input[aria-label="Alternatif adı"]').nth(1).fill('65 cm');await page.locator('#component-options input[type=radio]').nth(1).check();
  await page.locator('#component-reference').selectOption('node-0');
  await page.locator('#component-file').setInputFiles({name:'85.glb',mimeType:'model/gltf-binary',buffer:fixture(true)});
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Alternatif eklendi'));
  await page.locator('#component-options input[aria-label="Alternatif adı"]').nth(2).fill('85 cm');
  await page.locator('#next').click();assert.equal(await page.locator('#step-label').textContent(),'ADIM 03 / 04');
  await page.locator('#add-group').click();await page.locator('#group-name').fill('Finish');
  const targets=page.locator('#targets input');assert.equal(await targets.count(),4);for(let i=0;i<4;i++)await targets.nth(i).check();await page.locator('#add-option').click();
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#state').textContent==='Taslak kaydedildi');const id=await page.locator('#drafts').inputValue();
  await page.locator('#next').click();assert((await page.locator('#checks').textContent()).includes('tamam'));await page.locator('#reviewed').check();await page.locator('#publish').click();await page.locator('#public-link').waitFor({state:'visible'});
  await page.goto(`http://127.0.0.1:8000/product/?view=${id}`);await page.locator('#model-loading').waitFor({state:'hidden',timeout:30000});
  const cards=page.locator('.option-card').filter({hasText:'Cabinet size'});assert((await cards.textContent()).includes('65 cm'));await cards.locator('[data-variant]').filter({hasText:'85 cm'}).click();
  const visible=await page.evaluate(()=>{const names=[];document.querySelector('#product-viewer').model.root.traverseVisible(n=>{if(n.isMesh)names.push(n.name);});return names;});assert(visible.includes('External'));assert(!visible.includes('Body'));assert(visible.includes('P_Tall'));
  await page.reload();await page.locator('#model-loading').waitFor({state:'hidden',timeout:30000});assert.equal(await page.locator('[data-variant].active').textContent(),'65 cm');
  assert.deepEqual(errors,[]);await browser.close();console.log('PASS: four-step authoring, P_ options/default labels, external GLB and material mapping, local publication/reload and public selection.');
})().catch(e=>{console.error(e);process.exit(1);});
