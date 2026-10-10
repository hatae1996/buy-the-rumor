"""base.png -> base_key.png : 피부만 형광 마젠타로 (명암 유지, 눈·눈썹·입은 그대로)"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd

b = np.asarray(Image.open('base.png').convert('RGB')).astype(float)
bg = np.median(b[:80, :80].reshape(-1, 3), 0)
R = np.maximum(b[..., 0], 1); gr = b[..., 1] / R; br = b[..., 2] / R; L = b.mean(2)

body = np.abs(b - bg).sum(2) > 40
body = nd.binary_opening(body, iterations=1)
lab, n = nd.label(body); sz = nd.sum(body, lab, range(1, n + 1)); body = lab == (np.argmax(sz) + 1)
body = nd.binary_fill_holes(body)

# features: eyes/brows (dark), mouth (red)
feat = body & ((L < 100) | ((gr < 0.62) & (br < 0.45)))
feat = nd.binary_opening(feat, iterations=1)
lab, n = nd.label(feat); sz = nd.sum(feat, lab, range(1, n + 1))
feat = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 80])
featz = nd.binary_dilation(feat, iterations=2)

skin = body & ~feat
core = nd.binary_erosion(body, iterations=2)
idx = nd.distance_transform_edt(~(core & ~featz), return_distances=False, return_indices=True)
F = b[idx[0], idx[1]]                      # nearest clean skin colour (for edges)

def shade_of(col):
    l = col.mean(-1)
    lo, hi = 110.0, 205.0
    return np.clip(0.45 + 0.55 * (l - lo) / (hi - lo), 0.35, 1.0)

S = np.where((core & ~featz)[..., None], b, F)
mag = np.array([255.0, 0.0, 255.0])[None, None] * shade_of(S)[..., None]

out = b.copy()
# 1) clean skin
m = core & ~featz
out[m] = mag[m]
# 2) silhouette edge vs background: unmix  b = t*F + (1-t)*bg
band = body & ~core
FB = F - bg; t = np.clip(((b - bg) * FB).sum(2) / np.maximum((FB ** 2).sum(2), 1), 0, 1)
e = band & ~featz
out[e] = (mag * t[..., None] + bg * (1 - t[..., None]))[e]
# 3) around features: unmix  b = k*feature + (1-k)*skin
fidx = nd.distance_transform_edt(~feat, return_distances=False, return_indices=True)
Fe = b[fidx[0], fidx[1]]
d = Fe - F; k = np.clip(((b - F) * d).sum(2) / np.maximum((d ** 2).sum(2), 1), 0, 1)
r = featz & ~feat & body
out[r] = (Fe * k[..., None] + mag * (1 - k[..., None]))[r]
Image.fromarray(out.clip(0, 255).astype('uint8')).save('base_key.png')
print('ok')
