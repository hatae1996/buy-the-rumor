// 계절 카드. 원정 한 번의 덱에 1~2장 들어온다.
// 무더위·살찐 사슴·수확철·눈 덮인 길은 이번 원정에 상태를 붙이고, 굶주린 늑대는 늑대 무리를 늘린다.
import type { CardDef } from '../types';
import { AUTUMN, pass, rest, S, SPRING, SUMMER, turnBack, WINTER } from './helpers';

export const SEASON_CARDS: readonly CardDef[] = [
  // ───── 봄 ─────
  {
    id: 'fawn',
    title: '어린 사슴',
    text: '어미 곁에서 비틀거리는 새끼 사슴. 봄이다.',
    sources: [S(SPRING, 'forest')],
    choices: [
      { label: '보내 준다', fatigue: 0, success: [{ kind: 'rumor', topic: 'deer' }] },
      { label: '잡는다', fatigue: 1, success: [{ kind: 'goods', good: 'meat', min: 1, max: 1, from: 'forest' }] },
    ],
  },
  {
    id: 'floodCreek',
    title: '불어난 개울',
    text: '눈 녹은 물로 개울이 불었다. 징검다리가 잠겼다.',
    sources: [S(SPRING, 'forest'), S(SPRING, 'field'), S(SPRING, 'ore')],
    choices: [pass('건넌다', 2), turnBack()],
  },

  // ───── 여름 ─────
  {
    id: 'heatwave',
    title: '무더위',
    text: '숨이 턱 막히는 더위. 잡은 것이 금방 상할 날씨다.',
    sources: [S(SUMMER, 'fish'), S(SUMMER, 'forest')],
    choices: [
      { label: '그냥 간다', fatigue: 0, success: [{ kind: 'flag', flag: 'heat' }] },
      { label: '그늘에서 쉬어 간다', fatigue: -1, success: [{ kind: 'skip', cards: 1 }] },
    ],
  },
  {
    id: 'shoals',
    title: '물고기 떼가 드는 철',
    text: '이맘때면 이 바닷가로 고기 떼가 찾아든다고 했다.',
    sources: [S(SUMMER, 'fish')],
    choices: [{ label: '그물을 크게 친다', fatigue: 2, success: [{ kind: 'goods', good: 'fish', min: 3, max: 4, from: 'fish', boost: 'net' }] }, pass()],
  },
  {
    id: 'scorchingSun',
    title: '뙤약볕',
    text: '염전이 가장 잘 마르는 날이다. 대신 몹시 덥다.',
    sources: [S(SUMMER, 'salt')],
    choices: [{ label: '더 긁는다', fatigue: 3, success: [{ kind: 'goods', good: 'salt', min: 3, max: 4 }] }, rest('그늘에서 쉰다')],
  },

  // ───── 가을 ─────
  {
    id: 'fatDeer',
    title: '살찐 사슴',
    text: '도토리를 잔뜩 먹은 사슴이 느릿느릿 걷는다. 오늘은 사슴마다 살이 오른 철이다.',
    sources: [S(AUTUMN, 'forest')],
    choices: [
      {
        label: '쫓는다',
        fatigue: 2,
        chance: { base: 0.6, node: 'forest', nodeWeight: 0.3 },
        success: [
          { kind: 'flag', flag: 'fatDeer' },
          { kind: 'goods', good: 'meat', min: 3, max: 3, from: 'forest', boost: 'deer' },
          { kind: 'goods', good: 'leather', min: 1, max: 2, from: 'forest' },
        ],
        failure: [{ kind: 'flag', flag: 'fatDeer' }],
      },
      { label: '다른 사슴을 찾아본다', fatigue: 0, success: [{ kind: 'flag', flag: 'fatDeer' }] },
    ],
  },
  {
    id: 'harvestTime',
    title: '수확철',
    text: '들마다 낫질 소리가 난다. 어느 집이나 일손이 모자라다.',
    sources: [S(AUTUMN, 'field')],
    choices: [
      { label: '들판으로 간다', fatigue: 1, success: [{ kind: 'flag', flag: 'harvest' }, { kind: 'link', card: 'farmHand' }] },
      pass(),
    ],
  },
  {
    id: 'harvest',
    title: '추수 날',
    text: '온 마을이 들에 나와 곡식을 벤다. 일손이 모자란다.',
    sources: [S(AUTUMN, 'field')],
    choices: [
      { label: '거든다', fatigue: 3, success: [{ kind: 'goods', good: 'grain', min: 2, max: 3, boost: 'farm' }] },
      { label: '구경만 한다', fatigue: 0, success: [{ kind: 'rumor', topic: 'harvest' }] },
    ],
  },

  // ───── 겨울 ─────
  {
    id: 'snowyPath',
    title: '눈 덮인 길',
    text: '발목까지 빠지는 눈. 한 걸음 한 걸음이 무겁다.',
    sources: [S(WINTER, 'forest'), S(WINTER, 'ore'), S(WINTER, 'field')],
    choices: [{ label: '조심해서 간다', fatigue: 0, success: [{ kind: 'flag', flag: 'snow' }] }, turnBack()],
  },
  {
    id: 'frozenCreek',
    title: '얼어붙은 개울',
    text: '개울이 꽁꽁 얼었다. 얼음 아래로 물고기 그림자가 지나간다.',
    sources: [S(WINTER, 'forest')],
    choices: [{ label: '얼음 낚시를 한다', fatigue: 2, success: [{ kind: 'goods', good: 'fish', min: 1, max: 1 }] }, pass()],
  },
  {
    id: 'hungryWolves',
    title: '굶주린 늑대',
    text: '눈 위에 늑대 발자국이 어지럽다. 먹을 게 없는 겨울이다.',
    sources: [S(WINTER, 'forest')],
    deckChange: { add: { wolfPack: 1 } },
    choices: [pass('경계하며 간다', 1), turnBack()],
  },
  {
    id: 'snowBrush',
    title: '눈 덮인 덤불',
    text: '토끼 굴이 보인다. 눈 위에 발자국이 어지럽다.',
    sources: [S(WINTER, 'forest')],
    choices: [
      { label: '덫을 놓고 간다', needs: { gear: 'trap' }, fatigue: 2, success: [{ kind: 'leave', card: 'checkTrap' }] },
      {
        label: '굴을 파 본다',
        fatigue: 2,
        chance: { base: 0.5 },
        success: [
          { kind: 'goods', good: 'meat', min: 1, max: 1, from: 'forest' },
          { kind: 'goods', good: 'leather', min: 1, max: 1, from: 'forest' },
        ],
        failure: [],
      },
    ],
  },
  {
    id: 'icyPath',
    title: '얼어붙은 산길',
    text: '바위마다 살얼음이 끼었다. 한 걸음 한 걸음이 미끄럽다.',
    sources: [S(WINTER, 'ore')],
    choices: [pass('조심해서 간다', 2), turnBack()],
  },
  {
    id: 'frozenHarbor',
    title: '얼어붙은 항구',
    text: '항구가 얼었다. 얼음 위에 구멍을 낸 자리가 몇 군데 보인다.',
    sources: [S(WINTER, 'fish')],
    choices: [
      {
        label: '얼음 낚시를 한다',
        fatigue: 2,
        chance: { base: 0.4 },
        success: [{ kind: 'goods', good: 'fish', min: 1, max: 1, from: 'fish' }],
        failure: [],
      },
      turnBack(),
    ],
  },
  {
    id: 'frozenPan',
    title: '얼어 굳은 염전',
    text: '염전이 얼어붙었다. 겨울엔 소금이 거의 나지 않는다.',
    sources: [S(WINTER, 'salt')],
    choices: [
      {
        label: '얼음을 깨서 긁는다',
        fatigue: 3,
        chance: { base: 0.4 },
        success: [{ kind: 'goods', good: 'salt', min: 1, max: 1 }],
        failure: [],
      },
      turnBack(),
    ],
  },
  {
    id: 'emptyField',
    title: '빈 들판',
    text: '눈 덮인 들에는 바람 소리뿐이다.',
    sources: [S(WINTER, 'field')],
    choices: [{ label: '마른 가지를 줍는다', fatigue: 1, success: [{ kind: 'goods', good: 'wood', min: 1, max: 1 }] }, turnBack()],
  },
];
