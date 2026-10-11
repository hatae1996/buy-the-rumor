# 말 키트

로우폴리 말 3종에 털색·갈기색·발굽색·무늬를 바꿔 끼우는 재료입니다. (1536×1024, 투명 배경)

## 바로 써보기
```
pip install numpy pillow scipy
python random_horse.py              # out/ 폴더에 랜덤 말 12마리 + sheet.png (3종 중 랜덤)
python random_horse.py --n 30 --seed 7
```

## 파일
| 파일 | 내용 |
|---|---|
| `horse_01.png` | 기본 말 |
| `horse_02.png` | 늙은 조랑말 (작고 통통, 고개 숙임) |
| `horse_03.png` | 빠른 말 (날씬, 긴 다리, 짧은 갈기) |
| `horse_XX_reg.png` | 각 말의 색 영역 지도 (1 = 몸 털, 2 = 갈기·꼬리, 3 = 발굽, 255 = 눈 고정) |
| `src_horse_XX.png` | ChatGPT 원본 (마젠타 배경, 갈기·꼬리 파란색) |
| `horse_color.py` | 털색 바꾸기 |
| `horse_pattern.py` | 무늬: `zebra`(얼룩말), `pinto`(큰 얼룩), `appaloosa`(점박이), `dapple`(동전무늬 회색), `socks`(흰 발목+이마 줄) |
| `random_horse.py` | 랜덤 말 생성기 |
| `extract_horse.py` | 새 말 원본 → 투명 PNG + 영역 지도 |
| `horse_coats.png`, `horse_patterns.png` | 예시 미리보기 |

## 색 바꾸기 (아무 RGB 색이나 가능)
```python
import numpy as np
from PIL import Image
from horse_color import recolor_horse
im = np.asarray(Image.open('horse_01.png')); reg = np.asarray(Image.open('horse_01_reg.png'))
out = recolor_horse(im, reg, {1: (90, 60, 140),   # 몸
                              2: (255, 200, 0),   # 갈기·꼬리
                              3: (30, 30, 30)})   # 발굽
Image.fromarray(out, 'RGBA').save('my_horse.png')
```

## 무늬 입히기
```python
from horse_pattern import apply_pattern
out = apply_pattern(im, reg, {1: (232, 228, 220), 2: (60, 40, 28), 3: (70, 60, 55)},
                    'pinto', (130, 80, 48), seed=3)   # 바탕색들, 무늬 종류, 무늬 색, 시드
```
시드 숫자를 바꾸면 같은 무늬 종류라도 모양이 매번 달라집니다.

## 참고
- 아주 밝은 흰색/완전한 검정은 명암이 눌려 밋밋할 수 있음. 흰 말은 (225, 222, 215) 정도가 자연스러움
- 눈은 색이 고정
- 무늬는 평면에 찍는 방식이라 다리 측면 등에서 살짝 납작해 보일 수 있음

## 새 말 추가
ChatGPT에 배경은 **형광 마젠타(#FF00FF)**, 갈기·꼬리는 **선명한 파란색**으로 그려 달라고 요청한 뒤:
```
python extract_horse.py 원본.png horse_04
```
`horse_04.png`로 저장하면 `random_horse.py`가 자동으로 포함합니다.
```
```
