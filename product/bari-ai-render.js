// Isolated BARI AI render request prototype. No remote API calls.
(() => {
  const isBari = new URLSearchParams(location.search).get('catalogue') === 'orka-bari';
  if (!isBari) return;

  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  let dialog, form, wallImageUrl, previousFocus;
  const $ = (selector, root = document) => root.querySelector(selector);

  function close() {
    if (!dialog) return;
    dialog.hidden = true;
    if (wallImageUrl) URL.revokeObjectURL(wallImageUrl);
    wallImageUrl = null;
    previousFocus?.focus?.();
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('div');
    dialog.id = 'bari-ai-render-modal';
    dialog.className = 'modal bari-ai-render-modal';
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="modal-card bari-ai-render-card" role="dialog" aria-modal="true" aria-labelledby="bari-ai-title">
        <button type="button" class="modal-close" data-ai-close aria-label="Kapat">×</button>
        <p class="bari-ai-eyebrow">VREEL / BARI · DENEYSEL</p>
        <h2 id="bari-ai-title">AI Photo Render</h2>
        <p class="bari-ai-intro">Mevcut ürün, malzeme seçimleri ve kamera açısı korunarak bir görsel talebi hazırlanır.</p>
        <form id="bari-ai-render-form">
          <label for="bari-ai-output">Görsel türü</label>
          <select id="bari-ai-output" name="output" required>
            <option value="studio">Stüdyo fotoğrafı — sade arka plan</option>
            <option value="interior">İç mekân — gerçekçi banyo ortamı</option>
            <option value="marketing">Pazarlama görseli — atmosferik ışık</option>
          </select>
          <label for="bari-ai-wall">Duvar kaplama referansı <span class="bari-ai-optional">(isteğe bağlı)</span></label>
          <input id="bari-ai-wall" name="wall" type="file" accept="image/png,image/jpeg,image/webp">
          <p class="bari-ai-hint">JPG, PNG veya WebP · En fazla 8 MB. Dosya yalnızca bu tarayıcıda önizlenir.</p>
          <div class="bari-ai-wall-preview" id="bari-ai-wall-preview" hidden><img alt="Seçilen duvar kaplama referansı"></div>
          <p class="bari-ai-notice">Deneysel arayüz: AI servisi henüz bağlı değil. Hazırlanan görüntü hiçbir sunucuya gönderilmez.</p>
          <div class="bari-ai-actions">
            <button type="button" data-ai-close>Vazgeç</button>
            <button type="submit" class="primary">Sahneyi hazırla</button>
          </div>
        </form>
        <div id="bari-ai-result" hidden aria-live="polite">
          <h3>Render girdisi hazır</h3>
          <p>Ürünün mevcut açısı ve seçili malzemeleriyle alınan kaynak görüntü. AI üretimi henüz yapılmadı.</p>
          <img id="bari-ai-scene-preview" alt="3D görüntüleyiciden alınan kaynak görüntü">
          <p id="bari-ai-summary" class="bari-ai-summary"></p>
          <div class="bari-ai-actions">
            <button type="button" data-ai-back>Seçimleri düzenle</button>
            <button type="button" class="primary" id="bari-ai-save-capture">Kaynak görüntüyü indir</button>
          </div>
        </div>
      </div>`;
    document.body.append(dialog);
    form = $('#bari-ai-render-form', dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-ai-close]')) close();
      if (event.target.closest('[data-ai-back]')) {
        $('#bari-ai-result', dialog).hidden = true;
        form.hidden = false;
      }
    });
    $('#bari-ai-wall', dialog).addEventListener('change', event => {
      if (wallImageUrl) URL.revokeObjectURL(wallImageUrl);
      wallImageUrl = null;
      const file = event.target.files?.[0];
      const preview = $('#bari-ai-wall-preview', dialog);
      preview.hidden = true;
      event.target.setCustomValidity('');
      if (!file) return;
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES) {
        event.target.setCustomValidity('JPG, PNG veya WebP formatında, 8 MB altında bir görsel seçin.');
        event.target.reportValidity();
        return;
      }
      wallImageUrl = URL.createObjectURL(file);
      $('img', preview).src = wallImageUrl;
      preview.hidden = false;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const viewer = $('#product-viewer');
      if (!viewer || typeof viewer.toDataURL !== 'function') {
        alert('3D model henüz hazır değil. Lütfen tekrar deneyin.');
        return;
      }
      let capture;
      try { capture = viewer.toDataURL('image/png'); }
      catch (error) { console.error(error); alert('Görüntü alınamadı. Lütfen tekrar deneyin.'); return; }
      const output = $('#bari-ai-output', dialog);
      const file = $('#bari-ai-wall', dialog).files?.[0];
      const orbit = typeof viewer.getCameraOrbit === 'function' ? viewer.getCameraOrbit() : null;
      $('#bari-ai-scene-preview', dialog).src = capture;
      $('#bari-ai-summary', dialog).textContent =
        `Görsel türü: ${output.selectedOptions[0].textContent} · Duvar referansı: ${file?.name || 'Yok'} · Kamera: ${orbit ? [orbit.theta, orbit.phi, orbit.radius].map(v => Number(v).toFixed(2)).join(' / ') : 'Mevcut görünüm'}`;
      $('#bari-ai-save-capture', dialog).onclick = () => {
        const link = document.createElement('a');
        link.href = capture;
        link.download = 'ORKA_BARI_AI_render_source.png';
        link.click();
      };
      form.hidden = true;
      $('#bari-ai-result', dialog).hidden = false;
    });
  }

  // Capture phase prevents the pre-existing 4K exporter from running for BARI only.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-action="snapshot-4k"]');
    if (!button || !isBari) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureDialog();
    previousFocus = button;
    form.reset();
    $('#bari-ai-wall', dialog).setCustomValidity('');
    $('#bari-ai-wall-preview', dialog).hidden = true;
    $('#bari-ai-result', dialog).hidden = true;
    form.hidden = false;
    dialog.hidden = false;
    $('#bari-ai-output', dialog).focus();
  }, true);
  document.addEventListener('keydown', event => {
    if (!dialog || dialog.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const nodes = [...dialog.querySelectorAll('button:not([hidden]), input:not([hidden]), select:not([hidden])')]
        .filter(node => node.offsetParent !== null && !node.disabled);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();
