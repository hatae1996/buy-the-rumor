"""말 무늬: 몸 털(영역 1)에 무늬 마스크를 만들어 두 색을 섞는다. 명암은 원래 밝기 비율 유지.
patterns: zebra(얼룩말 줄무늬), pinto(큰 얼룩), appaloosa(점박이), dapple(동전무늬 회색), socks(흰 발목+이마 줄)
"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd


def _noise(shape, scale, seed):
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((shape[0] // scale + 3, shape[1] // scale + 3))
    n = nd.zoom(n, scale, order=3)[:shape[0], :shape[1]]
    return (n - n.mean()) / (n.std() + 1e-6)


def pattern_mask(kind, reg, alpha, seed=0):
    H, W = reg.shape
    body = (reg == 1) & (alpha > 0)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    m = np.zeros((H, W))
    if kind == 'zebra':
        belly = np.percentile(yy[body], 62)          # below = legs
        neck_x = np.percentile(xx[body], 70)          # right = neck/head
        warp = _noise((H, W), 70, seed) * 10 + _noise((H, W), 25, seed + 1) * 3
        width = 1 + 0.25 * _noise((H, W), 50, seed + 2)   # stripes vary in thickness

        def stripes(phase, period):
            s_ = np.sin(2 * np.pi * phase / period)
            return np.clip((s_ + 0.15 * width) * 4, 0, 1)
        m_body = stripes(xx + warp + (yy - belly) * 0.35, 46)
        m_leg = stripes(yy + warp * 0.4 + xx * 0.12, 30)
        m_neck = stripes(xx * 0.55 - yy * 0.85 + warp, 40)
        wl = np.clip((yy - belly) / 30, 0, 1)
        wn = np.clip((xx - neck_x) / 50, 0, 1) * (1 - wl)
        m = m_body * (1 - wl) * (1 - wn) + m_leg * wl + m_neck * wn
    elif kind == 'pinto':
        n = _noise((H, W), 90, seed) + 0.5 * _noise((H, W), 30, seed + 1)
        m = np.clip((n - 0.25) * 4, 0, 1)
    elif kind == 'appaloosa':
        rng = np.random.default_rng(seed)
        ys, xs = np.nonzero(body & (yy > np.percentile(yy[body], 25)) & (xx < np.percentile(xx[body], 55)))
        pick = rng.choice(len(ys), size=min(120, len(ys)), replace=False)
        canvas = np.zeros((H, W))
        for i in pick:
            r = rng.uniform(5, 11)
            y0, x0 = ys[i], xs[i]
            sl = (slice(max(int(y0 - r - 2), 0), int(y0 + r + 3)), slice(max(int(x0 - r - 2), 0), int(x0 + r + 3)))
            d = np.hypot(yy[sl] - y0, xx[sl] - x0)
            canvas[sl] = np.maximum(canvas[sl], np.clip((r - d) / 1.5, 0, 1))
        # blanket: white rump behind the spots
        rump = np.clip((np.percentile(xx[body], 50) - xx) / 60, 0, 1) * np.clip((yy - np.percentile(yy[body], 15)) / 80, 0, 1)
        m = np.maximum(rump * 0.0 + canvas, 0)
    elif kind == 'dapple':
        # dapple grey: light round spots in a darker net, fading out towards the legs and head
        n = _noise((H, W), 9, seed)
        spots = np.clip((n - 0.15) * 2.5, 0, 1)
        top = np.percentile(yy[body], 20); belly = np.percentile(yy[body], 65)
        fade = np.clip((belly - yy) / 60, 0, 1) * np.clip((yy - top) / 40, 0.3, 1)
        m = spots * fade * 0.8
    elif kind == 'socks':
        rows = np.nonzero(body.any(1))[0]
        ybot = rows.max()
        m = np.clip((yy - (ybot - 150)) / 12, 0, 1)
        # blaze on the face: thin vertical band near the front of the head
        cols = np.nonzero(body.any(0))[0]
        xf = cols.max()
        face = np.exp(-((xx - (xf - 70)) / 10) ** 2) * (yy < np.percentile(yy[body], 30))
        m = np.maximum(m, np.clip(face * 1.5, 0, 1))
    m = nd.gaussian_filter(m, 0.8) * body
    return m


def apply_pattern(rgba, reg, base_colors, kind, pattern_color, seed=0):
    """base_colors: {1: coat, 2: mane, 3: hoof}; pattern_color: colour of the pattern on the coat."""
    im = rgba.astype(float)
    rgb = im[..., :3]
    a = im[..., 3] / 255
    out = rgb.copy()
    m = pattern_mask(kind, reg, a, seed)
    for c, col in base_colors.items():
        mm = reg == c
        if not mm.any():
            continue
        v = rgb.max(2) if c == 2 else rgb.mean(2)
        ref = np.percentile(v[mm], 70)
        s = (np.clip(v / max(ref, 1), 0.35, 1.25) ** 0.9)[..., None]
        col_a = np.array(col, float)[None, None]
        if c == 1:
            col_b = np.array(pattern_color, float)[None, None]
            col_px = col_a * (1 - m[..., None]) + col_b * m[..., None]
        else:
            col_px = np.broadcast_to(col_a, rgb.shape)
        new = col_px * s
        out[mm] = new[mm]
    return np.dstack([np.clip(out, 0, 255), im[..., 3]]).astype('uint8')
