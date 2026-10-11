"""말 색 바꾸기: 영역별 명암(밝기 비율)을 유지하고 색만 입힘."""
import numpy as np
from PIL import Image

def recolor_horse(rgba, reg, colors):
    im = rgba.astype(float)
    rgb = im[..., :3]
    out = rgb.copy()
    for c, col in colors.items():
        m = reg == c
        if not m.any():
            continue
        # brightness measure: blue mane uses the max channel, grey coat the mean
        v = rgb.max(2) if c == 2 else rgb.mean(2)
        ref = np.percentile(v[m], 70)
        s = np.clip(v / max(ref, 1), 0.35, 1.25)
        s = s ** 0.9
        new = np.array(col, float)[None, None] * s[..., None]
        out[m] = new[m]
    return np.dstack([np.clip(out, 0, 255), im[..., 3]]).astype('uint8')
