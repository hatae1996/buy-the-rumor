// 들은 주장을 말로. 숫자는 흐려진 정도에 따라 "48" → "40은 넘는다" → "금값"으로 뭉개진다.
// 신문과 달리 소문은 말투가 섞인다. 성격은 말투로 드러내지 않는다 (겁쟁이만 나쁜 소식을 크게 말한다).
import { GOOD_NAME } from '../economy/goods';
import { eventDef } from '../events/defs';
import { eulReul, iGa, numEunNeun } from '../josa';
import { regionTag, type WorldMap } from '../worldgen';
import type { Claim, NodeRumorKind } from './types';

export interface TellFlavor {
  /** 크게 말한다 (부풀린 소문, 겁쟁이의 나쁜 소식) */
  strong: boolean;
  /** 겁을 낸다 (나쁜 소식에 한마디 더) */
  scared: boolean;
}

const NODE_TEXT: Record<NodeRumorKind, Record<'low' | 'high', [string, string]>> = {
  // [보통, 크게]
  forest: {
    low: ['요즘 {t} 사냥꾼들이 빈손으로 돌아온다더라.', '{t} 숲에 짐승 씨가 말랐다더라.'],
    high: ['{t} 숲에 사냥감이 넉넉하다더군.', '{t} 숲에 사슴이 넘쳐 난다더군.'],
  },
  fish: {
    low: ['{t} 앞바다 고기가 예전 같지 않다더라.', '{t} 앞바다 고기 씨가 말랐다더라.'],
    high: ['올해 {t} 앞바다엔 고기가 많다더군.', '{t} 앞바다에 고기 떼가 새까맣다더군.'],
  },
  ore: {
    low: ['{t} 광맥이 바닥을 보인다더라.', '{t} 광맥이 다 말라 버렸다더라.'],
    high: ['{t} 광맥이 아직 실하다더군.', '{t} 광맥이 끝이 없다더군.'],
  },
};

export function claimText(claim: Claim, map: WorldMap, flavor: TellFlavor = { strong: false, scared: false }): string {
  const t = map.towns[claim.town]!.name;
  const body = claimBody(claim, t, flavor);
  return `"${body}${flavor.scared ? ' 큰일이야.' : ''}"`;
}

function claimBody(claim: Claim, t: string, flavor: TellFlavor): string {
  switch (claim.kind) {
    case 'omen':
      return `${t} 쪽에서 ${eventDef(claim.event).omen ?? '이상한 일이 생긴다더라.'}`;
    case 'node':
      return NODE_TEXT[claim.resource][claim.level][flavor.strong ? 1 : 0].replace('{t}', t);
    case 'price': {
      const g = iGa(GOOD_NAME[claim.good]);
      if (claim.price === null || claim.bound === null) return `${t}에서 ${g} ${claim.dir === 'high' ? '금값' : '헐값'}이래.`;
      if (claim.bound === 'atLeast') return `${t}에서 ${g} ${numEunNeun(claim.price)} 넘는다더라.`;
      if (claim.bound === 'atMost') return `${t}에서 ${g} ${claim.price}도 안 한다더라.`;
      return claim.dir === 'high' ? `${t}에서 ${g} ${claim.price}에 팔린다더군.` : `${t}에서 ${g} ${claim.price}밖에 안 한다더라.`;
    }
    case 'orders': {
      const name = GOOD_NAME[claim.good];
      if (claim.side === 'buy') {
        return claim.qty === null
          ? `${t} 장에 ${name} 사려는 사람이 많다더라.`
          : `${t} 장에 ${eulReul(name)} ${claim.qty}개쯤 더 사려는 사람들이 있다더군.`;
      }
      return claim.qty === null ? `${t} 장에 ${iGa(name)} 남아돈다더라.` : `${t} 장에 ${iGa(name)} ${claim.qty}개쯤 안 팔리고 남는다더라.`;
    }
    case 'trait':
      return `${t} 근처에 ${iGa(regionTag(claim.tag).name)} 있다더라.`;
  }
}
