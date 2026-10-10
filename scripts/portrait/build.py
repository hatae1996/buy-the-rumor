"""NPC 초상 빌드 (0.1.6): 아바타 키트(assets-src/portrait/avatar-kit)에서 게임용 512 그림을 만든다.

    npm run portraits        (= python scripts/portrait/build.py)

필요한 것: pip install -r scripts/portrait/requirements.txt
  (키트의 render.py를 그대로 불러 쓰는데, render.py가 regions.py를 거쳐 scikit-learn까지 불러온다)

만드는 것 (assets/portrait/):
  base_<피부>.png, base_<피부>_old.png
      피부 3 × (젊음 / 노인) = 6장. 배경은 투명. 노인은 눈썹 회색(brows.py) + 주름(age_01_mul) 곱하기까지 해 둔다
      (눈썹 바꾸기는 거리 변환이라 게임에서 하기엔 무겁다).
  parts/<파츠>.png, <파츠>_mul.png, <파츠>_reg.png
      키트의 parts/에 있는 top_NN, hair_NN, beard_NN. 본체와 _mul은 LANCZOS로, _reg는 nearest로 줄인다
      (영역 번호 1, 2, 3, 255가 섞이면 안 된다).
  src/sim/looks/kitParts.ts
      그림이 있는 파츠 id 목록. 시뮬레이션은 "목록(catalog.ts)에 있고 그림이 있는" 파츠만 뽑는다.
      기획자가 새 파츠를 키트에 넣고 이 스크립트를 다시 돌리면 다음 빌드부터 쓰인다.

sources/(ChatGPT 원본)는 쓰지 않는다.
"""
import os
import re
import shutil
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIT = os.path.join(ROOT, 'assets-src', 'portrait', 'avatar-kit')
OUT = os.path.join(ROOT, 'assets', 'portrait')
KIT_PARTS_TS = os.path.join(ROOT, 'src', 'sim', 'looks', 'kitParts.ts')

# 게임에 넣는 크기 (기획서 "NPC 외모": 1254 → 512). catalog.ts의 PORTRAIT_GAME과 같다
SIZE = 512
# 키트 parts/에서 게임에 넣는 파츠 (나이·눈썹은 베이스에 미리 넣는다)
PART_RE = re.compile(r'^(top|hair|beard)_\d+$')
# 노인 눈썹 색 (render.py의 render()와 같은 값)
OLD_BROWS = (178, 175, 170)

sys.path.insert(0, KIT)
from render import SKIN, layer_mul, skin_base  # noqa: E402  키트 코드를 그대로 쓴다
from brows import recolor_brows  # noqa: E402


def body_alpha() -> np.ndarray:
    """베이스의 사람 부분 (render.py의 skin_base와 같은 기준 + 안쪽 구멍 메우기). 255 = 사람, 0 = 배경"""
    b = np.asarray(Image.open(os.path.join(KIT, 'base.png')).convert('RGB')).astype(float)
    bg = np.median(b[:60, :60].reshape(-1, 3), 0)
    body = nd.binary_fill_holes(np.abs(b - bg).sum(2) > 25)
    return (body * 255).astype(np.uint8)


def save_png(im: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)


def build_bases(alpha: np.ndarray) -> list[str]:
    out = []
    for tone in SKIN:
        for old in (False, True):
            base = skin_base(tone)
            if old:
                base = recolor_brows(base, OLD_BROWS, os.path.join(KIT, 'parts', 'brows_mask.png'))
            rgb = np.asarray(base).astype(float)
            if old:
                rgb = layer_mul(rgb, os.path.join(KIT, 'parts', 'age_01_mul.png'))
            rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])
            name = f'base_{tone}{"_old" if old else ""}'
            save_png(Image.fromarray(rgba, 'RGBA').resize((SIZE, SIZE), Image.LANCZOS), os.path.join(OUT, name + '.png'))
            out.append(name)
    return out


def build_parts() -> list[str]:
    src = os.path.join(KIT, 'parts')
    ids = sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png') and PART_RE.match(f[:-4]))
    for pid in ids:
        body = Image.open(os.path.join(src, pid + '.png')).convert('RGBA')
        # Pillow는 RGBA를 줄일 때 알파를 곱한 채로 섞어 투명한 곳의 색이 번지지 않는다
        save_png(body.resize((SIZE, SIZE), Image.LANCZOS), os.path.join(OUT, 'parts', pid + '.png'))
        mul = os.path.join(src, pid + '_mul.png')
        if os.path.exists(mul):
            save_png(Image.open(mul).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS), os.path.join(OUT, 'parts', pid + '_mul.png'))
        reg = os.path.join(src, pid + '_reg.png')
        if os.path.exists(reg):
            r = Image.open(reg).convert('L').resize((SIZE, SIZE), Image.NEAREST)
            bad = set(np.unique(np.asarray(r)).tolist()) - {0, 1, 2, 3, 255}
            if bad:
                raise SystemExit(f'{pid}_reg.png에 모르는 영역 번호가 있다: {sorted(bad)}')
            save_png(r, os.path.join(OUT, 'parts', pid + '_reg.png'))
        else:
            print(f'  주의: {pid}_reg.png가 없어 색을 바꿀 수 없다 (그림 색 그대로 쓴다)')
    return ids


def write_kit_parts(ids: list[str]) -> None:
    lines = [
        '// 자동 생성 파일: 고치지 않는다. npm run portraits (scripts/portrait/build.py)가 다시 쓴다.',
        '// 아바타 키트에 그림이 있는 파츠. 시뮬레이션은 catalog.ts에 있고 여기에도 있는 파츠만 뽑는다.',
        'export const KIT_PARTS: readonly string[] = [',
        *[f"  '{i}'," for i in ids],
        '];',
        '',
    ]
    with open(KIT_PARTS_TS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))


def main() -> None:
    # 지난 빌드에서 남은 그림(키트에서 빠진 파츠)이 섞이지 않게 비우고 새로 만든다
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    bases = build_bases(body_alpha())
    ids = build_parts()
    write_kit_parts(ids)
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f'베이스 {len(bases)}장, 파츠 {len(ids)}개 ({", ".join(ids)}) -> {os.path.relpath(OUT, ROOT)} ({total / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
