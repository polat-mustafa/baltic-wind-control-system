"""
Build the SB-510 turbine model (15 MW "V236 class") for the 3D viewer.

    blender --background --factory-startup --python scripts/blender/build_v236.py -- \
        public/models/v236.glb [preview.png]

Everything is procedural and parametric (no downloaded assets), so the model
is reproducible from this file and reviewable in git. Geometry is authored in
the viewer's three.js frames and converted to Blender Z-up with B(); the glTF
exporter converts back to Y-up, so every exported mesh lands in the exact
frame the React component expects:

  blade*          blade-local: root at y=0, span +y, leading edge +x (the
                  rotor turns clockwise seen from upwind, so blade 1 moves
                  toward +x), pressure side +z (upwind), prebend toward +z
  spinner, hub*   rotor frame: spin axis +z (upwind), blade 1 along +y
  dt_*, gen_*     shaft frame: origin at the hub centre, +z along the main
                  shaft toward the rotor (the viewer tilts it 6° nose-up)
  nacelle*        nacelle frame: origin at world (0, 151, -5), front at +z
  everything else world frame: sea level y=0, seabed y=-40, hub height 150 m

Multi-colour parts (CTV, SOV, generator magnets, weathered tower / TP /
monopile) carry per-vertex colours (glTF COLOR_0).

The exterior follows public V236-15.0 MW data (rotor 236 m, blade 115.5 m, hub
150 m); the drivetrain, overhang (11.35 m), tower (Ø 10 → 6.5 m) and monopile
(Ø 9 m in ~40 m water) follow the IEA 15 MW reference turbine that SB-510 is
modelled with (low-speed direct drive, no gearbox). Colours: RAL 7035 light grey
tower and nacelle, RAL 1023 traffic-yellow transition piece (IALA O-139
marking of offshore structures), red blade-tip bands (ICAO Annex 14 style).
"""

import math
import sys

import bmesh
import bpy

# ── Output paths ───────────────────────────────────────────────────────────
argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT_GLB = argv[0] if argv else "v236.glb"
OUT_PNG = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)


def B(p):
    """three.js (x, y-up, z) → Blender (x, y, z-up)."""
    return (p[0], -p[2], p[1])


MATS = {}


def mat(name, rgb, metal=0.0, rough=0.5, alpha=1.0, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 4.0
    MATS[name] = m
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


WHITE = mat("paint_white_ral9010", srgb("#eef0ee"), 0.0, 0.35)
GREY = mat("paint_grey_ral7035", srgb("#cfd3d1"), 0.0, 0.45)
DARK = mat("steel_dark", srgb("#3c434a"), 0.6, 0.45)
GALV = mat("steel_galvanised", srgb("#9aa1a6"), 0.8, 0.4)
YELLOW = mat("paint_yellow_ral1023", srgb("#f2b705"), 0.0, 0.45)
RED = mat("paint_red_ral3020", srgb("#c1121f"), 0.0, 0.45)
MP = mat("steel_monopile", srgb("#4a5561"), 0.5, 0.6)
ROCK = mat("scour_rock", srgb("#5d5a52"), 0.0, 0.95)
LIGHT = mat("aviation_light", srgb("#ff2a1a"), 0.0, 0.3, emit=srgb("#ff2a1a"))


class Mesh:
    """Tiny mesh builder in three.js coordinates."""

    def __init__(self):
        self.v = []
        self.f = []
        self.uv = []  # per-vertex (u, v) or None
        self.col = []  # per-vertex linear RGB or None
        self.smooth = []

    def add_v(self, p, uv=None):
        self.v.append(B(p))
        self.uv.append(uv)
        self.col.append(None)
        return len(self.v) - 1

    def paint(self, fn):
        """Per-vertex colour from a function of the three.js position."""
        self.col = [fn((x, z, -y)) for x, y, z in self.v]
        return self

    def add_f(self, idx, smooth=True):
        self.f.append(tuple(idx))
        self.smooth.append(smooth)

    def extend(self, other, color=None):
        off = len(self.v)
        self.v += other.v
        self.uv += other.uv
        self.col += [color] * len(other.v) if color else other.col
        self.f += [tuple(i + off for i in face) for face in other.f]
        self.smooth += other.smooth

    def build(self, name, material, collection, closed=False):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.update()
        me.polygons.foreach_set("use_smooth", self.smooth)
        if any(u is not None for u in self.uv):
            layer = me.uv_layers.new(name="UVMap")
            for poly in me.polygons:
                for li in poly.loop_indices:
                    vi = me.loops[li].vertex_index
                    u = self.uv[vi] or (0.0, 0.0)
                    layer.data[li].uv = u
        if any(c is not None for c in self.col):
            ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
            for i, c in enumerate(self.col):
                ca.data[i].color = (*(c or (1.0, 1.0, 1.0)), 1.0)
            me.color_attributes.active_color = ca
        if closed:
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(me)
            bm.free()
        me.materials.append(material)
        ob = bpy.data.objects.new(name, me)
        collection.objects.link(ob)
        return ob


def ring_strip(m, rings, closed=True, smooth=True, cap_start=False, cap_end=False):
    """Quads between consecutive rings (lists of vertex indices)."""
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            m.add_f((a[i], a[j], b[j], b[i]), smooth)
    if cap_start:
        m.add_f(tuple(reversed(rings[0])), False)
    if cap_end:
        m.add_f(tuple(rings[-1]), False)


def lathe(profile, seg, axis="y", center=(0, 0, 0), smooth=True, cap=False, arc=None):
    """Revolve [(r, h)] around an axis through center. Returns Mesh.
    arc=(a0, a1) makes an open sector (e.g. a half-section cutaway)."""
    m = Mesh()
    rings = []
    n_pts = seg + 1 if arc else seg
    for r, h in profile:
        ring = []
        for k in range(n_pts):
            a = arc[0] + (arc[1] - arc[0]) * k / seg if arc else 2 * math.pi * k / seg
            c, s = math.cos(a) * r, math.sin(a) * r
            if axis == "y":
                p = (center[0] + c, center[1] + h, center[2] + s)
            else:  # z
                p = (center[0] + c, center[1] + s, center[2] + h)
            ring.append(m.add_v(p))
        rings.append(ring)
    # Orientation: faces must point outward for lathes around +y with CCW.
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % n_pts
            if axis == "y":
                m.add_f((a[i], b[i], b[j], a[j]), smooth)
            else:
                m.add_f((a[i], a[j], b[j], b[i]), smooth)
    if cap:
        m.add_f(tuple(rings[0]) if axis == "y" else tuple(reversed(rings[0])), False)
        m.add_f(tuple(reversed(rings[-1])) if axis == "y" else tuple(rings[-1]), False)
    return m


def tube(p0, p1, r, seg=8, smooth=True):
    """Closed cylinder between two three.js points."""
    m = Mesh()
    d = [p1[i] - p0[i] for i in range(3)]
    L = math.sqrt(sum(x * x for x in d)) or 1.0
    d = [x / L for x in d]
    ref = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
    u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]
    ul = math.sqrt(sum(x * x for x in u))
    u = [x / ul for x in u]
    w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
    rings = []
    for p in (p0, p1):
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ring.append(
                m.add_v(tuple(p[i] + r * (math.cos(a) * u[i] + math.sin(a) * w[i]) for i in range(3)))
            )
        rings.append(ring)
    ring_strip(m, rings, smooth=smooth)
    m.add_f(tuple(reversed(rings[0])), False)
    m.add_f(tuple(rings[1]), False)
    return m


