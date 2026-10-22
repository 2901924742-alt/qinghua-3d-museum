const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../enhancements/exhibit-cache.js'), 'utf8')
    .replace('export function createExhibitCache', 'function createExhibitCache');
const urls = ['./qinghuaci.glb', './models/covered-vase-192.glb', './models/beaker-vase-193.glb', './models/covered-vase-191.glb'];
const tick = () => new Promise(setImmediate), checks = [], unhandled = [];
process.on('unhandledRejection', error => unhandled.push(error));
const legacySignal = signal => ({get aborted() {return signal.aborted;},
    addEventListener: signal.addEventListener.bind(signal), removeEventListener: signal.removeEventListener.bind(signal)});
class LegacyController {
    constructor() {this.controller = new AbortController(); this.signal = legacySignal(this.controller.signal);}
    abort() {this.controller.abort();}
}
function fixture(maxBytes = 10, legacy = false) {
    const requests = [], timers = new Map(); let timerId = 0;
    const context = {ArrayBuffer, AbortController: legacy ? LegacyController : AbortController,
        setTimeout(fn, ms) {const id = ++timerId; timers.set(id, {fn, ms}); return id;},
        clearTimeout(id) {timers.delete(id);}};
    vm.createContext(context); vm.runInContext(source + ';globalThis.factory=createExhibitCache;', context);
    const cache = context.factory({urls, maxBytes, fetcher: (url, options) => new Promise((resolve, reject) => requests.push({url, options, resolve, reject}))});
    return {cache, requests, timers,
        complete(index, length, value = index + 1) {
            const bytes = new Uint8Array(length).fill(value).buffer;
            requests[index].resolve({ok: true, arrayBuffer: () => Promise.resolve(bytes)}); return bytes;
        },
        expire() {for (const {fn, ms} of [...timers.values()]) {assert.equal(ms, 30000); fn();}}
    };
}
async function successAndCapacity() {
    const f = fixture();
    const first = f.cache.load(urls[0]); await tick(); const a = f.complete(0, 4);
    assert.equal(await first, a); assert.equal(await f.cache.load(urls[0]), a); assert.equal(f.requests.length, 1);
    const second = f.cache.load(urls[1]); await tick(); const b = f.complete(1, 4); assert.equal(await second, b);
    assert.equal(await f.cache.load(urls[0]), a);
    const third = f.cache.load(urls[2]); await tick(); f.complete(2, 4); await third;
    assert.equal(await f.cache.load(urls[0]), a);
    const evicted = f.cache.load(urls[1]); await tick(); assert.equal(f.requests.length, 4); const bReloaded = f.complete(3, 4); await evicted;
    const oversized = f.cache.load(urls[3]); await tick(); const large = f.complete(4, 11); assert.equal(await oversized, large);
    const again = f.cache.load(urls[3]); await tick(); assert.equal(f.requests.length, 6); f.complete(5, 11); await again;
    assert.equal(await f.cache.load(urls[1]), bReloaded); f.cache.dispose();
}
async function capacityAndValidation() {
    const f = fixture(4);
    const small = f.cache.load(urls[0]); await tick(); const bytes = f.complete(0, 4); await small;
    const large = f.cache.load(urls[1]); await tick(); f.complete(1, 5); await large;
    assert.equal(await f.cache.load(urls[0]), bytes, 'Oversized response must not evict existing cache');
    const retry = f.cache.load(urls[1]); await tick(); f.complete(2, 5); await retry; assert.equal(f.requests.length, 3);
    await assert.rejects(f.cache.load('https://unlisted.example/model.glb'), /Unknown exhibit URL/);
    assert.equal(await f.cache.warm('../unknown.glb'), null); assert.equal(f.requests.length, 3);
    const disabled = fixture(0), p = disabled.cache.load(urls[0]); await tick(); disabled.complete(0, 1); await p;
    const p2 = disabled.cache.load(urls[0]); await tick(); disabled.complete(1, 1); await p2; assert.equal(disabled.requests.length, 2);
    f.cache.dispose(); disabled.cache.dispose();
}
async function failuresRetry() {
    for (const failure of ['fetch', 'http', 'body', 'invalid']) {
        const f = fixture(), p = f.cache.load(urls[0]); const rejected = assert.rejects(p);
        await tick();
        if (failure === 'fetch') f.requests[0].reject(new Error('Network failure'));
        else f.requests[0].resolve({ok: failure !== 'http', status: 503,
            arrayBuffer: () => failure === 'body' ? Promise.reject(new Error('Truncated body')) : Promise.resolve('not bytes')});
        await rejected;
        const retry = f.cache.load(urls[0]); await tick(); const bytes = f.complete(1, 3); assert.equal(await retry, bytes);
        assert.equal(await f.cache.load(urls[0]), bytes); assert.equal(f.requests.length, 2); f.cache.dispose();
    }
}
async function invalidatedParsingRetry() {
    const f = fixture(8), first = f.cache.load(urls[0]); await tick(); f.complete(0, 4, 1);
    await first;
    const other = f.cache.load(urls[1]); await tick(); const retained = f.complete(1, 4, 2); await other;
    await assert.rejects((async () => {
        await f.cache.load(urls[0]);
        try {throw new Error('Injected model parsing failure');}
        catch (error) {f.cache.forget(urls[0]); throw error;}
    })(), /model parsing failure/);
    f.cache.forget(urls[0]); f.cache.forget('https://unlisted.example/model.glb'); f.cache.forget(urls[3]);
    const retry = f.cache.load(urls[0]); await tick(); assert.equal(f.requests.length, 3);
    const correct = f.complete(2, 4, 3); assert.equal(await retry, correct);
    assert.equal(await f.cache.load(urls[1]), retained, 'Invalidation must reclaim cache size without evicting another exhibit');
    assert.equal(await f.cache.load(urls[0]), correct); assert.equal(f.requests.length, 3); f.cache.dispose();
}
async function cancellation() {
    for (const legacy of [false, true]) {
        const f = fixture(10, legacy), controller = legacy ? new LegacyController() : new AbortController();
        controller.abort(); await assert.rejects(f.cache.load(urls[0], controller.signal), {name: 'AbortError'});
        assert.equal(f.requests.length, 0);
        const current = legacy ? new LegacyController() : new AbortController();
        const p = f.cache.load(urls[0], current.signal), rejected = assert.rejects(p, {name: 'AbortError'}); await tick();
        current.abort(); await rejected; assert(f.requests[0].options.signal.aborted);
        const next = f.cache.load(urls[0]); await tick(); assert.equal(f.requests.length, 2);
        f.complete(0, 3, 1); await tick(); const correct = f.complete(1, 3, 2);
        assert.equal(await next, correct); assert.equal(await f.cache.load(urls[0]), correct); f.cache.dispose();
    }
    const f = fixture(), controller = new AbortController(); let bodyResolve;
    const p = f.cache.load(urls[0], controller.signal), rejected = assert.rejects(p, {name: 'AbortError'}); await tick();
    f.requests[0].resolve({ok: true, arrayBuffer: () => new Promise(resolve => {bodyResolve = resolve;})}); await tick();
    controller.abort(); await rejected; bodyResolve(new ArrayBuffer(3)); await tick();
    const again = f.cache.load(urls[0]); await tick(); assert.equal(f.requests.length, 2); f.complete(1, 3); await again; f.cache.dispose();
}
async function independentConsumers() {
    const f = fixture(), controller = new AbortController();
    const first = f.cache.load(urls[0], controller.signal), rejected = assert.rejects(first, {name: 'AbortError'});
    const second = f.cache.load(urls[0]); await tick(); assert.equal(f.requests.length, 2);
    controller.abort(); await rejected; assert.equal(f.requests[1].options.signal.aborted, false);
    const correct = f.complete(1, 4, 2); assert.equal(await second, correct);
    f.complete(0, 4, 1); await tick(); assert.equal(await f.cache.load(urls[0]), correct);
    const warming = f.cache.warm(urls[1]); await tick(); assert.equal(await f.cache.load(urls[0]), correct);
    assert.equal(await warming, null); assert(f.requests[2].options.signal.aborted); f.cache.dispose();
    const g = fixture(), aborter = new AbortController(), cancelled = g.cache.load(urls[0], aborter.signal);
    const checked = cancelled.then(() => assert.fail('Expected cancellation'), error => assert.equal(error, 0));
    await tick(); aborter.abort(0); await checked; g.requests[0].reject(undefined); await tick();
    const retry = g.cache.load(urls[0]); await tick(); const bytes = g.complete(1, 3); assert.equal(await retry, bytes); g.cache.dispose();
}
async function warmTakeover() {
    const f = fixture(), background = f.cache.warm(urls[0]);
    assert.equal(f.cache.warm(urls[0]), background); await tick();
    assert.equal(f.requests[0].options.priority, 'low'); assert.equal(f.timers.size, 1);
    const p = f.cache.load(urls[0]); f.cache.cancelWarm(); await tick();
    assert.equal(f.timers.size, 0); assert.equal(f.requests.length, 1); assert.equal(f.requests[0].options.signal.aborted, false);
    const bytes = f.complete(0, 4); assert.equal(await p, bytes); assert.equal(await background, bytes);
    assert.equal(await f.cache.load(urls[0]), bytes); f.cache.dispose();
    const g = fixture(), warming = g.cache.warm(urls[0]); await tick(); const aborter = new AbortController();
    const adopted = g.cache.load(urls[0], aborter.signal), rejected = assert.rejects(adopted, {name: 'AbortError'});
    aborter.abort(); await rejected; assert.equal(await warming, null);
    const newer = g.cache.load(urls[0]); await tick(); assert.equal(g.requests.length, 2);
    g.complete(0, 3, 1); await tick(); const fresh = g.complete(1, 3, 2); assert.equal(await newer, fresh);
    assert.equal(await g.cache.load(urls[0]), fresh); g.cache.dispose();
}
async function backgroundCancellation() {
    for (const action of ['cancel', 'different-load', 'different-warm', 'timeout']) {
        const f = fixture(), first = f.cache.warm(urls[0]); await tick(); let other;
        if (action === 'cancel') f.cache.cancelWarm();
        if (action === 'different-load') other = f.cache.load(urls[1]);
        if (action === 'different-warm') other = f.cache.warm(urls[1]);
        if (action === 'timeout') f.expire();
        assert.equal(await first, null); assert(f.requests[0].options.signal.aborted);
        if (other) {await tick(); f.complete(1, 3); await other;}
        f.complete(0, 3); await tick();
        const retry = f.cache.load(urls[0]); await tick(); const index = f.requests.length - 1;
        assert.equal(index, other ? 2 : 1); f.complete(index, 3); await retry; assert.equal(f.timers.size, 0); f.cache.dispose();
    }
    const f = fixture(), first = f.cache.warm(urls[0]); await tick(); f.requests[0].reject(new Error('Offline'));
    assert.equal(await first, null); assert.equal(f.timers.size, 0);
    const retry = f.cache.warm(urls[0]); await tick(); const bytes = f.complete(1, 3); assert.equal(await retry, bytes);
    assert.equal(await f.cache.load(urls[0]), bytes); f.cache.dispose();
}
async function disposal() {
    const f = fixture(), warming = f.cache.warm(urls[0]); await tick();
    f.cache.dispose(); f.cache.dispose(); assert.equal(await warming, null); assert.equal(f.timers.size, 0);
    f.complete(0, 3); await tick(); assert.equal(await f.cache.warm(urls[0]), null);
    await assert.rejects(f.cache.load(urls[0]), {name: 'AbortError'}); assert.equal(f.requests.length, 1);
    const g = fixture(), pending = g.cache.load(urls[0]), rejected = assert.rejects(pending, {name: 'AbortError'}); await tick();
    g.cache.dispose(); await rejected; assert(g.requests[0].options.signal.aborted);
    g.requests[0].reject(new Error('Late network rejection')); await tick();
}
(async () => {
    for (const test of [successAndCapacity, capacityAndValidation, failuresRetry, invalidatedParsingRetry, cancellation, independentConsumers, warmTakeover, backgroundCancellation, disposal]) {
        await test(); checks.push(test.name); console.log(`PASS ${test.name}`);
    }
    await tick(); assert.deepEqual(unhandled, []);
    console.log(JSON.stringify({status: 'passed', groups: checks.length, checks, unhandledRejections: unhandled.length}));
})().catch(error => {console.error(error); process.exitCode = 1;});
