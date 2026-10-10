// A portable snapshot preserves labels, order, defaults and binary files verbatim.
const FORMAT = 'vreel-product-package';
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
function base64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}
export async function exportProductPackage(record) {
  if (!record?.draft?.model?.blob) throw new Error('Önce model içeren bir taslak açın.');
  const files = new Map();
  async function encode(value) {
    if (value instanceof Blob) {
      const bytes = new Uint8Array(await value.arrayBuffer());
      const sha256 = await digest(bytes);
      if (!files.has(sha256)) files.set(sha256, { sha256, size: bytes.length, data: base64(bytes) });
      return { $blob: sha256, type: value.type };
    }
    if (Array.isArray(value)) return Promise.all(value.map(encode));
    if (value && typeof value === 'object') {
      const entries = [];
      for (const [key, item] of Object.entries(value)) entries.push([key, await encode(item)]);
      return Object.fromEntries(entries);
    }
    return value;
  }
  const snapshot = await encode(record);
  return { format: FORMAT, version: 1, record: snapshot, files: [...files.values()] };
}
export async function importProductPackage(packageData) {
  if (packageData?.format !== FORMAT || packageData.version !== 1 || !Array.isArray(packageData.files) || !packageData.record?.draft) throw new Error('Geçerli bir VREEL ürün paketi seçin.');
  const files = new Map();
  for (const file of packageData.files) {
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.data !== 'string' || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 500 * 1024 * 1024) throw new Error('Paket dosya bilgisi geçersiz.');
    const raw = atob(file.data), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    if (bytes.length !== file.size || await digest(bytes) !== file.sha256) throw new Error('Paket dosyası eksik veya değiştirilmiş.');
    files.set(file.sha256, bytes);
  }
  function decode(value) {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === 'object') {
      if (Object.hasOwn(value, '$blob')) {
        if (!files.has(value.$blob)) throw new Error('Pakette bir dosya eksik.');
        return new Blob([files.get(value.$blob)], { type: value.type || '' });
      }
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
    }
    return value;
  }
  const record = decode(packageData.record);
  if (!(record.draft.model?.blob instanceof Blob) || typeof record.draft.name !== 'string') throw new Error('Pakette ürün modeli bulunamadı.');
  return record;
}
