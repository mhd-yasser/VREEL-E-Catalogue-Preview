const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  // Software WebGL in CI: keep the real renderer/materials, disable expensive shadows.
  await context.addInitScript(() => {
    const define = Object.defineProperties;
    Object.defineProperties = function (object, properties) {
      const result = define(object, properties);
      if (properties.shadowIntensity && properties.model)
        object.shadowIntensity = 0;
      return result;
    };
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => raf(callback), 120);
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8000/admin/");
  await page.locator("#example").click();
  await page.waitForFunction(
    () => document.querySelector("#notice").textContent.includes("Model hazır"),
    { timeout: 30000 },
  );
  await page.locator("#name").fill("Authoring integration desk");
  await page.locator("#next").click();
  await page.locator("#next").click();
  await page.locator("#add-group").click();
  await page.locator("#group-name").fill("Cabinet finish");
  const targetInputs = page.locator("#targets input");
  assert((await targetInputs.count()) > 1);
  await targetInputs.nth(0).check();
  await targetInputs.nth(1).check();
  await page.locator("#add-option").click();
  await page.locator("#options input[type=text]").nth(1).fill("Navy");
  await page.locator("#options input[type=color]").fill("#112244");
  await page
    .locator("#options button")
    .filter({ hasText: "Önizle" })
    .nth(1)
    .click();
  await page.locator("#save").click();
  await page.waitForFunction(
    () => document.querySelector("#state").textContent === "Taslak kaydedildi",
  );
  const id = await page.locator("#drafts").inputValue();
  assert(id);
  await page.locator("#next").click();
  assert(
    await page
      .locator("#checks")
      .textContent()
      .then((t) => t.includes("tamam")),
  );
  await page.locator("#reviewed").check();
  await page.locator("#publish").click();
  await page.locator("#public-link").waitFor({ state: "visible" });
  const published = await context.newPage();
  await published.goto(`http://127.0.0.1:8000/admin/?view=${id}`);
  await published.waitForFunction(()=>document.querySelector("#product-viewer")?.model);
  await published
    .locator("#material-groups .swatch")
    .nth(1)
    .waitFor();
  assert.equal(
    await published.locator("#material-groups .swatch").count(),
    2,
  );
  await published
    .locator("#material-groups .swatch")
    .nth(1)
    .click();
  assert.equal(
    await published
      .locator("#material-groups .swatch")
      .nth(1)
      .getAttribute("class"),
    "swatch active",
  );
  await page.locator("#back").click();
  await page.screenshot({ path: "/tmp/vreel-mapping.png", fullPage: true });
  await page.locator("#back").click();
  await page.locator("#name").fill("Unpublished revised desk");
  await page.locator("#save").click();
  await page.waitForFunction(
    () => document.querySelector("#state").textContent === "Taslak kaydedildi",
  );
  await published.reload();
  assert.equal(
    await published.locator(".panel-heading h1").textContent(),
    "Authoring integration desk",
  );
  await page.reload();
  await page.locator("#drafts").selectOption(id);
  await page.waitForFunction(
    () => document.querySelector("#name").value === "Unpublished revised desk",
  );
  await page.locator("#next").click();
  assert.equal(await page.locator("#targets input:checked").count(), 2);
  await page.locator("#back").click();
  await page
    .locator("#textures")
    .setInputFiles(path.resolve("sofa/assets/black.webp"));
  await page.locator("#attachments").setInputFiles({
    name: "private.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("PRIVATE FILE"),
  });
  await page.locator("#downloads").check();
  await page.locator("#next").click();
  await page.locator("#library button").click();
  assert.equal(await page.locator("#options .option").count(), 3);
  await page.locator("#next").click();
  assert.match(await page.locator("#checks").textContent(), /Ziyaretçiye açık/);
  assert.match(
    await page.locator("#checks").textContent(),
    /UV koordinatları eksik/,
  );
  assert.equal(await page.locator("#publish").isDisabled(), true);
  await page.locator("#back").click();
  await page.locator("#back").click();
  await page.locator(".asset-row label input").check();
  await page.locator("#next").click();
  const uvSlots = await page.evaluate(() => {
    let slot = 0;
    const eligible = [];
    document.querySelector("#viewer").model.root.traverse((node) => {
      if (!node.isMesh) return;
      for (const material of [node.material].flat()) {
        if (node.geometry.attributes.uv) eligible.push(slot);
        slot++;
      }
    });
    return eligible;
  });
  assert(uvSlots.length > 0);
  const checked = page.locator("#targets input:checked");
  while (await checked.count()) await checked.first().uncheck();
  await page.locator("#targets input").nth(uvSlots[0]).check();
  await page.locator("#next").click();
  assert.match(await page.locator("#checks").textContent(), /tamam/);
  await page.locator("#reviewed").check();
  await page.locator("#publish").click();
  await page.locator("#public-link").waitFor({ state: "visible" });
  await published.reload();
  await published
    .locator("#material-groups .swatch")
    .nth(2)
    .waitFor();
  assert.equal(await published.locator("#details a[download]").count(), 1);
  await published
    .locator("#material-groups .swatch")
    .nth(2)
    .click();
  assert.equal(
    await published
      .locator("#material-groups .swatch")
      .nth(2)
      .getAttribute("class"),
    "swatch active",
  );
  await page.locator("#back").click();
  await page.locator("#back").click();
  await page.locator("#save").click();
  await page.waitForFunction(
    () => document.querySelector("#state").textContent === "Taslak kaydedildi",
  );
  await page.reload();
  await page.locator("#drafts").selectOption(id);
  await page.waitForFunction(() =>
    document.querySelector("#model-status").textContent.includes("desk"),
  );
  await page.locator("#next").click();
  await page.locator("#next").click();
  assert.equal(await page.locator("#details a[download]").count(), 1);
  await page.screenshot({ path: "/tmp/vreel-review.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/vreel-mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  const old = await context.newPage();
  await old.goto("http://127.0.0.1:8000/chair/");
  await old.waitForFunction(
    () => document.querySelector("#product-viewer")?.model,
    { timeout: 30000 },
  );
  await old.close();
  await published.close();
  await page.close();
  const sofa = await context.newPage();
  sofa.on("pageerror", (e) => errors.push(e.message));
  await sofa.setViewportSize({ width: 1440, height: 1000 });
  await sofa.goto("http://127.0.0.1:8000/admin/");
  await sofa.locator("#name").fill("Sofa multi-part finish");
  await sofa
    .locator("#model-file")
    .setInputFiles(path.resolve("sofa/model/Sofa.glb"), { timeout: 120000 });
  await sofa.waitForFunction(() =>
    document.querySelector("#notice").textContent.includes("Model hazır"),
  );
  await sofa
    .locator("#textures")
    .setInputFiles(path.resolve("sofa/assets/burgundy.webp"));
  await sofa.locator("#next").click();
  await sofa.locator("#add-group").click();
  await sofa.locator("#group-name").fill("Deri");
  const sofaUV = await sofa.evaluate(() => {
    let slot = 0;
    const indexes = [];
    document.querySelector("#viewer").model.root.traverse((n) => {
      if (!n.isMesh) return;
      for (const m of [n.material].flat()) {
        if (n.geometry.attributes.uv) indexes.push(slot);
        slot++;
      }
    });
    return indexes;
  });
  assert(sofaUV.length >= 2);
  for (const index of sofaUV)
    await sofa.locator("#targets input").nth(index).check();
  const fixedMaps = await sofa.evaluate(() => {
    const maps = [];
    document.querySelector("#viewer").model.root.traverse((n) => {
      if (n.isMesh)
        for (const m of [n.material].flat())
          maps.push([
            m.normalMap?.uuid,
            m.roughnessMap?.uuid,
            m.metalnessMap?.uuid,
            m.roughness,
            m.metalness,
          ]);
    });
    return maps;
  });
  await sofa.locator("#library button").click();
  await sofa
    .locator("#options button")
    .filter({ hasText: "Önizle" })
    .nth(1)
    .click();
  assert.deepEqual(
    await sofa.evaluate(() => {
      const maps = [];
      document.querySelector("#viewer").model.root.traverse((n) => {
        if (n.isMesh)
          for (const m of [n.material].flat())
            maps.push([
              m.normalMap?.uuid,
              m.roughnessMap?.uuid,
              m.metalnessMap?.uuid,
              m.roughness,
              m.metalness,
            ]);
      });
      return maps;
    }),
    fixedMaps,
  );
  await sofa.locator("#add-group").click();
  for (const index of sofaUV)
    assert(await sofa.locator("#targets input").nth(index).isDisabled());
  await sofa
    .locator("#groups .group button")
    .filter({ hasText: "Sil" })
    .last()
    .click();
  await sofa.locator("#next").click();
  assert.match(await sofa.locator("#checks").textContent(), /tamam/);
  await sofa.locator("#reviewed").check();
  await sofa.locator("#publish").click();
  await sofa.locator("#public-link").waitFor({ state: "visible" });
  const gallery = await context.newPage();
  await gallery.goto("http://127.0.0.1:8000/products/");
  await gallery.locator("#local-publications").waitFor();
  assert.equal(
    await gallery.locator("#local-publications .product-card").count(),
    2,
  );
  await gallery.locator("#add-product").click();
  assert.match(gallery.url(), /\/manage\/$/);
  await gallery.locator("#create-product").click();
  assert.match(gallery.url(), /\/admin\/$/);
  await sofa.screenshot({ path: "/tmp/vreel-sofa.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real GLB, multi-target group, color and texture alternatives, persistence, protected published snapshot, private/public downloads, validation, mobile layout, existing chair viewer.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
