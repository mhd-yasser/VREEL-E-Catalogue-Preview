import { listProducts } from '../admin/store.js';
const records = document.querySelector('#records');
const notice = document.querySelector('#notice');
const search = document.querySelector('#search');
const status = document.querySelector('#status');
let products = [];
function row(name, detail, links) {
  const article = document.createElement('article'); article.className = 'product-row';
  const info = document.createElement('div'); info.className = 'info';
  const title = document.createElement('h3'); title.textContent = name;
  const text = document.createElement('small'); text.textContent = detail;
  info.append(title, text);
  const actions = document.createElement('div'); actions.className = 'links';
  for (const [label, href] of links) { const a = document.createElement('a'); a.textContent = label; a.href = href; actions.append(a); }
  article.append(info, actions); return article;
}
function render() {
  records.replaceChildren();
  const term = search.value.trim().toLocaleLowerCase('tr-TR');
  for (const p of products) {
    const d = p.draft;
    if (status.value === 'draft' && p.published || status.value === 'published' && !p.published) continue;
    if (term && ![d.name, d.code, d.category].join(' ').toLocaleLowerCase('tr-TR').includes(term)) continue;
    const links = [['Taslağı düzenle →', `../admin/?edit=${encodeURIComponent(p.id)}`]];
    if (p.published) links.push(['Yerel ürünü görüntüle ↗', `../admin/?view=${encodeURIComponent(p.id)}`]);
    records.append(row(d.name || 'İsimsiz ürün', [d.code, d.category, p.published ? 'Yerel yayın · düzenlenebilir taslak' : 'Taslak'].filter(Boolean).join(' · '), links));
  }
  notice.textContent = records.childElementCount ? `${records.childElementCount} ürün` : products.length ? 'Aramaya uygun ürün bulunamadı.' : 'Henüz ürün yok. “Yeni ürün ekle” ile başlayın.';
}
for (const [name, path] of [['Axis Executive Desk','desk'],['Aura Yönetici Koltuğu','chair'],['Lounge Duo','sofa']]) document.querySelector('#demos').append(row(name, 'Yayınlanan demo · mevcut görüntüleyici', [['3D deneyimi aç ↗', `../${path}/`]]));
search.addEventListener('input', render); status.addEventListener('change', render);
try { products = await listProducts(); render(); } catch (e) { notice.textContent = 'Yerel ürünler okunamadı. Tarayıcı depolama izinlerini kontrol edin.'; notice.classList.add('error'); }
