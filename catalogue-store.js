const root=new URL('./',import.meta.url);
export async function loadCatalogueProduct(id,hydrate=false){
 const manifest=await fetch(new URL('catalogue/index.json',root)).then(r=>{if(!r.ok)throw new Error('Katalog yüklenemedi.');return r.json();});
 const entry=manifest.find(p=>p.id===id);if(!entry)throw new Error('Ürün katalogda bulunamadı.');
 const record=await fetch(new URL(entry.config,root)).then(r=>{if(!r.ok)throw new Error('Ürün yüklenemedi.');return r.json();});
 if(hydrate){async function decode(value){if(Array.isArray(value))return Promise.all(value.map(decode));if(value&&typeof value==='object'){if(value.url){const response=await fetch(new URL(value.url,root));if(!response.ok)throw new Error('Ürün dosyası yüklenemedi.');const blob=await response.blob();if(value.sha256){const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==value.sha256)throw new Error('Ürün dosyası doğrulanamadı.');}const copy={...value,blob};delete copy.url;return copy;}return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,item])=>[key,await decode(item)])));}return value;}
 record.draft=await decode(record.draft);if(record.published)record.published=await decode(record.published);}
 return record;
}