def box(c, size):
    m = Mesh()
    hx, hy, hz = (s / 2 for s in size)
    idx = [
        m.add_v((c[0] + sx * hx, c[1] + sy * hy, c[2] + sz * hz))
        for sx in (-1, 1)
        for sy in (-1, 1)
        for sz in (-1, 1)
    ]
    # vertex index = 4*ix + 2*iy + iz
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        m.add_f(tuple(idx[i] for i in f), False)
    return m


def annulus(y0, y1, r_in, r_out, seg):
    return lathe([(r_in, y0), (r_out, y0), (r_out, y1), (r_in, y1), (r_in, y0)], seg, smooth=False)


def railing(points, h=1.1, post_every=1.6, r=0.035, closed=True):
    """Posts + knee rail + hand rail along a polyline (three.js coords)."""
    m = Mesh()
    pts = list(points) + ([points[0]] if closed else [])
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        n = max(1, int(L / post_every))
        for k in range(n):
            t = k / n
            p = tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
            m.extend(tube(p, (p[0], p[1] + h, p[2]), r, 6))
        for hh in (h * 0.5, h):
            m.extend(tube((a[0], a[1] + hh, a[2]), (b[0], b[1] + hh, b[2]), r, 6))
    return m


def circle_pts(r, y, n, a0=0.0, a1=2 * math.pi):
    return [(r * math.cos(a0 + (a1 - a0) * k / n), y, r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n)]


col = bpy.data.collections.new("V236")
bpy.context.scene.collection.children.link(col)

# ══ Blade ══════════════════════════════════════════════════════════════════
BLADE_L = 115.5
# (span m, chord m, twist °, prebend m, sweep m) — V236-class planform, same
# table as the procedural fallback in Blade.tsx. Twist follows the BEM
# optimum θ(r) = φ(r) − α_design at λ ≈ 9.3 (rated: 103 m/s tip, 11.1 m/s),
# a ≈ 0.28, α ≈ 5°: φ = atan(U(1−a)/(Ωr)) → 9.5° at 35 m, ~0° at the tip.
ST = [
    (0.0, 5.4, 13.0, 0.00, 0.00),
    (3.5, 5.6, 13.0, 0.02, 0.00),
    (10.0, 6.2, 15.0, 0.10, 0.00),
    (20.0, 6.4, 14.5, 0.30, 0.00),
    (35.0, 5.7, 9.5, 0.65, 0.00),
    (50.0, 4.7, 5.5, 1.10, 0.05),
    (65.0, 3.8, 3.2, 1.75, 0.12),
    (80.0, 3.0, 1.8, 2.55, 0.30),
    (92.0, 2.3, 0.9, 3.40, 0.55),
    (102.0, 1.7, 0.4, 4.20, 0.85),
    (110.0, 1.1, 0.0, 4.75, 1.10),
    (115.5, 0.4, -0.3, 5.00, 1.20),
]
# relative thickness t/c along the span: cylinder → DU-type thick → thin tip
TC = [(0.0, 1.0), (3.0, 1.0), (9.0, 0.62), (18.0, 0.40), (35.0, 0.30), (60.0, 0.24), (85.0, 0.21), (115.5, 0.18)]
# flatback trailing-edge thickness / chord (thick inboard sections are flatbacks)
TE = [(0.0, 0.0), (6.0, 0.10), (18.0, 0.06), (35.0, 0.012), (60.0, 0.004), (115.5, 0.002)]


def interp(table, x, col=1):
    """Catmull-Rom through table[:, 0] → table[:, col]."""
    xs = [r[0] for r in table]
    ys = [r[col] for r in table]
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    i = max(k for k in range(len(xs) - 1) if xs[k] <= x)
    t = (x - xs[i]) / (xs[i + 1] - xs[i])

    def slope(k):
        a, b = max(k - 1, 0), min(k + 1, len(xs) - 1)
        return (ys[b] - ys[a]) / (xs[b] - xs[a]) * (xs[i + 1] - xs[i])

    m0, m1 = slope(i), slope(i + 1)
    t2, t3 = t * t, t * t * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * m1


def lin(table, x):
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            t = t * t * (3 - 2 * t)
            return y0 + (y1 - y0) * t
    return table[-1][1]


NP = 48  # points per surface → 96 around the section


