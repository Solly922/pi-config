# Renders an asset for inspection without changing or saving it: a contact sheet of views, a sheet of
# animation frames, or a turntable video.

import argparse
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from common import load_input, parse_script_args, renderable_geometry, require_bounds, world_bounds

# (azimuth, elevation) in degrees. Azimuth 0 looks at the front, which faces -Y in Blender.
VIEWS = {
    'front': (0, 0),
    'right': (90, 0),
    'back': (180, 0),
    'top': (0, 90),
    'three_quarter': (35, 25),
    'low_three_quarter': (-40, 5),
}
SHEET_COLUMNS = 4
TURNTABLE_FRAMES = 60


def add_check_camera(center: Vector) -> tuple[bpy.types.Object, bpy.types.Object]:
    scene = bpy.context.scene
    pivot = bpy.data.objects.new('check_pivot', None)
    pivot.location = center
    scene.collection.objects.link(pivot)

    camera = bpy.data.objects.new('check_camera', bpy.data.cameras.new('check_camera'))
    camera.parent = pivot
    scene.collection.objects.link(camera)
    scene.camera = camera

    return pivot, camera


def aim_camera(pivot: bpy.types.Object, camera: bpy.types.Object, radius: float, azimuth: float, elevation: float) -> None:
    distance = radius / math.sin(camera.data.angle / 2)
    camera.location = (0, -distance, 0)
    camera.rotation_euler = (math.radians(90), 0, 0)
    camera.data.clip_start = distance / 100
    camera.data.clip_end = distance * 10
    pivot.rotation_euler = (math.radians(-elevation), 0, math.radians(azimuth))


def add_neutral_lighting() -> None:
    scene = bpy.context.scene
    world = bpy.data.worlds.new('check_world')
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    scene.world = world

    # The camera sees a dark backdrop while the asset is lit by a brighter grey, so pale assets keep contrast.
    ambient = nodes['Background']
    ambient.inputs['Color'].default_value = (0.5, 0.5, 0.5, 1)
    backdrop = nodes.new('ShaderNodeBackground')
    backdrop.inputs['Color'].default_value = (0.1, 0.1, 0.1, 1)
    seen_by_camera = nodes.new('ShaderNodeLightPath')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(seen_by_camera.outputs['Is Camera Ray'], mix.inputs['Factor'])
    links.new(ambient.outputs['Background'], mix.inputs[1])
    links.new(backdrop.outputs['Background'], mix.inputs[2])
    links.new(mix.outputs['Shader'], nodes['World Output'].inputs['Surface'])

    sun = bpy.data.objects.new('check_sun', bpy.data.lights.new('check_sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)


def renderable_lights() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.view_layer.objects if obj.type == 'LIGHT' and not obj.hide_render]


def render_still(path: Path) -> np.ndarray:
    scene = bpy.context.scene
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)

    image = bpy.data.images.load(str(path))
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(image.size[1], image.size[0], 4)
    bpy.data.images.remove(image)

    return pixels


def use_flat_workbench(wireframe: bool) -> None:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.view_settings.view_transform = 'Standard'
    scene.world.color = (1, 1, 1)

    shading = scene.display.shading
    shading.light = 'FLAT'
    shading.color_type = 'SINGLE'
    shading.single_color = (0, 0, 0)

    # Workbench has no wireframe render mode, so each mesh gets a temporary Wireframe modifier.
    # Curves take no such modifier and stay solid.
    if wireframe:
        for obj in (obj for obj in renderable_geometry() if obj.type == 'MESH'):
            modifier = obj.modifiers.new('check_wire', 'WIREFRAME')
            modifier.thickness = 0.004 * max(obj.dimensions)
            modifier.use_even_offset = False


