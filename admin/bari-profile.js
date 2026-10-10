export const bariProfile = {
  brand: 'ORKA',
  name: 'BARI',
  category: 'Banyo mobilyası',
  source: 'https://www.orkabanyo.com/tr/orka-koleksiyonlar/bari',
  description: 'ORKA Tasarım Ekibi tarafından geliştirilen BARI, yalın çizgileri ve geniş depolama alanlarıyla modern banyolar için tasarlanmış bir mobilya koleksiyonudur. TherMold MDF gövde ve çekmeceler, sessiz kapanan kapak ve çekmeceler ile hijyen serisi seramik lavabo koleksiyonun temel özellikleridir. Seri, 65, 85 ve 100 cm banyo dolabı seçenekleri sunar. Ayna ve depolama alternatiflerini 3D görünümde inceleyebilir, mevcut yüzey seçeneklerini karşılaştırabilirsiniz.',
};
export function addBariProfile(draft) {
  if (!/^BARI(?:\b|_)/i.test(draft.model?.name || '') && !/^BARI(?:\b|_)/i.test(draft.name || '')) return false;
  let changed = false;
  for (const [key, value] of Object.entries({brand:bariProfile.brand,name:bariProfile.name,category:bariProfile.category,description:bariProfile.description,productSource:bariProfile.source})) {
    if (!draft[key]?.trim()) { draft[key] = value; changed = true; }
  }
  return changed;
}
