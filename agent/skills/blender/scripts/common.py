# Shared by the check scripts: arguments after Blender's "--", loading the asset, and finding what renders.

import argparse
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

GEOMETRY_TYPES = {'MESH', 'CURVE', 'SURFACE', 'FONT', 'META'}


def parse_script_args(parser: argparse.ArgumentParser) -> argparse.Namespace:
    parser.add_argument('input', nargs='?', help='.blend, .glb or .gltf to check. Omit to use the file Blender opened.')
    parser.add_argument('--hide', nargs='+', default=[], metavar='OBJECT', help='Objects to leave out, such as a ground plane or backdrop')
    script_args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

    return parser.parse_args(script_args)


def load_input(path: str | None, hidden_names: list[str]) -> None:
    if path is not None:
        open_asset_file(path)

    for name in hidden_names:
        if name not in bpy.data.objects:
            sys.exit(f'--hide: no object named {name}')
        bpy.data.objects[name].hide_render = True

    # Something disabled in viewports still renders, but Blender skips evaluating it, so its position,
    # modifiers and animation would be stale. Enabling it here, in memory only, keeps it measured.
    for item in (*bpy.data.objects, *bpy.data.collections):
        item.hide_viewport = False


def open_asset_file(path: str) -> None:
    file = Path(path)
    if not file.is_file():
        sys.exit(f'Input not found: {file}')

    suffix = file.suffix.lower()
    if suffix == '.blend':
        bpy.ops.wm.open_mainfile(filepath=str(file))
    elif suffix in ('.glb', '.gltf'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(file))
        use_imported_frame_range()
    else:
        sys.exit(f'Unsupported input {file.name}: use .blend, .glb or .gltf')


def use_imported_frame_range() -> None:
    # The importer leaves the scene at Blender's default 1-250 whatever the file's animations cover.
    ranges = [action.frame_range for action in bpy.data.actions]
    if ranges:
        scene = bpy.context.scene
        scene.frame_start = math.floor(min(start for start, _ in ranges))
        scene.frame_end = math.ceil(max(end for _, end in ranges))


def renderable_geometry() -> list[bpy.types.Object]:
    scene = bpy.context.scene
    rendered_collections = set(collections_enabled_for_render(scene.collection))

    # view_layer.objects already leaves out collections excluded from the view layer.
    return [
        obj for obj in bpy.context.view_layer.objects
        if obj.type in GEOMETRY_TYPES
        and not obj.hide_render
        and any(collection in rendered_collections for collection in obj.users_collection)
    ]


def collections_enabled_for_render(collection: bpy.types.Collection):
    if collection.hide_render:
        return

    yield collection

    for child in collection.children:
        yield from collections_enabled_for_render(child)


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector] | None:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lows, highs = [], []

    # Evaluated vertices, because a bounding box ignores modifiers and grows when the object is rotated.
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        # A curve with no bevel or no splines has no faces: it renders nothing, so it must not set the framing.
        if mesh is None or not mesh.polygons:
            evaluated.to_mesh_clear()
            continue

        coords = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get('co', coords)
        evaluated.to_mesh_clear()

        matrix = np.array(obj.matrix_world)
        world = coords.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
        lows.append(world.min(axis=0))
        highs.append(world.max(axis=0))

    if not lows:
        return None

    return Vector(np.min(lows, axis=0)), Vector(np.max(highs, axis=0))


def require_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    bounds = world_bounds(objects)
    if bounds is None:
        sys.exit('No renderable geometry in the scene')

    return bounds
