### 블렌더 파일에서 해야할 일

1. material 이름 똑같이 바꾸기
2. 애니메이션까지 완료한 파일로 하기

```python
# make_variants_A.py  — Blender 4.x
# Author: DA 전용 / 팔레트 10종 자동 생성 (A 타입)
import bpy
import os

# ─────────────────────────────────────────────────────────────────────────────
# 1) 경로 설정 (네 환경 기준)
# ─────────────────────────────────────────────────────────────────────────────
MASTER_FILE      = r"C:\FISH_PROJECT\MASTER\FISH_MASTER_A.blend"
VARIANT_SAVE_DIR = r"C:\FISH_PROJECT\VARIANTS"
EXPORT_DIR       = r"C:\FISH_PROJECT\EXPORT"

os.makedirs(VARIANT_SAVE_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# 2) 팔레트(테마) 10종 — Body / SideFin / U&DFin / Tail 만 변경
#    EyeWhite / EyeBlack 은 고정 (변경 안 함)
# ─────────────────────────────────────────────────────────────────────────────
PALETTES_A = [
    {"name": "Choco", "colors": {
        "Body": "#6B3E2E", "SideFin": "#8C5A43", "U&DFin": "#8C5A43", "Tail": "#4E2A1E"}},
    {"name": "Mint", "colors": {
        "Body": "#6EE7D2", "SideFin": "#2EC4B6", "U&DFin": "#2EC4B6", "Tail": "#118A8A"}},
    {"name": "Coral", "colors": {
        "Body": "#FF7F7F", "SideFin": "#FFA07A", "U&DFin": "#FFA07A", "Tail": "#FF6B6B"}},
    {"name": "Sunset", "colors": {
        "Body": "#FF9E00", "SideFin": "#FF6D00", "U&DFin": "#FF6D00", "Tail": "#E85D04"}},
    {"name": "Neon", "colors": {
        "Body": "#FF00A8", "SideFin": "#00E5FF", "U&DFin": "#00E5FF", "Tail": "#7B00FF"}},
    {"name": "Ocean", "colors": {
        "Body": "#1E88E5", "SideFin": "#0D47A1", "U&DFin": "#0D47A1", "Tail": "#1565C0"}},
    {"name": "Berry", "colors": {
        "Body": "#8E3A9D", "SideFin": "#D63384", "U&DFin": "#D63384", "Tail": "#6A1B9A"}},
    {"name": "Lemon", "colors": {
        "Body": "#F9D923", "SideFin": "#F08A5D", "U&DFin": "#F08A5D", "Tail": "#C97C5D"}},
    {"name": "Lavender", "colors": {
        "Body": "#C9A7EB", "SideFin": "#A68DDF", "U&DFin": "#A68DDF", "Tail": "#8B65C9"}},
    {"name": "Charcoal", "colors": {
        "Body": "#4A4A4A", "SideFin": "#B0B0B0", "U&DFin": "#B0B0B0", "Tail": "#2E2E2E"}},
]

# 변경 대상 / 제외 대상
TARGET_MATS  = {"Body", "SideFin", "U&DFin", "Tail"}
EXCLUDE_MATS = {"EyeWhite", "EyeBlack"}

# ─────────────────────────────────────────────────────────────────────────────
# 3) 색상/노드 유틸
#    (sRGB → Linear 변환 포함: 렌더 파이프라인 기준으로 더 정확)
# ─────────────────────────────────────────────────────────────────────────────
def hex_to_srgb_rgba(hex_str, alpha=1.0):
    h = hex_str.strip().lstrip('#')
    if len(h) != 6:
        raise ValueError(f"Bad hex color: '{hex_str}'")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (r, g, b, alpha)

def srgb_to_linear(c):
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055) ** 2.4

def srgb_rgba_to_linear(rgba):
    r, g, b, a = rgba
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), a)

def set_mat_basecolor(mat_name, hex_color):
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        print(f"[WARN] Material not found: {mat_name}")
        return
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        print(f"[WARN] Principled BSDF not found in {mat_name}")
        return
    srgb = hex_to_srgb_rgba(hex_color, 1.0)
    linear = srgb_rgba_to_linear(srgb)
    bsdf.inputs["Base Color"].default_value = linear
    mat.diffuse_color = srgb  # 뷰포트 미리보기 컬러

def apply_palette(colors: dict):
    for mat_name, hex_color in colors.items():
        if mat_name in EXCLUDE_MATS:
            continue
        if mat_name not in TARGET_MATS:
            # 정의되지 않은 이름은 무시 (안전)
            continue
        set_mat_basecolor(mat_name, hex_color)

# ─────────────────────────────────────────────────────────────────────────────
# 4) 컨텍스트/활성오브젝트 보정 (Blender 4.3 GLTF Export 안정화 패치)
# ─────────────────────────────────────────────────────────────────────────────
def _get_override_ctx():
    """UI 컨텍스트 오버라이드 생성 (윈도우/에어리어/리전 확보)"""
    wm = bpy.context.window_manager
    if not hasattr(wm, "windows") or not wm.windows:
        # 백그라운드(-b) 실행 등 UI 없을 때
        return {}
    win = wm.windows[0]
    screen = win.screen

    # area 우선순위: VIEW_3D > OUTLINER > TOPBAR
    area = next((a for a in screen.areas if a.type == 'VIEW_3D'), None)
    if area is None:
        area = next((a for a in screen.areas if a.type == 'OUTLINER'), None)
    if area is None:
        area = next((a for a in screen.areas if a.type == 'TOPBAR'), None)

    region = None
    if area:
        region = next((r for r in area.regions if r.type == 'WINDOW'), None)

    ctx = {'window': win, 'screen': screen, 'scene': bpy.context.scene}
    if area:   ctx['area']   = area
    if region: ctx['region'] = region
    return ctx

def _ensure_active_object():
    """활성 오브젝트 지정 및 OBJECT 모드 전환"""
    # 우선순위: MESH > ARMATURE
    obj = next((o for o in bpy.context.view_layer.objects if o.type == 'MESH'), None)
    if obj is None:
        obj = next((o for o in bpy.context.view_layer.objects if o.type == 'ARMATURE'), None)
    if obj:
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        try:
            bpy.ops.object.mode_set(mode='OBJECT')
        except Exception:
            pass
    return obj

def export_glb(filepath):
    """컨텍스트 오버라이드 + 활성 오브젝트 보장 후 GLB 내보내기"""
    _ensure_active_object()
    ctx = _get_override_ctx()
    if ctx:
        with bpy.context.temp_override(**ctx):
            bpy.ops.export_scene.gltf(
                filepath=filepath,
                export_format='GLB',
                export_animations=True,    # 애니메이션 포함
                export_apply=True,         # 모디파이어 적용
                export_yup=True,           # +Y Up
                export_materials='EXPORT', # 머티리얼 포함
            )
    else:
        # UI 없는 백그라운드 상황
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format='GLB',
            export_animations=True,
            export_apply=True,
            export_yup=True,
            export_materials='EXPORT',
        )

# ─────────────────────────────────────────────────────────────────────────────
# 5) 메인 루프 — 마스터 열기 → 팔레트 적용 → .blend 저장 → .glb 내보내기
# ─────────────────────────────────────────────────────────────────────────────
def run():
    if not os.path.exists(MASTER_FILE):
        raise FileNotFoundError(f"MASTER not found: {MASTER_FILE}")

    for idx, pal in enumerate(PALETTES_A, start=1):
        name = pal["name"]
        code = f"A{idx:02d}_{name}"  # 예: A01_Choco

        # 매 팔레트마다 마스터를 깨끗하게 다시 로드
        bpy.ops.wm.open_mainfile(filepath=MASTER_FILE)
        _ensure_active_object()  # 열자마자 활성 오브젝트 보장

        # 색 적용
        apply_palette(pal["colors"])

        # .blend 저장
        blend_out = os.path.join(VARIANT_SAVE_DIR, f"FISH_{code}.blend")
        bpy.ops.wm.save_as_mainfile(filepath=blend_out)
        print(f"[OK] Saved .blend: {blend_out}")

        # .glb 내보내기
        glb_out = os.path.join(EXPORT_DIR, f"FISH_{code}.glb")
        export_glb(glb_out)
        print(f"[OK] Exported .glb: {glb_out}")

    print("=== DONE: Variants for FISH_MASTER_A generated (10 files) ===")

# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run()
```

