// 숲 지형 카드 (목재, 고기, 가죽). 기획서 "원정 카드 목록 (초안)"의 숲 + 0.0.3에서 만든 숲 카드.
import type { CardDef } from '../types';
import { pass, rest, T, turnBack } from './helpers';

export const FOREST_CARDS: readonly CardDef[] = [
  {
    id: 'tracks',
    title: '사슴 발자국',
    text: '젖은 흙에 갈라진 발굽 자국이 이어진다. 아직 따뜻하다.',
    sources: [T('forest')],
    copies: 2,
    choices: [
      { label: '따라간다', fatigue: 2, success: [{ kind: 'link', card: 'deerHerd' }] },
      pass('무시한다'),
    ],
  },
  {
    id: 'deerHerd',
    title: '사슴 무리',
    text: '빈터에서 사슴 여럿이 풀을 뜯는다. 바람이 이쪽으로 분다.',
    sources: [{ kind: 'linked' }],
    choices: [
      {
        label: '다가간다',
        fatigue: 3,
        chance: { base: 0.45, node: 'forest', nodeWeight: 0.5 },
        success: [
          { kind: 'goods', good: 'meat', min: 1, max: 1, from: 'forest', boost: 'deer' },
          { kind: 'goods', good: 'leather', min: 1, max: 1, from: 'forest' },
        ],
        failure: [],
      },
      { label: '지켜본다', fatigue: 0, success: [{ kind: 'rumor', topic: 'deer' }] },
      {
        label: '멀리서 쏜다',
        needs: { gear: 'bow' },
        fatigue: 2,
        chance: { base: 0.85, node: 'forest', nodeWeight: 0.2 },
        success: [
          { kind: 'goods', good: 'meat', min: 1, max: 2, from: 'forest', boost: 'deer' },
          { kind: 'goods', good: 'leather', min: 1, max: 1, from: 'forest' },
        ],
        failure: [],
      },
    ],
  },
  {
    id: 'log',
    title: '쓰러진 고목',
    text: '바람에 넘어진 참나무가 길을 막고 있다.',
    sources: [T('forest')],
    choices: [{ label: '쪼갠다', fatigue: 3, success: [{ kind: 'goods', good: 'wood', min: 2, max: 2, from: 'forest' }] }, pass()],
  },
  {
    id: 'oak',
    title: '곧은 참나무',
    text: '하늘로 곧게 뻗은 참나무. 좋은 목재가 되겠다.',
    sources: [T('forest')],
    choices: [
      { label: '벤다', needs: { tool: 1 }, fatigue: 4, success: [{ kind: 'goods', good: 'wood', min: 3, max: 3, from: 'forest' }] },
      { label: '표시해 둔다', fatigue: 1, success: [{ kind: 'leave', card: 'markedTree' }] },
    ],
  },
  {
    id: 'rabbit',
    title: '덤불 속 토끼',
    text: '덤불이 바스락거린다. 긴 귀가 쫑긋 솟았다.',
    sources: [T('forest')],
    choices: [
      {
        label: '잡는다',
        fatigue: 1,
        chance: { base: 0.8 },
        success: [{ kind: 'goods', good: 'meat', min: 1, max: 1, from: 'forest' }],
        failure: [],
      },
      pass('무시한다'),
    ],
  },
  {
    id: 'fork',
    title: '갈림길',
    text: '길이 둘로 갈린다. 한쪽은 더 깊은 곳으로 이어진다.',
    sources: [T('forest'), T('ore')],
    choices: [{ label: '깊이 들어간다', fatigue: 1, success: [{ kind: 'more', cards: 1 }] }, turnBack()],
  },
  {
    id: 'hunter',
    title: '다른 사냥꾼',
    text: '맞은편 덤불에서 활을 든 사냥꾼이 고개를 내민다.',
    sources: [T('forest')],
    choices: [
      { label: '말을 건다', fatigue: 0, success: [{ kind: 'rumor', topic: 'deer' }] },
      {
        label: '먼저 쏜다',
        fatigue: 1,
        chance: { base: 0.5 },
        success: [{ kind: 'goods', good: 'meat', min: 2, max: 2, from: 'forest', boost: 'deer' }],
        failure: [],
      },
    ],
  },
  {
    id: 'rain',
    title: '비가 쏟아진다',
    text: '갑자기 하늘이 어두워지고 빗줄기가 굵어진다.',
    sources: [T('forest'), T('field')],
    choices: [{ label: '비를 피해 쉰다', fatigue: -2, success: [{ kind: 'skip', cards: 1 }] }, rest('맞으며 간다', 1)],
  },
];
