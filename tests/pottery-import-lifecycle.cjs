'use strict';
// Actual studio callbacks and vendored CPU model; no browser, Canvas encoding or GPU claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {pathToFileURL} = require('node:url');

const sourceFile = path.resolve(process.argv[2] || path.join(__dirname, '../enhancements/pottery-studio.js'));
const source = fs.readFileSync(sourceFile, 'utf8'), lines = source.split(/\r?\n/), checks = [], failures = [];
function lineWith(marker) {
    const line = lines.find(line => line.includes(marker));
    assert(line, 'Missing actual source marker: ' + marker);
    return line.trim();
}
function declaration(name) {
    const marker = ' function ' + name + '(', start = source.indexOf(marker);
    assert(start >= 0, 'Missing actual function: ' + name);
    const firstEnd = source.indexOf('\n', start), first = source.slice(start, firstEnd).trim();
    if (first.endsWith('}')) return first;
    const rest = source.slice(firstEnd), closing = /^ \}/m.exec(rest);
    assert(closing, 'Missing function closing: ' + name);
    return source.slice(start, firstEnd + closing.index + closing[0].length).trim();
}
function registration(marker) { return lineWith(marker); }
const posterRegistration = /^  listen\(poster,'click',async\(\)=>\{[\s\S]*?^  \}\);/m.exec(source)?.[0];
assert(posterRegistration, 'Use the actual PNG action');
const wordsSource = source.slice(source.indexOf('const words='), source.indexOf('\nconst sectionWords='));