def section(span):
    """Blade section at `span` as a list of (x, y, z) in blade-local frame."""
    chord = interp(ST, span, 1)
    twist = interp(ST, span, 2)
    pre = interp(ST, span, 3)
    swp = interp(ST, span, 4)
    tc = lin(TC, span)
    te = lin(TE, span)
    w = max(0.0, min(1.0, (tc - 0.42) / 0.58))  # 1 = pure cylinder
    t_af = min(tc, 0.42)
    camber = 0.035 * (1 - w)
    pts = []
    for surf in (1, -1):  # upper TE→LE, then lower LE→TE
        for k in range(NP):
            phi = math.pi * k / (NP - 1)
            if surf == -1:
                phi = math.pi + phi
            x = 0.5 * (1 + math.cos(phi))  # TE=1 at phi 0, LE=0 at pi
            xx = min(max(x, 0.0), 1.0)
            yt = 5 * t_af * (0.2969 * math.sqrt(xx) - 0.1260 * xx - 0.3516 * xx**2 + 0.2843 * xx**3 - 0.1036 * xx**4)
            yt += 0.5 * te * xx
            yc = camber * 4 * xx * (1 - xx)
            ya = yc + (yt if surf == 1 else -yt)
            # cylinder point at the same parameter
            yc_cyl = 0.5 * math.sin(phi)
            px = x * (1 - w) + x * w
            py = ya * (1 - w) + yc_cyl * w
            axis = 0.25 + 0.25 * w
            px = (px - axis) * chord
            py = py * chord
            a = -math.radians(twist)
            xt = math.cos(a) * px + math.sin(a) * py
            zt = -math.sin(a) * px + math.cos(a) * py
            # Section turned 180° about the span axis: leading edge +x (the
            # blade moves toward +x), pressure side +z facing the wind;
            # prebend stays upwind (+z), aft sweep toward the trailing edge.
            pts.append((-(xt + swp), span, -zt + pre))
    return pts


def blade_mesh(spans, offset=0.0):
    m = Mesh()
    rings = []
    for s in spans:
        sec = section(s)
        if offset:
            cx = sum(p[0] for p in sec) / len(sec)
            cz = sum(p[2] for p in sec) / len(sec)
            sec = [
                (p[0] + offset * (p[0] - cx) / (math.hypot(p[0] - cx, p[2] - cz) or 1), p[1],
                 p[2] + offset * (p[2] - cz) / (math.hypot(p[0] - cx, p[2] - cz) or 1))
                for p in sec
            ]
        ring = [m.add_v(p, (i / (len(sec) - 1), 1 - s / BLADE_L)) for i, p in enumerate(sec)]
        rings.append(ring)
    # Sections run clockwise in the blade frame (LE +x after the 180° turn),
    # so wind the strip over reversed rings to keep the faces outward.
    ring_strip(m, [r[::-1] for r in rings], closed=True, smooth=True)
    return m, rings


N_SPAN = 72
spans = [BLADE_L * (1 - math.cos(math.pi * k / (N_SPAN - 1))) / 2 for k in range(N_SPAN)]
blade, rings = blade_mesh(spans)
# root cap + rounded tip cap
root_c = blade.add_v((0.0, 0.0, 0.0), (0.5, 1.0))
for i in range(len(rings[0])):
    j = (i + 1) % len(rings[0])
    blade.add_f((root_c, rings[0][i], rings[0][j]), False)
tip = section(BLADE_L)
tip_c = blade.add_v(
    (sum(p[0] for p in tip) / len(tip), BLADE_L + 0.25, sum(p[2] for p in tip) / len(tip)), (0.5, 0.0)
)
for i in range(len(rings[-1])):
    j = (i + 1) % len(rings[-1])
    blade.add_f((rings[-1][j], rings[-1][i], tip_c))
blade.build("blade", WHITE, col)

# Tip marking: outer 6 m red, 6 m white, 6 m red (aviation obstacle marking)
marks = Mesh()
for s0, s1 in ((97.5, 103.5), (109.5, 115.4)):
    mm, _ = blade_mesh([s0 + (s1 - s0) * k / 10 for k in range(11)], offset=0.012)
    marks.extend(mm)
marks.build("blade_marks", RED, col)

# Root: bolted flange + pitch-bearing inner ring (dark)
root = lathe([(2.55, 0.0), (2.95, 0.0), (2.95, 0.45), (2.72, 0.45)], 64, smooth=False)
root.build("blade_root", DARK, col)

# ══ Spinner / hub (rotor frame, spin axis +z) ══════════════════════════════
SPIN = [(0.0, -2.8), (1.2, -2.75), (2.3, -2.5), (3.1, -1.9), (3.55, -1.0), (3.7, 0.0), (3.65, 1.0),
        (3.45, 2.1), (3.1, 3.3), (2.6, 4.5), (1.95, 5.6), (1.25, 6.5), (0.6, 7.1), (0.0, 7.35)]
# smooth the profile (Catmull-Rom resample)
dense = []
for k in range(64):
    h = -2.8 + (7.35 + 2.8) * k / 63
    dense.append((max(0.0, interp([(p[1], p[0]) for p in SPIN], h)), h))
spinner = lathe(dense, 72, axis="z")
# blade-root fairings: a short collar around each blade where it leaves the spinner
for b in range(3):
    a = math.pi / 2 + b * 2 * math.pi / 3  # blade 1 along +y
    d = (math.cos(a), math.sin(a), 0.0)
    ring_prof = [(3.05, 3.0), (3.05, 3.9), (2.85, 4.05)]
    col_m = Mesh()
    rings_c = []
    for r, h in ring_prof:
        ring = []
        for k in range(48):
            t = 2 * math.pi * k / 48
            # local frame: axis d, u = +z, w = d × z
            u = (0.0, 0.0, 1.0)
            w = (d[1], -d[0], 0.0)
            p = tuple(d[i] * h + r * (math.cos(t) * u[i] + math.sin(t) * w[i]) for i in range(3))
            ring.append(col_m.add_v(p))
        rings_c.append(ring)
    ring_strip(col_m, rings_c)
    spinner.extend(col_m)
