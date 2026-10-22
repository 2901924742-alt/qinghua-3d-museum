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