(async () => {
    const sourceRoot = path.dirname(path.dirname(sourceFile));
    const THREE = await import(pathToFileURL(path.join(sourceRoot, 'vendor/three.module.js')));
    const {createPotteryModel} = await import(pathToFileURL(path.join(sourceRoot, 'enhancements/pottery-model.js')));
    const candidate = createPotteryModel({THREE, preset: 'jar'}), incoming = candidate.serialize(); candidate.dispose();
    function fixture(language = 'zh') {
        const nodes = new Map(), timers = new Map(), storage = new Map(), urls = new Set(), revoked = [], blobs = [];
        let nextTimer = 1, nextURL = 1;
        function node(dataset = {}) {
            return {dataset, hidden: true, disabled: false, value: '', handlers: new Map(), attributes: new Map(),
                addEventListener(type, fn, options) {
                    const listeners = this.handlers.get(type) || []; listeners.push(fn); this.handlers.set(type, listeners);
                    options?.signal?.addEventListener('abort', () => this.handlers.delete(type), {once: true});
                }, setAttribute(key, value) {this.attributes.set(key, value);},
                removeAttribute(key) {this.attributes.delete(key); delete this[key];},
                releasePointerCapture() {}, setPointerCapture() {},
                getBoundingClientRect() {return {width: 300};}, remove() {this.removed = true;}};
        }
        const $ = selector => {if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector);};
        const modeButtons = ['solid', 'wire'].map(mode => node({mode}));
        const viewButtons = ['front', 'rim', 'section'].map(view => node({view}));
        const root = node(); root.querySelectorAll = selector => selector === '[data-mode]' ? modeButtons : viewButtons;
        const model = createPotteryModel({THREE}), initial = model.serialize();
        let restores = 0, writes = 0, renderCalls = 0;
        const restore = model.restore; model.restore = raw => {restores++; return restore(raw);};
        const ctx = new Proxy({}, {get: () => () => {}});
        const context = vm.createContext({$, root, __model: model, initial, performance: {now: () => 1000},
            lifetime: new AbortController(), references: new Map(), referenceKind: 'off',
            profile: node(), preview: node(), angle: node(), radius: node(), band: node(), preset: node(), poster: node(),
            posterImage: node(), sectionButton: node(), sectionControls: node(), sectionHeight: node(), sectionOutput: node(),
            draftStatus: node(), status: {textContent: 'initial'}, shapingTool: node(), shapingHint: node(), Blob,
            URL: {createObjectURL() {const url = 'blob:fixture/' + nextURL++; urls.add(url); return url;},
                revokeObjectURL(url) {urls.delete(url); revoked.push(url);}},
            setTimeout(fn, delay) {const id = nextTimer++; timers.set(id, {fn, delay}); return id;},
            clearTimeout(id) {timers.delete(id);},
            localStorage: {setItem(key, value) {writes++; storage.set(key, value);}}, draftKey: 'fixture-draft',
            document: {createElement(type) {assert.equal(type, 'canvas'); return {width: 0, height: 0,
                getContext: () => ctx, toBlob(callback) {blobs.push(callback);}};}},
            console: {warn() {}},
            updateHistory() {}, drawProfile() {}, placePreview() {}, prepareWire() {},
            render() {renderCalls++;return true;}, scheduleRender() {renderCalls++;}});
        context.shapingTool.value='precision';const customHeight=node();context.band.querySelector=()=>customHeight;
        vm.runInContext(wordsSource + ';this.t=words[' + JSON.stringify(language) + ']', context);
        vm.runInContext(source.slice(source.indexOf('const shapingWords='),source.indexOf('export function mountPottery'))+';Object.assign(t,shapingWords['+JSON.stringify(language)+']);',context);
        vm.runInContext([
            // Return the listener's result only so this CPU fixture can await the real async callback.
            lineWith('const listen=(node,event,fn)=>').replace('if(!suspended)fn(...args);', 'if(!suspended)return fn(...args);'),
            lineWith('let active=true,suspended=false,model=null,'),
            lineWith('let wireAttempted=false,'), lineWith('const bands=[.08,'), 'model=__model;',
            "const say=text=>{status.textContent=text;};",
            ...['updatePosterControls', 'clearExports', 'flushDraft', 'queueDraft', 'previewNormalization', 'fitPreviewUnit', 'fitFraming', 'mapping', 'radiusAt', 'selection', 'syncHeight', 'syncShapingTool', 'applyPending',
                'finishEdit', 'finishRotation', 'changed', 'beginBand', 'nudge', 'flushOnLeave', 'suspend', 'resume',
                'clearSection', 'syncView', 'dispose'].map(declaration),
            registration("listen(radius,'input'"), registration("listen(band,'change'"), registration("listen(shapingTool,'change'"),
            registration('for(const action of [\'undo\',\'redo\'])'),
            registration("listen(preset,'change'"),
            registration("for(const button of root.querySelectorAll('[data-mode]'))"),
            registration("for(const button of root.querySelectorAll('[data-view]'))listen("),
            registration("listen(sectionHeight,'input'"), registration("listen(angle,'input'"),
            registration("listen(preview,'pointerdown'"), registration("listen(preview,'pointermove'"),
            registration('listen($(\'[data-action="importDesign"]\'),\'change\''), posterRegistration
        ].join('\n'), context, {filename: sourceFile});
        function run(code) {return vm.runInContext(code, context);}
        function fire(target, type, event = {}) {
            const handlers = target.handlers.get(type); assert(handlers?.length, 'Missing actual listener: ' + type);
            return handlers.at(-1)({target, preventDefault() {}, ...event});
        }
        function beginImport(raw = incoming) {
            let resolveRead, rejectRead;
            const file = {size: Buffer.byteLength(raw), text: () => new Promise((resolve, reject) => {resolveRead = resolve; rejectRead = reject;})};
            const input = $('[data-action="importDesign"]'); input.files = [file]; input.value = 'selected.json';
            const done = fire(input, 'change'); assert.equal(input.value, '', 'Same file must remain selectable');
            return {done, resolve: () => resolveRead(raw), reject: () => rejectRead(new Error('read failed'))};
        }
        function seedExports() {
            run("pngURL='blob:old-png';designURL='blob:old-json';");
            urls.add('blob:old-png'); urls.add('blob:old-json');
            for (const key of ['download', 'designDownload']) {const link = $('[data-action="' + key + '"]'); link.hidden = false; link.href = 'blob:old';}
            context.posterImage.hidden = false; context.posterImage.src = 'blob:old-png';
        }
        function clean() {if (run('active')) run('dispose()');}
        return {run, fire, beginImport, seedExports, clean, model, initial, context, $, modeButtons, viewButtons,
            blobs, revoked, urls, timers, storage, get restores() {return restores;}, get writes() {return writes;},
            get renders() {return renderCalls;}, status: () => context.status.textContent};
    }
    async function check(name, action) {
        const f = fixture();
        try {await action(f); checks.push(name);} catch (error) {failures.push({name, message: error.message});}
        finally {f.clean();}
    }
    for (const [name, action] of [
        ['angle', f => f.fire(f.context.angle, 'input')],
        ['shaping-tool-natural', f => {f.context.shapingTool.value='natural';f.fire(f.context.shapingTool,'change');}],
        ['shaping-tool-return-precision', f => {for(const value of ['natural','precision']){f.context.shapingTool.value=value;f.fire(f.context.shapingTool,'change');}}],
        ['preview-drag', f => {f.fire(f.context.preview, 'pointerdown', {isPrimary: true, button: 0, pointerId: 1, clientX: 10}); f.fire(f.context.preview, 'pointermove', {pointerId: 1, clientX: 50});}],
        ['rim-view', f => f.fire(f.viewButtons[1], 'click')],
        ['section-view', f => {f.fire(f.viewButtons[2], 'click'); f.fire(f.context.sectionHeight, 'input');}],
        ['wire-grid', f => f.fire(f.modeButtons[1], 'click')],
        ['PNG', async f => {const pending = f.fire(f.context.poster, 'click'); assert.equal(f.blobs.length, 1); f.blobs.shift()({}); await pending;}]
    ]) await check('display-' + name + '-does-not-cancel-import', async f => {
        const job = f.beginImport(); await action(f); job.resolve(); await job.done;
        assert.equal(f.restores, 1, 'Display-only action must not discard a valid import');
        assert.equal(f.model.serialize(), incoming); assert.equal(f.status(), f.context.t.imported);
    });
    await check('idle-tool-change-preserves-exports-history-draft-and-pending-import',async f=>{f.seedExports();const job=f.beginImport(),before=f.model.serialize(),state=f.run('JSON.stringify({shapeRevision,generation,importToken,draftDirty,saveTimer,pngURL,designURL})'),renders=f.renders;for(const value of ['natural','precision']){f.context.shapingTool.value=value;f.fire(f.context.shapingTool,'change');}assert.equal(f.model.serialize(),before);assert.equal(f.run('JSON.stringify({shapeRevision,generation,importToken,draftDirty,saveTimer,pngURL,designURL})'),state);assert.equal(f.renders,renders);assert.equal(f.writes,0);assert.equal(f.revoked.length,0);assert.equal(f.$('[data-action="download"]').hidden,false);assert.equal(f.model.getProfile().canUndo,false);assert.equal(f.context.shapingHint.textContent,f.context.t.precisionHint);job.resolve();await job.done;assert.equal(f.restores,1);});
    await check('successful-import-invalidates-old-output-and-saves-draft', async f => {
        f.seedExports(); const job = f.beginImport(); job.resolve(); await job.done;
        assert.equal(f.$('[data-action="download"]').hidden, true);
        assert.equal(f.$('[data-action="designDownload"]').hidden, true);
        assert.equal(f.context.posterImage.hidden, true);
        assert(f.revoked.includes('blob:old-png')); assert(f.revoked.includes('blob:old-json'));
        f.run('flushDraft()'); assert.equal(f.storage.get('fixture-draft'), incoming);
    });
    for (const [name, action] of [
        ['nudge', f => f.run('nudge(1)')],
        ['radius-stroke', f => {f.context.radius.value = '10'; f.fire(f.context.radius, 'input'); f.run('finishEdit()');}],
        ['undo', f => {assert(f.model.reset('bowl')); f.run('changed()'); f.fire(f.$('[data-action="undo"]'), 'click');}],
        ['reset', f => {f.context.preset.value = 'bowl'; f.fire(f.context.preset, 'change');}]
    ]) await check('actual-edit-' + name + '-cancels-import-with-notice', async f => {
        const job = f.beginImport(); await action(f); const edited = f.model.serialize();
        assert.notEqual(edited, incoming);
        job.resolve(); await job.done; assert.equal(f.restores, 0); assert.equal(f.model.serialize(), edited);
        assert.equal(f.status(), f.context.t.importCancelled); assert(f.context.t.importCancelled);
    });
    await check('redo-cancels-pending-import', async f => {
        f.run('nudge(1)'); f.fire(f.$('[data-action="undo"]'), 'click');
        const job = f.beginImport(); f.fire(f.$('[data-action="redo"]'), 'click'); const edited = f.model.serialize();
        job.resolve(); await job.done; assert.equal(f.restores, 0); assert.equal(f.model.serialize(), edited);
        assert.equal(f.status(), f.context.t.importCancelled);
    });
    await check('active-uncommitted-edit-cancels-import', async f => {
        const job = f.beginImport(); f.run('beginBand()'); job.resolve(); await job.done;
        assert.equal(f.restores, 0); assert.equal(f.model.serialize(), f.initial);
        assert.equal(f.status(), f.context.t.importCancelled);
    });
    await check('no-op-reset-does-not-cancel-import', async f => {
        const job = f.beginImport(); f.context.preset.value = 'vase'; f.fire(f.context.preset, 'change');
        job.resolve(); await job.done; assert.equal(f.restores, 1);
    });
    await check('stationary-stroke-does-not-cancel-import', async f => {
        const job = f.beginImport(); f.run('nudge(0)');
        assert.equal(f.model.serialize(), f.initial);
        job.resolve(); await job.done; assert.equal(f.restores, 1);
    });
    await check('same-document-import-keeps-existing-refresh-contract', async f => {
        f.seedExports(); const job = f.beginImport(f.initial); job.resolve(); await job.done;
        assert.equal(f.restores, 1); assert.equal(f.revoked.length, 2);
        assert.equal(f.$('[data-action="download"]').hidden, true); assert.equal(f.status(), f.context.t.imported);
    });
    await check('newer-file-owns-commit-and-late-failure-is-silent', async f => {
        const older = f.beginImport(f.initial), newer = f.beginImport(); newer.resolve(); await newer.done;
        const message = f.status(); older.reject(); await older.done;
        assert.equal(f.restores, 1); assert.equal(f.model.serialize(), incoming); assert.equal(f.status(), message);
    });
    await check('newer-file-ignores-late-valid-old-file', async f => {
        const older = f.beginImport(f.initial), newer = f.beginImport(); newer.resolve(); await newer.done;
        const message = f.status(); older.resolve(); await older.done;
        assert.equal(f.restores, 1); assert.equal(f.model.serialize(), incoming); assert.equal(f.status(), message);
    });
    for (const operation of ['suspend()', 'dispose()']) await check(operation + '-blocks-late-read-and-writes', async f => {
        const job = f.beginImport(); f.run(operation); const writes = f.writes, message = f.status();
        job.resolve(); await job.done; assert.equal(f.restores, 0); assert.equal(f.writes, writes); assert.equal(f.status(), message);
        if (operation === 'suspend()') {f.run('resume()'); assert.equal(f.model.serialize(), f.initial);}
    });
    await check('resume-does-not-revive-cancelled-import', async f => {
        const job = f.beginImport(); f.run('suspend();resume()'); job.resolve(); await job.done;
        assert.equal(f.restores, 0); assert.equal(f.model.serialize(), f.initial); assert.equal(f.writes, 0);
    });
    await check('late-PNG-cannot-reappear-after-import', async f => {
        const poster = f.fire(f.context.poster, 'click'), job = f.beginImport(); job.resolve(); await job.done;
        f.blobs.shift()({}); await poster; assert.equal(f.$('[data-action="download"]').hidden, true); assert.equal(f.urls.size, 0);
    });
    await check('invalid-file-preserves-document-and-output', async f => {
        f.seedExports(); const job = f.beginImport('{'); job.resolve(); await job.done;
        assert.equal(f.model.serialize(), f.initial); assert.equal(f.revoked.length, 0);
        assert.equal(f.status(), f.context.t.importFailed);
    });
    const en = fixture('en');
    try {assert.equal(typeof en.context.t.importCancelled, 'string'); assert.match(en.context.t.importCancelled, /cancelled|canceled/i); checks.push('English-edit-conflict-notice');}
    catch (error) {failures.push({name: 'English-edit-conflict-notice', message: error.message});} finally {en.clean();}
    const sha = bytes => createHash('sha256').update(bytes).digest('hex');
    const report = {source: sourceFile, sourceSHA256: sha(source), testSHA256: sha(fs.readFileSync(__filename)),
        scope: 'Actual extracted studio functions/listeners plus vendored Three CPU geometry/model; DOM, timers and PNG encoding are controlled stubs. The listener wrapper only returns the callback promise so the fixture can await it. No browser, UI, GPU or real-device claim.',
        passed: checks.length, failed: failures.length, checks, failures};
    console.log(JSON.stringify(report, null, 2));
    if (failures.length) process.exitCode = 1;
})().catch(error => {console.error(error); process.exitCode = 1;});
