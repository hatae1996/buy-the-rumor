// 지역 특색 카드: 맵을 만들 때 그 지역에 붙는 특징 (곰이 사는 숲, 산적 길, 늑대 산, 목장 등).
// 횃불이 있으면 곰과 늑대를 쫓는 선택지가, 말이 있으면 말을 타고 빠져나오는 선택지가 열린다.
import type { CardDef } from '../types';
import { EV, maybe, pass, TAG, turnBack } from './helpers';

export const REGIONAL_CARDS: readonly CardDef[] = [
  // ───── 곰이 사는 숲 ─────
  {
    id: 'bearTracks',
    title: '곰 발자국',
    text: '어른 손바닥보다 큰 발자국. 나무껍질이 높이 긁혀 있다.',
    sources: [TAG('bears')],
    choices: [{ label: '따라가 본다', fatigue: 2, success: [{ kind: 'link', card: 'bear' }] }, pass('멀리 돌아간다', 1)],
  },
  {
    id: 'bear',
    title: '곰과 마주침',
    text: '덤불이 갈라지고 곰이 일어선다.',
    sources: [{ kind: 'linked' }],
    danger: true,
    choices: [
      {
        label: '소리치며 맞선다',
        fatigue: 3,
        chance: { base: 0.45 },
        success: [
          { kind: 'goods', good: 'leather', min: 2, max: 3 },
          { kind: 'goods', good: 'meat', min: 3, max: 4 },
        ],
        failure: [{ kind: 'hurt' }, { kind: 'loseHaul', fraction: 0.5 }, { kind: 'end' }],
      },
      { label: '도망친다', fatigue: 2, success: [{ kind: 'loseHaul', fraction: 0.3 }, { kind: 'end' }] },
      { label: '횃불로 쫓아낸다', needs: { gear: 'torch' }, fatigue: 1, success: [] },
      { label: '말을 타고 빠져나온다', needs: { horse: true }, fatigue: 1, success: [{ kind: 'end' }] },
    ],
  },
  {
    id: 'honeyBear',
    title: '꿀통을 노리는 곰',
    text: '나무 위 벌통 아래에서 곰이 서성인다. 길이 그 옆으로 나 있다.',
    sources: [TAG('bears')],
    danger: true,
    choices: [
      pass('곰이 갈 때까지 기다린다', 2),
      { label: '옆으로 지나간다', fatigue: 0, success: [maybe(0.5, { kind: 'hurt' }, { kind: 'loseHaul', fraction: 0.25 })] },
      { label: '횃불로 쫓아낸다', needs: { gear: 'torch' }, fatigue: 1, success: [] },
    ],
  },

  // ───── 산적 길 ─────
  {
    id: 'bandits',
    title: '통행세 요구',
    text: '갈림길에서 칼을 찬 사내들이 길을 막는다. "지나가려면 내고 가."',
    sources: [TAG('bandits'), EV('bandits')],
    danger: true,
    choices: [
      { label: '금화를 낸다', fatigue: 0, success: [{ kind: 'pay', gold: 10 }] },
      { label: '돌아간다', fatigue: 3, success: [{ kind: 'end' }] },
    ],
  },

  // ───── 늑대 산 ─────
  {
    id: 'wolfHowl',
    title: '늑대 울음',
    text: '언덕 너머에서 길게 늘어지는 울음소리가 들린다.',
    sources: [TAG('wolves')],
    choices: [{ label: '계속 간다', fatigue: 1, success: [{ kind: 'link', card: 'wolfPack' }] }, turnBack()],
  },
  {
    id: 'wolfPack',
    title: '늑대 무리',
    text: '나무 사이로 회색 그림자가 스친다. 하나, 둘, 셋…',
    sources: [EV('wolves'), { kind: 'season', season: 3, resource: 'forest' }],
    danger: true,
    choices: [
      { label: '고기를 던져 주고 지나간다', fatigue: 1, success: [{ kind: 'loseHaul', good: 'meat', fraction: 0.5 }] },
      {
        label: '버틴다',
        fatigue: 2,
        chance: { base: 0.55 },
        success: [],
        failure: [{ kind: 'hurt' }, { kind: 'loseHaul', fraction: 0.5 }],
      },
      { label: '횃불로 쫓는다', needs: { gear: 'torch' }, fatigue: 1, success: [] },
      { label: '말 덕분에 도망친다', needs: { horse: true }, fatigue: 0, success: [{ kind: 'end' }] },
    ],
  },

  // ───── 풍부한 어장, 암초 ─────
  {
    id: 'silverRun',
    title: '은빛 떼',
    text: '바다가 통째로 끓는 것 같다. 은빛 고기 떼가 해안까지 밀려왔다.',
    sources: [TAG('shoals'), EV('bigCatch')],
    choices: [{ label: '그물을 크게 친다', fatigue: 3, success: [{ kind: 'goods', good: 'fish', min: 4, max: 4, from: 'fish', boost: 'net' }] }, pass()],
  },
  {
    id: 'reef',
    title: '암초 사이',
    text: '암초 사이로 큰 고기들이 숨어 든다. 배가 긁히기 쉽다.',
    sources: [TAG('reef')],
    danger: true,
    choices: [
      {
        label: '배를 몰아 들어간다',
        fatigue: 2,
        chance: { base: 0.5 },
        success: [{ kind: 'goods', good: 'fish', min: 3, max: 4, from: 'fish', boost: 'net' }],
        failure: [{ kind: 'skip', cards: 1 }, maybe(0.5, { kind: 'breakGear', gear: 'net', uses: 3 })],
      },
      pass('돌아 나온다'),
    ],
  },

  // ───── 깊은 광맥 ─────
  {
    id: 'exposedVein',
    title: '노천 광맥',
    text: '깎인 비탈에 광맥이 그대로 드러나 있다. 손으로도 떼어 낼 만하다.',
    sources: [TAG('exposedVein'), EV('newVein')],
    choices: [
      { label: '떼어 낸다', fatigue: 2, success: [{ kind: 'goods', good: 'ore', min: 2, max: 2, from: 'ore' }] },
      { label: '소문만 들고 간다', fatigue: 0, success: [{ kind: 'rumor', topic: 'ore' }] },
    ],
  },

  // ───── 아름드리 고목 숲 ─────
  {
    id: 'oldGrowth',
    title: '아름드리 고목',
    text: '세 사람이 팔을 벌려야 안을 만한 나무가 바람에 꺾여 있다.',
    sources: [TAG('oldGrowth')],
    choices: [
      { label: '베어 낸다', needs: { tool: 1 }, fatigue: 3, success: [{ kind: 'goods', good: 'wood', min: 3, max: 4, from: 'forest' }] },
      pass(),
    ],
  },

  // ───── 비옥한 땅 ─────
  {
    id: 'bumper',
    title: '풍년 밭',
    text: '이삭이 고개를 푹 숙였다. 올해는 넉넉하다.',
    sources: [TAG('fertile'), EV('bumperHarvest')],
    choices: [{ label: '거든다', fatigue: 1, success: [{ kind: 'goods', good: 'grain', min: 2, max: 2, boost: 'farm' }] }, pass()],
  },

  // ───── 목장 ─────
  {
    id: 'ranchHand',
    title: '목장 일손',
    text: '울타리를 고치던 목동이 손짓한다. "하루 품삯은 넉넉히 주지."',
    sources: [TAG('ranch')],
    choices: [{ label: '일한다', fatigue: 3, success: [{ kind: 'earn', gold: 8 }] }, pass()],
  },
  {
    id: 'looseFoal',
    title: '풀린 망아지',
    text: '울타리 밖에서 망아지 한 마리가 풀을 뜯고 있다. 목장 낙인이 찍혀 있다.',
    sources: [TAG('ranch')],
    choices: [{ label: '목장에 돌려준다', fatigue: 1, success: [{ kind: 'rumor', topic: 'horse' }] }, pass()],
  },
];