def save_sheet(tiles: list[np.ndarray], path: Path) -> None:
    tile_height, tile_width = tiles[0].shape[:2]
    columns = min(SHEET_COLUMNS, len(tiles))
    rows = math.ceil(len(tiles) / columns)
    sheet = np.ones((rows * tile_height, columns * tile_width, 4), dtype=np.float32)

    for index, tile in enumerate(tiles):
        # Blender stores image rows bottom-up, so the first row of tiles goes at the end of the array.
        top = (rows - 1 - index // columns) * tile_height
        left = (index % columns) * tile_width
        sheet[top:top + tile_height, left:left + tile_width] = tile

    image = bpy.data.images.new('check_sheet', width=sheet.shape[1], height=sheet.shape[0])
    image.pixels.foreach_set(sheet.ravel())
    image.filepath_raw = str(path)
    image.file_format = 'PNG'
    image.save()
    print(f'Wrote {path}')


def render_views(out: Path, pivot, camera, radius: float) -> None:
    tiles = []
    for name, (azimuth, elevation) in VIEWS.items():
        aim_camera(pivot, camera, radius, azimuth, elevation)
        tiles.append(render_still(out / f'{name}.png'))

    aim_camera(pivot, camera, radius, *VIEWS['three_quarter'])
    use_flat_workbench(wireframe=False)
    tiles.append(render_still(out / 'silhouette.png'))
    use_flat_workbench(wireframe=True)
    tiles.append(render_still(out / 'wireframe.png'))

    save_sheet(tiles, out / 'views.png')


def render_animation_frames(out: Path, count: int) -> None:
    scene = bpy.context.scene
    span = scene.frame_end - scene.frame_start
    frames = sorted({round(scene.frame_start + span * index / (count - 1)) for index in range(count)})

    # The camera frames every sampled pose at once, so an asset that travels stays in view.
    # A frame where the asset is hidden contributes nothing to the framing and still renders as a tile.
    posed_bounds = []
    for frame in frames:
        scene.frame_set(frame)
        bounds = world_bounds(renderable_geometry())
        if bounds is not None:
            posed_bounds.append(bounds)

    if not posed_bounds:
        sys.exit('No renderable geometry in any sampled frame')

    lows, highs = zip(*posed_bounds)

    low = Vector(min(point[axis] for point in lows) for axis in range(3))
    high = Vector(max(point[axis] for point in highs) for axis in range(3))
    pivot, camera = add_check_camera((low + high) / 2)
    aim_camera(pivot, camera, (high - low).length / 2, *VIEWS['three_quarter'])

    tiles = []
    for frame in frames:
        scene.frame_set(frame)
        tiles.append(render_still(out / f'frame_{frame:04d}.png'))

    save_sheet(tiles, out / 'frames.png')


def render_turntable(out: Path, pivot, camera, radius: float) -> None:
    scene = bpy.context.scene
    aim_camera(pivot, camera, radius, 0, 15)
    scene.frame_start, scene.frame_end = 1, TURNTABLE_FRAMES

    # New keyframes ease in and out by default, which would make the turn speed up and slow down.
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    for frame, turn in ((1, 0), (TURNTABLE_FRAMES + 1, 2 * math.pi)):
        pivot.rotation_euler.z = turn
        pivot.keyframe_insert('rotation_euler', frame=frame)

    scene.render.image_settings.media_type = 'VIDEO'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.filepath = str(out / 'turntable.mp4')
    bpy.ops.render.render(animation=True)
    print(f'Wrote {out / "turntable.mp4"}')


def use_diagnostic_render_settings(size: int, engine: str | None) -> None:
    scene = bpy.context.scene
    render = scene.render

    # A file saved for video refuses the PNG format until its media type is set back to image.
    render.image_settings.media_type = 'IMAGE'
    render.image_settings.file_format = 'PNG'

    render.resolution_x = render.resolution_y = size
    render.resolution_percentage = 100
    render.pixel_aspect_x = render.pixel_aspect_y = 1
    render.use_border = False
    render.film_transparent = False

    # The scene's own compositor, sequencer, or camera markers would replace what the check camera sees.
    render.use_compositing = False
    render.use_sequencer = False
    for marker in scene.timeline_markers:
        marker.camera = None

    if engine:
        render.engine = engine

    if render.engine == 'BLENDER_WORKBENCH':
        render.engine = 'BLENDER_EEVEE'

    if scene.world is None:
        scene.world = bpy.data.worlds.new('check_world')


def frame_count(text: str) -> int:
    count = int(text)
    if count < 2:
        raise argparse.ArgumentTypeError('needs at least 2 frames')

    return count


def tile_size(text: str) -> int:
    size = int(text)
    # H.264 rejects odd dimensions.
    if size < 64 or size % 2:
        raise argparse.ArgumentTypeError('needs an even number of pixels, 64 or more')

    return size


def main() -> None:
    parser = argparse.ArgumentParser(description='Render an asset for inspection: a sheet of views, a sheet of animation frames, or a turntable.')
    parser.add_argument('--out', required=True, help='Folder for the renders')
    parser.add_argument('--size', type=tile_size, default=640, help='Pixels per tile side')
    parser.add_argument('--engine', choices=['BLENDER_EEVEE', 'CYCLES'], help="Defaults to the scene's own engine")
    parser.add_argument('--neutral', action='store_true', help="Replace the scene's lights and world with plain studio light")
    parser.add_argument('--frames', type=frame_count, help='Render this many animation frames instead of the views')
    parser.add_argument('--turntable', action='store_true', help='Render a turntable mp4 instead of the views')
    args = parse_script_args(parser)

    load_input(args.input, args.hide)
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    use_diagnostic_render_settings(args.size, args.engine)

    # An asset with its own lights is judged under them. One without, or --neutral, gets a grey world and a sun.
    lights = renderable_lights()
    if args.neutral or not lights:
        for obj in lights:
            obj.hide_render = True
        add_neutral_lighting()

    if args.frames:
        render_animation_frames(out, args.frames)
        return

    low, high = require_bounds(renderable_geometry())
    radius = (high - low).length / 2
    pivot, camera = add_check_camera((low + high) / 2)

    if args.turntable:
        render_turntable(out, pivot, camera, radius)
    else:
        render_views(out, pivot, camera, radius)


main()
