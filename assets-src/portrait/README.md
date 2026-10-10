# 초상 원본 (아바타 키트, 0.1.6)

기획자가 만든 아바타 키트(`avatar-kit/`)를 둔다. 만드는 법과 파일 형식은 `avatar-kit/README.md`, 새 파츠 프롬프트는 `docs/reference/npc-prompts.md`. 이 폴더는 게임 빌드에 들어가지 않는다. 게임은 `assets/portrait/`만 읽는다.

## 게임에 넣기

```
pip install -r scripts/portrait/requirements.txt   # 처음 한 번
npm run portraits
```

`scripts/portrait/build.py`가 키트 코드(`render.py`, `brows.py`)를 그대로 불러 `assets/portrait/`에 512 크기 그림을 다시 만든다.

- `base_<피부>.png`, `base_<피부>_old.png`: 피부 3(light, medium, deep) × (젊음 / 노인) = 6장, 배경은 투명. 노인은 회색 눈썹과 주름까지 미리 넣는다.
- `parts/<파츠>.png`, `_mul.png`, `_reg.png`: 키트 `parts/`의 `top_NN`, `hair_NN`, `beard_NN`. 본체와 `_mul`은 부드럽게, `_reg`(색 영역 번호)는 가장 가까운 픽셀로 줄인다.
- `src/sim/looks/kitParts.ts`: 그림이 있는 파츠 목록 (자동 생성).

새 파츠는 키트 `parts/`에 넣고(추출 방법은 키트 README) `npm run portraits`를 돌린 뒤 생긴 파일을 함께 커밋한다. 파츠 목록(`src/sim/looks/catalog.ts`의 `PARTS`)에 있는 id면 다음 빌드부터 그 직업 NPC가 쓴다. 상의는 `_reg.png`의 영역 번호가 그림마다 다르니(1이 셔츠인 상의도 있다) `PARTS`의 `regions`(어느 영역이 직업 색인지)를 그림에 맞게 고친다. `sources/`(ChatGPT 원본)는 저장소에 없고 빌드에도 쓰지 않는다.
