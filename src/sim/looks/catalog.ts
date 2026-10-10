// 초상 파츠 목록과 팔레트 (기획서 "NPC 외모", 0.1.4). 색 값과 파츠 목록은 초안이다. 기획자가 그림을 만들며 고친다.
// 그림 파일은 assets/portrait/<레이어>/<파츠 id>.png. 모두 같은 크기 캔버스에 같은 위치로 그린 투명 PNG다.
// 옷과 머리 파츠는 회색조로 그리고, 화면이 팔레트 색을 곱한다. 얼굴·목 파츠에는 피부색을 곱한다.
import type { ClothColorId, HairColorId, LayerId, SkinId, TintId } from './types';

/** 기획자가 그리는 캔버스 크기 (px). 게임에 넣을 때는 쓸 크기로 줄여도 같은 위치가 유지된다 */
export const PORTRAIT_CANVAS = 1254;

/** 아래에서 위로 그리는 순서와 곱할 색 */
export const LAYERS: readonly { id: LayerId; name: string; tint: TintId | null }[] = [
  { id: 'backHair', name: '뒷머리', tint: 'hair' },
  { id: 'face', name: '얼굴·목', tint: 'skin' },
  { id: 'top', name: '상의', tint: 'cloth' },
  { id: 'brows', name: '눈썹', tint: 'hair' },
  { id: 'beard', name: '수염', tint: 'hair' },
  { id: 'freckles', name: '주근깨', tint: null },
  { id: 'wrinkles', name: '주름', tint: null },
  { id: 'frontHair', name: '앞머리·옆머리', tint: 'hair' },
  { id: 'hat', name: '모자·두건', tint: 'hat' },
];

/** 레이어마다 있는 파츠 (id → 이름). 그림이 아직 없으면 화면이 단색 자리표시로 그린다 */
export const PARTS: Record<LayerId, Record<string, string>> = {
  backHair: { long: '긴 머리', braid: '땋은 머리', bun: '올린 머리', nape: '목덜미 머리' },
  face: { round: '둥근 얼굴', oval: '갸름한 얼굴', square: '각진 얼굴' },
  // 시대에 맞는 옷만: 단추 셔츠, 블레이저 같은 현대 옷은 없다
  top: { tunic: '끈 튜닉', pinafore: '조끼 드레스', apron: '앞치마', shawl: '숄', cloak: '망토', leatherVest: '가죽 조끼' },
  brows: { soft: '옅은 눈썹', thick: '짙은 눈썹', arched: '둥근 눈썹' },
  beard: { stubble: '거뭇한 수염', mustache: '콧수염', full: '덥수룩한 수염' },
  freckles: { freckles: '주근깨' },
  wrinkles: { lines: '주름' },
  frontHair: { fringe: '앞머리', parted: '가르마', swept: '넘긴 머리', cropped: '짧은 머리' },
  hat: { hood: '두건', kerchief: '머릿수건', feltHat: '펠트 모자', cap: '작업 모자' },
};

/** 옷 색: 천연 염료 (초안). 짙은 색은 광부·대장장이·도시 상인 */
export const CLOTH_COLORS: Record<ClothColorId, { name: string; hex: string }> = {
  indigo: { name: '쪽빛', hex: '#4a6688' },
  madder: { name: '꼭두서니 빨강', hex: '#a84a3c' },
  ochre: { name: '황토', hex: '#c4903f' },
  olive: { name: '올리브', hex: '#7d7c46' },
  linen: { name: '표백 안 한 마', hex: '#ddd0b2' },
  deepIndigo: { name: '짙은 쪽빛', hex: '#2c3d56' },
  deepMadder: { name: '짙은 꼭두서니', hex: '#6c2e27' },
  deepOlive: { name: '짙은 올리브', hex: '#4b4c2d' },
};

export const SKIN_COLORS: Record<SkinId, { name: string; hex: string }> = {
  skin1: { name: '밝은 피부', hex: '#f2d5ba' },
  skin2: { name: '보통 피부', hex: '#dcac85' },
  skin3: { name: '그을린 피부', hex: '#b27c54' },
  skin4: { name: '짙은 피부', hex: '#7c5438' },
};

export const HAIR_COLORS: Record<HairColorId, { name: string; hex: string }> = {
  black: { name: '검은 머리', hex: '#2e2622' },
  brown: { name: '갈색 머리', hex: '#5c3c24' },
  auburn: { name: '밤색 머리', hex: '#9c6634' },
  gray: { name: '흰머리', hex: '#c8c1b3' },
};

/** 곱할 색의 값 (화면이 쓴다) */
export function tintHex(tint: TintId, look: { skin: SkinId; hair: HairColorId; cloth: ClothColorId; hatColor: ClothColorId }): string {
  switch (tint) {
    case 'skin':
      return SKIN_COLORS[look.skin].hex;
    case 'hair':
      return HAIR_COLORS[look.hair].hex;
    case 'cloth':
      return CLOTH_COLORS[look.cloth].hex;
    case 'hat':
      return CLOTH_COLORS[look.hatColor].hex;
  }
}
