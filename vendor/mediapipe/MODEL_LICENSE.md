# Hand Landmarker model license and source

Verified on 2026-10-17. This file documents the pretrained model separately from the Tasks Vision JavaScript/WASM runtime.

## Unmodified model asset

- File: `hand_landmarker.task`
- Official distribution: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- Version path: `hand_landmarker/float16/1`
- Size: 7,819,105 bytes
- SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`

The local file matches `source-manifest.json`. The model is not project-authored or retrained.

## Primary license evidence

The [official Hand Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) links its model bundle to Google's [Hand Tracking (Lite/Full) model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf).

Page 2 of that model card, under the detector/tracker specifications, states: **LICENSED UNDER Apache License, Version 2.0**. The bundle contains a palm detector and a hand landmark tracker. The [official MediaPipe v0.10.3 Vision README](https://github.com/google-ai-edge/mediapipe/blob/d392f8ad98b2d7375e3a57cd3464ecac7efef12a/mediapipe/tasks/web/vision/README.md) uses the same versioned `.task` URL above.

The complete Apache license is retained in `LICENSE`. Retain the source/model attribution and applicable notices when redistributing. No license to Google trademarks is implied. The model card supplies model-license evidence; it is not a cryptographic attestation of this binary.

## Runtime distribution boundary

The separately bundled `@mediapipe/tasks-vision@0.10.3` package declares Apache-2.0 in `package.json`; runtime file sources and hashes are recorded in `source-manifest.json`.

The root MediaPipe license is preserved, including its additional third-party text. A complete component-specific NOTICE/build-provenance inventory for the exact precompiled WASM artifacts was not obtained in this review. This file does not claim that gap is resolved and does not relabel the runtime or model as MIT.