```python
# make_variants_A_materials_split_up_down.py — Blender 4.x
# 변경 범위: '머티리얼 이름' 기준으로 Principled BSDF Base Color만 수정
# 안전장치: UpFin/DownFin이 없고 예전 이름(U&DFin)만 있어도 동일 색 적용
# 저장: VARIANTS(.blend) + EXPORT(.glb) 둘 다 생성

import bpy, os

# ── 경로 ─────────────────────────────────────────────
MASTER_FILE      = r"C:\FISH_PROJECT\MASTER\FISH_MASTER_A.blend"
VARIANTS_DIR     = r"C:\FISH_PROJECT\VARIANTS"
EXPORT_DIR       = r"C:\FISH_PROJECT\EXPORT"

# 저장 옵션 (요청대로 둘 다 저장)
SAVE_BLEND = True
SAVE_GLB   = True

os.makedirs(VARIANTS_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# ── 팔레트 10종 (UpFin/DownFin 동일 색) ─────────────
PALETTES_A = [
    {"name": "Choco",    "colors": {"Body":"#6B3E2E","SideFin":"#8C5A43","UpFin":"#8C5A43","DownFin":"#8C5A43","Tail":"#4E2A1E"}},
    {"name": "Mint",     "colors": {"Body":"#6EE7D2","SideFin":"#2EC4B6","UpFin":"#2EC4B6","DownFin":"#2EC4B6","Tail":"#118A8A"}},
    {"name": "Coral",    "colors": {"Body":"#FF7F7F","SideFin":"#FFA07A","UpFin":"#FFA07A","DownFin":"#FFA07A","Tail":"#FF6B6B"}},
    {"name": "Sunset",   "colors": {"Body":"#FF9E00","SideFin":"#FF6D00","UpFin":"#FF6D00","DownFin":"#FF6D00","Tail":"#E85D04"}},
    {"name": "Neon",     "colors": {"Body":"#FF00A8","SideFin":"#00E5FF","UpFin":"#00E5FF","DownFin":"#00E5FF","Tail":"#7B00FF"}},
    {"name": "Ocean",    "colors": {"Body":"#1E88E5","SideFin":"#0D47A1","UpFin":"#0D47A1","DownFin":"#0D47A1","Tail":"#1565C0"}},
    {"name": "Berry",    "colors": {"Body":"#8E3A9D","SideFin":"#D63384","UpFin":"#D63384","DownFin":"#D63384","Tail":"#6A1B9A"}},
    {"name": "Lemon",    "colors": {"Body":"#F9D923","SideFin":"#F08A5D","UpFin":"#F08A5D","DownFin":"#F08A5D","Tail":"#C97C5D"}},
    {"name": "Lavender", "colors": {"Body":"#C9A7EB","SideFin":"#A68DDF","UpFin":"#A68DDF","DownFin":"#A68DDF","Tail":"#8B65C9"}},
    {"name": "Charcoal", "colors": {"Body":"#4A4A4A","SideFin":"#B0B0B0","UpFin":"#B0B0B0","DownFin":"#B0B0B0","Tail":"#2E2E2E"}},
]

# 변경 제외 (고정)
EXCLUDE_MATS = {"EyeWhite", "EyeBlack"}

# ── 색 변환 ─────────────────────────────────────────
def _srgb_to_linear(c):
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055) ** 2.4

def _hex_to_linear_rgba(hex_str, a=1.0):
    h = hex_str.strip().lstrip('#')
    r = int(h[0:2],16)/255.0; g = int(h[2:4],16)/255.0; b = int(h[4:6],16)/255.0
    return (_srgb_to_linear(r), _srgb_to_linear(g), _srgb_to_linear(b), a)

# ── 머티리얼 Base Color만 변경 (이름 기준) ───────────
def set_basecolor(mat_name, hex_color):
    if mat_name in EXCLUDE_MATS:
        return
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        # 레거시 호환: UpFin/DownFin이 없고 U&DFin만 있을 때 동일 색 적용
        if mat_name in {"UpFin","DownFin"}:
            legacy = bpy.data.materials.get("U&DFin")
            if legacy:
                _set_mat_color(legacy, hex_color)
            else:
                print(f"[WARN] material not found: {mat_name}")
        else:
            print(f"[WARN] material not found: {mat_name}")
        return
    _set_mat_color(mat, hex_color)

def _set_mat_color(mat, hex_color):
    mat.use_nodes = True
    bsdf = next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'), None)
    if not bsdf:
        print(f"[WARN] Principled BSDF not found in {mat.name}")
        return
    bsdf.inputs["Base Color"].default_value = _hex_to_linear_rgba(hex_color, 1.0)

def apply_palette(colors_map: dict):
    # 기대 키: Body, SideFin, UpFin, DownFin, Tail
    for key, hexc in colors_map.items():
        set_basecolor(key, hexc)

# ── GLB 익스포트(컨텍스트 보정만, 씬 변경 없음) ─────────
def _override_ctx():
    wm = bpy.context.window_manager
    if not getattr(wm, "windows", None): return {}
    win = wm.windows[0]; screen = win.screen
    area = next((a for a in screen.areas if a.type in ('VIEW_3D','OUTLINER','TOPBAR')), None)
    region = next((r for r in (area.regions if area else []) if r.type=='WINDOW'), None)
    ctx = {'window':win,'screen':screen,'scene':bpy.context.scene}
    if area: ctx['area']=area
    if region: ctx['region']=region
    return ctx

def export_glb(filepath):
    ctx = _override_ctx()
    if ctx:
        with bpy.context.temp_override(**ctx):
            bpy.ops.export_scene.gltf(
                filepath=filepath,
                export_format='GLB',
                export_animations=True,
                export_apply=True,
                export_yup=True,
                export_materials='EXPORT',
            )
    else:
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format='GLB',
            export_animations=True,
            export_apply=True,
            export_yup=True,
            export_materials='EXPORT',
        )

# ── 메인 ────────────────────────────────────────────
def run():
    if not os.path.exists(MASTER_FILE):
        raise FileNotFoundError(MASTER_FILE)

    for i, pal in enumerate(PALETTES_A, start=1):
        code = f"A{i:02d}_{pal['name']}"
        # 항상 마스터 새로 로드 → 색 이외 변경이 남지 않게
        bpy.ops.wm.open_mainfile(filepath=MASTER_FILE)

        # 색 적용 (UpFin/DownFin 동일색, 레거시 U&DFin도 자동 대응)
        apply_palette(pal["colors"])

        if SAVE_BLEND:
            blend_out = os.path.join(VARIANTS_DIR, f"FISH_{code}.blend")
            bpy.ops.wm.save_as_mainfile(filepath=blend_out)
            print("[OK] saved blend:", blend_out)

        if SAVE_GLB:
            glb_out = os.path.join(EXPORT_DIR, f"FISH_{code}.glb")
            export_glb(glb_out)
            print("[OK] exported glb:", glb_out)

    print("=== DONE: A(Up/DownFin) x10 saved to VARIANTS & EXPORT ===")

if __name__ == "__main__":
    run()
```
