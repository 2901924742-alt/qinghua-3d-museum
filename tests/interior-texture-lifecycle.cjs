const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const file = path.resolve(__dirname, '../enhancements/interior.js');
const source = fs.readFileSync(file, 'utf8')
    .replace("import {interiorData} from './interior-data.js';", '')
    .replaceAll('export function ', 'function ')
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(file).href));
const fallback = 'Unavailable; curved glaze fallback retained';

(async () => {
    const THREE = await import(pathToFileURL(path.resolve(__dirname, '../vendor/three.module.js')).href);
    const {interiorData} = await import(pathToFileURL(path.resolve(__dirname, '../enhancements/interior-data.js')).href);
    const failures = [], checks = [];
    for (const [key, spec] of Object.entries(interiorData)) {
        const original = new THREE.Group();
        // Only the documented geometry signature matters to these loader lifecycle cases.
        for (const signature of spec.signature.split(',')) {
            const [vertices, indices] = signature.split(':').map(Number), geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(vertices * 3), 3));
            geometry.setIndex(Array(indices).fill(0));
            original.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
        }
        for (const mode of ['success', 'error', 'timeout', 'dispose', 'throw', 'sync-success', 'sync-error', 'sync-success-throw', 'sync-dispose']) {
            const label = `${key}/${mode}`, timers = new Map();
            const model = original.clone(true), textures = [];
            let now = 0, timerId = 0, callbacks, loads = 0;
            class TextureLoader {
                load(url, onLoad, progress, onError) {
                    loads++;
                    assert(url.endsWith(`/interior-textures/${key}.png`));
                    if (mode === 'throw') throw Error('Injected load throw');
                    const texture = new THREE.Texture();
                    texture.disposals = 0;
                    texture.addEventListener('dispose', () => texture.disposals++);
                    textures.push(texture); callbacks = {success: () => onLoad(texture), error: () => onError(Error('Injected texture failure'))};
                    if (mode.startsWith('sync-success')) callbacks.success();
                    if (mode === 'sync-success-throw') throw Error('Injected throw after callback');
                    if (mode === 'sync-error') callbacks.error();
                    if (mode === 'sync-dispose') model.getObjectByName(`museum-display-interior-${key}`).material.dispose();
                    return texture;
                }
            }
            const context = {THREE: {...THREE, TextureLoader}, interiorData, URL, document: {}, performance: {now: () => now},
                setTimeout(fn, delay) {const id = ++timerId; timers.set(id, {fn, deadline: now + delay}); return id;},
                clearTimeout(id) {timers.delete(id);}};
            vm.createContext(context);
            vm.runInContext(source + ';globalThis.addInterior=addInterior;', context, {filename: file});
            try {
                const result = context.addInterior(context.THREE, model, key), material = result.meshes[0].material;
                assert.equal(result.added, true); assert.equal(loads, 1);
                assert.equal(context.addInterior(context.THREE, model, key), result, 'Repeated installation must not start another load');
                let settled = 0, rejection;
                result.ready.then(() => settled++, error => {rejection = error;});
                const flush = async () => {await Promise.resolve(); await Promise.resolve();};
                const advance = milliseconds => {now += milliseconds; for (const [id, timer] of [...timers]) if (timer.deadline <= now) {timers.delete(id); timer.fn();}};
                const success = mode === 'success' || mode === 'sync-success';
                if (!mode.startsWith('sync-') && mode !== 'throw') {
                    await flush(); assert.equal(settled, 0, 'Pending load must not resolve early'); assert.equal(timers.size, 1);
                    if (mode === 'success') callbacks.success();
                    if (mode === 'error') callbacks.error();
                    if (mode === 'dispose') material.dispose();
                    if (mode === 'timeout') {advance(4999); await flush(); assert.equal(settled, 0); advance(1);}
                }
                await flush();
                assert.equal(rejection, undefined, 'Texture failure must not reject the model-ready promise');
                assert.equal(settled, 1, 'Every load/disposal/timeout path must settle ready');
                assert.equal(timers.size, 0, 'Settled texture may not retain its timeout');
                if (success) {
                    assert.equal(material.map, textures[0]); assert.equal(textures[0].disposals, 0);
                    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace); assert.equal(material.map.flipY, false); assert.equal(material.map.wrapS, THREE.RepeatWrapping);
                } else {
                    assert.equal(material.map, null, 'Failed/disposed texture must retain the curved glaze fallback');
                    assert(textures.every(texture => texture.disposals === 1), 'Every failed returned texture must be released once');
                }
                if (callbacks) {callbacks.error(); callbacks.success(); callbacks.success();}
                advance(10000); await flush();
                assert.equal(settled, 1); assert.equal(timers.size, 0); assert.equal(material.map, success ? textures[0] : null);
                assert(textures.every(texture => texture.disposals === (success ? 0 : 1)), 'Late or repeated callbacks must neither reactivate nor dispose an active texture');
                assert.equal(result.report.decoration, success ? 'Display reconstruction loaded' : fallback);
                assert.equal(model.userData.museumInterior.decoration, result.report.decoration, 'QA metadata must reflect the final texture result');
                assert.equal(material._listeners?.dispose?.length ?? 0, 0, 'Settled texture may not retain the pending dispose listener');
                checks.push(label);
            } catch (error) {failures.push({label, error: String(error.stack || error)});}
        }
    }
    console.log(JSON.stringify({passed: failures.length === 0, checks: checks.length, cases: checks, failures}, null, 2));
    assert.equal(failures.length, 0, `${failures.length} texture lifecycle cases failed`);
})().catch(error => {console.error(error); process.exitCode = 1;});
