# Run with: python3 selftest.py. Builds small fixtures in a temp folder and checks both scripts against them.

import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).parent

FIXTURES = '''
import bpy, math, sys
out = sys.argv[sys.argv.index('--') + 1]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene

def add_cube(name, location=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location)
    bpy.context.object.name = name
    return bpy.context.object

# A three-sided prism turned 37 degrees in a scene of centimetres: a bounding box would overstate its size.
# Two decoys must be ignored: one in a collection disabled for render, one excluded from the view layer.
scene = reset()
bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=1, radius2=1, depth=2)
wedge = bpy.context.object
wedge.rotation_euler.z = math.radians(37)
scene.unit_settings.scale_length = 0.01
for name, x in (('render_off', 100), ('excluded', -100)):
    decoy = add_cube(name, (x, 0, 0))
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    collection.objects.link(decoy)
    scene.collection.objects.unlink(decoy)
bpy.data.collections['render_off'].hide_render = True
bpy.context.view_layer.layer_collection.children['excluded'].exclude = True
bpy.context.view_layer.update()
corners = [wedge.matrix_world @ vert.co for vert in wedge.data.vertices]
size = [(max(c[axis] for c in corners) - min(c[axis] for c in corners)) * 0.01 for axis in range(3)]
open(out + '/wedge_expected.txt', 'w').write(f'Size (m): {size[0]:.3f} wide x {size[1]:.3f} deep x {size[2]:.3f} tall')
bpy.ops.wm.save_as_mainfile(filepath=out + '/wedge.blend')

# Sound geometry that naive checks misjudge: a mirrored cube, a cube whose size lives in its object scale,
# and curves that have no faces.
scene = reset()
add_cube('mirrored').scale.x = -1
scaled = add_cube('scaled', (5, 0, 0))
for vert in scaled.data.vertices:
    vert.co *= 1e-7
scaled.scale = (1e7, 1e7, 1e7)
for name in ('empty_curve', 'guide_path'):
    curve = bpy.data.curves.new(name, 'CURVE')
    scene.collection.objects.link(bpy.data.objects.new(name, curve))
path = bpy.data.curves['guide_path'].splines.new('POLY')
path.points.add(1)
path.points[1].co = (60, 0, 0, 1)
bpy.ops.wm.save_as_mainfile(filepath=out + '/sound.blend')

# A closed cube exported to glTF, which splits its vertices at every hard edge.
scene = reset()
add_cube('closed')
bpy.ops.export_scene.gltf(filepath=out + '/closed.glb')

# A cube that travels 20 units, saved with video output and a camera marker that would steal the view.
scene = reset()
cube = add_cube('mover')
cube.keyframe_insert('location', frame=1)
cube.location.x = 20
cube.keyframe_insert('location', frame=3)
scene.frame_start, scene.frame_end = 1, 3
other = bpy.data.objects.new('other_camera', bpy.data.cameras.new('other_camera'))
scene.collection.objects.link(other)
other.location = (0, 0, -500)
scene.timeline_markers.new('cut', frame=2).camera = other
scene.render.image_settings.media_type = 'VIDEO'
scene.render.pixel_aspect_x = 3
bpy.ops.export_scene.gltf(filepath=out + '/mover.glb')
bpy.ops.wm.save_as_mainfile(filepath=out + '/mover.blend')
'''

TILE_HAS_SUBJECT = '''
import bpy, sys
import numpy as np
path, tiles = sys.argv[sys.argv.index('--') + 1], 3
image = bpy.data.images.load(path)
pixels = np.array(image.pixels[:]).reshape(image.size[1], image.size[0], 4)[:, :, :3]
background = pixels[0, 0]
for tile in np.array_split(pixels, tiles, axis=1):
    assert np.abs(tile - background).max() > 0.1, 'a tile shows only background'
print('TILES OK')
'''


def blender(*args: str) -> str:
    result = subprocess.run(['blender', '-b', '--factory-startup', *args], capture_output=True, text=True)
    return result.stdout + result.stderr


def main() -> None:
    with tempfile.TemporaryDirectory() as folder:
        work = Path(folder)
        (work / 'fixtures.py').write_text(FIXTURES)
        (work / 'tiles.py').write_text(TILE_HAS_SUBJECT)
        blender('-P', str(work / 'fixtures.py'), '--', folder)

        wedge = blender(str(work / 'wedge.blend'), '-P', str(SCRIPTS / 'mesh_report.py'))
        assert (work / 'wedge_expected.txt').read_text() in wedge, wedge
        assert 'Objects: 1' in wedge, wedge

        sound = blender(str(work / 'sound.blend'), '-P', str(SCRIPTS / 'mesh_report.py'))
        assert 'Total: 24 tris' in sound, sound
        assert 'flipped' not in sound and 'zero-area' not in sound and 'Traceback' not in sound, sound
        assert 'Size (m): 7.000 wide' in sound, sound

        closed = blender('-P', str(SCRIPTS / 'mesh_report.py'), '--', str(work / 'closed.glb'))
        assert 'non-manifold' not in closed and 'Total: 12 tris' in closed, closed

        imported = blender('-P', str(SCRIPTS / 'render_check.py'), '--', str(work / 'mover.glb'), '--out', str(work / 'imported'), '--frames', '3', '--size', '128')
        assert (work / 'imported' / 'frame_0003.png').is_file(), imported

        frames = blender(str(work / 'mover.blend'), '-P', str(SCRIPTS / 'render_check.py'), '--', '--out', folder, '--frames', '3', '--size', '128')
        assert 'frames.png' in frames, frames
        assert 'TILES OK' in blender('-P', str(work / 'tiles.py'), '--', str(work / 'frames.png'))

        views = blender(str(work / 'mover.blend'), '-P', str(SCRIPTS / 'render_check.py'), '--', '--out', folder, '--size', '128')
        assert 'views.png' in views, views

    print('selftest passed')


if __name__ == '__main__':
    sys.exit(main())
