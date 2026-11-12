// Keep downloaded bytes only; parsed exhibits and GPU resources retain their existing lifetime.
export function createExhibitCache({urls, maxBytes = 10 * 1024 * 1024, fetcher = fetch}) {
    if (!Array.isArray(urls) || urls.some(url => typeof url !== 'string' || !url)) throw new TypeError('Invalid exhibit URLs');
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('Invalid exhibit cache size');
    const allowed = new Set(urls), cache = new Map(), active = new Set();
    let size = 0, warming = null, disposed = false;
    const abortError = () => Object.assign(new Error('Exhibit download aborted'), {name: 'AbortError'});
    const reason = signal => signal?.reason ?? abortError();
    function cached(url) {
        const bytes = cache.get(url);
        if (bytes) {cache.delete(url); cache.set(url, bytes);}
        return bytes;
    }
    function forget(url) {
        const bytes = cache.get(url);
        if (bytes) {size -= bytes.byteLength; cache.delete(url);}
    }
    function remember(url, bytes) {
        if (bytes.byteLength > maxBytes) return;
        forget(url);
        while (size + bytes.byteLength > maxBytes) {
            const oldest = cache.keys().next().value;
            size -= cache.get(oldest).byteLength; cache.delete(oldest);
        }
        cache.set(url, bytes); size += bytes.byteLength;
    }
    function start(url, background) {
        const controller = new AbortController();
        let resolve, reject, settled = false;
        const task = {url, timer: null, promise: new Promise((yes, no) => {resolve = yes; reject = no;})};
        function finish(error, bytes) {
            if (settled) return;
            settled = true; clearTimeout(task.timer); active.delete(task);
            if (warming === task) warming = null;
            if (bytes === undefined) reject(error);
            else {remember(url, bytes); resolve(bytes);}
        }
        task.cancel = (error = abortError()) => {if (settled) return; controller.abort(); finish(error);};
        active.add(task);
        Promise.resolve().then(() => {
            if (settled || disposed) throw abortError();
            return fetcher(url, background ? {signal: controller.signal, priority: 'low'} : {signal: controller.signal});
        }).then(response => {
            if (settled || disposed) throw abortError();
            if (!response.ok) throw new Error(`Exhibit HTTP ${response.status}`);
            return response.arrayBuffer();
        }).then(bytes => {
            if (settled || disposed) return;
            if (!(bytes instanceof ArrayBuffer)) throw new TypeError('Invalid exhibit response');
            finish(null, bytes);
        }).catch(error => finish(error));
        return task;
    }
    function cancelWarm() {
        const task = warming; warming = null; task?.cancel();
    }
    async function load(url, signal) {
        if (disposed) throw abortError();
        if (!allowed.has(url)) throw new Error('Unknown exhibit URL');
        if (signal?.aborted) throw reason(signal);
        if (warming && warming.url !== url) cancelWarm();
        const bytes = cached(url); if (bytes) return bytes;
        const task = warming ?? start(url, false);
        // A foreground request owns an adopted prefetch; later prefetch cancellation cannot stop it.
        if (warming === task) {warming = null; clearTimeout(task.timer); task.timer = null;}
        const abort = () => task.cancel(reason(signal));
        signal?.addEventListener('abort', abort, {once: true});
        if (signal?.aborted) abort();
        try {
            const result = await task.promise;
            if (signal?.aborted) throw reason(signal);
            return result;
        } finally {signal?.removeEventListener('abort', abort);}
    }
    function warm(url) {
        if (disposed || !allowed.has(url)) return Promise.resolve(null);
        const bytes = cached(url); if (bytes) return Promise.resolve(bytes);
        if (warming?.url === url) return warming.background;
        cancelWarm();
        const task = start(url, true); warming = task;
        task.timer = setTimeout(() => task.cancel(Object.assign(new Error('Exhibit prefetch timed out'), {name: 'TimeoutError'})), 30000);
        task.background = task.promise.catch(() => null);
        return task.background;
    }
    function dispose() {
        disposed = true; warming = null;
        for (const task of active) task.cancel();
        cache.clear(); size = 0;
    }
    return {load, warm, cancelWarm, forget, dispose};
}

