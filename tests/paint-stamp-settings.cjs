'use strict';
// Node 24+, built-ins only. Actual draft module; no browser, Canvas, GPU or model-restore claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {deflateSync, inflateSync, crc32} = require('node:zlib');

const width = 512, height = 256, pngPrefix = 'data:image/png;base64,';
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const checks = [];
function chunk(type, data) {
    const bytes = Buffer.alloc(data.length + 12);
    bytes.writeUInt32BE(data.length, 0);
    bytes.write(type, 4, 4, 'ascii');
    data.copy(bytes, 8);
    bytes.writeUInt32BE(crc32(bytes.subarray(4, bytes.length - 4)), bytes.length - 4);
    return bytes;
}
function header(w = width, h = height) {
    const bytes = Buffer.alloc(13);
    bytes.writeUInt32BE(w, 0); bytes.writeUInt32BE(h, 4);
    bytes[8] = 8; bytes[9] = 6; // Non-interlaced 8-bit RGBA.
    return chunk('IHDR', bytes);
}
const scanlines = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    scanlines[row] = 0;
    for (let x = 0; x < width; x++) {
        const offset = row + 1 + x * 4, blue = (x > 40 && x < 150 && y > 30 && y < 110);
        scanlines[offset] = blue ? 31 : 250;
        scanlines[offset + 1] = blue ? 63 : 247;
        scanlines[offset + 2] = blue ? 143 : 237;
        scanlines[offset + 3] = 255;
    }
}
const compressed = deflateSync(scanlines);
assert.deepEqual(inflateSync(compressed), scanlines, 'The fixture must contain real compressed pixels');
const idat = chunk('IDAT', compressed), iend = chunk('IEND', Buffer.alloc(0));
const pngBytes = Buffer.concat([pngSignature, header(), idat, iend]);
const png = pngPrefix + pngBytes.toString('base64');
function pngSized(bytes) {
    const overhead = pngBytes.length + 12;
    assert(bytes >= overhead + 5);
    const text = Buffer.alloc(bytes - overhead, 120);
    Buffer.from('note\0', 'ascii').copy(text);
    const result = Buffer.concat([pngSignature, header(), chunk('tEXt', text), idat, iend]);
    assert.equal(result.length, bytes);
    return pngPrefix + result.toString('base64');
}
function json(value) {return JSON.stringify(value);}