spinner.build("spinner", WHITE, col)

hubd = Mesh()
for b in range(3):
    a = math.pi / 2 + b * 2 * math.pi / 3
    d = (math.cos(a), math.sin(a), 0.0)
    # pitch bearing seal ring visible at the collar lip
    ring = []
    rings_s = []
    for r, h in ((2.86, 4.0), (2.95, 4.0), (2.95, 4.2), (2.8, 4.2)):
        ring = []
        for k in range(48):
            t = 2 * math.pi * k / 48
            u = (0.0, 0.0, 1.0)
            w = (d[1], -d[0], 0.0)
            ring.append(hubd.add_v(tuple(d[i] * h + r * (math.cos(t) * u[i] + math.sin(t) * w[i]) for i in range(3))))
        rings_s.append(ring)
    ring_strip(hubd, rings_s, smooth=False)
# nose vent ring + rear gap ring
hubd.extend(lathe([(0.42, 7.28), (0.62, 7.2), (0.62, 7.26)], 32, axis="z", smooth=False))
hubd.extend(lathe([(3.3, -2.2), (3.45, -2.2), (3.45, -2.0), (3.3, -2.0)], 72, axis="z", smooth=False))
hubd.build("hub_detail", DARK, col)

# ══ Nacelle (nacelle frame; origin at world (0,151,-5); front +z) ══════════
def rrect(hw, yb, yt, rc, n=10, dome=0.0):
    """Rounded rectangle cross-section (x, y) points, CCW seen from +z."""
    pts = []
    corners = [(hw - rc, yt - rc, 0), (-hw + rc, yt - rc, 90), (-hw + rc, yb + rc, 180), (hw - rc, yb + rc, 270)]
    for cx, cy, a0 in corners:
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            x, y = cx + rc * math.cos(a), cy + rc * math.sin(a)
            if y > 0 and dome:
                y += dome * (1 - (x / hw) ** 2)
            pts.append((x, y))
    return pts


def nacelle_section(z):
    """Envelope at station z: long box with generously rounded edges. Direct
    drive: the generator sits in front of the nacelle, so the front is a rounded
    face 5 m upwind of the tower axis where the turret flange bolts on."""
    hw, yb, yt, rc = 5.0, -4.4, 4.6, 1.0
    if z > 9.1:  # front rounding
        t = min(1.0, (z - 9.1) / 0.9)
        e = 1 - math.cos(t * math.pi / 2)
        hw, yb, yt, rc = 5.0 - 0.5 * e, -4.4 + 0.5 * e, 4.6 - 0.5 * e, 1.0 + 0.4 * e
    if z < -9.6:  # rear rounding
        t = min(1.0, (-9.6 - z) / 0.9)
        e = 1 - math.cos(t * math.pi / 2)
        hw, yb, yt, rc = 5.0 - 0.5 * e, -4.4 + 0.5 * e, 4.6 - 0.5 * e, 1.0 + 0.4 * e
    return rrect(hw, yb, yt, rc, dome=0.35)


nac = Mesh()
zs = [-10.5 + 0.9 * (1 - math.cos(math.pi / 2 * k / 5)) for k in range(6)]
zs += [-9.6 + 18.7 * k / 18 for k in range(1, 19)]
zs += [9.1 + 0.9 * math.sin(math.pi / 2 * k / 5) for k in range(1, 6)]
nrings = []
for z in zs:
    nrings.append([nac.add_v((x, y, z)) for x, y in nacelle_section(z)])
ring_strip(nac, nrings)
# end caps (rear flat-ish, front where the turret enters)
nac.add_f(tuple(reversed(nrings[0])), True)
nac.add_f(tuple(nrings[-1]), True)
nac.build("nacelle_shell", GREY, col)

nd = Mesh()
roof = 4.6 + 0.35  # dome crest
# heli-hoist platform on the roof (grating + railing), mid-rear
nd.extend(box((0, roof + 0.12, -2.5), (6.4, 0.18, 6.0)))
nd.extend(railing([(-3.2, roof + 0.2, -5.5), (3.2, roof + 0.2, -5.5), (3.2, roof + 0.2, 0.5), (-3.2, roof + 0.2, 0.5)]))
# roof hatch
nd.extend(box((0, roof + 0.05, 2.5), (1.6, 0.25, 1.6)))
# panel seams (thin raised straps around the shell)
for z in (-6.0, -1.0, 4.0):
    sec = nacelle_section(z)
    ring_ids = []
    seam = Mesh()
    for off, zz in ((0.03, z - 0.08), (0.03, z + 0.08)):
        ring_ids.append([seam.add_v((x * (1 + off / 5), y * (1 + off / 5), zz)) for x, y in sec])
    ring_strip(seam, ring_ids, smooth=False)
    nd.extend(seam)
nd.build("nacelle_detail", GALV, col)

# ══ CoolerTop (world / yaw frame) ══════════════════════════════════════════
cool = Mesh()
y0, y1 = 151 + roof - 0.1, 151 + roof + 4.8
z0, z1 = -5 - 10.3, -5 - 6.8
for x in (-4.7, 4.7):
    for z in (z0, z1):
        cool.extend(tube((x, y0, z), (x, y1, z), 0.14, 8))
    cool.extend(tube((x, y1, z0), (x, y1, z1), 0.12, 8))
for z in (z0, z1):
    cool.extend(tube((-4.7, y1, z), (4.7, y1, z), 0.12, 8))
# two inclined radiator banks (A-frame), fins as slats
for side in (-1, 1):
    zc = (z0 + z1) / 2
    for k in range(14):
        yy = y0 + 0.4 + k * (y1 - y0 - 0.8) / 13
        dz = side * (1.5 - 1.3 * (yy - y0) / (y1 - y0))
        cool.extend(box((0, yy, zc + dz), (9.0, 0.16, 0.5)))
