"""길 위 마차 부품(assets-src/ui/travel/parts/, 분홍 배경)을 잘라 assets/ui/rig/ 에 넣고,
부품 자리(마차 틀 안의 %)를 src/ui/travelRigLayout.ts 로 쓴다. 화면은 이 자리에 부품을 겹쳐 놓고
바퀴살을 돌리고 말 걷기 그림을 넘긴다.

python scripts/ui/cut_wagon_parts.py [--preview 경로]   (numpy, pillow, scipy)
- body.png: 바퀴 없는 마차 몸체. 앞쪽 바퀴 축 끝(회색 두 개)에 가까운 쪽 바퀴 가운데를 맞춘다
- wheels.png: 위 줄 가까운 쪽 테두리·축·바퀴살, 아래 줄 먼 쪽 (조금 작고 바퀴살이 어둡다)
- shafts.png: 위 가까운 쪽 끌채, 아래 먼 쪽 끌채 (왼쪽 끝이 몸체, 오른쪽 고리가 말)
- horse_walk.png: 말 걷기 6장 (3×2 칸, 왼쪽 위부터). 칸마다 같은 자리로 잘라 한 줄 그림으로 붙인다
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

sys.path.insert(0, os.path.dirname(__file__))
from cut_sheets import despill_magenta, key_alpha  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'ui', 'travel', 'parts')
OUT = os.path.join(ROOT, 'assets', 'ui', 'rig')
TS = os.path.join(ROOT, 'src', 'ui', 'travelRigLayout.ts')

# 말 한 장의 너비(px). 여섯 장을 한 줄로 붙여 1024 이하 (사파리 메모리)
HORSE_FRAME_W = 168


def load(name: str):
    src = np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(float)
    alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
    return np.dstack([despill_magenta(src, alpha), alpha * 255])


def crop(rgba, box) -> Image.Image:
    x0, y0, x1, y1 = box
    return Image.fromarray(rgba[y0:y1, x0:x1].astype('uint8'), 'RGBA')


def blobs(rgba, min_px=2000):
    """덩어리 상자들 (줄마다 왼쪽부터)"""
    a = rgba[..., 3] > 128
    lab, _ = nd.label(nd.binary_dilation(a, iterations=4))
    out = []
    for k, sl in enumerate(nd.find_objects(lab), 1):
        own = a[sl] & (lab[sl] == k)
        if own.sum() < min_px:
            continue
        ys, xs = np.where(own)
        out.append((sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1))
    out.sort(key=lambda b: ((b[1] + b[3]) // 2 // 300, b[0]))
    return out


def save(im: Image.Image, name: str, max_w: int) -> Image.Image:
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, name), optimize=True)
    print(f'{name}: {im.width}x{im.height}')
    return im


def hole_of(im: Image.Image):
    """바퀴 테두리 안쪽 빈 곳 (가운데와 크기, 테두리 그림 비율)"""
    a = np.asarray(im)[..., 3] > 128
    hole = nd.binary_fill_holes(a) & ~a
    ys, xs = np.where(hole)
    w, h = im.size
    return ((xs.min() + xs.max() + 1) / 2 / w, (ys.min() + ys.max() + 1) / 2 / h, (xs.max() + 1 - xs.min()) / w, (ys.max() + 1 - ys.min()) / h)


# 부품 자리: 몸체 그림(잘라 낸 것) px 기준. 그림을 보며 맞춘 값 (--preview로 확인)
NEAR_REAR = (438, 722)  # 몸체 그림의 뒤쪽 축 끝
NEAR_FRONT = (856, 653)  # 앞쪽 축 끝
WHEEL_H = 300  # 가까운 쪽 바퀴 높이
FAR_SHIFT = (-150, -64)  # 먼 쪽 바퀴는 가까운 쪽에서 이만큼 (왼쪽 위로 깊이)
FAR_SCALE = 0.92
SPOKE_OVER = 1.1  # 바퀴살은 테두리 안쪽보다 조금 크게 (끝이 테두리 밑으로 들어간다)
SHAFT_NEAR = (975, 575, 590)  # 끌채 왼쪽 끝(몸체에 박힌 곳) x, y, 그림 너비
SHAFT_FAR = (945, 505, 560)
HORSE = (950, 140, 690)  # 말 왼쪽 위 x, y, 너비


def main() -> None:
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None

    body_src = load('body.png')
    body = crop(body_src, blobs(body_src)[0])
    wheels_src = load('wheels.png')
    wb = blobs(wheels_src)
    # 위 줄: 테두리, 축, 바퀴살 / 아래 줄: 같은 차례
    rim_n, hub_n, spk_n, rim_f, hub_f, spk_f = (crop(wheels_src, b) for b in wb)
    shafts_src = load('shafts.png')
    sb = blobs(shafts_src)
    shaft_n, shaft_f = (crop(shafts_src, b) for b in sb)
    horse_src = load('horse_walk.png')
    # 말: 3×2 칸에서 칸마다 같은 자리로 (걸음 사이에 몸이 흔들리지 않게)
    ch, cw = horse_src.shape[0] // 2, horse_src.shape[1] // 3
    cells = [horse_src[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] for r in range(2) for c in range(3)]
    union = np.any([cell[..., 3] > 128 for cell in cells], axis=0)
    ys, xs = np.where(union)
    hb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    frames = [crop(cell, hb) for cell in cells]

    # 몸체 그림 px 자리 → 부품 상자 (x, y, w, h)
    parts = []  # (이름, 상자, 그림, 덧붙임)

    def wheel(prefix, center, height, rim, hub, spk, far):
        s = height / rim.height
        rw, rh = rim.width * s, rim.height * s
        hx, hy, hw, hh = hole_of(rim)
        # 테두리 상자: 안쪽 빈 곳 가운데가 축에 오게
        rx, ry = center[0] - hx * rw, center[1] - hy * rh
        sd = hh * rh * SPOKE_OVER
        parts.append((f'{prefix}Spokes', (center[0] - sd / 2, center[1] - sd / 2, sd, sd), spk, {'squash': round(hw * rw / (hh * rh), 3), 'far': far}))
        parts.append((f'{prefix}Rim', (rx, ry, rw, rh), rim, {}))
        hs = height * 0.38
        parts.append((f'{prefix}Hub', (center[0] - hs * hub.width / hub.height / 2, center[1] - hs / 2, hs * hub.width / hub.height, hs), hub, {}))

    far_h = WHEEL_H * FAR_SCALE
    wheel('farRear', (NEAR_REAR[0] + FAR_SHIFT[0], NEAR_REAR[1] + FAR_SHIFT[1]), far_h, rim_f, hub_f, spk_f, True)
    wheel('farFront', (NEAR_FRONT[0] + FAR_SHIFT[0], NEAR_FRONT[1] + FAR_SHIFT[1]), far_h, rim_f, hub_f, spk_f, True)

    def shaft(name, spec, im):
        x, y, w = spec
        h = w * im.height / im.width
        # 왼쪽 끝 가운데쯤이 (x, y)
        parts.append((name, (x, y - h * 0.78, w, h), im, {}))

    shaft('shaftFar', SHAFT_FAR, shaft_f)
    hw = HORSE[2]
    parts.append(('horse', (HORSE[0], HORSE[1], hw, hw * frames[0].height / frames[0].width), frames[0], {'frames': len(frames)}))
    parts.append(('body', (0, 0, body.width, body.height), body, {}))
    wheel('nearRear', NEAR_REAR, WHEEL_H, rim_n, hub_n, spk_n, False)
    wheel('nearFront', NEAR_FRONT, WHEEL_H, rim_n, hub_n, spk_n, False)
    shaft('shaftNear', SHAFT_NEAR, shaft_n)

    x0 = min(b[0] for _, b, _, _ in parts)
    y0 = min(b[1] for _, b, _, _ in parts)
    x1 = max(b[0] + b[2] for _, b, _, _ in parts)
    y1 = max(b[1] + b[3] for _, b, _, _ in parts)
    W, H = x1 - x0, y1 - y0

    if preview:
        canvas = Image.new('RGBA', (round(W), round(H)), (244, 239, 230, 255))
        for name, (x, y, w, h), im, extra in parts:
            piece = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
            if 'squash' in extra:
                sq = piece.resize((max(1, round(w * extra['squash'])), round(h)), Image.LANCZOS)
                canvas.alpha_composite(sq, (round(x - x0 + (w - sq.width) / 2), round(y - y0)))
            else:
                canvas.alpha_composite(piece, (round(x - x0), round(y - y0)))
        canvas.convert('RGB').save(preview)
        print('preview', preview)
        return

    # 그림 저장 (화면에서 마차 틀은 많아야 폭 200px 남짓, 레티나 2배)
    save(body, 'body.png', 512)
    for im, name, w in [(rim_n, 'rim_near.png', 160), (hub_n, 'hub_near.png', 64), (spk_n, 'spokes_near.png', 160),
                        (rim_f, 'rim_far.png', 140), (hub_f, 'hub_far.png', 56), (spk_f, 'spokes_far.png', 140),
                        (shaft_n, 'shaft_near.png', 320), (shaft_f, 'shaft_far.png', 320)]:
        save(im, name, w)
    fw = HORSE_FRAME_W
    fh = round(frames[0].height * fw / frames[0].width)
    strip = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.alpha_composite(f.resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    save(strip, 'horse_walk.png', 1024)

    pct = lambda v, total: round((v) / total * 100, 2)  # noqa: E731
    lines = [
        '// 자동 생성 (scripts/ui/cut_wagon_parts.py). 고치지 말고 스크립트를 다시 돌린다.',
        '// 길 위 마차 부품 자리: 마차 틀(가로세로 비율 aspect) 안의 % 상자. 차례대로 겹친다 (뒤 → 앞)',
        f'export const RIG_ASPECT = {round(W / H, 4)};',
        '',
        'export interface RigPart {',
        '  name: string;',
        '  x: number;',
        '  y: number;',
        '  w: number;',
        '  h: number;',
        '  /** 바퀴살: 돌린 뒤 가로로 이만큼 눌러 바퀴 기울기에 맞춘다 */',
        '  squash?: number;',
        '  /** 말 걷기 그림 장 수 (한 줄로 붙어 있다) */',
        '  frames?: number;',
        '}',
        '',
        'export const RIG_PARTS: readonly RigPart[] = [',
    ]
    for name, (x, y, w, h), _, extra in parts:
        more = ''.join(f', {k}: {v}' for k, v in extra.items() if k in ('squash', 'frames'))
        lines.append(f"  {{ name: '{name}', x: {pct(x - x0, W)}, y: {pct(y - y0, H)}, w: {pct(w, W)}, h: {pct(h, H)}{more} }},")
    lines.append('];')
    with open(TS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote', os.path.relpath(TS, ROOT))


if __name__ == '__main__':
    main()
