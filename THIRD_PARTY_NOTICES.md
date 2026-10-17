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
