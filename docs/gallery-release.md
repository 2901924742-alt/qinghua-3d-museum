# Four exhibits in one shared scene

The original blue-and-white porcelain model is joined by three independent Smithsonian CC0 scans. The same renderer, star field, black hole, pedestal, controls and tools remain in use. Previous/next buttons request one model at a time. After preparation, the camera pulls out to the existing 40-unit distance limit for 1.05 seconds, holds for 0.3 seconds with the model swap at its midpoint, then approaches the selected exhibit for 1.65 seconds. A delayed frame still places the camera at the distant swap before beginning the approach. Dragging, scrolling, reset, Escape, opening a panel or changing language cancels the transition. Mobile reduced-motion preference skips the new camera transition; desktop retains the approved default animation behavior. The decorative line beneath the title is removed to avoid overlapping the subtitle.

Models are fetched on demand. Parsing, shader compilation and texture upload happen before the camera transition; texture uploads are spread across frames. A newer selection aborts an older request and discards any late parsed candidate. The current exhibit remains visible when a download, parsing or presentation fails. A successful change releases the previous geometry, materials, textures and owned ImageBitmaps. At most the current model and one prepared candidate share GPU resources briefly; all four models are never loaded together. The HTTP cache may retain file bytes.

All introductions, hotspot descriptions, unwrap images, photo/poster filenames and poster captions follow the selected exhibit. Language preference, introduction visibility and the existing orbit controls are retained. Display sizes are normalized. Scan 191 contains the body only, without the original cover; both languages explain this distinction. Source records, dimensions, licenses and hashes are in `models/README.md` and `models/manifest.json`.

The added GLBs are plain glTF 2.0: no runtime Draco decoder, additional viewer, Three.js upgrade or rendering pipeline is introduced. Original colour texture bytes are preserved exactly. The models are approximately 1.5–2.3 MB and 40,000 triangles each. Normal maps are 1024² and AO maps 512². Estimated RGBA8 texture allocation with mipmaps is 28 or 56 MiB per added model. These are estimates, not measured physical VRAM. The original `qinghuaci.glb` and its 4096² images are unchanged.

## Rollback

Before this change, all 20 runtime files matched the saved release `fc667434112ff40754fb4830d050b36050c99b02`. GitHub branch `codex/backup-2026-10-13-fc66743` preserves that commit. A complete local ZIP and SHA-256 manifest are retained in `backups/2026-10-13-release-fc66743/` outside the deployed directory. ZIP SHA-256: `48de3a20eb630d5fcf471fdb7932928f3f13b62a79e89377cf46f2d543f2bc20`.

Rollback can use that Netlify deployment or a new revert commit on main. Do not force-reset main or delete the historical deployment.

The subsequent distant-transition and title-line adjustment preserves `151a40da16ca7ca57ebd3f7d922d48b40367f548` on branch `codex/backup-2026-10-13-151a40d` and in `backups/2026-10-13-release-151a40d/`. All 29 source and ZIP entries were checked before editing. ZIP SHA-256: `476fac0d7eca3f2f67e8fbaa7412f89997d8c719a0f103a63fde7f6ff340fc61`.

## Validation

Round 1 exercises all four exhibits on desktop and touch/mobile Chromium: model loading, normalized placement, descriptions, unwrap canvases, four craft steps, photos and posters, with no runtime errors.

Round 2 exercises HTTP failures, malformed GLB, delayed stale requests, rapid clicks, presentation exceptions and recovery, gesture cancellation before and after commit, hidden introduction state, language persistence, modal focus, context restoration, two-finger to one-finger touch continuity and 320px/360px/portrait/landscape layout. Sixteen completed switches show stable GPU texture and geometry counts for each exhibit. With identical seed, camera and time, both the desktop and mobile original scene canvas are pixel-identical to the saved release. The portable `node tests/gallery-lifecycle.cjs` check covers preparation timeout, concurrent candidate ownership and cancellation while animation frames are suspended.

WebKit desktop/mobile checks cover all four exhibits, unwrap, craft, photo, poster and language. Windows Playwright WebKit can omit the WebGL canvas from page screenshots after DPR3 viewport changes. The old local backup, old production site and new preview reproduce this same limitation; synchronous captures contain the complete scene with no GL or context errors. This check does not establish real iPhone Safari presentation. Diagnostic evidence is retained locally in `museum/qa-webkit-diagnostic/`.

Round 3 verifies the deployment preview and production resources, interactions, visible porcelain pixels in exports and poster QR decoding. Local QA source and evidence are retained in `museum/tests/` and `museum/qa-gallery-oct13/`, outside the published runtime files.

The local browser uses software rendering; its FPS is unsuitable as a promise about a physical phone or PC GPU. Original-scene timing is comparable to the saved release under the same test settings. No physical iPhone, Android or WeChat browser is attached, so their hardware FPS and real memory limits remain unverified. A slow network can extend preparation time; the current model remains usable while the next one loads.

## Open-source references

- [three-gltf-viewer](https://github.com/donmccurdy/three-gltf-viewer): resource ownership and viewer lifecycle.
- [model-viewer](https://github.com/google/model-viewer): cancellation ownership for asynchronous model changes.
- [glTF Transform](https://github.com/donmccurdy/glTF-Transform): offline Draco decoding, geometry simplification and resource cleanup.

The switching implementation is original code, adapted to the existing museum API. A second viewer is not embedded.