// One verified original base-color texture, not a parsed-model or general GPU cache.
// Keeping the exact Texture avoids re-uploading a cloned Source on a later visit.
export function createExhibitTextureCache({maxBytes = 96 * 1024 * 1024} = {}) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('Invalid exhibit texture budget');
    const entries = new Set(), managed = new WeakSet(), closedImages = new WeakSet(), models = new WeakMap();
    let cached = null, disposed = false, hits = 0, misses = 0;
    const abortError = () => Object.assign(new Error('Exhibit texture lease released'), {name: 'AbortError'});
    const mipBytes = (width, height) => {
        let bytes = 0;
        for (;;) {bytes += width * height * 4; if (width === 1 && height === 1) return bytes; width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2));}
    };
    const expectedBytes = mipBytes(4096, 4096);
    function eligible(parser, url) {
        if (url !== './qinghuaci.glb' || disposed || expectedBytes > maxBytes) return false;
        const json = parser.json, map = json.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture;
        const texture = json.textures?.[0], image = json.images?.[0], view = json.bufferViews?.[4];
        const sampler = json.samplers?.[0];
        return json.materials?.length === 1 && json.textures?.length === 2 && json.images?.length === 2 &&
            map?.index === 0 && (map.texCoord ?? 0) === 0 && !map.extensions &&
            texture?.source === 0 && texture.sampler === 0 && !texture.extensions &&
            image?.bufferView === 4 && image.mimeType === 'image/jpeg' && !image.uri &&
            view?.byteLength === 2320759 && view.byteOffset === 321088 &&
            sampler?.magFilter === 9729 && sampler.minFilter === 9987 &&
            (sampler.wrapS ?? 10497) === 10497 && (sampler.wrapT ?? 10497) === 10497;
    }
    function destroy(entry) {
        if (entry.destroyed || !entry.settled) return;
        entry.destroyed = true; entries.delete(entry); if (cached === entry) cached = null;
        const texture = entry.texture, image = texture?.image;
        try {texture?.dispose();} finally {
            if (image?.close && !closedImages.has(image)) {closedImages.add(image); image.close();}
        }
    }
    function releaseEntry(entry) {
        if (disposed || (entry.refs === 0 && !entry.keep)) destroy(entry);
    }
    function clearIdle() {
        if (cached && cached.refs === 0) {const entry = cached; cached = null; entry.keep = false; releaseEntry(entry);}
    }
    function lease(url) {
        let released = false, held = null, bound = null;
        const owner = {
            plugin(parser) {
                const enabled = eligible(parser, url);
                return {name: 'MUSEUM_original_base_color', loadTexture(index) {
                    if (!enabled || index !== 0) return null;
                    if (released || disposed) return Promise.reject(abortError());
                    if (!held) {
                        if (cached) {held = cached; hits++;}
                        else {
                            const entry = {refs: 0, texture: null, promise: null, keep: true, settled: false, destroyed: false, bytes: expectedBytes};
                            held = cached = entry; entries.add(entry); misses++;
                            // Call the parser's normal loader directly; other maps keep their normal path.
                            entry.promise = Promise.resolve().then(() => parser.loadTexture(index)).then(texture => {
                                entry.texture = texture; entry.settled = true;
                                if (texture?.isTexture) {
                                    managed.add(texture);
                                    texture.userData.museumTextureProducer = 'original-base-color-retained';
                                }
                                if (!texture?.isTexture || texture.image?.width !== 4096 || texture.image?.height !== 4096 || mipBytes(texture.image.width, texture.image.height) > maxBytes) {
                                    entry.keep = false; if (cached === entry) cached = null;
                                }
                                releaseEntry(entry); return texture;
                            }, error => {
                                entry.settled = true; entry.keep = false; if (cached === entry) cached = null; releaseEntry(entry); throw error;
                            });
                        }
                        held.refs++;
                    }
                    const entry = held;
                    return entry.promise.then(texture => {
                        if (released || disposed) throw abortError();
                        if (texture) parser.associations?.set(texture, {textures: index});
                        return texture;
                    });
                }};
            },
            bind(model) {
                if (released || disposed) return false;
                if (bound && bound !== model) throw new Error('Texture lease already bound');
                if (models.has(model) && models.get(model) !== owner) throw new Error('Exhibit already has a texture lease');
                bound = model; models.set(model, owner); return true;
            },
            release() {
                if (released) return;
                released = true;
                if (bound) {models.delete(bound); bound = null;}
                if (held) {
                    held.refs--;
                    // A cancelled producer must not admit a new texture after its last lease left.
                    if (held.refs === 0 && !held.settled) {held.keep = false; if (cached === held) cached = null;}
                    releaseEntry(held); held = null;
                }
            }
        };
        return owner;
    }
    function releaseModel(model) {models.get(model)?.release();}
    function releaseGPU() {
        // Idle/staging textures are outside the museum scene. Retire their old renderer
        // listeners too, while keeping the same Texture, CPU image, budget and leases.
        for (const entry of entries) entry.texture?.dispose();
    }
    function dispose() {
        if (disposed) return; disposed = true; cached = null;
        for (const entry of [...entries]) {entry.keep = false; destroy(entry);}
    }
    return {lease, clearIdle, releaseModel, releaseGPU, dispose,
        retainsTexture: texture => managed.has(texture),
        retainsImage: image => !!image && [...entries].some(entry => !entry.destroyed && entry.texture?.image === image),
        get stats() {return {maxBytes, estimatedBytes: cached ? expectedBytes : 0, refs: cached?.refs ?? 0, pending: !!cached && !cached.settled, retained: !!cached?.texture, hits, misses, disposed};}
    };
}
