"""베이스(어떤 피부톤이든)의 눈썹 색만 바꾸기. 가장자리는 피부와 섞인 비율대로."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
_mask = None
def recolor_brows(img, color, mask_path='parts/brows_mask.png'):
    a = np.asarray(img.convert('RGB')).astype(float)
    m = np.asarray(Image.open(mask_path)) > 128
    L = a.mean(2)
    core = m & (L <= np.percentile(L[m], 35))
    idx = nd.distance_transform_edt(m, return_distances=False, return_indices=True)   # nearest skin outside mask
    skin = a[idx[0], idx[1]]
    ci = nd.distance_transform_edt(~core, return_distances=False, return_indices=True)
    browc = a[ci[0], ci[1]]
    d = skin - browc
    w = np.clip(((skin - a) * d).sum(2) / np.maximum((d ** 2).sum(2), 1), 0, 1)   # 1 = pure brow
    shade = np.clip(nd.gaussian_filter(a.mean(2), 2) / np.maximum(nd.gaussian_filter(browc.mean(2), 2), 1), 0.93, 1.07)[..., None]
    new = np.array(color, float)[None, None] * shade
    out = np.where(m[..., None], skin * (1 - w[..., None]) + new * w[..., None], a)
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))
