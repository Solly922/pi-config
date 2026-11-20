# Targets

Facts that differ by where the asset runs. Loader and renderer options change between engine versions, so confirm option names in the docs for the version the project has installed.

## Every real-time target

- Ship glTF 2.0 as a single `.glb`. It is Y-up, in metres, with the asset's front toward +Z.
- Procedural materials do not survive export. Bake them to base colour, roughness-metalness, and normal textures first.
- PBR metal renders black or flat without an environment map. Set one before judging any material.
- Turn on tone mapping and check the output colour space. Without them, lit colours clip and textures look washed out or too dark.
- Give the asset somewhere to sit: a shadow-catching ground, a contact shadow, or baked ambient occlusion.

Budgets are starting points for a mid-range laptop. Halve them for phones, and measure before raising them.

| Role | Triangles | Texture size |
| --- | --- | --- |
| Hero asset, seen close | 20k to 60k | 2048 |
| Mid-ground prop | 2k to 10k | 1024 |
| Background or repeated prop | 200 to 2k | 512, or a shared atlas |

Draw calls cost more than triangles. Merge meshes that share a material, and instance anything repeated.

## three.js and React Three Fiber

- Load with `GLTFLoader` (`useGLTF` in drei). Draco, meshopt, and KTX2 files each need their decoder registered on the loader.
- Set `scene.environment` to an HDRI or `RoomEnvironment`, pick a tone mapping on the renderer, and enable shadows on the renderer, the light, and each mesh: all three are off by default.
- The default camera looks down -Z, so a glTF's front faces a camera placed on +Z.
- Check it in the browser at the page's real camera and viewport, including a phone-sized one.

## Babylon.js

- Babylon is left-handed by default. Its glTF loader parents the import under a `__root__` node that flips it, so position and rotate that root or a parent you add, not the meshes under it.
- PBR materials need `scene.environmentTexture`. `scene.createDefaultEnvironment()` is a quick way to get one while working.
- Add a `ShadowGenerator` per shadow-casting light and list the casters on it.

## Godot and other native engines

Use an engine only when the user has chosen it and it is installed on this machine. Godot 4 imports `.glb` directly, is Y-up in metres with -Z forward, and reimports when the file changes. For any other engine, export `.glb` unless the user names another format, and ask how they bring assets in.

## Standalone renders

- Render in Blender with Cycles through a camera you composed: a chosen focal length (50 to 85 mm for a product, wider for an environment), a deliberate height, and depth of field when it helps the read.
- Light for the subject: a key with a direction, something to separate the subject from the background, and a surface to catch its shadow.
- Deliver the still at the size asked for, and a turntable when the user needs to see all sides.
