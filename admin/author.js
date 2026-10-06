import * as THREE from "three";
import { createViewer } from "../three-viewer.js?v=20261006-2";
import {
  saveProduct,
  listProducts,
  getProduct,
  newDraft,
  validation,
  inspectGLB,
} from "./store.js";
const $ = (id) => document.getElementById(id),
  uid = () => crypto.randomUUID();
const fieldIds = [
  "name",
  "code",
  "category",
  "description",
  "unit",
  "width",
  "depth",
  "height",
  "email",
];
const featureIds = ["configurable", "dimensions", "downloads", "contact"];
const parameters = new URLSearchParams(location.search);
const viewId = parameters.get("view"),
  editId = parameters.get("edit");
let record = { id: uid(), draft: newDraft(), published: null },
  draft = record.draft,
  step = 1,
  activeGroup = null,
  targets = [],
  viewer = null,
  loading = false,
  loaded = false,
  highlighted = [],
  dirty = false;
const urls = new Map(),
  textures = new Map(),
  previewSelection = new Map();
const derivedMaps = new Map();
function releaseDerivedMaps() {
  for (const map of derivedMaps.values()) map.dispose();
  derivedMaps.clear();
}
function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
}
function changed() {
  dirty = true;
  $("state").textContent = "Kaydedilmedi";
  $("reviewed").checked = false;
  $("public-link").hidden = true;
}
function assetUrl(asset) {
  if (!urls.has(asset.id)) urls.set(asset.id, URL.createObjectURL(asset.blob));
  return urls.get(asset.id);
}
function cleanup() {
  clearHighlight();
  releaseDerivedMaps();
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  for (const texture of textures.values()) texture.dispose();
  textures.clear();
  previewSelection.clear();
}
function readFields() {
  for (const id of fieldIds) draft[id] = $(id).value;
  for (const id of featureIds) draft.features[id] = $(id).checked;
}
function fillFields() {
  for (const id of fieldIds) $(id).value = draft[id];
  for (const id of featureIds) $(id).checked = draft.features[id];
  $("model-status").textContent = draft.model
    ? `${draft.model.name} · ${(draft.model.blob.size / 1048576).toFixed(2)} MB`
    : "Henüz model seçilmedi.";
}
function group() {
  return draft.groups.find((g) => g.id === activeGroup);
}
function button(text, handler) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.onclick = handler;
  return b;
}
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function initViewer() {
  if (viewer) return;
  viewer = createViewer($("viewer"));
  viewer.lightingPreset = "studio";
  let down = null;
  viewer.addEventListener(
    "pointerdown",
    (e) => (down = [e.clientX, e.clientY]),
  );
  viewer.addEventListener("pointerup", (e) => {
    if (
      !down ||
      Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 ||
      step !== 2
    )
      return;
    const pick = viewer.materialFromPoint(e.clientX, e.clientY);
    if (!pick) return;
    const target = targets.find((t) => t.material === pick.raw);
    if (!target) return;
    highlight([target.id]);
    notice(
      `${target.label} seçildi. Gruba bağlamak için aşağıdan işaretleyin.`,
    );
    const row = $("targets").querySelector(`[data-target="${target.id}"]`);
    row?.scrollIntoView({ block: "nearest" });
  });
}
async function loadModel(model, applyConfig = true) {
  initViewer();
  loading = true;
  loaded = false;
  $("next").disabled = true;
  $("model-file").disabled = true;
  $("example").disabled = true;
  try {
    inspectGLB(await model.blob.arrayBuffer());
    await new Promise((resolve, reject) => {
      const onLoad = () => {
          clear();
          resolve();
        },
        onError = () => {
          clear();
          reject(
            new Error(
              "Model yüklenemedi. Dosya ve gerekli sıkıştırma uzantılarını kontrol edin.",
            ),
          );
        },
        clear = () => {
          viewer.removeEventListener("load", onLoad);
          viewer.removeEventListener("error", onError);
        };
      viewer.addEventListener("load", onLoad);
      viewer.addEventListener("error", onError);
      viewer.src = assetUrl(model);
    });
    clearHighlight();
    targets = [];
    let meshIndex = 0;
    viewer.model.root.traverse((node) => {
      if (!node.isMesh) return;
      const index = meshIndex++;
      const original = [node.material].flat();
      const clones = original.map((m, slot) => {
        const material = m.clone();
        const id = `mesh-${index}-slot-${slot}`;
        targets.push({
          id,
          node,
          slot,
          material,
          original: material.clone(),
          label: `${node.userData.sourceName || node.name || "Parça " + (index + 1)} · ${m.name || "Malzeme " + (slot + 1)}`,
          uv: !!node.geometry.attributes.uv,
        });
        return material;
      });
      node.material = Array.isArray(node.material) ? clones : clones[0];
    });
    loaded = true;
    renderDimensionTargets();
    if (applyConfig) await applyAll();
    return true;
  } finally {
    loading = false;
    $("next").disabled = false;
    $("model-file").disabled = false;
    $("example").disabled = false;
  }
}
function renderDimensionTargets() {
  let host = $("dimension-targets");
  if (!host) {host=element("div");host.id="dimension-targets";$("viewer-column").append(host);}
  host.replaceChildren();
  const details=element("details"),summary=element("summary","Ölçülere dahil edilecek parçalar"),list=element("div");list.className="dimension-parts";
  details.append(summary,element("p","Seçim boşsa modelin tamamı kullanılır. Birden fazla ürün içeren modellerde yalnızca ilgili ürünü seçin."),list);host.append(details);
  const seen=new Set();
  for(const t of targets){const id=t.id.split("-slot-")[0];if(seen.has(id))continue;seen.add(id);
    const label=element("label"),check=element("input");check.type="checkbox";check.checked=(draft.dimensionTargets||[]).includes(id);
    check.onchange=()=>{draft.dimensionTargets=check.checked?[...(draft.dimensionTargets||[]),id]:(draft.dimensionTargets||[]).filter(x=>x!==id);viewer.measurementTargets=draft.dimensionTargets;renderInfo();changed();};
    label.append(check,element("span",t.node.userData.sourceName||t.node.name||id));list.append(label);
  }
  viewer.measurementTargets=draft.dimensionTargets||[];
}
function clearHighlight() {
  for (const h of highlighted) {
    if (h.target.material.emissive) {
      h.target.material.emissive.copy(h.color);
      h.target.material.emissiveIntensity = h.intensity;
    }
  }
  highlighted = [];
}
function highlight(ids) {
  clearHighlight();
  for (const target of targets.filter((t) => ids.includes(t.id))) {
    if (!target.material.emissive) continue;
    highlighted.push({
      target,
      color: target.material.emissive.clone(),
      intensity: target.material.emissiveIntensity,
    });
    target.material.emissive.set("#b68a4c");
    target.material.emissiveIntensity = 0.5;
  }
  viewer?.requestUpdate();
}
async function applyOption(g, o) {
  if (!o) return;
  clearHighlight();
  const bound = targets.filter((t) => g.targets.includes(t.id));
  let texture = null;
  if (o.assetId) {
    const a = draft.assets.find((a) => a.id === o.assetId);
    if (!a) throw new Error("Malzeme görseli bulunamadı.");
    if (bound.some((t) => !t.uv))
      throw new Error(
        `${g.name}: Doku kullanmak için bağlı parçaların UV koordinatları olmalı.`,
      );
    if (!textures.has(a.id))
      textures.set(a.id, await viewer.createTexture(assetUrl(a)));
    texture = textures.get(a.id);
  }
  for (const t of bound) {
    const m = t.material;
    derivedMaps.get(t.id)?.dispose();
    derivedMaps.delete(t.id);
    m.copy(t.original);
    if (!o.original) {
      if (texture) {
        const map = texture.clone();
        if (t.original.map) {
          map.repeat.copy(t.original.map.repeat);
          map.offset.copy(t.original.map.offset);
          map.center.copy(t.original.map.center);
          map.rotation = t.original.map.rotation;
          map.wrapS = t.original.map.wrapS;
          map.wrapT = t.original.map.wrapT;
          map.channel = t.original.map.channel;
        }
        map.needsUpdate = true;
        derivedMaps.set(t.id, map);
        m.map = map;
        m.color.set("#ffffff");
      } else {
        m.map = null;
        m.color.set(o.color || "#ffffff");
      }
    }
    m.needsUpdate = true;
  }
  viewer.requestUpdate();
}
async function applyAll() {
  if (!loaded) return;
  clearHighlight();
  releaseDerivedMaps();
  for (const t of targets) t.material.copy(t.original);
  if (draft.features.configurable)
    for (const g of draft.groups)
      await applyOption(
        g,
        g.options.find(
          (o) => o.id === (previewSelection.get(g.id) || g.defaultId),
        ),
      );
}
function renderAssets() {
  const host = $("assets");
  host.replaceChildren();
  for (const a of draft.assets) {
    const row = element("div", undefined, "asset-row");
    if (a.kind !== "attachments") {
      const img = element("img");
      img.src = assetUrl(a);
      img.alt = "";
      row.append(img);
    }
    row.append(
      element("span", `${a.name} · ${(a.blob.size / 1048576).toFixed(2)} MB`),
    );
    if (a.kind === "attachments") {
      const label = element("label"),
        check = document.createElement("input");
      check.type = "checkbox";
      check.checked = !!a.public;
      check.onchange = () => {
        a.public = check.checked;
        changed();
      };
      label.append(check, element("span", "Ziyaretçiye açık"));
      row.append(label);
    } else
      row.append(
        element(
          "small",
          a.kind === "textures" ? "İç kullanım" : "Ürün görseli",
        ),
      );
    row.append(
      button("Sil", () => {
        if (
          draft.groups.some((g) => g.options.some((o) => o.assetId === a.id))
        ) {
          notice("Önce bu görseli kullanan seçenekleri kaldırın.", true);
          return;
        }
        draft.assets = draft.assets.filter((x) => x.id !== a.id);
        changed();
        renderAssets();
        renderLibrary();
      }),
    );
    host.append(row);
  }
}
function renderLibrary() {
  const host = $("library");
  host.replaceChildren();
  const assets = draft.assets.filter((a) => a.kind === "textures");
  if (!assets.length)
    host.append(
      element(
        "p",
        "Henüz malzeme görseli yok. İlk adımda ekleyebilirsiniz.",
        "helper",
      ),
    );
  for (const a of assets) {
    const b = button(a.name, () => {
      const g = group();
      if (!g) {
        notice("Önce bir özelleştirme grubu seçin.", true);
        return;
      }
      g.options.push({
        id: uid(),
        label: a.name.replace(/\.[^.]+$/, ""),
        assetId: a.id,
      });
      changed();
      renderOptions();
      renderGroups();
    });
    const img = element("img");
    img.src = assetUrl(a);
    img.alt = "";
    b.prepend(img);
    host.append(b);
  }
}
function renderGroups() {
  const host = $("groups");
  host.replaceChildren();
  if (!draft.groups.length)
    host.append(
      element(
        "p",
        "Henüz grup yok. Örneğin “Dolap rengi” veya “Deri” grubu ekleyin.",
        "helper",
      ),
    );
  for (const g of draft.groups) {
    const row = element(
      "div",
      undefined,
      "group" + (g.id === activeGroup ? " selected" : ""),
    );
    row.append(
      button(`${g.name} · ${g.targets.length} hedef`, () => {
        activeGroup = g.id;
        renderGroups();
        renderGroupEditor();
        highlight(g.targets);
      }),
    );
    row.append(
      button("Sil", async () => {
        clearHighlight();
        draft.groups = draft.groups.filter((x) => x.id !== g.id);
        activeGroup = draft.groups[0]?.id || null;
        changed();
        await applyAll();
        renderGroups();
        renderGroupEditor();
      }),
    );
    host.append(row);
  }
}
function renderGroupEditor() {
  const g = group();
  $("group-editor").hidden = !g;
  if (!g) return;
  $("group-name").value = g.name;
  const host = $("targets");
  host.replaceChildren();
  for (const t of targets) {
    const label = element("label", undefined, "target");
    label.dataset.target = t.id;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = g.targets.includes(t.id);
    const owner = draft.groups.find(
      (x) => x.id !== g.id && x.targets.includes(t.id),
    );
    check.disabled = !!owner;
    check.onchange = async () => {
      g.targets = check.checked
        ? [...g.targets, t.id]
        : g.targets.filter((id) => id !== t.id);
      changed();
      try {
        await applyAll();
        highlight(g.targets);
      } catch (e) {
        notice(e.message, true);
      }
      renderGroups();
    };
    label.append(
      check,
      element("span", t.label + (owner ? ` (${owner.name})` : "")),
      button("Göster", () => highlight([t.id])),
    );
    host.append(label);
  }
  renderOptions();
}
function renderOptions() {
  const host = $("options");
  host.replaceChildren();
  const g = group();
  if (!g) return;
  g.options.forEach((o, index) => {
    const row = element("div", undefined, "option"),
      top = element("div", undefined, "option-top");
    if (o.assetId) {
      const a = draft.assets.find((a) => a.id === o.assetId);
      const img = element("img");
      if (a) img.src = assetUrl(a);
      img.alt = "";
      top.append(img);
    } else if (o.original) top.append(element("span", "GLB", "swatch"));
    else {
      const color = document.createElement("input");
      color.type = "color";
      color.value = o.color;
      color.setAttribute("aria-label", "Seçenek rengi");
      color.oninput = () => {
        o.color = color.value;
        changed();
      };
      color.onchange = () =>
        applyOption(g, o).catch((e) => notice(e.message, true));
      top.append(color);
    }
    const name = document.createElement("input");
    name.type = "text";
    name.value = o.label;
    name.maxLength = 80;
    name.setAttribute("aria-label", "Seçenek adı");
    name.oninput = () => {
      o.label = name.value;
      changed();
    };
    top.append(name);
    const bottom = element("div", undefined, "option-bottom");
    const label = element("label"),
      radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "default";
    radio.checked = o.id === g.defaultId;
    radio.onchange = () => {
      g.defaultId = o.id;
      previewSelection.delete(g.id);
      changed();
    };
    label.append(radio, element("span", "Varsayılan"));
    bottom.append(
      label,
      button("Önizle", () =>
        applyOption(g, o).catch((e) => notice(e.message, true)),
      ),
    );
    const up = button("↑", () => {
      [g.options[index - 1], g.options[index]] = [
        g.options[index],
        g.options[index - 1],
      ];
      changed();
      renderOptions();
    });
    up.disabled = index === 0;
    up.setAttribute("aria-label", "Seçeneği yukarı taşı");
    bottom.append(up);
    if (!o.original)
      bottom.append(
        button("Sil", async () => {
          g.options = g.options.filter((x) => x.id !== o.id);
          if (g.defaultId === o.id) g.defaultId = g.options[0].id;
          previewSelection.delete(g.id);
          changed();
          await applyAll();
          renderOptions();
        }),
      );
    row.append(top, bottom);
    host.append(row);
  });
}
function renderPreviewOptions(host) {
  host.replaceChildren();
  if (!draft.features.configurable) return;
  for (const g of draft.groups) {
    const block = element("div", undefined, "preview-group");
    block.append(element("strong", g.name));
    for (const o of g.options) {
      const b = button(o.label, async () => {
        try {
          await applyOption(g, o);
          previewSelection.set(g.id, o.id);
          renderPreviewOptions(host);
        } catch (e) {
          notice(e.message, true);
        }
      });
      b.classList.toggle(
        "active",
        o.id === (previewSelection.get(g.id) || g.defaultId),
      );
      b.setAttribute("aria-pressed", String(b.classList.contains("active")));
      const swatch = element(o.assetId ? "img" : "span", undefined, "swatch");
      if (o.assetId) {
        const a = draft.assets.find((a) => a.id === o.assetId);
        if (a) swatch.src = assetUrl(a);
        swatch.alt = "";
      } else {
        swatch.style.background = o.original
          ? "linear-gradient(135deg,#bdad94,#6c737b)"
          : o.color;
      }
      b.prepend(swatch);
      block.append(b);
    }
    host.append(block);
  }
}
function errors() {
  const all = validation(
    draft,
    targets.map((t) => t.id),
  );
  if (!loaded) all.push("Model yükleme kontrolü tamamlanmalı.");
  if (draft.features.configurable)
    for (const g of draft.groups)
      if (
        g.options.some((o) => o.assetId) &&
        targets.some((t) => g.targets.includes(t.id) && !t.uv)
      )
        all.push(`${g.name}: Doku seçenekleri için UV koordinatları eksik.`);
  return all;
}
function renderReview() {
  const problems = errors();
  $("checks").replaceChildren();
  for (const message of problems.length
    ? problems
    : ["Ürün bilgileri, model ve etkin özelliklerin gereksinimleri tamam."])
    $("checks").append(element("li", message));
  $("publish").disabled = problems.length > 0 || !$("reviewed").checked;
  renderPreviewOptions($("preview-options"));
  renderInfo();
}
function renderInfo() {
  const host = $("public-info");
  host.replaceChildren(
    element("h2", draft.name || "Ürün önizlemesi"),
    element("p", draft.description),
  );
  host.append(
    element("small", [draft.code, draft.category].filter(Boolean).join(" · ")),
  );
  const photo = draft.assets.find((a) => a.kind === "photos");
  if (photo) {
    const img = element("img");
    img.src = assetUrl(photo);
    img.alt = draft.name;
    img.style.cssText =
      "width:100px;height:70px;object-fit:cover;margin-top:12px";
    host.append(img);
  }
  if (draft.features.dimensions)
    host.append(
      element(
        "p",
        (viewer?.getMeasurementGuides()||[]).map(g=>`${g.axis} ${(Number(draft[{G:'width',D:'depth',Y:'height'}[g.axis]])>0?Number(draft[{G:'width',D:'depth',Y:'height'}[g.axis]]):Number((g.value*({mm:1000,cm:100,m:1}[draft.unit]||100)).toFixed(2)))} ${draft.unit||'cm'}`).join(' · ') ,
      ),
    );
  if (draft.features.downloads)
    for (const a of draft.assets.filter(
      (a) => a.kind === "attachments" && a.public,
    )) {
      const link = element("a", a.name);
      link.href = assetUrl(a);
      link.download = a.name;
      host.append(link);
    }
  if (draft.features.contact) {
    const a = element("a", "Teklif iste ↗");
    a.href = `mailto:${encodeURIComponent(draft.email)}?subject=${encodeURIComponent(draft.name + " — Teklif talebi")}`;
    host.append(a);
  }
}
async function go(next) {
  if (loading) return;
  readFields();
  if (next > 1 && !draft.model) {
    notice("Önce bir GLB model ekleyin.", true);
    return;
  }
  if (next > 1 && !loaded) {
    notice("Model yüklemesi başarıyla tamamlanmalı.", true);
    return;
  }
  step = next;
  document.body.dataset.authorStep=String(step);
  clearHighlight();
  $("setup").hidden = step !== 1;
  $("mapping").hidden = step === 1;
  $("editor").hidden = step !== 2;
  $("review").hidden = step !== 3;
  $("public-info").hidden = step !== 3;
  $("back").hidden = step === 1;
  $("next").hidden = step === 3;
  $("next").textContent =
    step === 1 ? "Malzeme eşleştirme →" : "Önizleme ve kontrol →";
  $("step-label").textContent = `ADIM 0${step} / 03`;
  $("page-title").textContent = [
    "",
    "Yeni ürün ekleyin",
    "Parçaları seçeneklere bağlayın",
    "Ürününüzü kontrol edin",
  ][step];
  $("page-subtitle").textContent = [
    "",
    "Ürününüzün bilgilerini, modelini ve sunum özelliklerini hazırlayın.",
    "Birlikte değişen parçaları gruplandırın ve müşteriye sunulacak alternatifleri tanımlayın.",
    "Seçenekleri deneyin ve yerel yayın kopyasını hazırlayın.",
  ][step];
  for (const b of $("steps").children)
    b.classList.toggle("active", Number(b.dataset.step) === step);
  notice("");
  if (step === 2) {
    renderGroups();
    renderGroupEditor();
    renderLibrary();
  }
  if (step === 3) {
    try {
      await applyAll();
      renderReview();
    } catch (e) {
      notice(e.message, true);
      $("publish").disabled = true;
    }
  }
}
async function refreshDrafts() {
  const products = await listProducts();
  $("drafts").replaceChildren(new Option("Ürün seçin", ""));
  for (const p of products)
    $("drafts").append(
      new Option(
        `${p.draft.name || "Adsız ürün"}${p.published ? " · yerel yayın var" : ""}`,
        p.id,
      ),
    );
  $("drafts").value = record.id;
}
async function save() {
  readFields();
  record.draft = draft;
  record.updatedAt = new Date().toISOString();
  await saveProduct(record);
  dirty = false;
  $("state").textContent = "Taslak kaydedildi";
  await refreshDrafts();
  notice("Taslak ve dosyalar bu tarayıcıya kaydedildi.");
}
async function acceptModel(file) {
  if (loading) return;
  const previous = draft.model;
  try {
    notice("Model kontrol ediliyor…");
    const model = { id: uid(), name: file.name, blob: file };
    await loadModel(model, false);
    draft.model = model;
    draft.groups = [];
    activeGroup = null;
    changed();
    fillFields();
    notice("Model hazır. Malzemeler ve parçalar okundu.");
  } catch (e) {
    const message = e.message;
    try {
      if (previous) await loadModel(previous);
    } catch {}
    notice(message, true);
    $("model-status").textContent =
      previous && loaded
        ? `${previous.name} · Önceki model korundu.`
        : "Model kontrolü başarısız. Geçerli bir GLB seçin.";
  } finally {
    $("model-file").value = "";
  }
}
for (const id of [...fieldIds, ...featureIds])
  $(id).addEventListener("input", () => {
    readFields();
    changed();
  });
