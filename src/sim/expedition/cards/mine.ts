// 내 카드: 내가 지난 원정에 남긴 것(놓아 둔 덫, 표시한 나무, 기억한 광맥)과 함께 간 말.
// 활·횃불·그물은 카드가 아니라 다른 카드의 선택지를 연다. 안내인은 여관에서 고용해 나쁜 카드 1장을 건너뛴다.
import type { CardDef } from '../types';
import { EV, rest } from './helpers';

export const MINE_CARDS: readonly CardDef[] = [
  {
    id: 'checkTrap',
    title: '놓아 둔 덫',
    text: '지난번에 놓아 둔 덫이 있는 자리다.',
    sources: [{ kind: 'mine' }],
    choices: [
      { label: '덫을 확인한다', fatigue: 1, success: [{ kind: 'trapCatch' }] },
      { label: '그대로 둔다', fatigue: 0, success: [{ kind: 'leave', card: 'checkTrap' }] },
    ],
  },
  {
    id: 'markedTree',
    title: '표시한 나무',
    text: '지난번에 껍질을 벗겨 표시해 둔 참나무다. 찾느라 헤맬 필요가 없다.',
    sources: [{ kind: 'mine' }],
    choices: [
      { label: '벤다', needs: { tool: 1 }, fatigue: 1, success: [{ kind: 'goods', good: 'wood', min: 3, max: 3, from: 'forest' }] },
      { label: '다음에 벤다', fatigue: 0, success: [{ kind: 'leave', card: 'markedTree' }] },
    ],
  },
  {
    id: 'markedVein',
    title: '기억한 광맥',
    text: '지난번에 돌을 쌓아 표시해 둔 자리다.',
    sources: [{ kind: 'mine' }],
    choices: [
      { label: '캔다', needs: { tool: 1 }, fatigue: 1, success: [{ kind: 'goods', good: 'ore', min: 3, max: 3, from: 'ore' }] },
      { label: '다음에 캔다', fatigue: 0, success: [{ kind: 'leave', card: 'markedVein' }] },
    ],
  },

  // ───── 말 ─────
  {
    id: 'packHorse',
    title: '말에 싣는다',
    text: '말 옆구리에 짐 바구니를 달면 더 많이 실어 올 수 있다.',
    sources: [{ kind: 'horse' }],
    needsHorse: true,
    choices: [{ label: '짐 바구니를 단다', fatigue: 0, success: [{ kind: 'flag', flag: 'packHorse' }] }, rest('말을 쉬게 둔다')],
  },
  {
    id: 'horseSpooked',
    title: '말이 놀람',
    text: '말이 앞발을 치켜들고 날뛴다. 짐 바구니가 흔들린다.',
    sources: [{ kind: 'linked' }, EV('ranchFire')],
    needsHorse: true,
    choices: [
      { label: '달랜다', fatigue: 2, success: [] },
      { label: '놔둔다', fatigue: 0, success: [{ kind: 'loseHaul', fraction: 0.3 }] },
    ],
  },
];
