import {fileLabel} from './file-labels.js';

// Reuse the existing contact modal for every product, including authored ones.
// This demo validates the form locally; it does not transmit or retain contacts.
export function bindSourceDownloads({config,page,downloadCurrent,root=document,fetchFile=fetch,isReady=()=>true}){
  const get=s=>root.querySelector(s),modal=get('#source-modal'),form=get('#source-form');
  const downloads=get('#source-downloads'),status=get('#source-status'),actions=downloads.querySelector('.source-actions');
  let confirmed=false;
  const permitted=()=>confirmed&&!modal.hidden&&form.reportValidity();
  const close=()=>{confirmed=false;downloads.hidden=true;modal.hidden=true;};
  get('#source-download').addEventListener('click',()=>{
    if(!isReady())return;confirmed=false;downloads.hidden=true;status.textContent='';modal.hidden=false;
    form.querySelector('[name="person"]')?.focus();
  });
  get('[data-close-source]').addEventListener('click',close);
  form.addEventListener('submit',event=>{
    event.preventDefault();for(const input of form.querySelectorAll('input'))if(input.type!=='file')input.value=input.value.trim();if(!form.reportValidity())return;
    confirmed=true;downloads.hidden=false;status.textContent='';
  });
  form.addEventListener('input',()=>{confirmed=false;downloads.hidden=true;});
  async function run(button,download){
    if(!permitted())return;button.disabled=true;status.textContent='';
    try{await download();}catch(error){status.textContent=fileLabel(error.message)||'3D File indirilemedi.';}
    finally{button.disabled=false;}
  }
  if(config.draft)actions.replaceChildren();
  const current=root.createElement('button');current.type='button';current.textContent='3D File İndir';
  current.addEventListener('click',()=>run(current,downloadCurrent));actions.prepend(current);
  for(const file of config.sourceFiles||[]){
    const button=root.createElement('button');button.type='button';button.textContent=fileLabel(file.name)+' İndir';
    button.addEventListener('click',()=>run(button,()=>{
      const link=root.createElement('a');link.href=file.href();link.download=file.name;link.click();
    }));actions.append(button);
  }
  for(const button of actions.querySelectorAll('[data-source-format]')){
    button.addEventListener('click',()=>run(button,async()=>{
      const format=button.dataset.sourceFormat;
      const filename=config.download.replace(/\.glb$/i,format==='max'?'.max':`.${format}`);
      const href=`../${page}/files/${format}/${filename}`;
      if(!(await fetchFile(href,{method:'HEAD'})).ok)throw new Error(`${button.textContent.replace(' İndir','')} dosyası henüz hazır değil.`);
      const link=root.createElement('a');link.href=href;link.download='';link.click();
    }));
  }
  return {close};
}
