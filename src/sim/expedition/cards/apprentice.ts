// 견습 첫 원정 카드 (기획서 "첫 5분의 흐름" 2장면): 쉬운 카드 3장, 반드시 성공한다.
// 어느 쪽을 골라도 무언가 얻고, 확률도 자원지도 따지지 않는다. 다른 덱에는 들어가지 않는다.
// 얻는 짐은 모양이 다 달라 등짐(3×3)을 채우는 손맛이 있다 (목재 1×3, 가죽 가로 2칸, 고기 세로 2칸).
// 무엇을 골라도 9칸 안에 다 들어간다 (가장 많이 얻어도 7칸).
import type { CardDef } from '../types';

const ONLY_SCRIPTED = [{ kind: 'linked' }] as const;

export const APPRENTICE_DECK = ['appBranches', 'appTrap', 'appClearing'] as const;

export const APPRENTICE_CARDS: readonly CardDef[] = [
  {
    id: 'appBranches',
    title: '꺾인 나뭇가지',
    text: '간밤 바람에 굵은 가지가 꺾여 길가에 떨어져 있다.',
    sources: [...ONLY_SCRIPTED],
    choices: [
      { label: '주워 간다', fatigue: 1, success: [{ kind: 'goods', good: 'wood', min: 1, max: 1 }] },
      { label: '쪼개서 묶는다', fatigue: 2, success: [{ kind: 'goods', good: 'wood', min: 2, max: 2 }] },
    ],
  },
  {
    id: 'appTrap',
    title: '사냥꾼의 덫',
    text: '"걸린 게 있으면 가져가게." 사냥꾼이 손을 흔들며 지나간다.',
    sources: [...ONLY_SCRIPTED],
    choices: [
      { label: '가죽만 챙긴다', fatigue: 1, success: [{ kind: 'goods', good: 'leather', min: 2, max: 2 }] },
      {
        label: '모두 챙긴다',
        fatigue: 2,
        success: [
          { kind: 'goods', good: 'leather', min: 1, max: 1 },
          { kind: 'goods', good: 'meat', min: 1, max: 1 },
        ],
      },
    ],
  },
  {
    id: 'appClearing',
    title: '햇볕 드는 빈터',
    text: '나무 사이로 볕이 든다. 그루터기 옆에 누가 두고 간 가죽 한 장이 보인다.',
    sources: [...ONLY_SCRIPTED],
    choices: [
      { label: '가죽을 챙긴다', fatigue: 0, success: [{ kind: 'goods', good: 'leather', min: 1, max: 1 }] },
      { label: '쉬어 간다', fatigue: -2, success: [] },
    ],
  },
];
