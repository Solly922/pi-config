---
name: blender
description: Build, render, check, bake, and export 3D assets with headless Blender driven by Python. Use when a task needs Blender for modeling, materials, renders, turntables, texture baking, or glTF export, or needs a .blend, .glb, or .gltf inspected.
---

# Blender, headless

Run `command -v blender` first. If Blender is missing, say so and stop: this skill has no fallback. Art direction and the choice of tool belong to the `3d-design` skill. Read it first when the task is to make something.

Tested on Blender 5.3. The Python API changes between releases, so on another version (`blender --version`) confirm a property exists before relying on it:

```bash
blender -b --factory-startup --python-expr "import bpy; print([p.identifier for p in bpy.types.BevelModifier.bl_rna.properties])"
```

## Work as a build script

Write one `build.py` per asset that starts from an empty scene, builds everything, and saves a `.blend`. Refining means editing the script and rerunning it, so every pass is reproducible and the script is the source of truth.

```bash
blender -b --factory-startup -P build.py          # build
blender -b asset.blend -o //renders/hero_ -f 1    # render frame 1 through the scene camera
```

- Start with `bpy.ops.wm.read_factory_settings(use_empty=True)`. The default scene holds a cube, a camera, and a light.
- Arguments for your script go after `--` and arrive in `sys.argv`.
- Filter Blender's log with `2>&1 | grep -E "Error|Traceback|line |Saved"`. A Python error does not change the exit code.
- Build geometry with `bmesh` and object data, and keep shape-defining numbers in named variables at the top. Operators (`bpy.ops`) need a context: wrap them in `with bpy.context.temp_override(object=obj, active_object=obj):`.
- Keep modifiers live in the `.blend` and let export apply them. Order matters: Solidify, then Boolean, then Bevel, then Weighted Normal.
- One unit is one metre. Put the asset's base at z = 0 and its front toward -Y.

## Look at it

After every pass, run both checks and read the image.

```bash
S=~/.pi/agent/skills/blender/scripts
blender -b asset.blend -P $S/render_check.py -- --out renders/pass2 --neutral --hide ground
blender -b asset.blend -P $S/mesh_report.py -- --hide ground
```

`render_check.py` writes `views.png`, one sheet with front, right, back, top on the first row and three-quarter, low three-quarter, silhouette, wireframe on the second. Both scripts also take a `.glb` or `.gltf` as a first argument after `--`, for checking an export or a library asset. Neither changes or saves the file. Curves stay solid in the wireframe tile.

- `--hide OBJECT ...` leaves staging out. Without it a ground plane sets the framing and the asset renders as a dot.
- `--neutral` swaps the scene's lights and world for plain studio light. Use it to judge form and materials, and render through the scene camera to judge the lighting.
- `--frames N` writes `frames.png` with N frames across the scene's animation. Use it for anything that moves.
- `--turntable` writes `turntable.mp4` for the user. It takes minutes without a GPU, so run it once at the end.
- `--size` sets pixels per tile (default 640) and `--engine CYCLES` overrides the scene's engine.

`mesh_report.py` prints real-world size, triangles per object, and warnings for open edges, flipped normals, collapsed faces, unapplied scale, and missing UVs or materials. Curves are counted as they will export. Open edges are judged after welding coincident vertices, so a `.glb` reports the same as its `.blend`. In a `.blend` the welded vertices are listed as duplicates: merge them, unless they are separate shells that touch, such as curve end caps or Array copies. Both scripts skip collection instances, so make instances real before checking a scene built from them.

After editing either script, run `python3 $S/selftest.py`.

## What goes wrong

- **Curve tubes are expensive.** A bevelled curve at default resolution costs thousands of triangles. Set `bevel_resolution` to 2 and `resolution_u` to 6 for thin rods, then read the report.
- **Metal looks flat grey.** Metal shows only what it reflects. Give the world a gradient or an HDRI and add a light the metal can catch.
- **Light inside glass stays inside.** In Cycles, glass blocks direct light. Mix a Transparent BSDF into the glass material on the Light Path node's `Is Shadow Ray` output.
- **Ambient Occlusion, Bevel, and Pointiness nodes** are the cheap way to put dirt in recesses and wear on edges. They render in Cycles and do not export.
- **EEVEE, Cycles, and Workbench all render without a display.** Cycles falls back to the CPU when there is no supported GPU, which is fine for stills at 64 to 128 samples with denoising.
- **Colours look washed out or crushed.** The view transform is AgX by default. Set `scene.view_settings.look` for contrast, and use `Standard` only for flat diagnostic renders.

## Export to glTF

```python
bpy.ops.export_scene.gltf(filepath='asset.glb', use_selection=True, export_apply=True)
```

Select only the asset, so cameras, lights, and staging stay behind. `export_apply` applies modifiers and converts curves to meshes. The exporter converts Blender's Z-up to glTF's Y-up.

Procedural materials do not export: only image textures and plain values wired straight into the Principled BSDF survive. Bake first when the look depends on nodes:

1. Unwrap: `bpy.ops.uv.smart_project(island_margin=0.02)` in Edit Mode with everything selected.
2. Add an Image Texture node holding a new image and make it the active node (`node_tree.nodes.active`).
3. Set the engine to Cycles and call `bpy.ops.object.bake(type=..., margin=8)`.
   - Roughness: `type='ROUGHNESS'`.
   - Normal: `type='NORMAL'`.
   - Base colour: wire the colour into an Emission shader and bake `type='EMIT'`. A `DIFFUSE` bake of a metallic surface comes out near black.
4. Save the images, then build a plain export material that wires them into a Principled BSDF.

After exporting, run both check scripts on the `.glb`. The export is done when the sheet matches the `.blend` sheet and the report shows the triangle count and textures you expect.
