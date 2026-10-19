# Display reconstruction of missing interiors

The four original GLBs, their exterior geometry, original UVs, textures, opening and existing cover are preserved. Missing inner walls, floor shape and the added blue decoration are DISPLAY RECONSTRUCTIONS, not measured or authenticated original interiors. The bilingual Explore panel states this distinction.

## Shape and shading

interior-data.js retains the actual ordered source cut and its source normals. The lining keeps all cut positions, inherits those normals and eases into its own computed normals over a short band. The final eight of 32 rings form a curved bowl; the tiny central fan is 0.1225% of the previous full-width fan area. The last three wall normals are no longer forced upward to imitate a flat floor.

There are still 64 points per regular section and one added mesh/material per exhibit. Only 33 UV-wrap vertices are added, without adding faces or changing bounds. The original cut's baked shading is compensated while the atlas eases into glaze, avoiding a new bright ring. Depth shading is a display cue, not physically simulated light transport.

## Added decoration

Each exhibit owns one 512 x 512 RGB PNG under enhancements/interior-textures. The four files total approximately 1.03 MB. They adapt the corresponding exterior's blue-chroma motifs to the missing cavity, retain original cut colours in a narrow joining band and fade into unpatterned glaze at the floor. Original rim decoration is untouched. Neutral scan shadows and red/brown labels are not transplanted as decoration. manifest.json records source and output hashes and the reconstruction notice.

U follows the cut's arc-length progress, with split wrap faces; V runs from cut to floor. No independent circular bottom decal is inserted. Atlases use sRGB, flipY=false and repeat only around U.

addInterior(THREE, model, key) remains idempotent and returns {added, meshes, report, ready}. Both existing load paths await ready before compilation. Atlases load only for the active exhibit and requested switching candidate. Failure or a five-second timeout resolves with the curved-glaze fallback, so an optional image cannot indefinitely block the museum. Existing exhibit cleanup disposes the atlas. A browser image transfer already in flight may continue, but late callbacks cannot reactivate a released material.

## Checks

From the D-drive project, using its existing Node runtime and asset-tools development packages:

    node work/interior-continuity-2026-10-19/repository/tests/build-interior-data.cjs
    node work/interior-continuity-2026-10-19/repository/tests/build-interior-atlas.cjs
    node work/interior-continuity-2026-10-19/repository/tests/interior-geometry.cjs
    node work/interior-continuity-2026-10-19/repository/tests/interior-texture-lifecycle.cjs
    node work/interior-continuity-2026-10-19/repository/tests/startup-guard.test.cjs

Geometry checks retain source-byte, boundary, winding, manifold, no-self-intersection and containment assertions after welding UV copies. Texture lifecycle tests cover success, failure, timeout, disposal and synchronous/late callbacks. Browser reports and screenshots belong in the separate qa folder. Browser checks do not establish physical iPhone/WeChat FPS, photographic accuracy, original inner painting or measured wall thickness.
