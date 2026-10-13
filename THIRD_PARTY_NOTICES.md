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
