// 들판 지형 카드 (곡물). 수확철에는 농부를 도우면 곡물이 1 더 나온다.
import type { CardDef } from '../types';
import { pass, rest, T } from './helpers';

export const FIELD_CARDS: readonly CardDef[] = [
  {
    id: 'gleaning',
    title: '이삭 줍기',
    text: '거두고 남은 이삭이 밭고랑에 떨어져 있다.',
    sources: [T('field')],
    choices: [{ label: '줍는다', fatigue: 1, success: [{ kind: 'goods', good: 'grain', min: 1, max: 1 }] }, pass()],
  },
  {
    id: 'farmHand',
    title: '일손이 필요한 농부',
    text: '"이보게, 반나절만 거들어 주면 곡식을 나눠 주지."',
    sources: [T('field')],
    choices: [{ label: '돕는다', fatigue: 4, success: [{ kind: 'goods', good: 'grain', min: 3, max: 3, boost: 'farm' }] }, pass('거절한다')],
  },
  {
    id: 'foxDen',
    title: '여우 굴',
    text: '밭둑 아래 굴이 있다. 드나든 흔적이 새롭다.',
    sources: [T('field')],
    choices: [{ label: '덫을 놓는다', needs: { gear: 'trap' }, fatigue: 1, success: [{ kind: 'leave', card: 'checkTrap' }] }, pass()],
  },
  {
    id: 'mill',
    title: '방앗간',
    text: '물레방아가 삐걱이며 돈다. 주인이 밀가루를 털며 나온다.',
    sources: [T('field')],
    choices: [{ label: '방앗간 주인과 이야기한다', fatigue: 0, success: [{ kind: 'rumor', topic: 'harvest' }] }, rest('쉬어 간다')],
  },
  {
    id: 'farmer',
    title: '밭의 농부',
    text: '허리를 펴던 농부가 손을 흔든다.',
    sources: [T('field')],
    choices: [
      { label: '말을 건다', fatigue: 0, success: [{ kind: 'rumor', topic: 'harvest' }] },
      { label: '일을 돕는다', fatigue: 3, success: [{ kind: 'goods', good: 'grain', min: 1, max: 2, boost: 'farm' }] },
    ],
  },
];
