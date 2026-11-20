# Prints what a render can't show: size, triangle count, broken geometry, materials and textures.

import argparse
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).parent))
from common import load_input, parse_script_args, renderable_geometry, require_bounds

WELD_DISTANCE = 1e-6


def report_object(obj: bpy.types.Object, depsgraph: bpy.types.Depsgraph) -> tuple[int, list[str]]:
    # Evaluated, so modifiers and curve bevels are counted.
    evaluated = obj.evaluated_get(depsgraph)
    evaluated_mesh = evaluated.to_mesh()
    if evaluated_mesh is None or not evaluated_mesh.polygons:
        evaluated.to_mesh_clear()
        print(f'  {obj.name}: no faces, renders nothing')
        return 0, []

    mesh = bmesh.new()
    mesh.from_mesh(evaluated_mesh)
    evaluated.to_mesh_clear()
    mesh.transform(obj.matrix_world)

    # A mirrored object (negative scale) comes out of the transform with every face wound backwards.
    if obj.matrix_world.is_negative:
        bmesh.ops.reverse_faces(mesh, faces=mesh.faces)

    triangles = sum(len(face.verts) - 2 for face in mesh.faces)
    warnings = []

    # 1e-12 square units is a millionth of a square millimetre at 1 unit = 1 m: a collapsed face, not a small one.
    tiny_faces = sum(1 for face in mesh.faces if face.calc_area() < 1e-12)
    if tiny_faces:
        warnings.append(f'{tiny_faces} zero-area faces')

    loose_verts = sum(1 for vert in mesh.verts if not vert.link_faces)
    if loose_verts:
        warnings.append(f'{loose_verts} loose vertices')

    # glTF splits vertices at UV and shading seams, so edges are judged after welding them back together.
    vertex_count = len(mesh.verts)
    bmesh.ops.remove_doubles(mesh, verts=mesh.verts, dist=WELD_DISTANCE)
    duplicate_verts = vertex_count - len(mesh.verts)
    # In a .blend, coincident vertices are unmerged geometry. In an imported glTF they are expected.
    if duplicate_verts and bpy.data.filepath:
        warnings.append(f'{duplicate_verts} duplicate vertices (unmerged, or separate shells that touch)')

    open_edges = sum(1 for edge in mesh.edges if not edge.is_manifold)
    if open_edges:
        warnings.append(f'{open_edges} non-manifold edges (open or shared by 3+ faces)')

    # Blender's own outward-normal pass tells us which faces it would flip. Only meaningful on closed meshes.
    if not open_edges:
        before = [face.normal.copy() for face in mesh.faces]
        bmesh.ops.recalc_face_normals(mesh, faces=mesh.faces)
        flipped = sum(1 for face, normal in zip(mesh.faces, before) if face.normal.dot(normal) < 0)
        if flipped:
            warnings.append(f'{flipped} faces with flipped normals')

    mesh.free()

    if any(abs(scale - 1) > 1e-4 for scale in obj.scale):
        warnings.append(f'unapplied scale {tuple(round(scale, 3) for scale in obj.scale)}')

    if obj.type == 'MESH' and not obj.data.uv_layers:
        warnings.append('no UV map')

    if not any(slot.material for slot in obj.material_slots):
        warnings.append('no material')

    materials = ', '.join(slot.material.name for slot in obj.material_slots if slot.material) or '-'
    print(f'  {obj.name}: {triangles} tris, materials [{materials}]')

    for warning in warnings:
        print(f'    WARNING {warning}')

    return triangles, warnings


def main() -> None:
    args = parse_script_args(argparse.ArgumentParser(description='Print size, triangle counts and geometry warnings for an asset.'))
    load_input(args.input, args.hide)

    geometry = renderable_geometry()
    low, high = require_bounds(geometry)
    metres_per_unit = bpy.context.scene.unit_settings.scale_length
    size = (high - low) * metres_per_unit

    print(f'Size (m): {size.x:.3f} wide x {size.y:.3f} deep x {size.z:.3f} tall')
    print(f'Lowest point z = {low.z * metres_per_unit:.3f} (0 means it sits on the ground)')
    print(f'Objects: {len(geometry)}')

    depsgraph = bpy.context.evaluated_depsgraph_get()
    results = [report_object(obj, depsgraph) for obj in geometry]
    print(f'Total: {sum(triangles for triangles, _ in results)} tris, {sum(len(warnings) for _, warnings in results)} warnings')

    used_images = [image for image in bpy.data.images if image.source in ('FILE', 'GENERATED') and image.users]
    print(f'Textures: {len(used_images)}')

    for image in used_images:
        print(f'  {image.name}: {image.size[0]}x{image.size[1]}')


main()
