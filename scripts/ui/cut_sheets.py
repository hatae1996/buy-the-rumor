"""UI 그림판을 잘라 assets/ui/ 에 투명 PNG로 넣는다.

- assets-src/ui/cart-ui-sheet.png: 분홍(마젠타) 배경. 탭 아이콘 5, 모래시계·빵·동전 (0.1.6 짐칸 탭). 그림판의 마차는 쓰지 않는다
- assets-src/ui/town-ui-sheet.png: 분홍 배경. 마을 탭 건물 6과 작은 아이콘 8 (0.1.6 마을 탭)
- assets-src/ui/ledger-ui-sheet.png: 장부 탭 (편지 묶음, 마을 집 둘)
- assets-src/ui/ledger-money-sheet.png: 장부 수입·지출 (돈주머니, 상자, 금화 더미, 자루)
- assets-src/ui/ledger-icons-sheet.png: 장부 시세 기록 (시계, 안내 i)
- assets-src/ui/inn-ui-sheet.png: 여관 (술잔, 전서구, 침대, 고용 게시판)
- assets-src/ui/newsboy-ui-sheet.png: 신문팔이 가판대 (신문 있음, 빔)
- assets-src/ui/news-ui-sheet.png, guild-ui-sheet.png: 소식 탭 신문·활동·길드 (보고 그림, 우승컵, 핀, 시즌 방패, 의뢰 그림)
- assets-src/ui/travel-ui-sheet.png, assets-src/ui/travel/: 길 위 마을 탭 (집, 식량, 수레, 느낌표, 계절별 길, 말과 수레)
- assets/source-sheets/sheet-A-icons-portraits.png: 검은 배경. 물품 그림 9개 (예전 것, goods_sheet()로만. 지금은 cut_goods.py)

python scripts/ui/cut_sheets.py   (numpy, pillow, scipy)
배경색 거리로 투명도를 만들고, 가장자리에 남은 배경색 기운을 빼고(despill), 덩어리마다 잘라 쓸 크기로 줄인다.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'ui')


def key_alpha(rgb: np.ndarray, key: np.ndarray, near: float, far: float) -> np.ndarray:
    """배경색과의 거리로 투명도 (near 이하는 투명, far 이상은 불투명)"""
    d = np.sqrt(((rgb - key) ** 2).sum(-1))
    return np.clip((d - near) / (far - near), 0, 1)


def despill_magenta(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """반투명 가장자리의 분홍 기운: 빨강·파랑이 초록보다 넘치는 만큼 줄인다"""
    out = rgb.copy()
    edge = alpha < 0.999
    g = out[..., 1]
    for c in (0, 2):
        ch = out[..., c]
        ch[edge] = np.minimum(ch[edge], np.maximum(g[edge], ch[edge] * alpha[edge]))
    return out


def save(rgba: np.ndarray, box, name: str, max_side: int, pad: int = 4) -> None:
    x0, y0, x1, y1 = box
    h, w = rgba.shape[:2]
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)
    im = Image.fromarray(rgba[y0:y1, x0:x1].astype('uint8'), 'RGBA')
    s = max_side / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    im.save(path, optimize=True)
    print(f'{name}: {im.size[0]}x{im.size[1]}')


def components(alpha: np.ndarray, min_px: int):
    lab, n = nd.label(alpha > 0.5)
    sizes = nd.sum(alpha > 0.5, lab, range(1, n + 1))
    boxes = []
    for i, sl in enumerate(nd.find_objects(lab)):
        if sizes[i] >= min_px:
            boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    return boxes


def cart_ui_sheet() -> None:
    src = np.asarray(Image.open(os.path.join(ROOT, 'assets-src', 'ui', 'cart-ui-sheet.png')).convert('RGB')).astype(float)
    alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
    rgb = despill_magenta(src, alpha)
    rgba = np.dstack([rgb, alpha * 255])
    boxes = components(alpha, 2000)
    # 위 줄 아이콘 5개(왼쪽부터), 가운데 줄 3개, 마차 (가장 큰 덩어리)
    boxes.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    wagon = boxes.pop()
    icons = sorted(boxes, key=lambda b: (b[1] > 250, b[0]))
    names = ['tab_town.png', 'tab_map.png', 'tab_cart.png', 'tab_ledger.png', 'tab_news.png', 'icon_hourglass.png', 'icon_bread.png', 'coin.png']
    if len(icons) != len(names):
        sys.exit(f'아이콘 덩어리 수가 다르다: {len(icons)}')
    for box, name in zip(icons, names):
        save(rgba, box, name, 160)
    # 마차는 다시 그려 받기로 해서 쓰지 않는다 (칸이 정사각형이 아니고 수레마다 칸 수가 다르다)
    del wagon


# 물품 그림: 그림판 셋째 줄, 왼쪽부터
GOODS = ['fish', 'meat', 'grain', 'wood', 'leather', 'ore', 'salt', 'salted', 'tools']


def goods_sheet() -> None:
    src = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'source-sheets', 'sheet-A-icons-portraits.png')).convert('RGB')).astype(float)
    # 검은 배경은 가장자리에서 이어진 아주 어두운 곳만 (그림 안의 어두운 외곽선은 남긴다)
    dark = src.max(-1) < 22
    lab, _ = nd.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    alpha = (~bg).astype(float)
    alpha = nd.gaussian_filter(alpha, 0.6)
    alpha[~bg] = 1.0
    rgba = np.dstack([src, alpha * 255])
    row = (alpha > 0.5)[520:660]
    boxes = [(b[0], b[1] + 520, b[2], b[3] + 520) for b in components(row.astype(float), 1500)]
    boxes.sort(key=lambda b: b[0])
    if len(boxes) != len(GOODS):
        sys.exit(f'물품 덩어리 수가 다르다: {len(boxes)}')
    os.makedirs(os.path.join(OUT, 'goods'), exist_ok=True)
    for box, good in zip(boxes, GOODS):
        save(rgba, box, f'goods/{good}.png', 128, pad=2)


def sheet_pieces(sheet: str, names) -> None:
    """분홍 배경 그림판(assets-src/ui/<sheet>)에서 그림 덩어리를 줄마다 왼쪽부터 찾아 names 차례로 저장한다.
    names는 (파일 이름, 가장 긴 변) 목록이고, 이름이 None이면 건너뛴다."""
    src = np.asarray(Image.open(os.path.join(ROOT, 'assets-src', 'ui', sheet)).convert('RGB')).astype(float)
    alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
    rgb = despill_magenta(src, alpha)
    rgba = np.dstack([rgb, alpha * 255])
    # 그림 사이가 좁아(여관과 바깥) 조금만 부풀려 덩어리를 찾는다. 상자마다 제 덩어리 번호를 들고 다닌다
    # (시장 등불이 여관 상자 안에 들어오듯 이웃 그림이 상자에 겹쳐도 제 것만 남긴다)
    grown = nd.binary_dilation(alpha > 0.5, iterations=5)
    lab, n = nd.label(grown)
    boxes = []
    for k, sl in enumerate(nd.find_objects(lab), 1):
        inner = (alpha > 0.5)[sl] & (lab[sl] == k)
        if inner.sum() < 800:
            continue
        ys, xs = np.where(inner)
        boxes.append((sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1, {k}))
    # 물결 두 줄처럼 가로 자리가 겹치고 위아래로 붙은 작은 조각은 하나로 묶는다
    merged = True
    while merged:
        merged = False
        for i, p in enumerate(boxes):
            for j, q in enumerate(boxes[i + 1:], i + 1):
                small = (p[2] - p[0]) * (p[3] - p[1]) < 40000 and (q[2] - q[0]) * (q[3] - q[1]) < 40000
                overlap = min(p[2], q[2]) - max(p[0], q[0]) > 0.6 * min(p[2] - p[0], q[2] - q[0])
                gap = max(p[1], q[1]) - min(p[3], q[3])
                if small and overlap and gap < 30:
                    boxes[i] = (min(p[0], q[0]), min(p[1], q[1]), max(p[2], q[2]), max(p[3], q[3]), p[4] | q[4])
                    del boxes[j]
                    merged = True
                    break
            if merged:
                break
    # 줄(가운데 높이)로 묶고 줄 안에서는 왼쪽부터
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur = [], [boxes[0]]
    for b in boxes[1:]:
        if (b[1] + b[3]) / 2 - (cur[-1][1] + cur[-1][3]) / 2 > 120:
            rows.append(cur)
            cur = [b]
        else:
            cur.append(b)
    rows.append(cur)
    ordered = [b for row in rows for b in sorted(row, key=lambda b: b[0])]
    if len(ordered) != len(names):
        sys.exit(f'{sheet}: 덩어리 수가 다르다 ({len(ordered)}, 이름은 {len(names)})')
    for box, (name, size) in zip(ordered, names):
        if name is None:
            continue
        own = rgba.copy()
        own[..., 3] *= np.isin(lab, list(box[4]))
        save(own, box[:4], name, size)


def town_ui_sheet() -> None:
    """마을 탭 그림판 (0.1.6 목업 docs/reference/town-tab-mockup-0.1.6.png): 건물 6, 작은 아이콘 8"""
    names = [
        ('bld_market.png', 480), ('bld_inn.png', 480), ('bld_outside.png', 480),
        ('bld_store.png', 256), ('bld_warehouse.png', 256), ('bld_anvil.png', 256),
        ('orn_sprig_l.png', 128), ('orn_sprig_r.png', 128), ('orn_waves.png', 128), ('icon_sprout.png', 96),
        ('icon_fish.png', 96), ('icon_wheat.png', 96), ('icon_chevron.png', 64), ('icon_arrow.png', 96),
    ]
    sheet_pieces('town-ui-sheet.png', names)


def travel_ui_sheet() -> None:
    """길 위 마을 탭 그림판 (0.1.6 목업 docs/reference/travel-mockup-0.1.6.png): 길 장면(따로 받은 것을 쓴다), 집, 식량, 수레, 느낌표"""
    sheet_pieces('travel-ui-sheet.png', [
        (None, 0),
        ('travel_house.png', 192), ('travel_food.png', 320), ('travel_wagon.png', 192),
        ('icon_notice.png', 64),
    ])


def ledger_ui_sheet() -> None:
    """장부 탭 그림판 (0.1.6 목업 docs/reference/ledger-orders-mockup-0.1.6.png): 봉인한 편지 묶음, 다른 마을 집(파랑), 지금 마을 집(빨강)"""
    sheet_pieces('ledger-ui-sheet.png', [('ledger_letters.png', 320), ('house_blue.png', 192), ('house_red.png', 192)])


def ledger_money_sheet() -> None:
    """장부 수입·지출 그림판 (0.1.6 목업 docs/reference/ledger-accounts-mockup-0.1.6.png): 돈주머니와 금화, 빈 상자, 금화 더미, 돈 나간 자루"""
    sheet_pieces('ledger-money-sheet.png', [('money_purse.png', 320), ('cargo_crate.png', 160), ('coins_stack.png', 192), ('coins_sack.png', 192)])


def ledger_icons_sheet() -> None:
    """장부 시세 기록 아이콘 (0.1.6 목업 docs/reference/ledger-prices-mockup-0.1.6.png): 시계, 안내(i)"""
    sheet_pieces('ledger-icons-sheet.png', [('icon_clock.png', 96), ('icon_info.png', 96)])


def news_ui_sheet() -> None:
    """소식 탭 그림판 (0.1.6 목업 docs/reference/news-*-mockup-0.1.6.png): 채집 바구니, 봉인 편지, 우승컵, (방패·늑대·얼음 구멍은 길드 그림판 것을 쓴다), 위치 핀"""
    sheet_pieces('news-ui-sheet.png', [
        ('report_gather.png', 192), ('report_letter.png', 192), ('rank_trophy.png', 192),
        (None, 0), (None, 0), (None, 0),
        ('icon_pin.png', 64),
    ])


def guild_ui_sheet() -> None:
    """길드 의뢰 그림판: 혹한의 시즌 방패, 겨울 식량 통, 늑대, 얼음 낚시 구멍, 통나무 (의뢰 번호로 이름을 붙인다)"""
    sheet_pieces('guild-ui-sheet.png', [
        ('theme_frost.png', 192), ('quest_winterFood.png', 160), ('quest_wolfRoad.png', 160),
        ('quest_iceFisher.png', 160), ('quest_towerFire.png', 160),
    ])


def inn_ui_sheet() -> None:
    """여관 그림판 (0.1.6 목업 docs/reference/inn-*-mockup-0.1.6.png): 술잔, 전서구, 침대, 고용 게시판"""
    sheet_pieces('inn-ui-sheet.png', [('inn_drink.png', 192), ('inn_pigeon.png', 192), ('inn_bed.png', 192), ('inn_board.png', 192)])


def newsboy_ui_sheet() -> None:
    """신문팔이 그림판 (0.1.6 목업 docs/reference/newsboy-*-mockup-0.1.6.png): 신문이 놓인 가판대, 빈 가판대"""
    sheet_pieces('newsboy-ui-sheet.png', [('newsstand.png', 320), ('newsstand_empty.png', 320)])


def travel_scene() -> None:
    """길 위 장면: 계절별 길 바닥 4장(같은 자리로 자른다)과 그 위를 가는 말과 수레 (assets-src/ui/travel/)"""
    folder = os.path.join(ROOT, 'assets-src', 'ui', 'travel')
    roads = {}
    for season in ('spring', 'summer', 'autumn', 'winter'):
        src = np.asarray(Image.open(os.path.join(folder, f'road_{season}.png')).convert('RGB')).astype(float)
        alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
        roads[season] = np.dstack([despill_magenta(src, alpha), alpha * 255])
    # 네 장을 겹쳐 같은 상자로 자른다 (계절이 바뀌어도 길 자리가 그대로)
    union = np.any([r[..., 3] > 128 for r in roads.values()], axis=0)
    ys, xs = np.where(union)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    for season, rgba in roads.items():
        save(rgba, box, f'road_{season}.png', 1024, pad=0)
    src = np.asarray(Image.open(os.path.join(folder, 'wagon.png')).convert('RGB')).astype(float)
    alpha = key_alpha(src, np.array([255.0, 0.0, 255.0]), 90, 190)
    ys, xs = np.where(alpha > 0.5)
    save(np.dstack([despill_magenta(src, alpha), alpha * 255]), (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), 'travel_horse_wagon.png', 640)


if __name__ == '__main__':
    cart_ui_sheet()
    town_ui_sheet()
    travel_ui_sheet()
    ledger_ui_sheet()
    ledger_money_sheet()
    ledger_icons_sheet()
    news_ui_sheet()
    guild_ui_sheet()
    inn_ui_sheet()
    newsboy_ui_sheet()
    travel_scene()
    # 물품 그림은 0.1.6부터 로우폴리 그림(scripts/ui/cut_goods.py)을 쓴다. 예전 그림판 물품이 필요하면 goods_sheet()
