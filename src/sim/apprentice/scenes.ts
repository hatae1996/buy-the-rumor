// 첫 5분의 장면 (기획서 "첫 5분의 흐름 (견습 기간, 확정)"). 장면 하나에 새로운 것 하나만 가르친다.
// 노상인 말은 자리만 잡아 둔 한 줄이다. 대사와 연출은 나중 버전에서 다듬는다.
import type { SceneId, UnlockId } from './types';

export interface SceneDef {
  id: SceneId;
  title: string;
  /** 배우는 것 */
  learn: string;
  /** 이 장면에 들어오면 열리는 것 */
  unlocks: readonly UnlockId[];
  /** 노상인 한두 줄. {dest}는 졸업하고 갈 마을, {destTo}는 그 마을에 으로/로를 붙인 것 */
  hint: string;
}

export const SCENES: readonly SceneDef[] = [
  { id: 'start', title: '시작', learn: '', unlocks: [], hint: '"숲에 한번 다녀와 보게. 빈손으로는 안 돌아올 걸세."' },
  { id: 'firstExpedition', title: '첫 원정', learn: '카드 넘기기, 피로', unlocks: [], hint: '"카드를 넘겨 길을 고르게. 무리하면 지친다네."' },
  {
    id: 'firstLoad',
    title: '첫 짐 싣기',
    learn: '끌어다 놓기, 돌리기',
    unlocks: ['cart'],
    hint: '"짐칸에서 짐을 끌어다 옮겨 보게. 톡 누르면 돌아간다네."',
  },
  {
    id: 'firstSale',
    title: '첫 판매와 첫 장날',
    learn: '장날에 가격이 정해짐',
    // 장날에 낸 신청과 돈 내역을 보는 장부는 첫 판매 때 (0.1.2)
    unlocks: ['ledger'],
    hint: '"가져온 걸 장에 내 보게. 값은 내가 적어 둔 대로면 되네. 그리고 하루를 보내 보게."',
  },
  {
    id: 'firstNews',
    title: '첫 신문',
    learn: '사건을 읽고 짐작하기',
    unlocks: ['news'],
    hint: '"신문팔이에게서 오늘 신문을 받아 읽어 보게. 견습 동안은 공짜라네. {dest}에서 큰 배를 짓는다는 소식이 있을 걸세."',
  },
  {
    id: 'firstBuy',
    title: '첫 구매와 무게',
    learn: '매수, 무게 제한',
    unlocks: [],
    hint: '"여기 목재를 사서 {destTo} 가져가 보게. 너무 많이 실으면 못 떠난다네."',
  },
  {
    id: 'graduation',
    title: '졸업',
    learn: '이동',
    unlocks: ['map'],
    // 졸업 선물에 그날 신문 한 부 (0.1.6 답 116 다)
    hint: '"손수레와 길에서 먹을 식량, 그리고 오늘 신문을 주겠네. 가는 길에 읽어 보게. 도시 값이 실려 있지. 길을 나서면 하루에 한 사람이 식량 하나를 먹는다네. 이제 {destTo} 떠나 보게. 지도에서 마을을 누르면 된다네."',
  },
];

export const sceneDef = (id: SceneId): SceneDef => SCENES.find((s) => s.id === id)!;

export function nextScene(id: SceneId): SceneId | null {
  const i = SCENES.findIndex((s) => s.id === id);
  return SCENES[i + 1]?.id ?? null;
}
