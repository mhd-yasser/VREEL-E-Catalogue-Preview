import { listProducts } from '../admin/store.js';
const records = document.querySelector('#records');
const notice = document.querySelector('#notice');
const search = document.querySelector('#search');
const status = document.querySelector('#status');
let products = [];
function row(name, detail, links, category = '—', published = false, image = null) {
  const article = document.createElement('article'); article.className = 'product-row';
  const cell = document.createElement('div'); cell.className = 'product-cell';
  if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; cell.append(img); }
  else { const icon = document.createElement('span'); icon.className = 'product-symbol'; icon.textContent = '◇'; icon.setAttribute('aria-hidden', 'true'); cell.append(icon); }
  const info = document.createElement('div'); info.className = 'info';
  const title = document.createElement('h3'); title.textContent = name;
  const text = document.createElement('small'); text.textContent = detail;
  info.append(title, text); cell.append(info);
  const cat = document.createElement('span'); cat.className = 'category-cell'; cat.textContent = category || '—';
  const state = document.createElement('div');
  const badge = document.createElement('span'); badge.className = 'status-pill' + (published ? ' published' : ''); badge.textContent = published ? 'Yerel yayın' : 'Taslak'; state.append(badge);
  const actions = document.createElement('div'); actions.className = 'links';
  for (const [label, href] of links) { const link = document.createElement('a'); link.textContent = label; link.href = href; actions.append(link); }
  article.append(cell, cat, state, actions); return article;
}
function render() {
  records.replaceChildren();
  const term = search.value.trim().toLocaleLowerCase('tr-TR');
  for (const p of products) {
    const d = p.draft;
    if (status.value === 'draft' && p.published || status.value === 'published' && !p.published) continue;
    if (term && ![d.name, d.code, d.category].join(' ').toLocaleLowerCase('tr-TR').includes(term)) continue;
    const links = [['Taslağı düzenle →', `../admin/?edit=${encodeURIComponent(p.id)}`]];
    if (p.published) links.push(['Yerel ürünü görüntüle ↗', `../product/?view=${encodeURIComponent(p.id)}`]);
    records.append(row(d.name || 'İsimsiz ürün', [d.code, d.category, p.published ? 'Yerel yayın · düzenlenebilir taslak' : 'Taslak'].filter(Boolean).join(' · '), links, d.category, Boolean(p.published)));
  }
  notice.textContent = records.childElementCount ? `${records.childElementCount} ürün` : products.length ? 'Aramaya uygun ürün bulunamadı.' : 'Henüz ürün yok. “Yeni ürün ekle” ile başlayın.';
}
for (const [name, path, category] of [['Axis Executive Desk','desk','Ofis'],['Aura Yönetici Koltuğu','chair','Oturma'],['Lounge Duo','sofa','Oturma']]) { const item = row(name, 'Mevcut demo', [['3D deneyimi aç ↗', `../${path}/`]], category, true, `../products/assets/product-${path}-transparent.webp`); item.querySelector('.status-pill').textContent = 'Demo'; document.querySelector('#demos').append(item); }
search.addEventListener('input', render); status.addEventListener('change', render);
try { products = await listProducts(); render(); } catch (e) { notice.textContent = 'Yerel ürünler okunamadı. Tarayıcı depolama izinlerini kontrol edin.'; notice.classList.add('error'); }

