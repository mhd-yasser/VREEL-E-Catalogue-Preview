import { listProducts } from "../admin/store.js";
// Local publications are deliberately separate from the deployed catalogue.
try {
  const records = (await listProducts()).filter((p) => p.published);
  if (records.length) {
    const section = document.createElement("section");
    section.className = "collection container";
    section.id = "local-publications";
    const heading = document.createElement("h2");
    heading.textContent = "Yerel yayınlar";
    const note = document.createElement("p");
    note.textContent =
      "Yalnızca bu tarayıcıda görünür. Genel kataloğa yayınlanmamıştır.";
    const grid = document.createElement("div");
    grid.className = "product-grid";
    for (const record of records) {
      const product = record.published,
        card = document.createElement("article");
      card.className = "product-card";
      const body = document.createElement("div");
      body.className = "card-body";
      const name = document.createElement("h3");
      name.textContent = product.name;
      const info = document.createElement("p");
      info.textContent = [product.code, product.category]
        .filter(Boolean)
        .join(" · ");
      const link = document.createElement("a");
      link.className = "card-link";
      link.href = `../admin/?view=${encodeURIComponent(record.id)}`;
      link.textContent = "Yerel ziyaretçi görünümü ↗";
      const edit = document.createElement("a");
      edit.className = "card-link";
      edit.href = "../manage/";
      edit.textContent = "Ürün yönetimi →";
      body.append(name, info, link, edit);
      card.append(body);
      grid.append(card);
    }
    section.append(heading, note, grid);
    document.querySelector("main").append(section);
  }
} catch (error) {
  console.warn("Yerel yayınlar okunamadı:", error.message);
}
