// 원정 카드 목록. 숫자(피로, 확률, 얻는 양)는 초안이며 돌려보며 맞춘다.
// 숲 카드는 prototypes/expedition.html에서 옮겼고, 나머지 지형은 같은 틀로 새로 썼다.
import type { CardDef } from './types';

const T = (resource: 'forest' | 'ore' | 'fish' | 'field' | 'salt') => ({ kind: 'terrain', resource }) as const;

export const CARDS: readonly CardDef[] = [
  // ───────── 숲 ─────────
  {
    id: 'tracks',
    title: '사슴 발자국',
    text: '젖은 흙에 갈라진 발굽 자국이 이어진다. 아직 따뜻하다.',
    sources: [T('forest')],
    copies: 2,
    choices: [
      {
        label: '조용히 따라간다',
        fatigue: 2,
        chance: { base: 0.3, node: 'forest', nodeWeight: 0.5 },
        success: [
          { kind: 'goods', good: 'meat', min: 2, max: 3, from: 'forest' },
          { kind: 'goods', good: 'leather', min: 1, max: 1, from: 'forest' },
        ],
        failure: [],
      },
      { label: '지나친다', fatigue: 0, success: [] },
    ],
  },
  {
    id: 'log',
    title: '쓰러진 고목',
    text: '바람에 넘어진 참나무가 길을 막고 있다.',
    sources: [T('forest')],
    choices: [
      { label: '쪼개서 땔감으로', fatigue: 3, success: [{ kind: 'goods', good: 'wood', min: 2, max: 2, from: 'forest' }] },
      { label: '걸터앉아 쉰다', fatigue: -1, success: [] },
    ],
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
        success: [{ kind: 'goods', good: 'meat', min: 2, max: 2, from: 'forest' }],
        failure: [],
      },
    ],
  },
  {
    id: 'fawn',
    title: '어린 사슴',
    text: '어미 곁에서 비틀거리는 새끼 사슴. 봄이다.',
    sources: [{ kind: 'season', season: 0, resource: 'forest' }],
    choices: [
      { label: '보내 준다', fatigue: 0, success: [{ kind: 'rumor', topic: 'deer' }] },
      { label: '잡는다', fatigue: 1, success: [{ kind: 'goods', good: 'meat', min: 1, max: 1, from: 'forest' }] },
    ],
  },
  {
    id: 'fatDeer',
    title: '살찐 사슴',
    text: '도토리를 잔뜩 먹은 사슴이 느릿느릿 걷는다. 사냥하기 가장 좋은 철이다.',
    sources: [{ kind: 'season', season: 2, resource: 'forest' }],
    choices: [
      {
        label: '쫓는다',
        fatigue: 2,
        chance: { base: 0.6, node: 'forest', nodeWeight: 0.3 },
        success: [
          { kind: 'goods', good: 'meat', min: 3, max: 4, from: 'forest' },
          { kind: 'goods', good: 'leather', min: 1, max: 2, from: 'forest' },
        ],
        failure: [],
      },
      { label: '지나친다', fatigue: 0, success: [] },
    ],
  },
  {
    id: 'snowBrush',
    title: '눈 덮인 덤불',
    text: '토끼 굴이 보인다. 눈 위에 발자국이 어지럽다.',
    sources: [{ kind: 'season', season: 3, resource: 'forest' }],
    choices: [
      { label: '덫을 놓고 간다', fatigue: 2, success: [{ kind: 'leave', card: 'checkTrap' }] },
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
    id: 'checkTrap',
    title: '놓아 둔 덫',
    text: '지난번에 놓아 둔 덫이 있는 자리다.',
    sources: [{ kind: 'mine' }],
    choices: [
      { label: '덫을 확인한다', fatigue: 1, success: [{ kind: 'goods', good: 'meat', min: 2, max: 2, from: 'forest' }] },
      { label: '그대로 둔다', fatigue: 0, success: [{ kind: 'leave', card: 'checkTrap' }] },
    ],
  },
  {
    id: 'wolfPack',
    title: '늑대 무리',
    text: '나무 사이로 회색 그림자가 스친다. 하나, 둘, 셋…',
    sources: [{ kind: 'event', event: 'wolves' }, { kind: 'tag', tag: 'wolves' }, { kind: 'season', season: 3, resource: 'forest' }],
    choices: [
      { label: '돌아간다', fatigue: 0, success: [{ kind: 'end' }] },
      {
        label: '버틴다',
        fatigue: 2,
        chance: { base: 0.55 },
        success: [],
        failure: [{ kind: 'loseHaul', good: 'meat', fraction: 0.5 }],
      },
    ],
  },
  {
    id: 'bearTracks',
    title: '곰 발자국',
    text: '어른 손바닥보다 큰 발자국. 나무껍질이 높이 긁혀 있다.',
    sources: [{ kind: 'tag', tag: 'bears' }],
    choices: [
      { label: '따라가 본다', fatigue: 2, success: [{ kind: 'link', card: 'bear' }] },
      { label: '멀리 돌아간다', fatigue: 1, success: [] },
    ],
  },
  {
    id: 'bear',
    title: '곰과 마주침',
    text: '덤불이 갈라지고 곰이 일어선다.',
    sources: [{ kind: 'linked' }],
    choices: [
      {
        label: '소리치며 맞선다',
        fatigue: 3,
        chance: { base: 0.45 },
        success: [
          { kind: 'goods', good: 'leather', min: 2, max: 3 },
          { kind: 'goods', good: 'meat', min: 3, max: 4 },
        ],
        failure: [{ kind: 'loseHaul', fraction: 0.5 }, { kind: 'end' }],
      },
      { label: '천천히 물러난다', fatigue: 1, success: [{ kind: 'end' }] },
    ],
  },
  {
    id: 'oldGrowth',
    title: '아름드리 고목',
    text: '세 사람이 팔을 벌려야 안을 만한 나무가 바람에 꺾여 있다.',
    sources: [{ kind: 'tag', tag: 'oldGrowth' }],
    choices: [
      { label: '베어 낸다', fatigue: 3, success: [{ kind: 'goods', good: 'wood', min: 3, max: 4, from: 'forest' }] },
      { label: '지나친다', fatigue: 0, success: [] },
    ],
  },
  {
    id: 'rain',
    title: '비가 쏟아진다',
    text: '갑자기 하늘이 어두워지고 빗줄기가 굵어진다.',
    sources: [T('forest'), T('field')],
    choices: [
      { label: '비를 피해 쉰다', fatigue: -2, success: [{ kind: 'skip', cards: 1 }] },
      { label: '맞으며 간다', fatigue: 1, success: [] },
    ],
  },

  // ───────── 광산 ─────────
  {
    id: 'vein',
    title: '광맥 줄기',
    text: '바위 틈으로 녹슨 빛깔의 줄기가 비친다.',
    sources: [T('ore')],
    copies: 2,
    choices: [
      {
        label: '곡괭이로 캔다',
        fatigue: 3,
        chance: { base: 0.4, node: 'ore', nodeWeight: 0.5 },
        success: [{ kind: 'goods', good: 'ore', min: 2, max: 3, from: 'ore' }],
        failure: [],
      },
      { label: '표시만 해 둔다', fatigue: 1, success: [{ kind: 'leave', card: 'markedVein' }] },
    ],
  },
  {
    id: 'markedVein',
    title: '표시해 둔 광맥',
    text: '지난번에 돌을 쌓아 표시해 둔 자리다.',
    sources: [{ kind: 'mine' }],
    choices: [
      { label: '캔다', fatigue: 2, success: [{ kind: 'goods', good: 'ore', min: 3, max: 3, from: 'ore' }] },
      { label: '다음에 캔다', fatigue: 0, success: [{ kind: 'leave', card: 'markedVein' }] },
    ],
  },
  {
    id: 'collapsed',
    title: '무너진 갱도',
    text: '옛 갱도 입구가 돌에 반쯤 막혀 있다.',
    sources: [T('ore')],
    choices: [
      {
        label: '치우고 들어간다',
        fatigue: 3,
        chance: { base: 0.5 },
        success: [{ kind: 'goods', good: 'ore', min: 3, max: 4, from: 'ore' }],
        failure: [{ kind: 'skip', cards: 1 }],
      },
      { label: '돌 부스러기만 줍는다', fatigue: 1, success: [{ kind: 'goods', good: 'ore', min: 1, max: 1, from: 'ore' }] },
    ],
  },
  {
    id: 'miner',
    title: '광부들',
    text: '갱도 앞에서 광부들이 점심을 먹고 있다.',
    sources: [T('ore')],
    choices: [
      { label: '말을 건다', fatigue: 0, success: [{ kind: 'rumor', topic: 'ore' }] },
      { label: '같이 쉰다', fatigue: -1, success: [] },
    ],
  },
  {
    id: 'exposedVein',
    title: '드러난 광맥',
    text: '산사태로 깎인 비탈에 광맥이 그대로 드러나 있다.',
    sources: [{ kind: 'tag', tag: 'exposedVein' }, { kind: 'event', event: 'newVein' }],
    choices: [
      { label: '캔다', fatigue: 2, success: [{ kind: 'goods', good: 'ore', min: 3, max: 4, from: 'ore' }] },
      { label: '소문만 들고 간다', fatigue: 0, success: [{ kind: 'rumor', topic: 'ore' }] },
    ],
  },
  {
    id: 'icyPath',
    title: '얼어붙은 산길',
    text: '바위마다 살얼음이 끼었다. 한 걸음 한 걸음이 미끄럽다.',
    sources: [{ kind: 'season', season: 3, resource: 'ore' }],
    choices: [
      { label: '조심해서 간다', fatigue: 2, success: [] },
      { label: '돌아간다', fatigue: 0, success: [{ kind: 'end' }] },
    ],
  },

  // ───────── 바다 (어장) ─────────
  {
    id: 'school',
    title: '물고기 떼',
    text: '물빛이 은빛으로 반짝인다. 떼가 몰려온다.',
    sources: [T('fish')],
    copies: 2,
    choices: [
      {
        label: '그물을 던진다',
        fatigue: 2,
        chance: { base: 0.35, node: 'fish', nodeWeight: 0.5 },
        success: [{ kind: 'goods', good: 'fish', min: 2, max: 4, from: 'fish' }],
        failure: [],
      },
      { label: '지켜본다', fatigue: 0, success: [{ kind: 'rumor', topic: 'fish' }] },
    ],
  },
  {
    id: 'rockFishing',
    title: '바위 낚시',
    text: '파도가 부서지는 바위 끝에 자리가 하나 비어 있다.',
    sources: [T('fish')],
    choices: [
      {
        label: '낚싯대를 드리운다',
        fatigue: 1,
        chance: { base: 0.6 },
        success: [{ kind: 'goods', good: 'fish', min: 1, max: 2, from: 'fish' }],
        failure: [],
      },
      { label: '파도를 보며 쉰다', fatigue: -1, success: [] },
    ],
  },
  {
    id: 'fisherman',
    title: '늙은 어부',
    text: '그물을 손질하던 어부가 하늘을 올려다본다.',
    sources: [T('fish'), T('salt')],
    choices: [
      { label: '말을 건다', fatigue: 0, success: [{ kind: 'rumor', topic: 'market' }] },
      { label: '그물 손질을 돕는다', fatigue: 2, success: [{ kind: 'goods', good: 'fish', min: 2, max: 2 }] },
    ],
  },
  {
    id: 'reef',
    title: '암초 사이',
    text: '암초 사이로 큰 고기들이 숨어 든다. 배가 긁히기 쉽다.',
    sources: [{ kind: 'tag', tag: 'reef' }],
    choices: [
      {
        label: '배를 몰아 들어간다',
        fatigue: 2,
        chance: { base: 0.5 },
        success: [{ kind: 'goods', good: 'fish', min: 3, max: 4, from: 'fish' }],
        failure: [{ kind: 'skip', cards: 1 }],
      },
      { label: '돌아 나온다', fatigue: 0, success: [] },
    ],
  },
  {
    id: 'shoals',
    title: '물고기 떼가 드는 철',
    text: '이맘때면 이 바닷가로 고기 떼가 찾아든다고 했다.',
    sources: [{ kind: 'tag', tag: 'shoals' }, { kind: 'season', season: 1, resource: 'fish' }],
    choices: [
      { label: '그물을 크게 친다', fatigue: 2, success: [{ kind: 'goods', good: 'fish', min: 3, max: 4, from: 'fish' }] },
      { label: '지나친다', fatigue: 0, success: [] },
    ],
  },
  {
    id: 'storm',
    title: '거센 파도',
    text: '바다가 뒤집힌다. 배들이 모두 뭍에 올라와 있다.',
    sources: [{ kind: 'event', event: 'storm' }],
    choices: [
      { label: '잦아들기를 기다린다', fatigue: -1, success: [{ kind: 'skip', cards: 1 }] },
      {
        label: '배를 띄운다',
        fatigue: 3,
        chance: { base: 0.3 },
        success: [{ kind: 'goods', good: 'fish', min: 3, max: 4, from: 'fish' }],
        failure: [{ kind: 'loseHaul', fraction: 0.5 }, { kind: 'end' }],
      },
    ],
  },
  {
    id: 'frozenHarbor',
    title: '얼어붙은 항구',
    text: '항구가 얼었다. 얼음 위에 구멍을 낸 자리가 몇 군데 보인다.',
    sources: [{ kind: 'season', season: 3, resource: 'fish' }],
    copies: 2,
    choices: [
      {
        label: '얼음 낚시를 한다',
        fatigue: 2,
        chance: { base: 0.4 },
        success: [{ kind: 'goods', good: 'fish', min: 1, max: 1, from: 'fish' }],
        failure: [],
      },
      { label: '돌아간다', fatigue: 0, success: [{ kind: 'end' }] },
    ],
  },

  // ───────── 염전 ─────────
  {
    id: 'saltPan',
    title: '소금 긁기',
    text: '말라붙은 염전에 하얀 결정이 반짝인다.',
    sources: [T('salt')],
    copies: 2,
    choices: [
      { label: '긁어모은다', fatigue: 2, success: [{ kind: 'goods', good: 'salt', min: 2, max: 3 }] },
      { label: '그늘에서 쉰다', fatigue: -1, success: [] },
    ],
  },
  {
    id: 'tide',
    title: '밀물이 온다',
    text: '물이 들어오기 전에 끝내야 한다.',
    sources: [T('salt')],
    choices: [
      { label: '서둘러 긁는다', fatigue: 3, success: [{ kind: 'goods', good: 'salt', min: 2, max: 2 }] },
      { label: '물이 빠지길 기다린다', fatigue: 0, success: [{ kind: 'skip', cards: 1 }] },
    ],
  },
  {
    id: 'scorchingSun',
    title: '뙤약볕',
    text: '염전이 가장 잘 마르는 날이다. 대신 몹시 덥다.',
    sources: [{ kind: 'season', season: 1, resource: 'salt' }],
    choices: [
      { label: '더 긁는다', fatigue: 3, success: [{ kind: 'goods', good: 'salt', min: 3, max: 4 }] },
      { label: '그늘에서 쉰다', fatigue: -1, success: [] },
    ],
  },
  {
    id: 'frozenPan',
    title: '얼어 굳은 염전',
    text: '염전이 얼어붙었다. 겨울엔 소금이 거의 나지 않는다.',
    sources: [{ kind: 'season', season: 3, resource: 'salt' }],
    choices: [
      {
        label: '얼음을 깨서 긁는다',
        fatigue: 3,
        chance: { base: 0.4 },
        success: [{ kind: 'goods', good: 'salt', min: 1, max: 1 }],
        failure: [],
      },
      { label: '돌아간다', fatigue: 0, success: [{ kind: 'end' }] },
    ],
  },

  // ───────── 들판 ─────────
  {
    id: 'gleaning',
    title: '이삭 줍기',
    text: '거두고 남은 이삭이 밭고랑에 떨어져 있다.',
    sources: [T('field')],
    choices: [
      { label: '줍는다', fatigue: 2, success: [{ kind: 'goods', good: 'grain', min: 1, max: 1 }] },
      { label: '지나친다', fatigue: 0, success: [] },
    ],
  },
  {
    id: 'farmer',
    title: '밭의 농부',
    text: '허리를 펴던 농부가 손을 흔든다.',
    sources: [T('field')],
    choices: [
      { label: '말을 건다', fatigue: 0, success: [{ kind: 'rumor', topic: 'harvest' }] },
      { label: '일을 돕는다', fatigue: 3, success: [{ kind: 'goods', good: 'grain', min: 1, max: 2 }] },
    ],
  },
  {
    id: 'harvest',
    title: '추수 날',
    text: '온 마을이 들에 나와 곡식을 벤다. 일손이 모자란다.',
    sources: [{ kind: 'season', season: 2, resource: 'field' }, { kind: 'tag', tag: 'fertile' }],
    choices: [
      { label: '거든다', fatigue: 3, success: [{ kind: 'goods', good: 'grain', min: 2, max: 3 }] },
      { label: '구경만 한다', fatigue: 0, success: [{ kind: 'rumor', topic: 'harvest' }] },
    ],
  },
  {
    id: 'emptyField',
    title: '빈 들판',
    text: '눈 덮인 들에는 바람 소리뿐이다.',
    sources: [{ kind: 'season', season: 3, resource: 'field' }],
    choices: [
      { label: '마른 가지를 줍는다', fatigue: 1, success: [{ kind: 'goods', good: 'wood', min: 1, max: 1 }] },
      { label: '돌아간다', fatigue: 0, success: [{ kind: 'end' }] },
    ],
  },

  // ───────── 길 ─────────
  {
    id: 'bandits',
    title: '통행세',
    text: '갈림길에서 칼을 찬 사내들이 길을 막는다. "지나가려면 내고 가."',
    sources: [{ kind: 'tag', tag: 'bandits' }],
    choices: [
      { label: '돈을 낸다', fatigue: 0, success: [{ kind: 'pay', gold: 10 }] },
      {
        label: '달아난다',
        fatigue: 3,
        chance: { base: 0.6 },
        success: [],
        failure: [{ kind: 'loseHaul', fraction: 0.5 }],
      },
    ],
  },
];

export const cardById = (id: string): CardDef => {
  const c = CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`없는 원정 카드: ${id}`);
  return c;
};
