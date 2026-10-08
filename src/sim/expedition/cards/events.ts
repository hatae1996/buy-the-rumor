// 사건 카드: 신문에 실린 최근 사건이 그 마을 원정 덱에 섞인다 (기획서 사건 표의 "원정 덱" 칸).
import type { CardDef } from '../types';
import { EV, pass, rest, turnBack } from './helpers';

export const EVENT_CARDS: readonly CardDef[] = [
  {
    id: 'brokenRoad',
    title: '무너진 길',
    text: '산사태가 쓸고 간 자리. 길이 흙더미에 묻혔다.',
    sources: [EV('landslide')],
    choices: [
      { label: '돌아간다', fatigue: 0, success: [{ kind: 'skip', cards: 1 }] },
      pass('흙더미를 기어오른다', 3),
    ],
  },
  {
    id: 'blockedShaft',
    title: '막힌 갱도',
    text: '무너진 갱도 앞에 광부들이 모여 웅성거린다.',
    sources: [EV('mineCollapse')],
    deckChange: { remove: { vein: 1 }, add: { collapsed: 1 } },
    choices: [
      {
        label: '돌을 치운다',
        fatigue: 3,
        chance: { base: 0.5 },
        success: [{ kind: 'goods', good: 'ore', min: 2, max: 2, from: 'ore' }],
        failure: [],
      },
      pass('돌아선다'),
    ],
  },
  {
    id: 'storm',
    title: '거센 파도',
    text: '바다가 뒤집힌다. 배들이 모두 뭍에 올라와 있다.',
    sources: [EV('storm')],
    danger: true,
    choices: [
      { label: '잦아들기를 기다린다', fatigue: -1, success: [{ kind: 'skip', cards: 1 }] },
      {
        label: '배를 띄운다',
        fatigue: 3,
        chance: { base: 0.3 },
        success: [{ kind: 'goods', good: 'fish', min: 3, max: 4, from: 'fish' }],
        failure: [{ kind: 'hurt' }, { kind: 'loseHaul', fraction: 0.5 }, { kind: 'end' }],
      },
    ],
  },
  {
    id: 'stormCoast',
    title: '폭풍이 지나간 해안',
    text: '파도가 온갖 것을 해안에 밀어 올려 놓았다.',
    sources: [EV('storm')],
    deckChange: { add: { wreck: 2 } },
    choices: [{ label: '해안을 뒤진다', fatigue: 1, success: [{ kind: 'link', card: 'wreck' }] }, pass()],
  },
  {
    id: 'sickDeer',
    title: '병든 사슴',
    text: '비틀거리는 사슴이 쓰러져 있다. 고기는 먹을 수 없겠다.',
    sources: [EV('animalSickness')],
    choices: [{ label: '가죽을 벗긴다', fatigue: 2, success: [{ kind: 'goods', good: 'leather', min: 1, max: 1 }] }, pass()],
  },
  {
    id: 'dryField',
    title: '메마른 들판',
    text: '가뭄에 이삭이 여물지 못하고 말라 버렸다.',
    sources: [EV('drought')],
    deckChange: { remove: { gleaning: 1 } },
    choices: [
      {
        label: '마른 이삭이라도 줍는다',
        fatigue: 2,
        chance: { base: 0.4 },
        success: [{ kind: 'goods', good: 'grain', min: 1, max: 1 }],
        failure: [],
      },
      turnBack(),
    ],
  },
  {
    id: 'caravan',
    title: '지나가는 상인 행렬',
    text: '짐을 가득 실은 수레가 줄지어 지나간다. 먼 마을 이야기를 잘 아는 사람들이다.',
    sources: [EV('caravan'), EV('boost')],
    choices: [{ label: '이야기를 듣는다', fatigue: 0, success: [{ kind: 'rumor', topic: 'market' }] }, rest('함께 쉬어 간다')],
  },
];