cool.build("cooler", DARK, col)

lights = Mesh()
for x in (-4.7, 4.7):
    lights.extend(lathe([(0.0, -0.3), (0.28, -0.3), (0.28, 0.0), (0.0, 0.25)], 16, center=(x, y1 + 0.3, z1)))
lights.build("nav_lights", LIGHT, col)

# ══ Weathering (per-vertex colour) ═════════════════════════════════════════
def vnoise(x, y):
    """Smooth value noise in [0, 1]."""
    def h(i, j):
        return (math.sin(i * 127.1 + j * 311.7) * 43758.5453) % 1.0
    i, j = math.floor(x), math.floor(y)
    fx, fy = x - i, y - j
    u, v = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = h(i, j) + (h(i + 1, j) - h(i, j)) * u
    b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * u
    return a + (b - a) * v


def mix(c0, c1, t):
    t = max(0.0, min(1.0, t))
    return tuple(a + (b - a) * t for a, b in zip(c0, c1))


C_GREY, C_YELLOW = srgb("#cfd3d1"), srgb("#f2b705")
C_GROWTH, C_RUST, C_SALT = srgb("#3d4a34"), srgb("#8a5a2b"), srgb("#e6e2d6")


def weather_tower(p):
    ang = math.atan2(p[2], p[0])
    n = vnoise(ang * 6, p[1] * 0.08)
    c = mix(C_GREY, srgb("#b9bebb"), 0.35 * n)  # faint panel/weld streaks
    return mix(c, C_SALT, 0.25 * max(0.0, 1 - (p[1] - 26) / 6))  # salt spray at the base


def weather_tp(p):
    ang = math.atan2(p[2], p[0])
    n = vnoise(ang * 9, p[1] * 0.6)
    c = C_YELLOW
    if p[1] < 2.2:  # marine growth through the tidal / splash zone
        c = mix(c, C_GROWTH, (2.2 - p[1]) / 2.6 * (0.7 + 0.3 * n))
    if 2.2 <= p[1] < 7:  # rust streaks under the boat-landing brackets
        c = mix(c, C_RUST, 0.18 * n * (7 - p[1]) / 5)
    return c


def weather_mp(p):
    n = vnoise(math.atan2(p[2], p[0]) * 7, p[1] * 0.3)
    return mix(srgb("#4a5561"), C_GROWTH, 0.55 + 0.35 * n)


VCOL = mat("vertex_colour", (1.0, 1.0, 1.0), 0.2, 0.5)

# ══ Tower (world) ══════════════════════════════════════════════════════════
T0, T1, R0, R1 = 26.0, 146.9, 5.0, 3.25
prof = [(R0 + (R1 - R0) * k / 40, T0 + (T1 - T0) * k / 40) for k in range(41)]
tower = lathe(prof, 96)
tower.paint(weather_tower).build("tower", VCOL, col)

td = Mesh()
for y in (T0 + 0.3, 56.0, 86.0, 116.0, T1 - 0.3):
    r = R0 + (R1 - R0) * (y - T0) / (T1 - T0)
    td.extend(annulus(y - 0.15, y + 0.15, r - 0.02, r + 0.07, 96))
# tower door (faces the boat landing, -x) with frame
rd = R0 + 0.05
td.extend(box((-rd, T0 + 1.6, 0), (0.25, 2.4, 1.3)))
td.build("tower_detail", DARK, col)

tl = Mesh()
for k in range(4):  # intermediate obstruction lights (low-intensity, red)
    a = k * math.pi / 2 + math.pi / 4
    y = 95.0
    r = R0 + (R1 - R0) * (y - T0) / (T1 - T0) + 0.2
    tl.extend(lathe([(0, -0.2), (0.22, -0.2), (0.22, 0.1), (0, 0.22)], 12, center=(r * math.cos(a), y, r * math.sin(a))))
tl.build("tower_lights", LIGHT, col)

# ══ Transition piece + monopile + scour (world) ════════════════════════════
TP_R = 4.9
tp = lathe([(TP_R, -2.0), (TP_R, 25.4), (TP_R - 0.4, 25.8), (R0 + 0.1, 26.0)], 96, smooth=True)
tp.paint(weather_tp).build("transition_piece", VCOL, col)

tpd = Mesh()
# external main platform (grating) with railing
tpd.extend(annulus(25.6, 25.9, TP_R, 9.0, 96))
tpd.extend(railing(circle_pts(8.9, 25.9, 40), post_every=1.5))
# lower resting / cable-hang-off platform
tpd.extend(annulus(18.3, 18.5, TP_R, 6.2, 64))
# boat landing (-x side): two fender tubes, brackets and the access ladder
bx = -TP_R - 1.25
for zz in (-0.95, 0.95):
    tpd.extend(tube((bx, -4.0, zz), (bx, 19.0, zz), 0.32, 12))
    for yy in (-2.0, 6.0, 14.0):
        tpd.extend(tube((bx, yy, zz), (-TP_R + 0.1, yy, zz * 0.6), 0.14, 8))
lx = -TP_R - 0.5
for zz in (-0.35, 0.35):
    tpd.extend(tube((lx, -2.5, zz), (lx, 25.7, zz), 0.05, 6))
y = -2.2
while y < 25.5:
    tpd.extend(tube((lx, y, -0.35), (lx, y, 0.35), 0.025, 6))
    y += 0.3
# davit crane (+x side)
tpd.extend(tube((7.6, 25.9, 0), (7.6, 30.5, 0), 0.22, 12))
tpd.extend(tube((7.6, 30.3, 0), (10.8, 31.4, 0), 0.14, 10))
tpd.extend(tube((10.8, 31.4, 0), (10.8, 29.5, 0), 0.02, 4))
tpd.build("tp_detail", GALV, col)