$("model-file").onchange = (e) => {
  const file = e.target.files[0];
  if (file) acceptModel(file);
};
$("drop").ondragover = (e) => {
  e.preventDefault();
  $("drop").classList.add("over");
};
$("drop").ondragleave = () => $("drop").classList.remove("over");
$("drop").ondrop = (e) => {
  e.preventDefault();
  $("drop").classList.remove("over");
  const files = e.dataTransfer.files;
  if (files.length !== 1 || !files[0].name.toLowerCase().endsWith(".glb")) {
    notice("Tek bir GLB dosyası bırakın.", true);
    return;
  }
  acceptModel(files[0]);
};
$("example").onclick = async () => {
  try {
    const r = await fetch("../model/desk-200-drawers-left.glb");
    if (!r.ok) throw new Error("Örnek model bulunamadı.");
    if (!draft.name) {
      draft.name = "Örnek yönetici masası";
      draft.code = "DEMO-200";
      fillFields();
    }
    await acceptModel(new File([await r.blob()], "desk-200-drawers-left.glb"));
  } catch (e) {
    notice(e.message, true);
  }
};
for (const kind of ["textures", "photos", "attachments"])
  $(kind).onchange = async (e) => {
    try {
      for (const file of e.target.files) {
        if (kind !== "attachments") {
          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
            throw new Error("Yalnızca PNG, JPEG veya WebP görsellerini seçin.");
          const bitmap = await createImageBitmap(file);
          bitmap.close();
        }
        draft.assets.push({
          id: uid(),
          name: file.name,
          blob: file,
          kind,
          public: false,
        });
      }
      changed();
      renderAssets();
      renderLibrary();
    } catch (err) {
      notice(err.message, true);
    } finally {
      e.target.value = "";
    }
  };
