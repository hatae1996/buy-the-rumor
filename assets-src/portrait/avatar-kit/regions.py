"""파츠를 '색을 바꿀 수 있는 영역'으로 나누고, 색을 바꾸는 함수.
regions: <part>_reg.png  (0 = 투명, 1 = 주 색, 2 = 보조 색, 3 = 보조 색2, 255 = 고정 디테일: 끈·단추 등)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from skimage.color import rgb2lab
from sklearn.cluster import KMeans


def make_regions(part_path, out_path, k=4, merge_de=14, detail_frac=0.035):
    im = np.asarray(Image.open(part_path).convert('RGBA')).astype(float)
    a = im[..., 3]
    op = a > 128
    lab = rgb2lab(im[..., :3] / 255)
    X = np.stack([lab[..., 0][op] * 0.25, lab[..., 1][op], lab[..., 2][op]], 1)
    km = KMeans(n_clusters=k, n_init=4, random_state=0).fit(X[::7])
    lbl = km.predict(X)
    cent = km.cluster_centers_
    # merge clusters with similar colour (same fabric under different light)
    groups = list(range(k))
    def find(i):
        while groups[i] != i:
            i = groups[i]
        return i
    for i in range(k):
        for j in range(i + 1, k):
            dab = np.hypot(cent[i, 1] - cent[j, 1], cent[i, 2] - cent[j, 2])
            dl = abs(cent[i, 0] - cent[j, 0]) / 0.25
            if dab < merge_de and dl < 22:
                groups[find(j)] = find(i)
    lbl = np.array([find(l) for l in range(k)])[lbl]
    reg = np.zeros(a.shape, np.uint8)
    full = np.zeros(a.shape, int) - 1
    full[op] = lbl
    ids, cnt = np.unique(lbl, return_counts=True)
    order = ids[np.argsort(-cnt)]
    frac = dict(zip(ids, cnt / cnt.sum()))
    code = 1
    for g in order:
        m = full == g
        if frac[g] < detail_frac or code > 3:
            reg[m] = 255
        else:
            # clean speckle: small islands go to the surrounding region later
            reg[m] = code
            code += 1
    # majority-smooth tiny islands (<60 px) of recolourable regions
    for c in [1, 2, 3]:
        m = reg == c
        l2, n2 = nd.label(m)
        if n2:
            sz = nd.sum(m, l2, range(1, n2 + 1))
            small = np.isin(l2, [i + 1 for i, v in enumerate(sz) if v < 60])
            reg[small] = 0
    # fill unassigned opaque/semi pixels from nearest assigned
    need = (a > 0) & (reg == 0)
    have = reg > 0
    if have.any():
        idx = nd.distance_transform_edt(~have, return_distances=False, return_indices=True)
        reg[need] = reg[idx[0], idx[1]][need]
    Image.fromarray(reg).save(out_path)
    return reg


def recolor(part_rgba, reg, colors):
    """colors: {region_code: (r,g,b)}. 명암은 원래 이미지의 밝기 비율로 유지."""
    im = part_rgba.astype(float)
    rgb = im[..., :3]
    L = rgb2lab(rgb / 255)[..., 0]
    out = rgb.copy()
    for c, col in colors.items():
        m = reg == c
        if not m.any():
            continue
        ref = np.percentile(L[m], 60)
        tl = rgb2lab(np.array(col, float)[None, None] / 255)[0, 0]
        # shift lightness so the region's typical lightness lands on the target colour
        newL = np.clip(L + (tl[0] - ref), 0, 100)
        lab = np.zeros(rgb.shape)
        lab[..., 0] = newL
        # keep a little of the original chroma variation (warm/cool facets) around the target
        orig = rgb2lab(rgb / 255)
        ma, mb = np.median(orig[..., 1][m]), np.median(orig[..., 2][m])
        lab[..., 1] = tl[1] + (orig[..., 1] - ma) * 0.5
        lab[..., 2] = tl[2] + (orig[..., 2] - mb) * 0.5
        from skimage.color import lab2rgb
        new = lab2rgb(lab) * 255
        out[m] = new[m]
    return np.dstack([np.clip(out, 0, 255), im[..., 3]]).astype('uint8')


if __name__ == '__main__':
    make_regions(sys.argv[1], sys.argv[2], k=int(sys.argv[3]) if len(sys.argv) > 3 else 4)
