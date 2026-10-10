"""인장 그림 빌드 (0.2.1): assets-src/badge/<인장 id>.png(1254×1254 원본)를 게임용 512로 줄여 assets/badge/에 넣는다.

    npm run badges        (= python scripts/badge/build.py)

필요한 것: pip install pillow
파일 이름이 인장 id다 (지금은 "개척 상인" pioneer.png 하나, src/sim/ranking/badges.ts PIONEER_BADGE).
게임(src/ui/badgeArt.ts)은 assets/badge/에 그림이 있는 인장만 그림으로, 없으면 등급 색 메달로 그린다.
"""
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'badge')
OUT = os.path.join(ROOT, 'assets', 'badge')
# 게임에 넣는 크기 (기획 0.2.1: 1254 → 512)
SIZE = 512


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    names = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png')) if os.path.isdir(SRC) else []
    for name in names:
        im = Image.open(os.path.join(SRC, name)).convert('RGBA')
        if im.size != (SIZE, SIZE):
            im = im.resize((SIZE, SIZE), Image.LANCZOS)
        im.save(os.path.join(OUT, name.lower()), optimize=True)
        print(f'{name} → assets/badge/{name.lower()}')
    if not names:
        print('assets-src/badge/에 그림이 없다')


if __name__ == '__main__':
    main()
