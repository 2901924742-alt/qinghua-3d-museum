# Third-party notices

This site redistributes the following unchanged JavaScript files from **three.js 0.160.0** under the MIT license:

- `vendor/three.module.js` — https://unpkg.com/three@0.160.0/build/three.module.js
- `vendor/controls/OrbitControls.js` — https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js
- `vendor/loaders/GLTFLoader.js` — https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js
- `vendor/utils/BufferGeometryUtils.js` — https://unpkg.com/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js

Copyright © 2010–2023 three.js authors. The full license is preserved in `vendor/LICENSE`. File sizes and SHA-256 checksums are recorded in `vendor/manifest.json`.

The version and files match the dependencies previously loaded by this site from unpkg. The engine has not been upgraded.

## Smithsonian porcelain scans

Three additional blue-and-white porcelain scans and associated collection metadata from the Smithsonian Institution are used under CC0 1.0. Source records, transformations and checksums are documented in `models/README.md` and `models/manifest.json`. The original exhibit is retained unchanged. The presentation is independent and is not endorsed by the Smithsonian.

The switching logic is original code informed by the resource lifecycle in [three-gltf-viewer](https://github.com/donmccurdy/three-gltf-viewer/blob/main/src/viewer.js) and cancellation ownership in [model-viewer](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/three-components/ModelScene.ts). No source code from those projects is redistributed and no second viewer is embedded.

## QR Code Generator 1.4.4

`vendor/qrcode/qrcode.js` is the unchanged qrcode-generator 1.4.4 JavaScript distribution, copyright (c) 2009 Kazuhiko Arase, MIT license. The full license is in `vendor/qrcode/LICENSE`.

- Source: https://github.com/kazuhikoarase/qrcode-generator
- Pinned distribution: https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js
- SHA-256: `18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780`

The QR code is generated locally. The library is loaded from this site's vendor directory only when a poster is requested; no QR service receives the image or visitor information.

## MediaPipe Tasks Vision 0.10.3 and Hand Landmarker

This local preview bundles unchanged JavaScript/WASM files from `@mediapipe/tasks-vision@0.10.3`, whose package metadata declares **Apache-2.0**. This does not change the existing Three.js 0.160.0 dependency.

- Official npm source: https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.3.tgz
- Package metadata, exact file sizes/hashes and upstream URLs: `vendor/mediapipe/package.json` and `vendor/mediapipe/source-manifest.json`
- Complete preserved upstream root license: `vendor/mediapipe/LICENSE`, sourced from https://github.com/google-ai-edge/mediapipe/blob/d392f8ad98b2d7375e3a57cd3464ecac7efef12a/LICENSE (`v0.10.3`)
- Unmodified pretrained model: Google's `hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`; source, SHA-256 and the official model card's Apache-2.0 statement are documented in `vendor/mediapipe/MODEL_LICENSE.md`.

The upstream root license and its additional third-party text are retained. A complete component-specific NOTICE/build-provenance inventory for these exact precompiled WASM artifacts has not been obtained; this preview does not claim all embedded-component notices have been independently verified. Apache-2.0 runtime/model files are not relicensed as MIT.

The gesture mapping was informed by palm-size normalization, mirrored coordinates and optional-feature isolation in [Timo8848/gesture-Christmas_tree-3d_with_photo](https://github.com/Timo8848/gesture-Christmas_tree-3d_with_photo/tree/d5e6ebfe8409161fa7d8ba7cbac501151a5f5b61), commit `d5e6ebfe8409161fa7d8ba7cbac501151a5f5b61` (MIT, copyright 2025 Pan Wang). **No source code, Christmas-tree assets or photos from that repository are copied into this preview.** The project uses its own porcelain-pattern particle implementation and retains mouse/touch interaction independently of camera permission.

## perfect-freehand 1.2.3

`vendor/perfect-freehand/` contains the CPU stroke-outline algorithms from [steveruizok/perfect-freehand](https://github.com/steveruizok/perfect-freehand/tree/176e00f2399f4969e1b0965c5921d96a3e50ce9f/packages/perfect-freehand), fixed commit `176e00f2399f4969e1b0965c5921d96a3e50ce9f`. Copyright (c) 2021 Stephen Ruiz Ltd, MIT license. The full original license is preserved in `vendor/perfect-freehand/LICENSE`.

The seven local browser ESM files were generated from the verified upstream TypeScript using Node's built-in `stripTypeScriptTypes`, then given explicit relative `.js` import extensions. No upstream npm scripts or build system were run. Original-source Git blob hashes, generated-file byte sizes and SHA-256 checksums, and the exact transformation/runtime are recorded in `vendor/perfect-freehand/source-manifest.json`.

The optional natural cobalt brush loads these local files only for painting. It uses the outline output with the existing Canvas2D canvas; it does not introduce React, a remote service, an additional WebGL context, or a new Three.js dependency. Museum-specific bounded sampling, ink compositing, wrapping and failure fallback remain in the site's own integration modules.

## Official three.js r160 GLTFExporter

`vendor/three-exporter/` redistributes the unchanged official `examples/jsm/exporters/GLTFExporter.js` and `examples/jsm/utils/TextureUtils.js` from [three.js r160](https://github.com/mrdoob/three.js/tree/d04539a76736ff500cae883d6a38b3dd8643c548), fixed commit `d04539a76736ff500cae883d6a38b3dd8643c548`. Copyright © 2010–2023 three.js authors, MIT license. The complete original license is preserved in `vendor/three-exporter/LICENSE`; source paths, exact byte sizes, Git blob SHA-1 and SHA-256 hashes are recorded in `vendor/three-exporter/source-manifest.json`.

The two modules keep their upstream directory layout and import the site's existing Three.js 0.160.0 engine. No exporter algorithm was rewritten, no new engine is bundled, and no upstream build or npm script was run. They load on demand when exporting an original user-created vessel and its locally drawn artwork as a self-contained GLB; museum scans are outside this export feature.

The integration accepts only its owned ordinary CanvasTexture artwork and rejects compressed or foreign texture maps. This keeps exports on the Canvas2D encoding path; the upstream compressed-texture utility's optional WebGL decompression path is not used. Snapshot ownership, cancellation and late-result handling remain in the site's own painting module.

## Official three.js r160 clipping stencil reference

The optional horizontal section view for original user-created pottery adapts the opposing front/back stencil passes and cap ordering from the official [webgl_clipping_stencil example](https://github.com/mrdoob/three.js/blob/d04539a76736ff500cae883d6a38b3dd8643c548/examples/webgl_clipping_stencil.html), fixed commit `d04539a76736ff500cae883d6a38b3dd8643c548`. Copyright © 2010–2023 three.js authors, MIT license. The exact upstream HTML is retained as inert documentation in `vendor/three-clipping/webgl_clipping_stencil.html.txt`, with the full original `LICENSE` and file sizes/Git blob SHA-1/SHA-256 in `source-manifest.json`.

The site's `pottery-studio.js` uses one horizontal plane, two meshes borrowing the actual original geometry, and one cap. It creates and disposes only its owned materials and cap geometry, uses a quaternion for exact horizontal alignment, and reuses the museum's renderer on demand. The upstream demonstration's GUI, controls, renderer and continuous animation loop are not included. The section is an artistic view of the user's relative design mesh; it is not heritage CT, a measured original artifact, or a physical wall-thickness analysis.

## Celadon CPU pottery adaptation

The original-vessel workshop reuses the CPU clay, hand and utility algorithms from [winchxyz/celadon](https://github.com/winchxyz/celadon/tree/be0342639a28dd92a3ac3169206bede2e18a5116), fixed commit `be0342639a28dd92a3ac3169206bede2e18a5116`, under the MIT license. The unchanged upstream files, original license, exact source hashes and source paths are preserved in `vendor/celadon/` and its `source-manifest.json`. The site's adapter retains Three.js r160 and uses its own closed vessel mesh, bounded editing history, file validation, original vase/jar/bowl templates and on-demand museum preview. The upstream game engine, economy, audio, scoring and renderer are not embedded.

The optional reference outline uses those same original workshop templates through the existing adapted model, with equal scaling of radius and height. It provides a local Canvas2D design guide and an outline width-to-height ratio, not an authenticity or physical-pottery score. Temporary reference models are disposed after their numeric profiles are read; reference lines are excluded from exported works. The commercial game Let’s Create! Pottery inspired the making-and-decorating flow only; its code and assets are not copied.