mono = lathe([(4.5, -40.0), (4.5, -1.5)], 64)
mono.paint(weather_mp).build("monopile", VCOL, col)

anodes = Mesh()
for y in (-12.0, -24.0):
    for k in range(6):
        a = k * math.pi / 3
        anodes.extend(box((4.75 * math.cos(a), y, 4.75 * math.sin(a)), (0.35, 2.2, 0.35)))
anodes.build("anodes", DARK, col)

scour = lathe([(0.0, -39.0), (5.0, -39.2), (9.0, -39.6), (14.0, -40.1), (18.0, -40.35), (18.5, -40.5)], 48)
scour.build("scour", ROCK, col)

# ══ Drivetrain (shaft frame: hub centre origin, +z toward the rotor) ═══════
# IEA 15 MW low-speed direct drive (Gaertner et al. 2020, Tables 5-2 / 5-4).
# The hub flange drives a short hollow main shaft (2.2 m, r 3.0 / 2.8 m) that
# turns on two main bearings 1.2 m apart — upwind tapered double outer-ring
# (locating), downwind spherical roller (non-locating) — around the stationary
# turret (r 2.2 / 2.0 m). A rotor disc behind the hub carries the outer rotor of
# a 200-pole radial-flux PMSG (air-gap radius 5.08 m, core 2.17 m, 10 mm gap, 200
# surface magnets) that surrounds the bearings; the stator (240 slots) sits on a
# disc bolted to the turret, whose flange meets the bedplate 5 m upwind of the
# tower axis (report Table 5-3). No gearbox: the generator turns
# at rotor speed (7.56 rpm → 12.6 Hz, full converter). Roller counts are
# assumed (OEM data is confidential) and match services/p3/cms.py. Static
# parts are cut at x = 0 (port half kept) so the rotating parts stay visible.
PORT = (math.pi / 2, 3 * math.pi / 2)

STEEL = mat("steel_machined", srgb("#aeb4ba"), 0.9, 0.3)
CAST = mat("cast_iron_painted", srgb("#5b6b7a"), 0.3, 0.55)
COPPER = mat("copper_winding", srgb("#b8733a"), 0.9, 0.35)
GEN = mat("generator_paint", srgb("#2f4f6f"), 0.3, 0.45)

# main shaft (rotates): hub flange + hollow shaft r 3.0 / 2.8 m, 2.2 m long
shaft = lathe([(2.8, -2.4), (3.4, -2.4), (3.4, -2.6), (3.0, -2.6), (3.0, -4.6), (2.8, -4.6), (2.8, -2.4)],
              72, axis="z", smooth=False)
shaft.build("dt_shaft", STEEL, col)

# main bearings: inner rings on the turret (half, static) + rollers (full, cage speed)
# (z, rows Δz, rollers per row, pitch radius, roller radius, width)
BEARINGS = ((-2.9, 0.13, 60, 2.5, 0.11, 0.5), (-4.1, 0.11, 40, 2.48, 0.17, 0.42))
brg = Mesh()
for z, _dz, _n, _rc, _rr, w in BEARINGS:
    brg.extend(lathe([(2.2, z + w / 2), (2.32, z + w / 2), (2.32, z - w / 2), (2.2, z - w / 2), (2.2, z + w / 2)],
                     36, axis="z", smooth=False, arc=PORT))
brg.build("dt_bearings", STEEL, col)
rollers = Mesh()
for z, dz, n, rc_, rr, _w in BEARINGS:
    for row in (-1, 1):
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (row > 0)) / n
            c = (rc_ * math.cos(a), rc_ * math.sin(a))
            zr = z + row * dz
            rollers.extend(tube((c[0], c[1], zr + 0.09), (c[0], c[1], zr - 0.09), rr, 8))
rollers.build("dt_rollers", STEEL, col)

# turret / nose (static, half): r 2.2 / 2.0 m from the hub to the bedplate flange
# (5 m upwind of the tower axis), with ribs behind the stator support disc
tur = lathe([(2.0, -2.6), (2.2, -2.6), (2.2, -6.0), (3.3, -6.0), (3.3, -6.38), (2.0, -6.38), (2.0, -2.6)],
            40, axis="z", smooth=False, arc=PORT)
for k in range(6):  # radial ribs behind the stator disc
    a = math.pi / 2 + math.pi * (k + 0.5) / 6
    ca, sa = math.cos(a), math.sin(a)
    rib = Mesh()
    pts = [(2.2, -5.3), (4.4, -5.3), (2.2, -6.0)]
    ids = [rib.add_v((r * ca + dx * -sa, r * sa + dx * ca, z)) for dx in (-0.06, 0.06) for r, z in pts]
    rib.add_f((ids[0], ids[1], ids[2]), False)
    rib.add_f((ids[5], ids[4], ids[3]), False)
    for u, v in ((0, 1), (1, 2), (2, 0)):
        rib.add_f((ids[u], ids[v], ids[v + 3], ids[u + 3]), False)
    tur.extend(rib)
tur.build("dt_turret", CAST, col)

# brake calipers (static) gripping the generator rotor disc rim — rotor brake / lock
cal = Mesh()
for a in (math.pi * 0.75, math.pi * 1.25):
    cal.extend(box((5.2 * math.cos(a), 5.2 * math.sin(a), -2.59), (0.45, 0.45, 0.55)))
cal.build("dt_calipers", RED, col)


def on_rim(block, a, r):
    """Move a block centred on the shaft axis to radius r at angle a (shaft frame)."""
    for vi, (bx, by, bz) in enumerate(block.v):
        x3, y3, z3 = bx, bz, -by
        block.v[vi] = B((x3 * math.cos(a) - (y3 + r) * math.sin(a), x3 * math.sin(a) + (y3 + r) * math.cos(a), z3))
    return block


