"""Export a web copy of a project. Originals are opened read-only and never saved.

blender --background --disable-autoexec --python export-web-model.py -- \
    --source project.blend --preset ulisse --output assets/models/ulisse.glb
"""

import argparse
import hashlib
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--preset', choices=['ulisse', 'nodi', 'padiglione'], required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.open_mainfile(filepath=args.source, load_ui=False, use_scripts=False)
bpy.context.scene.frame_set(1)

# Export only project geometry. Ulisse's working scene contains several copies,
# interiors, and lighting rigs; this isolates the freestanding original.
source_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.hide_render]
if args.preset == 'ulisse':
    source_objects = [obj for obj in source_objects if 17 < obj.location.x < 21 and max(obj.dimensions) < 5]

for source in source_objects:
    for modifier in source.modifiers:
        if modifier.type == 'SUBSURF':
            modifier.levels = min(modifier.levels, 2)
            modifier.render_levels = min(modifier.render_levels, 2)
        if modifier.type == 'PARTICLE_SYSTEM':
            modifier.show_viewport = False
            modifier.show_render = False
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
export_objects = []
fingerprints = set()
for source in source_objects:
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    if not mesh.vertices:
        continue
    # Remove duplicate development copies occupying exactly the same position.
    digest = hashlib.sha256()
    digest.update(str(tuple(round(v, 5) for row in source.matrix_world for v in row)).encode())
    digest.update(str(tuple(tuple(round(v, 5) for v in vert.co) for vert in mesh.vertices)).encode())
    digest.update(str(tuple(slot.material.name if slot.material else '' for slot in source.material_slots)).encode())
    fingerprint = digest.hexdigest()
    if fingerprint in fingerprints:
        continue
    fingerprints.add(fingerprint)
    mesh.transform(source.matrix_world)
    obj = bpy.data.objects.new(source.name, mesh)
    export_objects.append(obj)

scene = bpy.context.scene
for obj in list(scene.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for obj in export_objects:
    scene.collection.objects.link(obj)
bpy.context.view_layer.update()

# Keep the object upright, centered, and grounded; use a practical viewer scale.
points = [obj.matrix_world @ Vector(corner) for obj in export_objects for corner in obj.bound_box]
low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
origin = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
desired_size = {'ulisse': .43, 'nodi': 2.0, 'padiglione': 4.0}[args.preset]
scale = desired_size / max(high - low)
transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-origin)
for obj in export_objects:
    obj.data.transform(transform)
    obj.select_set(True)
    obj.animation_data_clear()

# Mixed Cycles emission shaders are adapted to glTF's real-time PBR material.
# Geometry stays unchanged; procedural roughness is reduced to a constant.
if args.preset == 'ulisse':
    light_material = bpy.data.materials.new('Ulisse · LED')
    light_material.use_nodes = True
    shader = light_material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.94, 1, .58, 1)
    shader.inputs['Emission Color'].default_value = (.94, 1, .58, 1)
    shader.inputs['Emission Strength'].default_value = 2.4
    shader.inputs['Roughness'].default_value = .3
    for obj in export_objects:
        for slot in obj.material_slots:
            if slot.material and slot.material.name == 'Material.001':
                slot.material = light_material
    for name, values in [('metal', {'Metallic': .62, 'Roughness': .24, 'Transmission Weight': .3}),
                         ('Material.004', {'Roughness': .32})]:
        material = bpy.data.materials.get(name)
        if not material or not material.node_tree:
            continue
        shader = next((node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
        if not shader:
            continue
        for socket_name, value in values.items():
            socket = shader.inputs[socket_name]
            for link in list(socket.links):
                material.node_tree.links.remove(link)
            socket.default_value = value

if args.preset == 'nodi':
    # The source references external image files that are unavailable. Present
    # the authentic shape explicitly as a neutral volumetric study instead of
    # inventing the missing artwork or publishing broken textures.
    study_material = bpy.data.materials.new('NODI · studio volumetrico')
    study_material.use_nodes = True
    shader = study_material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.62, .49, .37, 1)
    shader.inputs['Roughness'].default_value = .82
    for obj in export_objects:
        obj.data.materials.clear()
        obj.data.materials.append(study_material)

# Resolve packed textures in memory and limit oversized textures for mobile.
used_materials = {slot.material for obj in export_objects for slot in obj.material_slots if slot.material}
for material in used_materials:
    if not material.node_tree:
        continue
    for node in material.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image:
            continue
        image = node.image
        width, height = image.size
        if max(width, height) > 1536:
            ratio = 1536 / max(width, height)
            image.scale(max(1, int(width * ratio)), max(1, int(height * ratio)))

bpy.context.view_layer.objects.active = export_objects[0]
output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format='GLB',
    use_selection=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_image_format='AUTO',
    export_keep_originals=False,
    export_apply=True,
    export_yup=True,
)
triangles = sum(len(polygon.vertices) - 2 for obj in export_objects for polygon in obj.data.polygons)
print('WEB_MODEL', args.preset, 'objects=', len(export_objects), 'triangles=', triangles, 'bytes=', output.stat().st_size, flush=True)
