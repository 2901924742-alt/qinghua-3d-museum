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
    positions.push(center[0], levels.at(-1)[0], center[1]);
    for (let k = 0; k < count; k++) {
        indices.push(floor, last + (k + 1) % count, last + k);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    // Keep the flat floor's normal continuous at its fan edge. Blend only
    // the last two wall sections into it, so lighting does not draw a bright
    // circular "lid" around the bottom of an otherwise open deep cavity.
    const normals = geometry.getAttribute('normal');
    const normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let step = 0; step < 3; step++) {
        const offset = seamCount + (levels.length - 1 - step) * count;
        for (let k = 0; k < count; k++) {
            normal.fromBufferAttribute(normals, offset + k).lerp(up, (3 - step) / 3).normalize();
            normals.setXYZ(offset + k, normal.x, normal.y, normal.z);
        }
    }
    normals.setXYZ(floor, 0, 1, 0);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    // A small baked depth cue affects only this plain infill. Match the
    // source cut's neutral glaze luminance, then dim gently into the cavity.
    // This is a display approximation, not measured optical/inner-wall data.
    const colors = [], upper = geometry.boundingBox.max.y, lower = geometry.boundingBox.min.y;
    const luminance = spec.seamLuminance ?? 1;
    for (let k = 0; k < positions.length; k += 3) {
        const depth = THREE.MathUtils.clamp((upper - positions[k + 1]) / (upper - lower), 0, 1);
        const value = luminance * (1 - .58 * Math.sqrt(depth));
        colors.push(value, value, value);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
}

/** Call on the freshly parsed glTF scene, before display normalization. */
export function addInterior(THREE, model, key) {
    if (installed.has(model)) return installed.get(model);
    const spec = interiorData[key];
    if (!spec) return {added: false, reason: 'No verified interior profile for this exhibit.'};
    const signature = [];
    model.traverse(object => {
        if (object.isMesh) signature.push([
            object.geometry.getAttribute('position').count,
            object.geometry.index?.count ?? 0
        ].join(':'));
    });
    if (signature.sort().join(',') !== spec.signature) {
        return {added: false, reason: 'Model geometry differs from the verified source profile.'};
    }
    const started = performance.now();
    const geometry = createInteriorGeometry(THREE, spec);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.56,
        side: THREE.FrontSide, fog: true, vertexColors: true
    });
    material.name = 'Display-only plain glaze interior';
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `museum-display-interior-${key}`;
    mesh.layers.enable(1);
    mesh.userData.museumDisplayInterior = true;
    mesh.userData.notice = 'Interior infill for display; wall thickness is not measured.';
    model.add(mesh);
    const report = {
        key, sourceSHA256: spec.sourceSHA256, seamVertices: spec.seam.length / 3,
        vertices: geometry.getAttribute('position').count,
        triangles: geometry.index.count / 3,
        seamGlazeLuminance: spec.seamLuminance,
        depthShadeAtFloor: 0.42,
        cpuMilliseconds: performance.now() - started,
        approximation: 'Display infill only; original scan, opening, cover and textures are unchanged.'
    };
    const result = {added: true, meshes: [mesh], report};
    model.userData.museumInterior = {...report};
    installed.set(model, result);
    return result;
}
