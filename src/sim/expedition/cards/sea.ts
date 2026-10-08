// 바다와 해안 지형 카드 (생선, 소금). 그물이 있으면 물고기 카드의 생선이 1 더 나온다.
import type { CardDef } from '../types';
import { maybe, pass, rest, T } from './helpers';

export const SEA_CARDS: readonly CardDef[] = [
  {
    id: 'school',
    title: '물고기 떼',
    text: '물빛이 은빛으로 반짝인다. 떼가 몰려온다.',
    sources: [T('fish')],
    copies: 2,
    choices: [
      { label: '그물을 던진다', fatigue: 3, success: [{ kind: 'goods', good: 'fish', min: 2, max: 3, from: 'fish', boost: 'net' }] },
      { label: '지켜본다', fatigue: 0, success: [{ kind: 'rumor', topic: 'fish' }] },
    ],
  },
  {
    id: 'reefZone',
    title: '암초 지대',
    text: '물속 바위 사이로 큰 고기들이 드나든다. 그물이 걸리기 쉽다.',
    sources: [T('fish')],
    danger: true,
    choices: [
      {
        label: '들어간다',
        fatigue: 2,
        success: [
          { kind: 'goods', good: 'fish', min: 3, max: 3, from: 'fish', boost: 'net' },
          maybe(0.35, { kind: 'breakGear', gear: 'net', uses: 3 }),
        ],
      },
      pass('돌아간다'),
    ],
  },
  {
    id: 'mudflat',
    title: '썰물 갯벌',
    text: '물이 빠진 갯벌에 조개 숨구멍이 송송 나 있다.',
    sources: [T('fish')],
    choices: [{ label: '조개를 줍는다', fatigue: 1, success: [{ kind: 'goods', good: 'fish', min: 1, max: 1 }] }, pass()],
  },
  {
    id: 'wreck',
    title: '난파선 잔해',
    text: '부서진 배 조각이 모래톱에 걸려 있다.',
    sources: [T('fish')],
    choices: [
      {
        label: '뒤진다',
        fatigue: 2,
        success: [
          {
            kind: 'oneOf',
            options: [[{ kind: 'goods', good: 'wood', min: 2, max: 2 }], [{ kind: 'goods', good: 'tools', min: 1, max: 1 }], []],
          },
          { kind: 'rumor', topic: 'market' },
        ],
      },
      pass('무시한다'),
    ],
  },
  {
    id: 'gulls',
    title: '갈매기 떼',
    text: '갈매기들이 한쪽 바다 위를 빙빙 돈다.',
    sources: [T('fish')],
    choices: [{ label: '따라간다', fatigue: 1, success: [{ kind: 'link', card: 'school' }] }, pass('무시한다')],
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
      rest('파도를 보며 쉰다'),
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

  // ───── 염전 ─────
  {
    id: 'saltField',
    title: '염전',
    text: '네모난 소금밭에 물이 말라 하얀 결정이 앉았다.',
    sources: [T('salt')],
    choices: [{ label: '소금을 긁는다', fatigue: 3, success: [{ kind: 'goods', good: 'salt', min: 2, max: 2 }] }, pass()],
  },
  {
    id: 'saltPan',
    title: '소금 긁기',
    text: '말라붙은 염전에 하얀 결정이 반짝인다.',
    sources: [T('salt')],
    choices: [{ label: '긁어모은다', fatigue: 2, success: [{ kind: 'goods', good: 'salt', min: 2, max: 3 }] }, rest('그늘에서 쉰다')],
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
];
