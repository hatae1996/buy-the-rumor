// 산과 광산 지형 카드 (광석). 광석을 캐는 선택지는 도구 1개를 쓴다.
import type { CardDef } from '../types';
import { maybe, pass, rest, T } from './helpers';

export const MOUNTAIN_CARDS: readonly CardDef[] = [
  {
    id: 'vein',
    title: '광맥 줄기',
    text: '바위 틈으로 녹슨 빛깔의 줄기가 비친다.',
    sources: [T('ore')],
    copies: 2,
    choices: [
      { label: '캔다', needs: { tool: 1 }, fatigue: 4, success: [{ kind: 'goods', good: 'ore', min: 2, max: 2, from: 'ore' }] },
      { label: '위치를 기억한다', fatigue: 1, success: [{ kind: 'leave', card: 'markedVein' }] },
    ],
  },
  {
    id: 'collapsed',
    title: '무너진 갱도',
    text: '옛 갱도 입구가 돌에 반쯤 막혀 있다. 천장에서 흙이 부슬부슬 떨어진다.',
    sources: [T('ore')],
    danger: true,
    choices: [
      {
        label: '들어간다',
        fatigue: 3,
        success: [{ kind: 'goods', good: 'ore', min: 3, max: 3, from: 'ore' }, maybe(0.2, { kind: 'hurt' })],
      },
      pass('돌아선다'),
    ],
  },
  {
    id: 'creek',
    title: '반짝이는 개울',
    text: '개울 바닥 모래 사이로 무언가 반짝인다.',
    sources: [T('ore')],
    choices: [{ label: '체로 거른다', fatigue: 2, success: [{ kind: 'goods', good: 'ore', min: 1, max: 1, from: 'ore' }] }, rest('물을 마신다')],
  },
  {
    id: 'rockfall',
    title: '낙석',
    text: '머리 위에서 돌 구르는 소리가 난다.',
    sources: [T('ore')],
    danger: true,
    choices: [pass('돌아간다', 1), { label: '서둘러 지나간다', fatigue: 0, success: [maybe(0.3, { kind: 'loseHaul', fraction: 0.3 })] }],
  },
  {
    id: 'hut',
    title: '버려진 오두막',
    text: '지붕이 내려앉은 광부 오두막. 문이 반쯤 열려 있다.',
    sources: [T('ore'), T('forest')],
    choices: [{ label: '뒤진다', fatigue: 1, success: [maybe(0.4, { kind: 'goods', good: 'tools', min: 1, max: 1 })] }, rest('쉰다', -2)],
  },
  {
    id: 'oldMiner',
    title: '늙은 광부',
    text: '곡괭이에 기대 선 노인이 산을 올려다본다. 이 산을 누구보다 잘 안다고 한다.',
    sources: [T('ore')],
    choices: [
      { label: '이야기를 듣는다', fatigue: 0, success: [{ kind: 'rumor', topic: 'ore' }] },
      { label: '길을 묻는다', fatigue: 0, success: [{ kind: 'link', card: 'vein' }] },
    ],
  },
  {
    id: 'miner',
    title: '광부들',
    text: '갱도 앞에서 광부들이 점심을 먹고 있다.',
    sources: [T('ore')],
    choices: [{ label: '말을 건다', fatigue: 0, success: [{ kind: 'rumor', topic: 'ore' }] }, rest('같이 쉰다')],
  },
];
