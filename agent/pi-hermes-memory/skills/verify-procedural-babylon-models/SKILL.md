---
name: "verify-procedural-babylon-models"
description: "Build and verify original faceted Babylon meshes, material merging, and model-only GLB exports."
version: 2
created: "2026-09-11"
updated: "2026-09-11"
---
## When to Use
When implementing procedural low-poly Babylon.js models and a browser viewer, particularly with custom geometry mixed with Babylon builders.

## Procedure
1. Keep model construction separate from React and rendering. Return a stable model ID, root TransformNode, surface meshes, actual triangle count, and explicit disposal function.
2. Give the model a consistent floor and forward-axis convention. Verify custom profile triangle winding with a dot-product test; Babylon's default left-handed normal convention can reverse an assumed winding.
3. Before Mesh.MergeMeshes, match vertex attributes. For untextured models, remove UVKind from builder primitives when custom meshes have no UVs; otherwise provide compatible UVs. Merge by material for static models, and by joint plus material for articulated ones.
4. Author joint pivots in each character's own proportions and preserve geometry world transforms when parenting. Split limbs at elbows/knees; omit internal tube caps and overlap a small rounded joint to avoid coincident faces. Attach garment, hair and beard pieces to explicit accessory pivots rather than animating unrelated meshes.
5. For two-sided cloth generated with both windings, convertToFlatShadedMesh must compute separate face normals after unindexing. Shared smooth normals cancel between opposite faces.
6. Use NullEngine tests for finite geometry, valid indices, floor alignment, draw budgets and cleanup. For articulated rosters, test exact rest restoration and distinct poses. When characters are cosmetic-only, assert identical input trajectories across every motion profile.
7. Use browser rendering to inspect every silhouette and animated pose, including clothing intersections. Software Chromium verifies rendering/interactions, not hardware performance. Replacing the active input adapter must reset the previous actor, dispose boundary materials/listeners, and route callbacks to the current actor rather than capturing the first one.
8. Exercise selected GLB downloads after animations. Parse the header and JSON chunk; verify only selected-root descendants, no stage/camera/lights, and neutral translation. For triangle counts, use the indices accessor count when present, otherwise POSITION count. Do not imply procedural motion is included unless clips are actually baked.
## Pitfalls
- Babylon Mesh.MergeMeshes throws when custom and builder meshes have different vertex attributes.
- A finite normal is not necessarily outward; explicitly test direction, including top/bottom caps.
- Flat color detail panels can intersect a tapered torso. Fit trim to the actual cross sections and inspect the rendered result rather than relying on mesh presence.
- Capture selected model identity before async serializer imports, and prevent lineup/selection changes while exporting so filenames and transforms remain stable.
- Do not call a source-generated static model rigged or animated; material merging destroys independent limb geometry unless joints are preserved deliberately.

## Verification
1. NullEngine tests pass for every roster member and repeated disposal leaves no model meshes/materials.
2. Actual browser displays every model and supports camera/selection controls without exceptions.
3. Every exported GLB has valid structure and contains only the chosen model.
4. Type, lint and production-build checks pass; real-device performance remains explicitly separate.