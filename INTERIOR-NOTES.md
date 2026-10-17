# Isolated display interior repair

This preview adds a plain interior wall and an upward-facing interior floor to four incomplete scan interiors. It does not replace or edit the GLBs, their exterior meshes, textures, existing material settings, or the cover of exhibit 192. Exhibit 191 remains body-only, without an invented cover. The added interior shape and depth shading are for display and are not measured archaeological structure or wall thickness.

## Integration

```js
import {addInterior} from './enhancements/interior.js';
// On a newly parsed glTF scene, before prepareExhibit's normalization:
const infill = addInterior(THREE, gltf.scene, exhibitKey);
```

Keys are `original`, `covered-192`, `beaker-193`, and `vase-191`. The API returns `{added, meshes, report}`. An unknown key or differing vertex/index signature returns `{added:false, reason}` without altering the model. Calling it again on the same model returns the existing result. Every model owns its new material and geometry; the existing `disposeExhibit` traversal disposes them normally. No new textures, event listeners, timers, asynchronous requests, global scene objects, or animation work are added.

The static `interior-data.js` was generated from the preserved local GLBs. It stores the actual ordered body cut boundary and 32 exterior-derived interior sections of 64 vertices. Every boundary vertex is retained; a triangulated collar joins that irregular ring to the regular sections. The inner floor is at 10% of body height, above the existing outer foot. The opaque, single-sided new material faces into the cavity. It does not cap the mouth.

The scans' existing inner cuts have substantially different baked base-color shading. To avoid a bright serrated white disk at those cuts, the new neutral vertex colors use the median linear luminance of the source cut's white glaze, then gradually reduce to 42% of that luminance at the interior floor. This adds a depth cue only to the new mesh; it copies no blue decoration, label, or source image. It is a display approximation, not a physical lighting simulation.

Only the new floor's final ring has an explicitly upward shading normal; its previous two sections blend into that normal. Positions, triangle winding, the measured source seam, and source normals are unaffected. Some thin highlights can remain at narrow body sections because the interior profile follows the exterior's changes in width. They are not open seams. In the 193 top view, the narrow projected section at normalized display Y approximately -0.422 occludes the wider floor at Y -0.590.

| Exhibit | Original cut vertices retained | Added vertices | Added triangles |
|---|---:|---:|---:|
| Original | 64 | 2,113 | 4,160 |
| 192 | 535 | 2,584 | 4,631 |
| 193 | 280 | 2,329 | 4,376 |
| 191 | 349 | 2,398 | 4,445 |

Every exhibit adds one mesh/draw call and one material. Profile data is 188,367 bytes before transfer compression (73,649 bytes with default gzip). Geometry creation measured about 1–6 ms in this desktop Node process, including the cold first call; this is not a phone or browser FPS measurement.

## Reproducible checks

Run these from the D-drive project root:

```powershell
node work/museum-interior-gesture-2026-10-17/preview/tests/build-interior-data.cjs
node work/museum-interior-gesture-2026-10-17/preview/tests/interior-geometry.cjs
```

The builder reads local source GLBs and writes only the preview's profile module. The geometry test verifies source SHA-256, unchanged original buffers/material references, unchanged bounds, matching scan seam edges and orientation, manifold new geometry, no degenerate faces, no collar self-intersections, inward section winding, upward floor faces, finite neutral vertex colors, 7,936 exterior-envelope samples per model, downward opening rays, repeated calls, and disposal. The new mesh's only boundary is its join to the scan; those edges match the original boundary in the opposite direction.

The scanned boundary is jagged and occasionally backtracks slightly in polar angle. Respecting it produces 4, 8, and 6 locally concave collar facets on 192, 193, and 191. These facets have consistent winding with the original scan and zero detected self-intersections; forcing their normals to point exactly at the center would break that consistency. Regular wall sections face inward and all floor faces point upward.

With the parent's isolated local QA server on port 4187:

```powershell
node work/museum-interior-gesture-2026-10-17/preview/tests/interior-visual.cjs
# After a color-only adjustment, recheck the interior views:
node work/museum-interior-gesture-2026-10-17/preview/tests/interior-visual.cjs --interior-only
# Final normal/color verification: desktop/mobile Edge and a minimal WebKit pass
node work/museum-interior-gesture-2026-10-17/preview/tests/interior-final-views.cjs
node work/museum-interior-gesture-2026-10-17/preview/tests/interior-final-views.cjs --webkit
```

Screenshots and browser reports go to `work/museum-interior-gesture-2026-10-17/qa`, not the museum source tree. The full pass contains 52 desktop/mobile views, including front, top, oblique, close seam, side, back, and an additional QA-only hidden-cover inspection for 192. It checks a rendered 512² interior mask against the original model's filled outer silhouette, allowing one raster pixel of edge tolerance. The interior-only color pass contains 28 views. The final normal/color script captures 18 Edge views and 5 WebKit views, and checks actual captured porcelain pixels, GL error, context state and browser errors. It uses synchronous WebGL-canvas capture rather than assuming an ordinary WebKit page screenshot includes that canvas. The real cover is never hidden by the implementation. The reports record runtime module hashes.

These checks do not replace physical iPhone/WeChat/Safari testing. They do not repair unrelated small holes or scan artifacts elsewhere on the original scans. No physical accuracy of the new interior dimensions, optical material response, or reconstructed wall thickness is claimed.
