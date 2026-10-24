import {interiorData} from './interior-data.js';

// This fills unavailable scan interiors for display. It is not a measured
// reconstruction of the objects' wall thickness or their original interiors.
const installed = new WeakMap();

export function createInteriorGeometry(THREE, spec) {
    const {seam, seamProgress, center, angles, levels} = spec;
    const seamCount = seam.length / 3, count = angles.length;
    const positions = [...seam], indices = [];
    for (const level of levels) {
        const y = level[0];
        for (let i = 0; i < count; i++) {
            const radius = level[i + 1];
            positions.push(center[0] + Math.cos(angles[i]) * radius, y,
                center[1] + Math.sin(angles[i]) * radius);
        }
    }
    // Join every original boundary edge to the first regular section. Keeping
    // all boundary vertices avoids an open seam caused by resampling the scan.
    let i = 0, j = 0;
    while (i < seamCount || j < count) {
        const a = i % seamCount, b = seamCount + j % count;
        const nextTop = i < seamCount ? (seamProgress[i + 1] ?? 1) : Infinity;
        const nextBottom = j < count ? (j + 1) / count : Infinity;
        if (nextTop <= nextBottom) {
            indices.push(a, b, (i + 1) % seamCount); i++;
        } else {
            indices.push(a, b, seamCount + (j + 1) % count); j++;
        }
    }
    for (let row = 0; row < levels.length - 1; row++) {
        const top = seamCount + row * count, bottom = top + count;
        for (let k = 0; k < count; k++) {
            const next = (k + 1) % count;
            indices.push(top + k, bottom + k, top + next,
                top + next, bottom + k, bottom + next);
        }
    }
    const floor = positions.length / 3, last = floor - count;
    positions.push(center[0], levels[levels.length - 1][0], center[1]);
    for (let k = 0; k < count; k++) {
        indices.push(floor, last + (k + 1) % count, last + k);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const colors = [], upper = geometry.boundingBox.max.y, lower = geometry.boundingBox.min.y;
    const normal = new THREE.Vector3(), sourceNormal = new THREE.Vector3();
    const uvs = [], smooth = value => value * value * (3 - 2 * value);
    // Share the source's boundary shading, then ease back to the curved wall.
    for (let k = 0; k < positions.length; k += 3) {
        const vertex = k / 3;
        const seamVertex = vertex < seamCount;
        const column = (vertex - seamCount) % count;
        const u = seamVertex ? seamProgress[vertex] : vertex === floor ? .5 : column / count;
        const depth = THREE.MathUtils.clamp((upper - positions[k + 1]) / (upper - lower), 0, 1);
        // Keep the scan's baked cut shade while the atlas eases into clean glaze.
        const cutShade = spec.seamLuminance ?? 1;
        const glazeShade = .94;
        const transition = smooth(Math.min(1, depth / .035));
        const compensation = Math.min(1, cutShade / (cutShade + (glazeShade - cutShade) * transition));
        const value = seamVertex ? 1 : compensation * (1 - .72 * smooth(depth));
        colors.push(value, value, value);
        uvs.push(u, seamVertex ? 0 : depth);
        if (spec.seamNormals && (seamVertex || depth < .08)) {
            let a = seamVertex ? vertex : 0;
            if (!seamVertex) while (a + 1 < seamCount && seamProgress[a + 1] <= u) a++;
            const b = (a + 1) % seamCount;
            const t = seamVertex ? 0 : (u - seamProgress[a]) / ((seamProgress[a + 1] ?? 1) - seamProgress[a]);
            sourceNormal.fromArray(spec.seamNormals, a * 3).lerp(new THREE.Vector3().fromArray(spec.seamNormals, b * 3), t).normalize();
            normal.fromBufferAttribute(normals, vertex).lerp(sourceNormal,
                seamVertex ? 1 : 1 - smooth(Math.min(1, depth / .08))).normalize();
            normals.setXYZ(vertex, normal.x, normal.y, normal.z);
        }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    // Split only UV wrap faces; sharing U=0 across the join stretches a whole atlas.
    const attributes = ['position', 'normal', 'color', 'uv'];
    const values = attributes.map(name => Array.from(geometry.getAttribute(name).array));
    const duplicates = new Map();
    for (let face = 0; face < indices.length; face += 3) {
        const us = indices.slice(face, face + 3).map(index => uvs[index * 2]);
        if (Math.max(...us) - Math.min(...us) <= .5) continue;
        for (let corner = 0; corner < 3; corner++) {
            const original = indices[face + corner];
            if (uvs[original * 2] >= .5) continue;
            if (!duplicates.has(original)) {
                duplicates.set(original, values[0].length / 3);
                attributes.forEach((name, index) => {
                    const attribute = geometry.getAttribute(name), size = attribute.itemSize;
                    for (let component = 0; component < size; component++) {
                        values[index].push(attribute.array[original * size + component] + (name === 'uv' && component === 0 ? 1 : 0));
                    }
                });
            }
            indices[face + corner] = duplicates.get(original);
        }
    }
    attributes.forEach((name, index) => geometry.setAttribute(name,
        new THREE.Float32BufferAttribute(values[index], name === 'uv' ? 2 : 3)));
    geometry.setIndex(indices);
    return geometry;
}

/** Call on the freshly parsed glTF scene, before display normalization. */
export function addInterior(THREE, model, key) {
    if (installed.has(model)) return installed.get(model);
    const spec = interiorData[key];
    if (!spec) {
        const reason = 'No verified interior profile for this exhibit.';
        console.warn('Museum display interior unavailable:', key, reason);
        return {added: false, reason, ready: Promise.resolve()};
    }
    const signature = [], sources = [];
    model.traverse(object => {
        if (object.isMesh) {sources.push(object); signature.push([
            object.geometry.getAttribute('position').count,
            object.geometry.index?.count ?? 0
        ].join(':'));}
    });
    if (signature.sort().join(',') !== spec.signature) {
        const reason = 'Model geometry differs from the verified source profile.';
        console.warn('Museum display interior unavailable:', key, reason);
        return {added: false, reason, ready: Promise.resolve()};
    }
    const started = performance.now();
    const geometry = createInteriorGeometry(THREE, spec);
    const body = sources.sort((a, b) => {
        const height = mesh => new THREE.Box3().setFromObject(mesh, true).getSize(new THREE.Vector3()).y;
        return height(b) - height(a);
    })[0];
    const sourceMaterial = [].concat(body.material)[0];
    const material = new THREE.MeshStandardMaterial({
        color: sourceMaterial.color?.clone() ?? 0xffffff, metalness: 0,
        roughness: key === 'original' ? .38 : sourceMaterial.roughness ?? .8,
        side: THREE.FrontSide, fog: true, vertexColors: true
    });
    material.name = 'Display reconstruction: interior glaze and decoration';
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `museum-display-interior-${key}`;
    mesh.layers.enable(1);
    mesh.userData.museumDisplayInterior = true;
    mesh.userData.notice = 'Interior shape and decoration are display reconstructions, not scanned or measured originals.';
    model.add(mesh);
    const report = {
        key, sourceSHA256: spec.sourceSHA256, seamVertices: spec.seam.length / 3,
        vertices: geometry.getAttribute('position').count,
        triangles: geometry.index.count / 3,
        seamGlazeLuminance: spec.seamLuminance,
        depthShadeAtFloor: .28 * Math.min(1, (spec.seamLuminance ?? 1) / .94),
        cpuMilliseconds: performance.now() - started,
        approximation: 'Display infill only; original scan, opening, cover and textures are unchanged.'
    };
    const result = {added: true, meshes: [mesh], report, ready: Promise.resolve()};
    if (typeof document !== 'undefined') {
        result.ready = new Promise(resolve => {
            let settled = false, returned = false, early, texture;
            const released = new Set();
            const release = candidate => {
                if (candidate && !released.has(candidate)) {released.add(candidate); candidate.dispose();}
            };
            const finish = loaded => {
                // A cached/custom loader may call back before load() returns its texture.
                if (!returned) {early = early === false ? false : loaded; return;}
                if (settled) return;
                settled = true; clearTimeout(timer);
                material.removeEventListener('dispose', onDispose);
                if (!loaded) {
                    material.map = null; material.needsUpdate = true; release(texture);
                    report.decoration = 'Unavailable; curved glaze fallback retained';
                } else report.decoration = 'Display reconstruction loaded';
                if (model.userData.museumInterior) model.userData.museumInterior.decoration = report.decoration;
                resolve();
            };
            const onDispose = () => finish(false);
            const timer = setTimeout(() => finish(false), 5000);
            material.addEventListener('dispose', onDispose);
            try {
                texture = new THREE.TextureLoader().load(new URL(`./interior-textures/${key}.png`, import.meta.url).href,
                    candidate => {
                        if (settled) {if (candidate !== material.map) release(candidate); return;}
                        texture ??= candidate; finish(true);
                    }, undefined, () => finish(false));
                returned = true;
                if (early === false) {finish(false); return;}
                texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
                texture.wrapS = THREE.RepeatWrapping;
                material.map = texture;
                if (early === true) finish(true);
            } catch {returned = true; finish(false);}
        });
    }
    model.userData.museumInterior = {...report};
    installed.set(model, result);
    return result;
}
