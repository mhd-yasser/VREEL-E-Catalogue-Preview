import {normalizeDraft,sceneSettings,collectScenes,importVariantSettings,applyMaterialVariant,motionSettings,configureMotions,toggleMotion,productErrors,composeProduct} from '../product-runtime.js?v=20261010-1';
import {addARControls} from '../product-ar.js?v=20261010-1';
import * as THREE from "three";
import { createViewer } from "../three-viewer.js?v=20261010-1";
import {
  saveProduct,
  listProducts,
  getProduct,
  newDraft,
  validation,
  inspectGLB,
} from "./store.js?v=20261010-1";
import {collectComponents, mountAlternatives, applyComponentSelection, componentErrors, materialTargetId} from '../component-options.js?v=20261010-1';
let components = [], componentNodes = new Map(), activeComponentGroup = null;
const componentSelection = new Map();
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
  componentSelection.clear();
}
function readFields() {
  if(draft.schemaVersion===2)draft.ar={enabled:$("ar-enabled").checked};
  for (const id of fieldIds) draft[id] = $(id).value;
  for (const id of featureIds) draft.features[id] = $(id).checked;
}
function fillFields() {
  $("ar-enabled").checked=draft.ar?.enabled!==false;
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
      step !== 3
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
  $("save").disabled = true;
  $("component-editor").inert = true;
  $("model-file").disabled = true;
  $("example").disabled = true;
  try {
    inspectGLB(await model.blob.arrayBuffer());
    viewer.productMode=draft.schemaVersion===2||!applyConfig?"scenes":"legacy";
    await new Promise((resolve, reject) => {
      const onLoad = () => {
          clear();
          resolve();
        },
        onError = (event) => {
          clear();
          reject(
            new Error(
              event.detail?.message || "Model yüklenemedi. Dosya ve gerekli sıkıştırma uzantılarını kontrol edin.",
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
    components = viewer.productMode==="scenes"?collectScenes(viewer.model.root):collectComponents(viewer.model.root);
    if(!applyConfig){draft.schemaVersion=2;draft.modelScale=1;draft.scaleConfirmed=false;draft.scenes=sceneSettings(viewer.model.runtime);draft.materialVariants=[];draft.animations=[];draft.defaultVariant=null;}
    componentNodes = applyConfig
      ? await mountAlternatives(viewer, draft, assetUrl)
      : new Map(components.map(c => [c.id,c.node]));
    if(draft.schemaVersion===2){
      componentNodes.runtime=viewer.model.runtime;componentNodes.draft=draft;
      draft.materialVariants=importVariantSettings(viewer.model.runtime,draft.materialVariants);
      if(!applyConfig)draft.animations=motionSettings(viewer.model.runtime);
      configureMotions(viewer.model.runtime,draft.animations);
      renderModelInspection();
    }
    targets = [];
    let meshIndex = 0;
    viewer.model.root.traverse((node) => {
      if (!node.isMesh || draft.schemaVersion===2) return;
      const index = node.userData.componentMaterialPrefix ? -1 : meshIndex++;
      const original = [node.material].flat();
      const clones = original.map((m, slot) => {
        const material = m.clone();
        const id = materialTargetId(node, index, slot);
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
    viewer.measurementTargets = (draft.componentGroups||[]).length?[]:draft.dimensionTargets||[];
    if (applyConfig) await applyAll();
    else composeProduct(viewer.model.runtime,draft);
    if(draft.schemaVersion===2)viewer.reframe();
    return true;
  } finally {
    loading = false;
    $("next").disabled = false;
    $("save").disabled = false;
    $("component-editor").inert = false;
    $("model-file").disabled = false;
    $("example").disabled = false;
  }
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
  if(draft.schemaVersion===2){applyComponentSelection(componentNodes,draft.componentGroups,componentSelection);applyMaterialVariant(viewer.model.runtime,draft,previewSelection.get("native")||draft.defaultVariant);viewer.requestUpdate();return;}
  clearHighlight();
  viewer.measurementTargets = (draft.componentGroups||[]).length?[]:draft.dimensionTargets||[];
  applyComponentSelection(componentNodes, draft.componentGroups, componentSelection);
  viewer.requestUpdate();
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
  for (const g of draft.componentGroups || []) {
    const block = element('div', undefined, 'preview-group');
    block.append(element('strong', g.name));
    for (const o of g.options) {
      const b = button(o.label, () => {
        componentSelection.set(g.id,o.id);
        applyComponentSelection(componentNodes,draft.componentGroups,componentSelection);
        viewer.reframe(); renderInfo(); renderPreviewOptions(host);
      });
      b.classList.toggle('active',o.id === (componentSelection.get(g.id)||g.defaultId));
      b.setAttribute('aria-pressed',String(b.classList.contains('active')));
      block.append(b);
    }
    host.append(block);
  }
  if(draft.schemaVersion===2){
    if(draft.features.configurable&&draft.materialVariants.length){const block=element('div',undefined,'preview-group');block.append(element('strong','Malzeme kombinasyonu'));for(const v of draft.materialVariants)block.append(button(v.label,()=>{previewSelection.set('native',v.id);applyMaterialVariant(viewer.model.runtime,draft,v.id);viewer.requestUpdate();renderPreviewOptions(host);}));host.append(block);}
    for(const m of draft.animations)host.append(button(m.name,()=>toggleMotion(viewer.model.runtime,m.id)));
    return;
  }
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
  all.push(...(draft.schemaVersion===2?productErrors(draft,viewer?.model?.runtime):componentErrors(draft, components)));
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
  if (loading || componentUploadBusy) return;
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
  $("component-editor").hidden = step !== 2;
  $("editor").hidden = step !== 3 || draft.schemaVersion===2;
  $("imported-materials").hidden = step !== 3 || draft.schemaVersion!==2;
  $("motion-editor").hidden = step !== 3 || draft.schemaVersion!==2;
  $("review").hidden = step !== 4;
  $("public-info").hidden = step !== 4;
  $("back").hidden = step === 1;
  $("next").hidden = step === 4;
  $("next").textContent =
    step === 1 ? "Parça alternatifleri →" : step === 2 ? "Malzeme ve hareketler →" : "Önizleme ve kontrol →";
  $("step-label").textContent = `ADIM 0${step} / 04`;
  $("page-title").textContent = [
    "",
    "Yeni ürün ekleyin",
    "Ürün parçalarının alternatiflerini düzenleyin",
    "Malzeme seçenekleri ve hareketler",
    "Ürününüzü kontrol edin",
  ][step];
  $("page-subtitle").textContent = [
    "",
    "Ürününüzün bilgilerini, modelini ve sunum özelliklerini hazırlayın.",
    "Sahneleri sınıflandırın, alternatifleri adlandırın ve varsayılanları belirleyin.",
    "Birlikte değişen parçaları gruplandırın ve müşteriye sunulacak alternatifleri tanımlayın.",
    "Seçenekleri deneyin ve yerel yayın kopyasını hazırlayın.",
  ][step];
  for (const b of $("steps").children)
    b.classList.toggle("active", Number(b.dataset.step) === step);
  notice("");
  if (step === 2) {applyComponentSelection(componentNodes,draft.componentGroups,componentSelection);renderComponentEditor();}
  if (step === 3) {
    if(draft.schemaVersion===2){renderNativeVariants();renderMotions();}else{renderGroups();renderGroupEditor();renderLibrary();}
  }
  if (step === 4) {
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
  const previous = draft.model, previousDraft=structuredClone(draft);
  try {
    notice("Model kontrol ediliyor…");
    const model = { id: uid(), name: file.name, blob: file };
    await loadModel(model, false);
    draft.model = model;
    draft.groups = [];
    draft.features.configurable=draft.materialVariants.length>0;
    $("configurable").checked=draft.features.configurable;
    draft.componentGroups = [];
    draft.componentAssets = [];
    draft.dimensionTargets = [];
    componentSelection.clear();
    activeComponentGroup = null;
    activeGroup = null;
    changed();
    fillFields();
    notice("Model hazır. Malzemeler ve parçalar okundu.");
  } catch (e) {
    const message = e.message;
    draft=previousDraft;record.draft=draft;
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
    draft = normalizeDraft(record.draft);
    draft.componentGroups ||= []; draft.componentAssets ||= []; componentSelection.clear(); activeComponentGroup = null;
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
      step = 4;
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
        draft = normalizeDraft(record.draft);
    draft.componentGroups ||= []; draft.componentAssets ||= []; componentSelection.clear(); activeComponentGroup = null;
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



function componentGroup() { return (draft.componentGroups || []).find(g => g.id === activeComponentGroup); }
function refreshComponentPreview() {
  for (const node of componentNodes.values()) node.visible = true;
  applyComponentSelection(componentNodes,draft.componentGroups,componentSelection);
  viewer?.requestUpdate();
  if(draft.schemaVersion===2)viewer?.reframe();
}
function renderComponentEditor() {
  draft.componentGroups ||= []; draft.componentAssets ||= [];
  if (!componentGroup()) activeComponentGroup = draft.componentGroups[0]?.id || null;
  if(draft.schemaVersion===2)renderSceneClassification();
  const host = $('component-groups'); host.replaceChildren();
  if (!draft.componentGroups.length) {
    host.append(element('p',`${components.length} sahne / parça bulundu. Bir grup ekleyin veya alternatif yoksa bu adımı geçin.`,'helper'));
    for(const c of components)host.append(element('small',c.path));
  }
  for (const g of draft.componentGroups) {
    const row=element('div',undefined,'group'+(g.id===activeComponentGroup?' selected':''));
    row.append(button(`${g.name} · ${g.options.length} seçenek`,()=>{activeComponentGroup=g.id;renderComponentEditor();}),button('Sil',async()=>{
      draft.componentGroups=draft.componentGroups.filter(x=>x.id!==g.id);
      const removed=new Set(g.options.filter(o=>o.assetId).map(o=>o.assetId));
      draft.componentAssets=draft.componentAssets.filter(a=>!removed.has(a.id));
      if(draft.schemaVersion===2)draft.animations=draft.animations.map(m=>({...m,tracks:m.tracks.filter(t=>![...removed].some(id=>t.startsWith(`asset-${id}:`)))})).filter(m=>m.tracks.length);
      removeExternalMaterialTargets(removed);
      componentSelection.delete(g.id); changed(); await loadModel(draft.model); renderComponentEditor();
    })); host.append(row);
  }
  const g=componentGroup(); $('component-group-editor').hidden=!g; if(!g)return;
  $('component-group-name').value=g.name;
  const list=$('component-nodes'); list.replaceChildren();
  if(!components.length)list.append(element('p','Dosyada sahne bulunamadı.','helper'));
  const assigned=(draft.componentGroups||[]).flatMap(x=>x.options).filter(o=>o.nodeId).map(o=>o.nodeId);
  for(const c of components.filter(c=>draft.schemaVersion!==2||draft.scenes.find(s=>s.id===c.id)?.role==='alternative')){
    const row=element('label',undefined,'target'),check=element('input');check.type='checkbox';check.checked=g.options.some(o=>o.nodeId===c.id);
    const owner=draft.componentGroups.find(x=>x.id!==g.id&&x.options.some(o=>o.nodeId===c.id));
    const nested=components.some(other=>assigned.includes(other.id)&&other.id!==c.id&&(isAncestor(c.node,other.node)||isAncestor(other.node,c.node)));
    check.disabled=!!owner||(nested&&!check.checked);
    check.onchange=()=>{
      if(check.checked){const option={id:uid(),nodeId:c.id,label:draft.schemaVersion===2?c.name:c.name.slice(2)||c.name};g.options.push(option);g.defaultId ||= option.id;}
      else {
        if(g.options.some(o=>o.referenceId===c.id)){notice('Önce bu parçaya bağlı dosya alternatiflerini kaldırın.',true);check.checked=true;return;}
        g.options=g.options.filter(o=>o.nodeId!==c.id);if(!g.options.some(o=>o.id===g.defaultId))g.defaultId=g.options[0]?.id||null;
      }
      componentSelection.delete(g.id);changed();refreshComponentPreview();renderComponentEditor();
    };
    row.append(check,element('span',c.path+(owner?` (${owner.name})`:nested?' (İç içe seçim daha sonra)':'')),button('Göster',()=>{
      componentSelection.set(g.id,g.options.find(o=>o.nodeId===c.id)?.id||g.defaultId);refreshComponentPreview();
      highlight(targets.filter(t=>isAncestor(c.node,t.node)||c.node===t.node).map(t=>t.id));
    }));list.append(row);
  }
  const options=$('component-options');options.replaceChildren();
  for(const o of g.options){
    const row=element('div',undefined,'component-option'),name=element('input');name.value=o.label;name.maxLength=80;name.setAttribute('aria-label','Alternatif adı');name.oninput=()=>{o.label=name.value;changed();};
    const bottom=element('div',undefined,'option-bottom'),label=element('label'),radio=element('input');radio.type='radio';radio.name='component-default';radio.checked=g.defaultId===o.id;
    radio.onchange=()=>{g.defaultId=o.id;componentSelection.delete(g.id);changed();refreshComponentPreview();};label.append(radio,element('span','Varsayılan'));
    bottom.append(label,button('Önizle',()=>{componentSelection.set(g.id,o.id);refreshComponentPreview();viewer.reframe();}));
    if(o.assetId)bottom.append(button('Sil',async()=>{g.options=g.options.filter(x=>x.id!==o.id);draft.componentAssets=draft.componentAssets.filter(a=>a.id!==o.assetId);if(draft.schemaVersion===2)draft.animations=draft.animations.map(m=>({...m,tracks:m.tracks.filter(t=>!t.startsWith(`asset-${o.assetId}:`))})).filter(m=>m.tracks.length);removeExternalMaterialTargets(new Set([o.assetId]));if(g.defaultId===o.id)g.defaultId=g.options[0]?.id||null;componentSelection.delete(g.id);changed();await loadModel(draft.model);renderComponentEditor();}));
    if(!o.assetId&&draft.schemaVersion===2&&draft.materialVariants.length){const fallback=element('select');fallback.append(new Option('Özgün malzemeler',''));for(const v of draft.materialVariants)fallback.append(new Option(v.label,v.id));fallback.value=o.defaultVariant||'';fallback.onchange=()=>{o.defaultVariant=fallback.value;changed();applyAll();};row.append(element('small','Seçili malzeme eşleşmezse'),fallback);}
    if(o.assetId&&draft.schemaVersion===2){const align=element('select');align.append(new Option('Dışa aktarılmış konum','exported'),new Option('Merkezleri hizala','center'));align.value=o.alignment||'exported';align.onchange=async()=>{o.alignment=align.value;changed();await loadModel(draft.model);renderComponentEditor();};row.append(align);for(let axis=0;axis<3;axis++){const label=element('label',`${['X','Y','Z'][axis]} (m)`),input=element('input');input.type='number';input.step='any';input.value=o.offset?.[axis]||0;input.onchange=async()=>{o.offset ||= [0,0,0];o.offset[axis]=Number(input.value)||0;changed();await loadModel(draft.model);renderComponentEditor();};label.append(input);row.append(label);}const ext=viewer.model.runtime.externalRuntimes.find(r=>r.root.parent?.userData.componentAsset===o.assetId);if(ext?.scenes.length>1){const scene=element('select');for(const s of ext.scenes.filter(s=>!['0','noAR'].includes(s.name)))scene.append(new Option(s.name,s.id));scene.value=o.sceneId||ext.defaultScene;scene.onchange=async()=>{o.sceneId=scene.value;changed();await loadModel(draft.model);renderComponentEditor();};row.append(element('small','Alternatif dosyanın sahnesi'),scene);}if(ext?.variants.length){const v=element('select');v.append(new Option('Dosyanın özgün malzemesi',''));for(const choice of ext.variants)v.append(new Option(choice.name,choice.id));v.value=o.defaultVariant||'';v.onchange=()=>{o.defaultVariant=v.value;ext.defaultVariant=v.value;changed();applyAll();};row.append(element('small','Eşleşme yoksa kullanılacak malzeme'),v);}}
    row.append(name,element('small',o.assetId?'Ayrı GLB dosyası':components.find(c=>c.id===o.nodeId)?.path||'Eksik parça'),bottom);options.append(row);
  }
  const reference=$('component-reference'),previousReference=reference.value;
  reference.replaceChildren(new Option('Referans parça seçin',''));
  const references=g.options.filter(o=>o.nodeId);
  for(const o of references)reference.append(new Option(o.label,o.nodeId));
  reference.value=references.some(o=>o.nodeId===previousReference)?previousReference:references.length===1?references[0].nodeId:'';
  $('component-file').disabled=!g.options.some(o=>o.nodeId)||loading;
}
function isAncestor(parent,node){for(let p=node.parent;p;p=p.parent)if(p===parent)return true;return false;}
function removeExternalMaterialTargets(ids){for(const g of draft.groups)g.targets=g.targets.filter(t=>![...ids].some(id=>t.startsWith(`asset-${id}-mesh-`)));}
$('add-component-group').onclick=()=>{
  const g={id:uid(),name:`Alternatif grubu ${(draft.componentGroups||[]).length+1}`,options:[],defaultId:null};
  (draft.componentGroups ||= []).push(g);activeComponentGroup=g.id;changed();renderComponentEditor();
};
$('component-group-name').oninput=e=>{componentGroup().name=e.target.value;changed();const g=componentGroup();const b=$('component-groups').querySelector('.selected button');if(b)b.textContent=`${g.name} · ${g.options.length} seçenek`;};
let componentUploadBusy=false;
function componentUploadNotice(message,error=false){
  const host=$('component-upload-status');host.textContent=message;host.classList.toggle('error',error);
  notice(message,error);
}
$('component-file').onchange=async e=>{
  const input=e.target,file=input.files[0],g=componentGroup(),referenceId=$('component-reference').value;
  if(!file)return;
  if(componentUploadBusy||loading){componentUploadNotice('Model yükleniyor. Tamamlandıktan sonra dosyayı tekrar seçin.',true);input.value='';return;}
  if(!g){componentUploadNotice('Önce bir alternatif grubu seçin.',true);input.value='';return;}
  if(!g.options.some(o=>o.nodeId===referenceId)){
    componentUploadNotice('Önce yerini alacağı referans parçayı seçin.',true);input.value='';return;
  }
  const asset={id:uid(),name:file.name,blob:file};
  const option={id:uid(),label:file.name.replace(/\.glb$/i,''),assetId:asset.id,referenceId,alignment:draft.schemaVersion===2?'exported':'center',offset:[0,0,0]};
  componentUploadBusy=true;input.disabled=true;$('component-editor').inert=true;$('save').disabled=true;$('next').disabled=true;
  componentUploadNotice(`${file.name} kontrol ediliyor ve yükleniyor…`);
  try{
    inspectGLB(await file.arrayBuffer());
    (draft.componentAssets ||= []).push(asset);g.options.push(option);
    await loadModel(draft.model);
    const known=new Set((draft.animations||[]).flatMap(m=>m.tracks));for(const source of draft.schemaVersion===2?viewer.model.runtime.sources:[]){const keys=[...new Set(source.tracks.map(t=>t.key))].filter(k=>!known.has(k));if(keys.length)draft.animations.push({id:uid(),name:source.name,duration:source.duration,mode:'toggle',smooth:false,tracks:keys});}if(draft.schemaVersion===2)configureMotions(viewer.model.runtime,draft.animations);
    if(draft.schemaVersion===2&&draft.materialVariants.length){draft.features.configurable=true;$("configurable").checked=true;}
    componentSelection.set(g.id,option.id);refreshComponentPreview();viewer.reframe();
    changed();renderComponentEditor();componentUploadNotice(`${file.name} alternatiflere eklendi ve önizlemede gösteriliyor.`);
  }catch(err){
    draft.componentAssets=(draft.componentAssets||[]).filter(a=>a.id!==asset.id);g.options=g.options.filter(o=>o.id!==option.id);
    componentSelection.delete(g.id);
    let restoreError='';
    try{await loadModel(draft.model);}catch(restore){restoreError=` Önceki model de yüklenemedi: ${restore.message}`;}
    renderComponentEditor();componentUploadNotice(`${file.name} eklenemedi: ${err.message}${restoreError}`,true);
  }finally{
    componentUploadBusy=false;input.value='';$('component-editor').inert=false;$('save').disabled=false;$('next').disabled=false;
    input.disabled=!componentGroup()?.options.some(o=>o.nodeId);
  }
};

function renderModelInspection(){
  const host=$('model-inspection');host.replaceChildren();if(draft.schemaVersion!==2)return;
  const rt=viewer.model.runtime;
  host.append(element('p',`${rt.scenes.length} sahne · ${rt.variants.length} malzeme seçeneği · ${rt.sources.length} hareket. glTF uzunluk birimi metredir; dosyada kaynak Max birimi doğrulanamaz.`,'helper'));
  const label=element('label','Model ölçeği (1 = dosyanın metre ölçeği)'),scale=element('select');
  for(const [value,name] of [[1,'Metre / doğru glTF ölçeği'],[.01,'Santimetre sayıları → metre'],[.001,'Milimetre sayıları → metre']])scale.append(new Option(name,String(value)));
  scale.value=String(draft.modelScale||1);scale.onchange=()=>{draft.modelScale=Number(scale.value);draft.scaleConfirmed=false;changed();applyAll();viewer.reframe();renderModelInspection();};label.append(scale);host.append(label);
  const check=element('input');check.type='checkbox';check.checked=!!draft.scaleConfirmed;check.onchange=()=>{draft.scaleConfirmed=check.checked;changed();};const confirm=element('label','Ölçeği ürünün gerçek ölçüleriyle doğruladım');confirm.prepend(check);host.append(confirm);
  for(const scene of rt.scenes){const b=new THREE.Box3().setFromObject(scene.node),size=b.getSize(new THREE.Vector3());host.append(element('small',`${scene.name}: ${(size.x*draft.modelScale).toFixed(3)} × ${(size.z*draft.modelScale).toFixed(3)} × ${(size.y*draft.modelScale).toFixed(3)} m`));}
}
function renderSceneClassification(){
  const host=$('scene-classification');host.replaceChildren();
  for(const config of draft.scenes){const row=element('div',undefined,'option'),name=element('strong',config.name),role=element('select');
    for(const [value,label] of [['unassigned','Sınıflandırılmadı'],['shared','Ortak / daima görünür'],['alternative','Alternatif'],['decoration','Dekor / AR ve ölçü hariç'],['excluded','Gösterme']])role.append(new Option(label,value));
    role.value=config.role;role.disabled=config.name==='0'||config.name==='noAR';role.onchange=()=>{
      if(draft.componentGroups.some(g=>g.options.some(o=>o.nodeId===config.id))){notice('Önce sahneyi alternatif grubundan çıkarın.',true);role.value=config.role;return;}
      config.role=role.value;config.measure=role.value!=='decoration';changed();refreshComponentPreview();renderComponentEditor();
    };
    const measure=element('input');measure.type='checkbox';measure.checked=config.measure!==false;measure.disabled=config.role==='decoration';measure.onchange=()=>{config.measure=measure.checked;changed();refreshComponentPreview();};const label=element('label','Ölçülere dahil');label.prepend(measure);row.append(name,role,label);host.append(row);
  }
}
function renderNativeVariants(){
  const host=$('native-variants');host.replaceChildren();
  if(!draft.materialVariants.length){host.append(element('p','Bu dosyada KHR_materials_variants yok. Yalnızca özgün malzemeler gösterilir.'));return;}
  const original=element('input');original.type='radio';original.name='native-default';original.checked=!draft.defaultVariant;original.onchange=()=>{draft.defaultVariant=null;previewSelection.delete('native');changed();applyAll();};const originalLabel=element('label','Dosyanın özgün malzemeleri');originalLabel.prepend(original);host.append(originalLabel);
  for(const v of draft.materialVariants){const row=element('div',undefined,'option'),name=element('input');name.value=v.label;name.oninput=()=>{v.label=name.value;changed();};
    const radio=element('input');radio.type='radio';radio.name='native-default';radio.checked=draft.defaultVariant===v.id;radio.onchange=()=>{draft.defaultVariant=v.id;previewSelection.delete('native');changed();applyAll();};const label=element('label','Varsayılan');label.prepend(radio);
    row.append(name,element('small',v.key),label,button('Önizle',()=>{previewSelection.set('native',v.id);applyMaterialVariant(viewer.model.runtime,draft,v.id);viewer.requestUpdate();}));host.append(row);
  }
}
function renderMotions(){
  const host=$('motion-settings');host.replaceChildren();const rt=viewer.model.runtime;
  if(!rt.sources.length){host.append(element('p','Dosyada hareket yok.'));return;}
  const available=new Map();for(const s of rt.sources)for(const t of s.tracks)if(!available.has(t.key))available.set(t.key,{label:`${s.name} / ${t.label} / ${t.track.name.split('.').pop()}`,source:s,track:t});
  for(const m of draft.animations){const row=element('div',undefined,'option'),name=element('input');name.value=m.name;name.oninput=()=>{m.name=name.value;changed();};
    const duration=element('input');duration.type='number';duration.min='.05';duration.step='.05';duration.value=m.duration;duration.setAttribute('aria-label','Süre (saniye)');duration.onchange=()=>{m.duration=Number(duration.value);changed();configureMotions(rt,draft.animations);};
    const mode=element('select');mode.append(new Option('Aç / kapat (mevcut konumdan)','toggle'),new Option('Bir kez oynat','once'));mode.value=m.mode;mode.onchange=()=>{m.mode=mode.value;changed();configureMotions(rt,draft.animations);};
    const smooth=element('input');smooth.type='checkbox';smooth.checked=m.smooth;smooth.onchange=()=>{m.smooth=smooth.checked;changed();configureMotions(rt,draft.animations);};const smoothLabel=element('label','Yumuşak başlangıç / bitiş (oynatma)');smoothLabel.prepend(smooth);
    row.append(name,element('small','Süre (saniye)'),duration,mode,smoothLabel);
    for(const [key,item] of available){const check=element('input');check.type='checkbox';check.checked=m.tracks.includes(key);check.disabled=draft.animations.some(other=>other!==m&&other.tracks.includes(key));check.onchange=()=>{m.tracks=check.checked?[...m.tracks,key]:m.tracks.filter(t=>t!==key);changed();configureMotions(rt,draft.animations);renderMotions();};const label=element('label',item.label);label.prepend(check);row.append(label);}
    row.append(button('Aç / kapat',()=>toggleMotion(rt,m.id)),button('Sil',()=>{draft.animations=draft.animations.filter(a=>a!==m);changed();configureMotions(rt,draft.animations);renderMotions();}));host.append(row);
  }
}
$('split-motions').onclick=()=>{
  const groups=new Map();for(const s of viewer.model.runtime.sources)for(const t of s.tracks){const key=`${s.id}:${t.node.userData.sourceNodeIndex}`;if(!groups.has(key))groups.set(key,{id:uid(),name:`${s.name} — ${t.label}`,duration:s.duration,mode:'toggle',smooth:false,tracks:[]});const g=groups.get(key);if(!g.tracks.includes(t.key))g.tracks.push(t.key);}
  draft.animations=[...groups.values()];changed();configureMotions(viewer.model.runtime,draft.animations);renderMotions();
};
$('add-motion').onclick=()=>{draft.animations.push({id:uid(),name:'Yeni hareket',duration:1,mode:'toggle',smooth:false,tracks:[]});changed();renderMotions();};
$('ar-preview').onchange=()=>{componentNodes.arPreview=$('ar-preview').checked;refreshComponentPreview();viewer.reframe();};
$('ar-enabled').onchange=()=>{readFields();changed();};
addARControls({get model(){return viewer?.model;},toDataURL:()=>viewer.toDataURL()},$('review-ar'),m=>notice(m));
