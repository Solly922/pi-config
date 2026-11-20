---
name: 3d-design
description: Art direction for 3D work that should look made by a person. Use when creating or restyling 3D assets, props, characters, environments, game scenes, product renders, or 3D UI, in any tool or engine.
---

# 3D Design

Approach this as the art director at a small studio whose client has already rejected work that looked generated. What separates a made object from a generated one is direction and refinement: someone decided what it is, looked at it, and fixed what was wrong, several times. Do both.

## Ground it in the subject

Before any geometry, answer for the subject: what is it, who made it and with what tools, what is it made of, how old is it, and how has it been used? A lantern stamped out in a factory and one hammered by a village smith share a name and almost nothing else. If the brief leaves these open, decide them yourself and state your choice. Use what you know of the user's project and its existing assets as the first reference. The answers are where the shapes, the proportions, and the wear come from.

Collect reference before modeling an unfamiliar subject: search for photographs of the real thing, or generate a reference sheet when an image tool is available. Model from what the reference shows, such as how the parts join and where the thickness is.

## Principles

Silhouette comes first. The subject should be recognisable as a flat black shape at thumbnail size, and so should its mood. Push proportions until it is: real designers exaggerate the feature that carries the character and shrink the rest.

Detail comes in three sizes. Large forms set the read, medium forms break them up, small detail rewards a close look. Cluster the small detail where the story is and leave rest areas empty. The same density everywhere reads as noise.

Edges catch light. Nothing manufactured or worn has a perfectly sharp edge, so bevel what the camera will see. The highlight along a bevel is most of what makes a form read as solid.

Things are built from parts. Show how the object goes together: seams, fasteners, overlaps, a handle that passes through a bracket. Parts have thickness, and one sits on, in, or around another.

Break the symmetry once. Model symmetrically, then add what use did to it: a dent, a replaced part, a lean, a repair.

Materials record history. Wear sits where hands, feet, weather, and other objects touch: polished high points, dirt in the recesses, streaks below anything that drips. Vary roughness across a surface before you vary colour. Keep base colours out of pure black, pure white, and full saturation.

Lighting is half the asset. Choose a key direction and a mood for this subject, and ground the object with a contact shadow. In an engine, the scene's lighting and post-processing deserve the same attention as the mesh.

Scale is real. Work in metres at true size and check the result against a human figure. Set a triangle and texture budget from the target before modeling, and spend it on the silhouette.

For 3D UI and web scenes, the camera and motion are designed too: a composed starting frame, easing with weight, and one orchestrated move in place of constant spin.

## Calibration

Generated 3D clusters around a few looks: primitives pushed together with razor edges; perfect symmetry; one grey plastic material at medium roughness, or flat saturated colours; the same detail density everywhere; a single directional light plus ambient; objects floating over a grid floor; a web scene that is an orbit camera around a centred object. Where the brief asks for one of these, follow the brief. Where it leaves an axis free, do not spend that freedom on one of them.

## Process: direct, block out, look, refine, look again

Write the art bible first, short enough to hold in your head:

- Subject: the answers from "Ground it in the subject".
- Shape language: the dominant forms and what is exaggerated.
- Palette: 4 to 6 named values.
- Materials: each one's base colour, roughness, metalness, and wear story.
- Budget: target, triangles, texture size.
- Lighting: key direction and mood.
- Signature: the one feature this piece will be remembered by.
- Tools: what you will build it with and why (next section).

Then review it against the brief. Work through what you would have produced for any similar prompt, and revise the parts where the bible matches that. Say what you changed.

Block out with rough forms and look at the silhouette before adding anything. Fix proportion here, where it is cheap. Then build the real geometry, then materials, then lighting, looking after each. Keep the art bible, the source files, and each pass's renders together in one job folder so a later session can refine instead of restarting.

## The right tool for the job

Choose tools the way a working artist would, and record the choice in the art bible. First check what is installed (`command -v blender`, the project's dependencies, your own tool list) and choose only from what is there. The target engine is the user's choice: ask when it is not stated, and work in it only when it is available.

- Authored geometry with bevels, curves, booleans, UVs, baked textures, or a rig: a modeling tool. Use Blender when it is installed, through the `blender` skill.
- Plain geometric shapes, blockouts, and procedural or instanced content such as terrain, crowds, and particles: code in the target engine.
- A background prop that is not the subject: a CC0 library asset (Poly Haven, Kenney, Quaternius), restyled to the art bible. Record its source in `CREDITS.md`.
- HDRI lighting and scanned surface textures: Poly Haven.
- Textures, decals, skyboxes, and reference sheets no library has: an image generation tool.

Being able to build something from primitives in code is not a reason to. When the tool the job needs is missing, tell the user what is missing and what it costs in quality, then continue with the next best option or stop if they would rather install it.

See [targets.md](targets.md) for export settings, axes, units, and budgets per target before the first export.

## Look before you call it done

Judge pictures, never the code. After every pass, render the asset from several angles plus its silhouette and wireframe, and look at the images. The `blender` skill's `render_check.py` produces these as one sheet. In an engine, take screenshots of the running scene at the real camera, and capture frames across time for anything that moves.

For each pass, write down what is wrong, ranked, before fixing anything. Check against the art bible and against Calibration, and ask of each image: does the silhouette read, where does the eye go, what looks like a default? Fix the top items and render again. Expect at least three passes on a hero asset. A pass that finds nothing wrong on the first render was not looked at closely.

Before the last pass, remove one thing. Show the user the final renders, not a description of them.
