# 중세 랜덤 아바타 키트

로우폴리 스타일 베이스 캐릭터 1개에 머리·옷·나이를 갈아끼우는 랜덤 아바타 재료입니다.
모든 이미지는 **1254×1254, 같은 위치**라서 좌표 계산 없이 순서대로 겹치기만 하면 됩니다.

## 바로 써보기

```
pip install numpy pillow scipy scikit-image scikit-learn
python render.py              # out/ 폴더에 랜덤 아바타 12장 + sheet.png
python render.py --n 30       # 30장
python render.py --seed 7     # 같은 조합 다시 뽑기
```

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `base.png` | 최종 베이스 (살색 피부, 민머리) |
| `base_key.png` | 파츠 뽑을 때 ChatGPT에 첨부하는 **마젠타 피부** 작업용 베이스 |
| `parts/` | 완성된 파츠 |
| `sources/` | ChatGPT에서 받은 원본 (다시 추출할 때 사용) |
| `render.py` | 랜덤 조합 생성기 |
| `regions.py`, `brows.py` | 색 바꾸기 / 눈썹 색 바꾸기 |
| `tools/` | 원본 → 파츠 추출 코드 |
| `previews/` | 확인용 미리보기 |

## 파츠 목록

| 종류 | 파일 | 내용 |
|---|---|---|
| 머리 | hair_01 | 짧은 부스스한 머리 |
| | hair_02 | 어깨 길이 생머리 |
| | hair_03 | 옆머리만 남은 대머리 (노인용으로 좋음) |
| 상의 | top_03 | 끈 달린 튜닉 + 크림 셔츠 |
| | top_04 | 끈 달린 조끼 원피스 + 크림 블라우스 |
| | top_05 | 갈색 니트 (중세 느낌이 애매하면 제외) |
| | top_06 | 자주색 더블릿 (놋쇠 단추) |
| | top_07 | 농민 리넨 튜닉 (밧줄 매듭) |
| | top_08 | 모피 깃 상인 겉옷 |
| | top_09 | 사냥꾼 가죽 조끼 + 초록 셔츠 |
| 나이 | age_01_mul | 주름 레이어 |
| 눈썹 | brows_mask | 눈썹 색 바꿀 영역 (노인은 회색 눈썹) |

파츠마다 붙는 파일:
- `이름.png`: 파츠 본체 (투명 배경)
- `이름_mul.png`: 파츠가 피부에 드리우는 그림자. **곱하기(multiply)** 로 겹침. 흰색 = 변화 없음
- `이름_reg.png`: 색 바꾸기 영역 지도 (1 = 주 색, 2 = 보조 색, 3 = 보조 색2, 255 = 고정 장식, 0 = 투명)

## 겹치는 순서 (아래 → 위)

1. `base.png` (피부톤 적용)
2. 노인이면: 눈썹 회색으로 바꾸기 → `age_01_mul.png` 곱하기
3. `top_XX_mul.png` 곱하기
4. `top_XX.png`
5. `hair_XX_mul.png` 곱하기 (있을 때만)
6. `hair_XX.png`

## 피부톤

`base.png`의 피부 픽셀(배경이 아닌 곳)에 비율을 곱해서 만듭니다. `render.py`의 `SKIN` 참고.
- light (1.00, 1.00, 1.00)
- medium (0.62, 0.52, 0.48)
- deep (0.42, 0.34, 0.31)

상의 목선 안쪽 피부·그림자도 곱하기 레이어라서 어떤 피부톤이든 자연스럽게 따라갑니다.

## 색 바꾸기

명암(로우폴리 면의 밝고 어두운 차이)은 그대로 두고 색만 바꿉니다.
```python
from render import render
render(tone='deep', hair='hair_02', top='top_08', old=False,
       hair_color=(140, 62, 38),
       top_colors={1: (110, 40, 40), 2: (60, 50, 45), 3: (225, 215, 195)}).save('me.png')
```
알려진 한계:
- top_03, top_04는 끈이 피부 레이어 쪽에 있어서 끈 색은 안 바뀝니다 (피부톤 따라 밝기만 변함)
- top_09는 앞섶 끈이 셔츠 색을 따라 같이 바뀝니다
- 아주 밝은 흰색 / 완전한 검정은 명암이 눌려 밋밋해질 수 있음

## 새 파츠 추가하는 법

1. ChatGPT 새 메시지에 **`base_key.png`** 첨부 (매번 원본을 새로 첨부, 이전 결과에 이어서 편집 금지)
2. 프롬프트:
```
Using this exact image, add only [파츠 설명].
Keep the magenta skin exactly as it is. Do not change anything else: same face, same head shape, same position and size, same lighting, same background color. Keep the same low-poly faceted style with muted earthy colors. No hood, no hat, no cape, no jewelry.
```
3. **흰머리·금발·은색처럼 밝은 파츠**는 끝에 `Use a solid dark navy background.` 추가 (밝은 회색 배경이랑 구분이 어려움)
4. 추출:
```
python tools/extract_key.py sources/top_10.png parts/top_10 top     # 상의
python tools/extract_key.py sources/hair_04.png parts/hair_04 hair  # 머리
python -c "from regions import make_regions; make_regions('parts/top_10.png','parts/top_10_reg.png',k=5,merge_de=10)"
```
   출력의 `face-drift`가 30을 넘으면 ChatGPT가 얼굴/위치를 바꾼 것이니 다시 뽑기
5. 반드시 어두운 피부톤에 얹어서 목선·가장자리를 확대해 확인

중세 옷 프롬프트 아이디어 (위 [파츠 설명] 자리에):
- 기사·병사: `a padded gambeson in muted olive-gray with quilted stitching and a high collar`
- 사제·학자: `a simple dark gray wool robe with a wide round collar`

나이 레이어 추출: `python tools/extract_age.py sources/age_01.png parts/age_01_mul.png`

## 참고

- top_03 ~ top_05는 마젠타 방식 이전에 만든 것이라 `tools/extract.py` + `tools/skinfix.py`로 추출했습니다. 결과물 형식은 같습니다.
- 현대식 옷 2종(올리브 단추 셔츠, 네이비 재킷)은 중세 배경에 맞지 않아 제외했습니다.