(async () => {
    assert.equal(typeof crc32, 'function', 'Node 24 native zlib.crc32 is required');
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
    const file = path.resolve(__dirname, '../enhancements/paint-draft.js');
    // The module is self-contained. Loading unchanged bytes as ESM avoids package-type assumptions.
    const module = await import('data:text/javascript;base64,' + fs.readFileSync(file).toString('base64'));
    const {parsePaintDraft, stringifyPaintDraft, isStaticPaintPNG, validatePaintPNG} = module;
    const base = {version: 2, width, height, png, shapeJSON: null, tool: 'flower', stamp: 'bamboo',
        stampSize: 48, brushWidth: 7, density: 75, angle: -37.5, glazed: true};
    function reject(value, label) {
        assert.equal(parsePaintDraft(json(value)), null, label + ': parser');
        assert.throws(() => stringifyPaintDraft(value), /Invalid paint draft/, label + ': serializer');
    }
    function roundtrip(value, label) {
        const before = json(value), parsed = parsePaintDraft(before);
        assert(parsed, label + ': parse');
        const saved = stringifyPaintDraft(Object.freeze({...value})), restored = parsePaintDraft(saved);
        assert.deepEqual(restored, parsed, label + ': settings roundtrip');
        assert.equal(json(value), before, label + ': input must remain unchanged');
        assert.equal(restored.angle, -37.5, label + ': vessel angle must remain independent');
        return {saved: JSON.parse(saved), parsed: restored};
    }
    assert.equal(isStaticPaintPNG(png), true);
    // Exactly one strict native inflate validation; later loops test the JSON schema only.
    assert.equal(await validatePaintPNG(png), true);
    checks.push('actual-512x256-RGBA-PNG-native-deflate-CRC-and-one-strict-validation');

    for (const tool of ['brush', 'flower']) {
        const old2 = {...base, tool}; if (tool === 'brush') delete old2.stamp;
        const parsed2 = roundtrip(old2, 'old-v2-' + tool).parsed;
        assert(!Object.hasOwn(parsed2, 'stampAngle')); assert(!Object.hasOwn(parsed2, 'stampRepeat'));
        const old1 = {...old2, version: 1}; delete old1.shapeJSON;
        const parsed1 = parsePaintDraft(json(old1)); assert(parsed1);
        for (const key of ['shapeJSON', 'stamp', 'stampSize', 'stampAngle', 'stampRepeat']) assert(!Object.hasOwn(parsed1, key));
        const promoted = JSON.parse(stringifyPaintDraft(parsed1));
        assert.equal(promoted.version, 2); assert.equal(promoted.shapeJSON, null);
        assert(!Object.hasOwn(promoted, 'stampAngle')); assert(!Object.hasOwn(promoted, 'stampRepeat'));
    }
    checks.push('legacy-v1-v2-without-new-fields-remain-readable-and-optional-fields-stay-absent');

    for (const unknown of [{stampAngle: 90, stampRepeat: 12}, {stampAngle: '90', stampRepeat: null},
        {stampAngle: {bad: true}, stampRepeat: [4], shapeJSON: 'not a valid shape envelope'}]) {
        const value = {...base, version: 1, ...unknown}, parsed = parsePaintDraft(json(value));
        assert(parsed, 'v1 retains its existing ignore-unknown-fields policy');
        for (const key of ['stampAngle', 'stampRepeat', 'shapeJSON', 'stamp', 'stampSize']) assert(!Object.hasOwn(parsed, key));
    }
    checks.push('v1-unknown-field-policy-is-unchanged-and-does-not-adopt-v2-stamp-settings');

    for (const extra of [{stampAngle: -180}, {stampAngle: 180}, {stampRepeat: 1}, {stampRepeat: 12},
        {stampAngle: 0, stampRepeat: 1}, {stampAngle: 73, stampRepeat: 8}]) {
        const {saved, parsed} = roundtrip({...base, ...extra}, 'independently-optional-fields');
        for (const key of ['stampAngle', 'stampRepeat']) {
            assert.equal(Object.hasOwn(saved, key), Object.hasOwn(extra, key));
            assert.equal(Object.hasOwn(parsed, key), Object.hasOwn(extra, key));
            if (Object.hasOwn(extra, key)) assert.equal(parsed[key], extra[key]);
        }
    }
    checks.push('v2-angle-only-repeat-only-and-both-preserve-optional-field-presence');

    const angles = [-180, -90, -1, 0, 1, 90, 180], repeats = [1, 4, 6, 8, 12];
    const tools = [{tool: 'brush'}, ...['flower', 'plum', 'bamboo', 'cloud', 'ring', 'disc', 'band'].map(stamp => ({tool: 'flower', stamp}))];
    let validCombinations = 0;
    for (const tool of tools) for (const stampAngle of angles) for (const stampRepeat of repeats) {
        const value = {...base, ...tool, stampAngle, stampRepeat}; if (tool.tool === 'brush') delete value.stamp;
        const {parsed} = roundtrip(value, tool.tool + '/' + tool.stamp + '/' + stampAngle + '/' + stampRepeat);
        assert.equal(parsed.stampAngle, stampAngle); assert.equal(parsed.stampRepeat, stampRepeat);
        if (tool.tool === 'brush') assert.equal(parsed.tool, 'brush');
        if (tool.stamp === 'band') assert.equal(parsed.stamp, 'band');
        validCombinations++;
    }
    assert.equal(validCombinations, 280);
    checks.push('280-valid-combinations-include-hidden-brush-band-preferences-and-independent-vessel-angle');

    const badAngles = [-181, 181, -0.5, 0.5, Number.MAX_SAFE_INTEGER, '90', '', null, true, false, [], {}, [0], NaN, Infinity, -Infinity];
    const badRepeats = [-1, 0, 2, 3, 5, 7, 9, 13, 4.5, 1.1, '4', '', null, true, false, [], {}, [4], NaN, Infinity, -Infinity];
    for (const value of badAngles) reject({...base, stampAngle: value, stampRepeat: 4}, 'invalid-stamp-angle-' + String(value));
    for (const value of badRepeats) reject({...base, stampAngle: 90, stampRepeat: value}, 'invalid-stamp-repeat-' + String(value));
    for (const key of ['stampAngle', 'stampRepeat']) {
        assert(json({...base, [key]: NaN}).includes('"' + key + '":null'));
        assert.equal(parsePaintDraft(json({...base, [key]: NaN})), null);
    }
    checks.push('wrong-types-null-floats-out-of-range-and-NaN-to-null-reject-without-coercion');

    for (const [key, value] of [['brushWidth', 1], ['brushWidth', 29], ['brushWidth', 2.5], ['density', 19],
        ['density', 101], ['density', 50.5], ['angle', -181], ['angle', 181], ['angle', '90'], ['glazed', 1],
        ['tool', 'band'], ['stamp', 'missing'], ['stampSize', 15], ['stampSize', 97], ['stampSize', 32.5]])
        reject({...base, stampAngle: 90, stampRepeat: 6, [key]: value}, 'existing-field-' + key);
    for (const dimensions of [{width: 513}, {height: 255}]) {
        const value = {...base, stampAngle: 90, stampRepeat: 6, ...dimensions};
        assert.equal(parsePaintDraft(json(value)), null, 'Raw draft canvas dimensions remain fixed');
        const saved = JSON.parse(stringifyPaintDraft(value));
        assert.equal(saved.width, width); assert.equal(saved.height, height, 'Existing serializer uses the fixed canvas size');
    }
    reject({...base, tool: 'brush', stamp: 'band', stampAngle: 90, stampRepeat: 6}, 'existing-stamp-tool-constraint');
    assert.equal(parsePaintDraft(json({...base, version: 3})), null);
    checks.push('existing-tool-dimensions-brush-density-view-angle-glaze-and-stamp-boundaries-not-relaxed');

    for (const bad of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AA==',
        png.replace('base64,', 'base64,!'), pngPrefix + Buffer.concat([pngSignature, header(513, height), idat, iend]).toString('base64'),
        pngPrefix + Buffer.concat([pngSignature, header(width, 255), idat, iend]).toString('base64')]) reject({...base, png: bad, stampAngle: 0, stampRepeat: 4}, 'existing-PNG-boundary');
    assert(parsePaintDraft(json({...base, png: pngSized(1048576), stampAngle: 0, stampRepeat: 4})), 'Existing exact 1MiB PNG bound remains valid');
    reject({...base, png: pngSized(1048577), stampAngle: 0, stampRepeat: 4}, 'above-existing-PNG-byte-bound');
    checks.push('existing-PNG-signature-dimensions-type-base64-and-exact-1MiB-bound-preserved');

    for (const value of [undefined, 0, false, {}, 'null', '[]', '{broken']) {
        const record = {...base, shapeJSON: value, stampAngle: 0, stampRepeat: 4};
        assert.equal(parsePaintDraft(json(record)), null, 'v2 raw shape envelope stays mandatory');
        if (value === undefined) assert.equal(JSON.parse(stringifyPaintDraft(record)).shapeJSON, null, 'Existing serializer default remains null');
        else assert.throws(() => stringifyPaintDraft(record), /Invalid paint draft/);
    }
    const asciiOverhead = JSON.stringify({x: ''}).length;
    const exactASCII = JSON.stringify({x: 'a'.repeat(131072 - asciiOverhead)});
    assert.equal(Buffer.byteLength(exactASCII), 131072);
    roundtrip({...base, shapeJSON: exactASCII, stampAngle: -90, stampRepeat: 8}, 'exact-shape-ASCII-byte-bound');
    reject({...base, shapeJSON: JSON.stringify({x: 'a'.repeat(131073 - asciiOverhead)}), stampAngle: 0}, 'above-shape-character-byte-bound');
    const exactUTF8 = JSON.stringify({x: 'é'.repeat((131072 - asciiOverhead) / 2)});
    assert.equal(Buffer.byteLength(exactUTF8), 131072);
    roundtrip({...base, shapeJSON: exactUTF8, stampRepeat: 12}, 'exact-shape-UTF8-byte-bound');
    reject({...base, shapeJSON: JSON.stringify({x: 'é'.repeat((131072 - asciiOverhead) / 2 + 1)}), stampRepeat: 4}, 'above-shape-UTF8-byte-bound');
    checks.push('existing-v2-shape-envelope-character-and-UTF8-byte-limits-preserved');

    const extra = {...base, stampAngle: 90, stampRepeat: 6, ignoredPadding: ''};
    const overhead = json(extra).length, exactJSON = json({...extra, ignoredPadding: 'a'.repeat(1700000 - overhead)});
    assert.equal(exactJSON.length, 1700000); assert(parsePaintDraft(exactJSON));
    const aboveJSON = json({...extra, ignoredPadding: 'a'.repeat(1700001 - overhead)});
    assert.equal(aboveJSON.length, 1700001); assert.equal(parsePaintDraft(aboveJSON), null);
    checks.push('existing-exact-JSON-character-cap-and-unknown-v2-policy-preserved');

    console.log(JSON.stringify({status: 'passed', test: 'paint-stamp-settings', node: process.version,
        scope: 'Actual JSON schema and one native PNG inflate on Node 24; no Canvas pixels, model restore, UI, GPU or physical-device claims.',
        validCombinations, strictPNGValidations: 1, checks}));
})().catch(error => {console.error(error); process.exitCode = 1;});
