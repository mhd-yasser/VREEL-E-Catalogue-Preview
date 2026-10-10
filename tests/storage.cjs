const assert = require("node:assert/strict");
const fs = require("node:fs");
const { indexedDB } = require(
  process.env.FAKE_INDEXEDDB_MODULE || "fake-indexeddb",
);
global.indexedDB = indexedDB;
(async () => {
  const { newDraft, validation, inspectGLB, saveProduct, getProduct } =
    await import("../admin/store.js");
  const bytes = fs.readFileSync("model/desk-200-drawers-left.glb");
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  assert(inspectGLB(buffer).meshes.length > 0);
  assert.throws(() => inspectGLB(new ArrayBuffer(22)), /GLB/);
  const json = JSON.stringify({
    asset: { version: "2.0" },scenes:[{}],
    images: [{ uri: "external.jpg" }],
  });
  const padding = " ".repeat((4 - (json.length % 4)) % 4),
    encoded = Buffer.from(json + padding);
  const external = new ArrayBuffer(20 + encoded.length),
    v = new DataView(external);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, external.byteLength, true);
  v.setUint32(12, encoded.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(external, 20).set(encoded);
  assert.throws(() => inspectGLB(external), /dış dosyalara/);
  const draft = newDraft();
  draft.name = "Desk";
  draft.model = { blob: new Blob([bytes]), name: "desk.glb" };
  draft.features.dimensions = true;
  assert.deepEqual(validation(draft), []);
  draft.features.downloads = true;
  draft.assets = [
    {
      id: "private",
      kind: "attachments",
      public: false,
      blob: new Blob(["private"]),
    },
  ];
  assert(validation(draft).some((e) => e.includes("Ziyaretçiye açık")));
  draft.assets[0].public = true;
  delete draft.schemaVersion; // Existing products retain the manual material workflow.
  draft.features.configurable = true;
  draft.groups = [
    {
      id: "one",
      name: "Finish",
      targets: ["a", "b"],
      options: [
        { id: "original", label: "Original", original: true },
        { id: "navy", label: "Navy", color: "#112244" },
      ],
      defaultId: "original",
    },
  ];
  assert.deepEqual(validation(draft, ["a", "b"]), []);
  draft.groups.push({
    ...structuredClone(draft.groups[0]),
    id: "two",
    name: "Conflict",
  });
  assert(validation(draft, ["a", "b"]).some((e) => e.includes("birden fazla")));
  draft.groups.pop();
  draft.componentAssets=[{id:'alternative',name:'alternative.glb',blob:new Blob([bytes])}];
  draft.componentGroups=[{id:'size',name:'Size',defaultId:'base',options:[{id:'base',nodeId:'node-0',label:'100 cm'},{id:'other',assetId:'alternative',referenceId:'node-0',label:'85 cm'}]}];
  const record = { id: "test", draft, published: structuredClone(draft) };
  await saveProduct(record);
  record.draft.name = "Revised";
  await saveProduct(record);
  const loaded = await getProduct("test");
  assert.equal(loaded.draft.name, "Revised");
  assert.equal(loaded.published.name, "Desk");
  assert.equal(loaded.published.componentGroups[0].options[1].label,'85 cm');
  assert.deepEqual(Buffer.from(await loaded.published.componentAssets[0].blob.arrayBuffer()),bytes);
  assert.deepEqual(
    Buffer.from(await loaded.draft.model.blob.arrayBuffer()),
    bytes,
  );
  console.log(
    "PASS: GLB validity and external dependency rejection, publication requirements, conflicting group targets, persistent blobs, separate published snapshot.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
