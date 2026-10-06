const filters = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.product-card')];
const search = document.querySelector('#search');
const empty = document.querySelector('#empty-state');
let selected = 'all';

function refresh() {
  const term = search.value.trim().toLocaleLowerCase('tr-TR');
  let visible = 0;
  for (const card of cards) {
    const matchesFilter = selected === 'all' || card.dataset.status === selected;
    const matchesSearch = !term || card.dataset.search.toLocaleLowerCase('tr-TR').includes(term) ||
      card.querySelector('h3').textContent.toLocaleLowerCase('tr-TR').includes(term);
    card.hidden = !(matchesFilter && matchesSearch);
    if (!card.hidden) visible++;
  }
  empty.hidden = visible !== 0;
}

filters.forEach(button => button.addEventListener('click', () => {
  selected = button.dataset.filter;
  filters.forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  refresh();
}));
search.addEventListener('input', refresh);

document.querySelector('#add-product')?.addEventListener('click', () => {
  location.href = '../admin/';
});
