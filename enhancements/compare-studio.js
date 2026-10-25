const labels = {
  zh: {
    title: '四器对读', intro: '选择两件青花瓷，生成同视角对照图；切换纹饰与轮廓，比较口沿、肩颈和纹饰布局。',
    first: '左侧展品', second: '右侧展品', angle: '共同视角', front: '正面', side: '侧面', texture: '看纹饰', silhouette: '看轮廓', generate: '生成对照', retry: '重新对照',
    choose: '选择两件不同的展品，再生成对照。', same: '请选择两件不同的展品。', preparing: (n, name) => `正在准备 ${n}/2：${name}…`, ready: '对照已生成。可切换轮廓与纹饰，或保存对照图。',
    failed: '对照暂时生成失败；当前展馆不受影响，请重试。', timeout: '准备快照超时，请检查网络并重新对照。', unavailable: '展品对照暂不可用，仍可返回展馆观察模型。',
    normalized: '两件展品按统一显示高度排列，仅比较形态与纹饰，不代表文物的实际大小或比例。',
    reconstruction: '缺失的内部结构与纹饰为展示性重建，非实测；本对照不能作为年代、真伪或尺寸鉴定依据。',
    clues: '观察线索：', metadata: '展品资料与来源', unknown: '本数字模型的原件、年代、实物尺寸、收藏出处和最初制作来源尚未核实。', source: '查看馆方原始资料',
    export: '生成对照 PNG', exporting: '正在生成对照图片…', save: '保存对照 PNG', exportReady: '对照图片已生成；手机也可长按图片保存。', exportError: '图片生成失败，请重试。',
    alt: '两件青花瓷的归一化对照图', caption: '天传数字博物馆 · 四器对读', mode: '对照方式', image: '实际模型快照'
  },
  en: {
    title: 'Compare the vessels', intro: 'Choose two vessels and compare their rims, shoulders and decoration in matching snapshots. Switch decoration and silhouette, or save the comparison.',
    first: 'Left exhibit', second: 'Right exhibit', angle: 'Shared viewpoint', front: 'Front', side: 'Side', texture: 'Decoration', silhouette: 'Silhouette', generate: 'Create comparison', retry: 'Try comparison again',
    choose: 'Choose two different exhibits, then create the comparison.', same: 'Choose two different exhibits.', preparing: (n, name) => `Preparing ${n}/2: ${name}…`, ready: 'Comparison ready. Switch between decoration and silhouette, or save the image.',
    failed: 'The comparison could not be prepared. The museum remains available; please retry.', timeout: 'Snapshot preparation timed out. Check the connection and retry.', unavailable: 'Comparison is unavailable. You can still return to the museum to inspect the models.',
    normalized: 'Both exhibits use a common display height for shape and decoration comparison. This is not their actual size or physical scale.',
    reconstruction: 'Missing interior shape and decoration are display reconstructions, not measurements. This comparison is not evidence for dating, authenticity or dimensions.',
    clues: 'Look for: ', metadata: 'Object information and sources', unknown: 'The original object, date, physical dimensions, collection and initial model-making source of this digital model have not been verified.', source: 'Open the museum source',
    export: 'Create comparison PNG', exporting: 'Creating comparison image…', save: 'Save comparison PNG', exportReady: 'Image ready. On mobile, hold the preview to save it.', exportError: 'The image could not be generated. Please retry.',
    alt: 'Normalized comparison of two blue-and-white porcelain vessels', caption: 'Tianchuan Digital Museum · Vessel comparison', mode: 'Comparison mode', image: 'Actual model snapshot'
  }
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function plainIntro(html) {
  return String(html || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/^(?:制作人：[^\n]*|Created by[^\n]*)\s*/, '').trim();
}

function release(canvas) {
  if (canvas) { canvas.width = 0; canvas.height = 0; }
}

export function mountCompare(container, {language = 'zh', exhibits = [], captureExhibit} = {}) {
  const lang = language === 'en' ? 'en' : 'zh', t = labels[lang];
  const section = element('section', 'innovation-compare');
  section.append(element('h3', '', t.title), element('p', 'innovation-intro', t.intro));
  container.append(section);
  if (exhibits.length < 2 || typeof captureExhibit !== 'function') {
    section.append(element('p', '', t.unavailable));
    return {dispose() { section.remove(); }};
  }

  let disposed = false, generation = 0, controller = null, pair = null, angle = 0, mode = 'texture', exportURL = null;
  const listeners = [];
  const listen = (node, type, fn) => { node.addEventListener(type, fn); listeners.push(() => node.removeEventListener(type, fn)); };
  const controls = element('div', 'innovation-compare-controls');
  const selects = [t.first, t.second].map((label, slot) => {
    const wrapper = element('label', 'innovation-compare-field', label);
    const select = element('select');
    exhibits.forEach((exhibit, index) => {
      const option = element('option', '', exhibit[lang]?.exhibit || exhibit.zh?.exhibit || exhibit.id);
      option.value = String(index); select.append(option);
    });
    select.value = String(slot); wrapper.append(select); controls.append(wrapper); return select;
  });
  const angleLabel = element('label', 'innovation-compare-field', t.angle);
  const angleSelect = element('select');
  [t.front, t.side].forEach((name, index) => { const option = element('option', '', name); option.value = String(index); angleSelect.append(option); });
  angleSelect.value = '0'; angleLabel.append(angleSelect);
  const generate = element('button', 'innovation-compare-generate', t.generate); generate.type = 'button';
  controls.append(angleLabel, generate); section.append(controls);
  const modeBar = element('div', 'innovation-compare-modes'); modeBar.setAttribute('role', 'group'); modeBar.setAttribute('aria-label', t.mode);
  const modeButtons = ['texture', 'silhouette'].map(value => {
    const button = element('button', '', value === 'texture' ? t.texture : t.silhouette); button.type = 'button';
    button.setAttribute('aria-pressed', String(mode === value)); modeBar.append(button);
    listen(button, 'click', () => {
      mode = value; modeButtons.forEach((item, index) => item.setAttribute('aria-pressed', String((index === 0 ? 'texture' : 'silhouette') === mode)));
      if (pair) pair.forEach(item => { item.canvas.style.filter = mode === 'silhouette' ? 'brightness(0) invert(1)' : ''; });
      clearExport();
    });
    return button;
  });
  section.append(modeBar);
  const status = element('p', 'innovation-status', t.choose); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const results = element('div', 'innovation-compare-results'); results.setAttribute('aria-busy', 'false'); results.tabIndex = -1;
  results.setAttribute('role', 'group'); results.setAttribute('aria-label', t.title);
  const note = element('p', 'innovation-note', t.normalized);
  const reconstruction = element('p', 'innovation-note', t.reconstruction);
  const exportButton = element('button', 'innovation-compare-export', t.export); exportButton.type = 'button'; exportButton.disabled = true;
  const exportArea = element('div', 'innovation-compare-download');
  section.append(status, results, note, reconstruction, exportButton, exportArea);

  function clearExport() {
    if (exportURL) URL.revokeObjectURL(exportURL);
    exportURL = null; exportArea.replaceChildren();
  }
  function clearPair() {
    if (pair) pair.forEach(item => release(item.canvas));
    pair = null; results.replaceChildren(); exportButton.disabled = true; clearExport();
  }
  function reset() {
    generation++; controller?.abort(); controller = null; clearPair();
    results.setAttribute('aria-busy', 'false'); generate.textContent = t.generate;
    const same = selects[0].value === selects[1].value;
    generate.disabled = same; status.textContent = same ? t.same : t.choose;
  }
  selects.forEach(select => listen(select, 'change', reset));
  listen(angleSelect, 'change', () => { angle = angleSelect.value === '1' ? Math.PI / 2 : 0; reset(); });

  function capture(index, signal, token) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', aborted); fn(value);
      };
      const aborted = () => finish(reject, new DOMException('Aborted', 'AbortError'));
      const timer = setTimeout(() => { finish(reject, new Error('comparison-timeout')); controller?.abort(); }, 30000);
      signal.addEventListener('abort', aborted, {once: true});
      Promise.resolve().then(() => {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        return captureExhibit(index, signal, angle);
      }).then(canvas => {
        if (settled || disposed || token !== generation || signal.aborted) { release(canvas); aborted(); return; }
        if (!canvas || !(canvas.width > 0 && canvas.height > 0)) { release(canvas); finish(reject, new Error('Invalid comparison snapshot')); return; }
        finish(resolve, canvas);
      }, error => finish(reject, error));
    });
  }
  function addCard(item) {
    const exhibit = exhibits[item.index], info = exhibit[lang] || exhibit.zh || {};
    const card = element('article', 'innovation-compare-card');
    card.append(element('h4', '', info.exhibit || exhibit.id));
    item.canvas.setAttribute('role', 'img'); item.canvas.setAttribute('aria-label', `${t.image}: ${info.exhibit || exhibit.id}`);
    item.canvas.className = 'innovation-compare-snapshot'; item.canvas.style.filter = mode === 'silhouette' ? 'brightness(0) invert(1)' : '';
    card.append(item.canvas);
    const clues = exhibit.hotspots?.map(hotspot => hotspot[lang]?.[0]).filter(Boolean);
    if (clues?.length) card.append(element('p', 'innovation-compare-clues', t.clues + clues.join(' · ')));
    const details = element('details', 'innovation-compare-metadata'); details.append(element('summary', '', t.metadata));
    details.append(element('p', '', plainIntro(info.intro) || t.unknown));
    if (exhibit.source?.[1]) {
      try {
        const url = new URL(exhibit.source[1]);
        if (url.protocol === 'https:') {
          const source = element('a', '', t.source); source.href = url.href; source.target = '_blank'; source.rel = 'noopener noreferrer'; details.append(source);
        }
      } catch { /* Invalid source URLs are not presented as verified references. */ }
    }
    card.append(details); results.append(card);
  }
  async function start() {
    reset();
    const indices = selects.map(select => Number(select.value));
    if (generate.disabled || indices.some(index => !Number.isInteger(index) || index < 0 || index >= exhibits.length)) return;
    const token = generation, current = new AbortController(), pending = []; controller = current;
    generate.disabled = true; results.setAttribute('aria-busy', 'true');
    try {
      for (const [slot, index] of indices.entries()) {
        status.textContent = t.preparing(slot + 1, exhibits[index][lang]?.exhibit || exhibits[index].id);
        pending.push({index, canvas: await capture(index, current.signal, token)});
        if (disposed || token !== generation || current.signal.aborted) return;
      }
      pair = pending.splice(0); pair.forEach(addCard); exportButton.disabled = false; status.textContent = t.ready;
      try {
        results.focus?.({preventScroll: true});
        const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        results.scrollIntoView?.({behavior: reduced ? 'auto' : 'smooth', block: 'start', inline: 'nearest'});
      } catch { /* Optional focus and scrolling must not invalidate the generated comparison. */ }
    } catch (error) {
      if (!disposed && token === generation) { clearPair(); status.textContent = error.message === 'comparison-timeout' ? t.timeout : t.failed; generate.textContent = t.retry; }
    } finally {
      pending.forEach(item => release(item.canvas));
      if (!disposed && token === generation) { results.setAttribute('aria-busy', 'false'); generate.disabled = false; controller = null; }
    }
  }
  listen(generate, 'click', start);

  function wrap(ctx, text, x, y, width, lineHeight) {
    let line = '';
    for (const part of lang === 'en' ? text.match(/\S+\s*/g) || [] : text) {
      if (ctx.measureText(line + part).width > width && line) { ctx.fillText(line.trimEnd(), x, y); y += lineHeight; line = part; }
      else line += part;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineHeight;
  }
  async function exportPNG() {
    if (!pair || disposed) return;
    const token = generation, snapshots = pair, currentMode = mode;
    exportButton.disabled = true; status.textContent = t.exporting; clearExport();
    const canvas = element('canvas'); canvas.width = 1600; canvas.height = 1510;
    const ctx = canvas.getContext('2d'), silhouette = element('canvas');
    try {
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#061123'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 40px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#e9f1ff'; ctx.fillText(t.caption, 48, 70);
      ctx.font = '23px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#a9c8ef'; ctx.fillText(`${angle === 0 ? t.front : t.side} · ${currentMode === 'texture' ? t.texture : t.silhouette}`, 48, 112);
      snapshots.forEach((item, slot) => {
        const x = 44 + slot * 780, image = item.canvas;
        ctx.fillStyle = '#0b1b32'; ctx.fillRect(x, 145, 732, 1135);
        ctx.font = 'bold 27px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#e9f1ff';
        wrap(ctx, exhibits[item.index][lang]?.exhibit || exhibits[item.index].id, x + 28, 191, 676, 38);
        let source = image;
        if (currentMode === 'silhouette') {
          silhouette.width = image.width; silhouette.height = image.height;
          const mask = silhouette.getContext('2d'); if (!mask) throw new Error('Canvas unavailable');
          mask.drawImage(image, 0, 0); mask.globalCompositeOperation = 'source-in'; mask.fillStyle = '#bdd7ff'; mask.fillRect(0, 0, image.width, image.height); source = silhouette;
        }
        const scale = Math.min(660 / image.width, 920 / image.height), width = image.width * scale, height = image.height * scale;
        ctx.drawImage(source, x + (732 - width) / 2, 272 + (920 - height) / 2, width, height);
        ctx.font = '22px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#b9cce5';
        ctx.fillText(`${String(item.index + 1).padStart(2, '0')} / ${String(exhibits.length).padStart(2, '0')}`, x + 28, 1245);
      });
      ctx.font = '23px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#c2d2e8';
      const bottom = wrap(ctx, t.normalized, 48, 1330, 1504, 34); wrap(ctx, t.reconstruction, 48, bottom + 10, 1504, 34);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
      if (disposed || token !== generation || currentMode !== mode) return;
      exportURL = URL.createObjectURL(blob);
      const download = element('a', 'download', t.save); download.href = exportURL; download.download = 'qinghua-vessel-comparison.png';
      const preview = element('img'); preview.src = exportURL; preview.alt = t.alt; preview.loading = 'lazy';
      exportArea.append(download, preview); status.textContent = t.exportReady;
    } catch {
      if (!disposed && token === generation) status.textContent = t.exportError;
    } finally {
      release(canvas); release(silhouette);
      if (!disposed && token === generation && pair) exportButton.disabled = false;
    }
  }
  listen(exportButton, 'click', exportPNG);
  return {
    dispose() {
      if (disposed) return; disposed = true; generation++; controller?.abort(); controller = null;
      listeners.forEach(remove => remove()); clearPair(); section.remove();
    }
  };
}
