const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'enhancements', name), 'utf8');
function legacy(context = {}) {
    vm.createContext(context);
    vm.runInContext('delete Array.prototype.at;', context);
    assert.equal(vm.runInContext('typeof [].at', context), 'undefined');
    return context;
}
function handler(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert(from >= 0 && to > from, 'Focus handler source markers changed');
    return source.slice(from, to);
}
function checkFocus(source, name) {
    let onKey, prevented = 0;
    const document = {activeElement: null}, nodes = ['first', 'middle', 'last'].map(id => ({
        id, hidden: false, getClientRects: () => [1], focus() {document.activeElement = this;}
    }));
    const surface = {querySelectorAll: () => nodes};
    const showUI = {focus() {document.activeElement = this;}};
    const context = legacy({document, dialog: surface, dock: surface, mode: true, uiHidden: false, showUI,
        close() {}, listen(target, type, fn) {assert.equal(type, 'keydown'); onKey = fn;}});
    vm.runInContext(source, context);
    function press(node, shiftKey = false, key = 'Tab') {
        document.activeElement = node; prevented = 0;
        onKey({key, shiftKey, preventDefault() {prevented++;}});
    }
    press(nodes[2]); assert.equal(document.activeElement, nodes[0]); assert.equal(prevented, 1);
    press(nodes[0], true); assert.equal(document.activeElement, nodes[2]); assert.equal(prevented, 1);
    press(nodes[1]); assert.equal(document.activeElement, nodes[1]); assert.equal(prevented, 0);
    press(nodes[0], false, 'ArrowRight'); assert.equal(document.activeElement, nodes[0]); assert.equal(prevented, 0);
    nodes.splice(1);
    for (const shift of [false, true]) {press(nodes[0], shift); assert.equal(document.activeElement, nodes[0]); assert.equal(prevented, 1);}
    if (name === 'Gesture dock') {
        context.uiHidden = true;
        for (const shift of [false, true]) {press(showUI, shift); assert.equal(document.activeElement, showUI); assert.equal(prevented, 1);}
    }
    console.log(`${name}: forward/reverse focus wrap, middle keys and one control pass without Array.at`);
}
(async () => {
    const THREE = await import(pathToFileURL(path.join(root, 'vendor/three.module.js')).href);
    const {interiorData} = await import(pathToFileURL(path.join(root, 'enhancements/interior-data.js')).href);
    const file = path.join(root, 'enhancements/interior.js');
    const source = read('interior.js').replace("import {interiorData} from './interior-data.js';", '')
        .replaceAll('export function ', 'function ').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(file).href));
    // Parse profiles inside the legacy realm so their arrays also lack Array.at.
    const context = legacy({THREE});
    vm.runInContext(`const interiorData=${JSON.stringify(interiorData)};\n${source}\nglobalThis.build=key=>createInteriorGeometry(THREE,interiorData[key]);`, context);
    const keys = Object.keys(interiorData); assert.equal(keys.length, 4);
    for (const key of keys) {
        const geometry = context.build(key), position = geometry.getAttribute('position');
        assert(position.count > 0 && geometry.index.count > 0, `${key}: actual geometry was not built`);
        for (const attribute of Object.values(geometry.attributes)) assert(Array.from(attribute.array).every(Number.isFinite), `${key}: invalid geometry attribute`);
        assert(Array.from(geometry.index.array).every(index => index < position.count), `${key}: invalid geometry index`);
        assert(geometry.boundingBox.min.y < geometry.boundingBox.max.y, `${key}: collapsed interior`);
        geometry.dispose();
    }
    console.log('All four actual interior geometries build without Array.at');
    checkFocus(handler(read('ui.js'), "listen(dialog,'keydown'", "listen(dialog,'click'"), 'Knowledge dialog');
    checkFocus(handler(read('gesture-experience.js'), "listen(document,'keydown'", ' const canvas=renderer.domElement;'), 'Gesture dock');
})().catch(error => {console.error(error); process.exitCode = 1;});