# PMSG outer rotor (rotates with the shaft): rotor disc behind the hub, yoke, 200
# surface magnets (N red / S blue, educational colouring), core length 2.17 m
GZ0, GZ1 = -2.78, -4.95  # active length (core) 2.17 m
rot = Mesh()
rot.extend(lathe([(3.0, -2.5), (5.33, -2.5), (5.33, -2.68), (3.0, -2.68)], 96, axis="z", smooth=False),
           color=srgb("#4b5563"))
rot.extend(lathe([(5.13, -2.68), (5.33, -2.68), (5.33, -5.05), (5.13, -5.05), (5.13, -2.68)], 128, axis="z",
                 smooth=False), color=srgb("#2f4f6f"))
for k in range(200):  # magnets on the yoke bore (r = 5.1075 m)
    c = srgb("#c62828") if k % 2 == 0 else srgb("#1f4fb5")
    rot.extend(on_rim(box((0, 0, (GZ0 + GZ1) / 2), (0.13, 0.045, GZ0 - GZ1)), 2 * math.pi * k / 200, 5.1075), color=c)
rot.build("gen_rotor", VCOL, col)

# stator (static, half): laminated core r 4.55 → 5.075 m (10 mm gap) on the support
# disc, 240 slots shown as teeth on the bore, copper end windings
stator = lathe([(4.55, GZ0), (5.0, GZ0), (5.0, GZ1), (4.55, GZ1), (4.55, GZ0)], 72, axis="z",
               smooth=False, arc=PORT)
for k in range(120):  # the port half of the 240 teeth
    stator.extend(on_rim(box((0, 0, (GZ0 + GZ1) / 2), (0.06, 0.075, GZ0 - GZ1)), math.pi / 2 + math.pi * (k + 0.5) / 120,
                         5.0375))
stator.extend(lathe([(2.2, -5.1), (4.55, -5.1), (4.55, -5.3), (2.2, -5.3)], 48, axis="z", smooth=False, arc=PORT))
stator.build("gen_stator", DARK, col)
wind = Mesh()
for zc in (GZ0 + 0.08, GZ1 - 0.08):
    wind.extend(lathe([(4.62, zc + 0.08), (4.98, zc + 0.08), (4.98, zc - 0.08), (4.62, zc - 0.08), (4.62, zc + 0.08)],
                      64, axis="z", smooth=True, arc=PORT))
wind.build("gen_windings", COPPER, col)

# closed exterior for the normal (non-section) view: full rear end shield of the
# generator and the full turret nose from the generator to the bedplate flange
cover = lathe([(2.2, -5.05), (5.33, -5.05), (5.33, -5.35), (2.2, -5.35)], 96, axis="z", smooth=False)
cover.build("gen_cover", GEN, col)
nose = lathe([(2.2, -5.35), (2.2, -6.0), (3.3, -6.0), (3.3, -6.38), (2.0, -6.38)], 64, axis="z", smooth=False)
nose.build("dt_nose", CAST, col)

# ══ Bedplate + converter (world / yaw frame) ═══════════════════════════════
bed = Mesh()
bed.extend(box((0, 146.98, 0.6), (4.4, 0.56, 5.4)))  # cast bedplate nose from the yaw bearing forward
bed.extend(box((0, 148.9, 4.55), (5.0, 4.4, 0.5)))  # front bulkhead the turret flange bolts to (5 m)
for x in (-2.2, 2.2):
    bed.extend(box((x, 147.0, -6.0), (0.5, 0.55, 14.0)))  # welded rear frame
for z in (-2.5, -7.0, -12.5):
    bed.extend(box((0, 147.0, z), (4.9, 0.4, 0.4)))
bed.build("bedplate", CAST, col)

conv = Mesh()
for x in (-3.35,):  # port side only: the cutaway opens starboard
    for k in range(4):
        z = -2.75 - k * 1.12
        conv.extend(box((x, 148.5, z), (0.9, 2.4, 1.06)), color=srgb("#c9ced3"))
        conv.extend(box((x - math.copysign(0.46, x), 149.2, z), (0.02, 0.08, 0.3)), color=srgb("#22c55e"))
conv.build("converter", VCOL, col)

# ══ Service vessels (world frame) ══════════════════════════════════════════
# CTV: 27 m aluminium catamaran pushing its bow fender on the boat landing
# (−x side of the transition piece), 24 industrial personnel.
ctv = Mesh()
bow_x = -TP_R - 1.6
for zz in (-3.1, 3.1):  # twin hulls, bow taper
    hull = Mesh()
    rings_h = []
    for k in range(9):
        x = bow_x - 27.0 * k / 8
        w = 1.1 * (0.35 + 0.65 * min(1.0, k / 2))
        ring = [hull.add_v((x, y, zz + dz)) for y, dz in ((2.0, -w), (2.0, w), (-1.2, w * 0.6), (-1.2, -w * 0.6))]
        rings_h.append(ring)
    ring_strip(hull, rings_h, smooth=False)
    hull.add_f(tuple(reversed(rings_h[0])), False)
    hull.add_f(tuple(rings_h[-1]), False)
    ctv.extend(hull, color=srgb("#1f2d4a"))
ctv.extend(box((bow_x - 14.0, 2.2, 0), (26.0, 0.4, 9.2)), color=srgb("#6b7280"))  # deck
ctv.extend(box((bow_x - 11.5, 3.9, 0), (8.0, 3.0, 6.4)), color=srgb("#f3f4f6"))  # wheelhouse
ctv.extend(box((bow_x - 11.5, 4.4, 0), (8.05, 0.9, 6.45)), color=srgb("#111827"))  # window band
ctv.extend(tube((bow_x - 12.5, 5.4, 0), (bow_x - 12.5, 9.5, 0), 0.12, 8), color=srgb("#e5e7eb"))  # mast
ctv.extend(tube((bow_x + 0.2, 2.0, -3.9), (bow_x + 0.2, 2.0, 3.9), 0.45, 12), color=srgb("#111111"))  # bow fender
ctv.extend(box((bow_x - 22.0, 2.9, 0), (6.0, 1.0, 5.0)), color=srgb("#f59e0b"))  # cargo container
ctv.build("ctv", VCOL, col)

