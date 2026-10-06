const database = new Promise((resolve, reject) => {
  const request = indexedDB.open("vreel-authoring", 1);
  request.onupgradeneeded = () =>
    request.result.createObjectStore("products", { keyPath: "id" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function saveProduct(product) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readwrite");
    tx.objectStore("products").put(product);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Kayıt iptal edildi."));
  });
}
export async function listProducts() {
  const db = await database;
  return new Promise((resolve, reject) => {
    const request = db.transaction("products").objectStore("products").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function getProduct(id) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const request = db.transaction("products").objectStore("products").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export function newDraft() {
  return {
    name: "",
    code: "",
    category: "",
    description: "",
    unit: "mm",
    width: "",
    depth: "",
    height: "",
    email: "",
    features: {
      configurable: false,
      dimensions: false,
      downloads: false,
      contact: false,
    },
    model: null,
    assets: [],
    groups: [],
  };
}
export function validation(draft, targetIds = []) {
  const errors = [];
  if (!draft.name.trim()) errors.push("Ürün adı gerekli.");
  if (!draft.model)
    errors.push("Yüklenmiş ve kontrol edilmiş bir GLB gerekli.");
  if (
    draft.features.downloads &&
    !draft.assets.some((a) => a.kind === "attachments" && a.public)
  )
    errors.push("Ziyaretçiye açık bir indirilebilir dosya gerekli.");
  if (draft.features.contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))
    errors.push("Geçerli iletişim e-postası gerekli.");
  if (draft.features.configurable) {
    if (!draft.groups.length)
      errors.push("En az bir özelleştirme grubu gerekli.");
    const used = new Set();
    for (const g of draft.groups) {
      if (!g.name.trim() || !g.targets.length)
        errors.push("Her grup için bir ad ve bağlı hedef gerekli.");
      if (g.options.length < 2)
        errors.push(`${g.name || "Grup"}: en az bir alternatif gerekli.`);
      if (!g.options.some((o) => o.id === g.defaultId))
        errors.push(`${g.name}: varsayılan seçenek gerekli.`);
      for (const t of g.targets) {
        if (!targetIds.includes(t))
          errors.push(`${g.name}: modelde bulunamayan hedef.`);
        if (used.has(t))
          errors.push("Bir hedef birden fazla gruba bağlanamaz.");
        used.add(t);
      }
      for (const o of g.options) {
        if (!o.label.trim()) errors.push(`${g.name}: seçenek adı gerekli.`);
        if (
          o.assetId &&
          !draft.assets.some((a) => a.id === o.assetId && a.kind === "textures")
        )
          errors.push(`${g.name}: eksik malzeme görseli.`);
      }
    }
  }
  return [...new Set(errors)];
}
export function inspectGLB(buffer) {
  const v = new DataView(buffer);
  if (
    buffer.byteLength < 20 ||
    v.getUint32(0, true) !== 0x46546c67 ||
    v.getUint32(4, true) !== 2 ||
    v.getUint32(8, true) !== buffer.byteLength
  )
    throw new Error("Geçerli bir GLB 2.0 dosyası seçin.");
  const length = v.getUint32(12, true);
  if (v.getUint32(16, true) !== 0x4e4f534a || 20 + length > buffer.byteLength)
    throw new Error("GLB JSON bölümü geçersiz.");
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, length)).trim(),
  );
  if (
    [...(json.buffers || []), ...(json.images || [])].some(
      (x) => x.uri && !x.uri.startsWith("data:"),
    )
  )
    throw new Error(
      "Model dış dosyalara bağlı. Dokuları GLB içine gömerek yeniden dışa aktarın.",
    );
  return json;
}