$("add-group").onclick = () => {
  const original = { id: uid(), label: "Modeldeki malzeme", original: true };
  const g = {
    id: uid(),
    name: `Grup ${draft.groups.length + 1}`,
    targets: [],
    options: [original],
    defaultId: original.id,
  };
  draft.groups.push(g);
  activeGroup = g.id;
  draft.features.configurable = true;
  $("configurable").checked = true;
  changed();
  renderGroups();
  renderGroupEditor();
};
$("group-name").oninput = (e) => {
  group().name = e.target.value;
  changed();
  renderGroups();
};
$("add-option").onclick = () => {
  const g = group();
  g.options.push({ id: uid(), label: "Yeni renk", color: "#34383d" });
  changed();
  renderOptions();
};
$("clear-highlight").onclick = clearHighlight;
$("reset-view").onclick = () => viewer?.reframe();
$("next").onclick = () => go(step + 1);
$("back").onclick = () => go(step - 1);
$("steps").onclick = (e) => {
  const b = e.target.closest("[data-step]");
  if (b) go(Number(b.dataset.step));
};
$("save").onclick = () =>
  save().catch((e) => notice("Kayıt başarısız: " + e.message, true));
$("reviewed").onchange = () => renderReview();
$("publish").onclick = async () => {
  try {
    readFields();
    const problems = errors();
    if (problems.length || !$("reviewed").checked) {
      renderReview();
      return;
    }
    await applyAll();
    const previous = record.published;
    record.published = structuredClone(draft);
    record.publishedAt = new Date().toISOString();
    try {
      await save();
    } catch (e) {
      record.published = previous;
      throw e;
    }
    $("state").textContent = "Yerel yayın hazır";
    $("public-link").href = `../product/?view=${encodeURIComponent(record.id)}`;
    $("public-link").hidden = false;
    notice("Yerel yayın kopyası oluşturuldu. Genel katalog değiştirilmedi.");
  } catch (e) {
    notice("Yerel yayın başarısız: " + e.message, true);
  }
};
$("drafts").onchange = async (e) => {
  if (!e.target.value) return;
  if (dirty && !confirm("Kaydedilmemiş değişikliklerden çıkılsın mı?")) {
    e.target.value = record.id;
    return;
  }
  try {
    const next = await getProduct(e.target.value);
    if (!next) throw new Error("Kayıt bulunamadı.");
    cleanup();
    record = next;
    draft = record.draft;
    activeGroup = draft.groups[0]?.id || null;
    dirty = false;
    loaded = false;
    fillFields();
    renderAssets();
    if (draft.model) await loadModel(draft.model);
    await go(1);
    $("state").textContent = "Taslak";
  } catch (err) {
    notice(err.message, true);
  }
};
$("new").onclick = () => {
  if (dirty && !confirm("Kaydedilmemiş değişikliklerden çıkılsın mı?")) return;
  dirty = false;
  location.href = location.pathname;
};
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function start() {
  if(viewId){location.replace(`../product/?view=${encodeURIComponent(viewId)}`);return;}
  try {
    if (viewId) {
      document.body.classList.add("public-mode");
      record = await getProduct(viewId);
      if (!record?.published)
        throw new Error("Bu tarayıcıda yayın kopyası bulunamadı.");
      draft = record.published;
      fillFields();
      $("setup").hidden = true;
      $("mapping").hidden = false;
      $("page-title").textContent = draft.name;
      $("step-label").textContent = "YEREL ZİYARETÇİ ÖNİZLEMESİ";
      $("page-subtitle").textContent =
        "Bu ürün yalnızca bu tarayıcıdaki yayın kopyasından gösteriliyor.";
      $("state").textContent = "Yerel yayın";
      $("public-info").hidden = false;
      step = 3;
      await loadModel(draft.model);
      renderInfo();
      const host = element("article");
      host.id = "public-options";
      $("viewer-column").append(host);
      renderPreviewOptions(host);
      $("clear-highlight").hidden = true;
    } else {
      if (editId) {
        const saved = await getProduct(editId);
        if (!saved) throw new Error("Kayıt bulunamadı.");
        record = saved;
        draft = record.draft;
        activeGroup = draft.groups[0]?.id || null;
      }
      fillFields();
      await refreshDrafts();
      renderAssets();
      if (draft.model) await loadModel(draft.model);
    }
  } catch (e) {
    notice(e.message, true);
  }
}
start();