# SOV: 88 m service operation vessel on DP, motion-compensated gangway to the
# TP main platform (walk-to-work).
sov = Mesh()
zc_, half_b = -42.0, 9.8
rings_s = []
for k in range(12):
    x = 44.0 - 88.0 * k / 11
    w = half_b * (0.25 + 0.75 * min(1.0, k / 3))  # bow at +x
    rings_s.append([sov.add_v((x, y, zc_ + dz)) for y, dz in ((9.0, -w), (9.0, w), (-6.0, w * 0.92), (-6.0, -w * 0.92))])
ring_strip(sov, rings_s, smooth=False)
sov.add_f(tuple(reversed(rings_s[0])), False)
sov.add_f(tuple(rings_s[-1]), False)
sov.paint(lambda p: srgb("#b91c1c") if p[1] < 1.0 else srgb("#1e3a5f"))
sov.extend(box((22.0, 15.5, zc_), (26.0, 13.0, 16.0)), color=srgb("#f3f4f6"))  # accommodation block
sov.extend(box((22.0, 20.0, zc_), (26.1, 1.2, 16.1)), color=srgb("#111827"))  # bridge windows
sov.extend(box((30.0, 22.4, zc_), (12.0, 0.4, 16.0)), color=srgb("#374151"))  # helideck
sov.extend(box((-20.0, 9.8, zc_), (30.0, 1.6, 17.0)), color=srgb("#6b7280"))  # work deck
sov.extend(tube((0.0, 9.0, zc_ + 8.0), (0.0, 16.0, zc_ + 8.0), 1.1, 16), color=srgb("#f59e0b"))  # gangway tower
gw_a, gw_b = (0.0, 16.4, zc_ + 8.5), (0.0, 26.3, -8.6)
for dx in (-0.6, 0.6):  # gangway truss chords
    sov.extend(tube((gw_a[0] + dx, gw_a[1], gw_a[2]), (gw_b[0] + dx, gw_b[1], gw_b[2]), 0.12, 8), color=srgb("#f59e0b"))
    sov.extend(tube((gw_a[0] + dx, gw_a[1] + 1.1, gw_a[2]), (gw_b[0] + dx, gw_b[1] + 1.1, gw_b[2]), 0.06, 6),
               color=srgb("#f59e0b"))
sov.build("sov", VCOL, col)

# ══ Export ═════════════════════════════════════════════════════════════════
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_normals=True,
    export_texcoords=True,
    export_materials="EXPORT",
    export_vertex_color="ACTIVE",
)
print("EXPORTED", OUT_GLB, sum(len(o.data.polygons) for o in col.objects), "faces")

# ══ Optional preview render (workbench, for review) ════════════════════════
if OUT_PNG:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_shadows = True
    sc.render.resolution_x, sc.render.resolution_y = 1400, 1800
    world = bpy.data.worlds.new("w")
    sc.world = world
    # three instances of the blade around the rotor for the preview
    import mathutils

    rot_origin = mathutils.Vector(B((0, 150, 11.35)))  # IEA 15 MW overhang 11.35 m
    for m in MATS.values():  # workbench shows the viewport colour
        m.diffuse_color = (*m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value[:3], 1)
    for name in ("blade", "blade_marks", "blade_root"):
        src = bpy.data.objects[name]
        copies = [src] + [src.copy() for _ in range(2)]
        for k, ob in enumerate(copies):
            if k:
                col.objects.link(ob)
            ob.matrix_world = (
                mathutils.Matrix.Translation(rot_origin)
                @ mathutils.Matrix.Rotation(k * 2 * math.pi / 3, 4, "Y")
                @ ob.matrix_world
            )
            ob.rotation_mode = "XYZ"
    for name in ("spinner", "hub_detail"):
        bpy.data.objects[name].location = rot_origin
    for name in ("nacelle_shell", "nacelle_detail"):
        bpy.data.objects[name].location = B((0, 151, -5))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    col.objects.link(cam)
    cam.data.lens = 35
    cam.location = B((230, 110, 260))
    target = mathutils.Vector(B((0, 90, 0)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.filepath = OUT_PNG
    bpy.ops.render.render(write_still=True)
    # close-up of rotor/nacelle
    cam.location = B((38, 162, 42))
    target = mathutils.Vector(B((0, 151, -3)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = OUT_PNG.replace(".png", "_close.png")
    bpy.ops.render.render(write_still=True)
    cam.location = B((-40, 20, 30))
    target = mathutils.Vector(B((0, 12, 0)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = OUT_PNG.replace(".png", "_tp.png")
    bpy.ops.render.render(write_still=True)

    # interior section view: drivetrain tilted 6° about the hub, nacelle shell +
    # roof items hidden, camera from starboard
    tilt = mathutils.Matrix.Translation(rot_origin) @ mathutils.Matrix.Rotation(math.radians(-6), 4, "X")
    for ob in list(col.objects):
        if ob.name.startswith(("dt_", "gen_")):
            ob.matrix_world = tilt @ ob.matrix_world
    for name in ("nacelle_shell", "nacelle_detail", "cooler", "nav_lights"):
        bpy.data.objects[name].hide_render = True
    for ob in col.objects:
        if ob.name.startswith(("blade", "spinner", "hub_detail")):
            ob.hide_render = True
    cam.location = B((20, 154, 12))
    target = mathutils.Vector(B((0, 149.5, 6)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = OUT_PNG.replace(".png", "_interior.png")
    bpy.ops.render.render(write_still=True)
    for ob in col.objects:
        ob.hide_render = not (ob.name.startswith(("ctv", "sov", "transition", "tp_", "tower")))
    cam.location = B((-70, 40, -80))
    target = mathutils.Vector(B((-15, 10, -20)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = OUT_PNG.replace(".png", "_vessels.png")
    bpy.ops.render.render(write_still=True)
