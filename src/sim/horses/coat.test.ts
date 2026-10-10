// 말의 털색·무늬·이름 (0.1.7 답 130): 말마다 시드로 정해지고, 이름은 지어 줄 수 있다.
import { describe, expect, it } from 'vitest';
import { applyCommand, createEconomy, playerView } from '../economy';
import { generateWorld } from '../worldgen';
import { COAT_IDS, HORSE_NAMES, horseLooks, MARKING_IDS } from './coat';
import type { Horse } from './types';

const map = generateWorld(20261008);
const horse = (id: number): Horse => ({ id, kind: 'pony', fatigue: 0, hungry: 0, price: 100, home: 0 });

describe('말의 털색과 무늬', () => {
  it('같은 세계의 같은 말은 언제나 같고, 말마다 털색 다섯·무늬 넷이 고루 나온다', () => {
    const s = { seed: 77 };
    expect(horseLooks(s, horse(3))).toEqual(horseLooks(s, horse(3)));
    const coats = new Set<string>();
    const marks = new Set<string>();
    for (let id = 1; id <= 200; id++) {
      const l = horseLooks(s, horse(id));
      coats.add(l.coat);
      marks.add(l.marking);
      expect(HORSE_NAMES).toContain(l.name);
      expect(l.named).toBe(false);
    }
    expect([...coats].sort()).toEqual([...COAT_IDS].sort());
    expect([...marks].sort()).toEqual([...MARKING_IDS].sort());
  });

  it('이름을 지어 주면 장부에 그 이름이 보이고, 비우면 처음 이름으로 돌아간다', () => {
    const s = createEconomy(map, 20261008, { apprentice: false });
    const h = horse(s.horses.nextId++);
    s.players.me!.horses.push(h);
    const first = playerView(s, map, 'me').horses[0]!;
    expect(first).toMatchObject({ named: false, coat: horseLooks(s, h).coat, marking: horseLooks(s, h).marking });
    expect(applyCommand(s, map, 'me', { type: 'nameHorse', horseId: h.id, name: '  번개 ' }).ok).toBe(true);
    expect(playerView(s, map, 'me').horses[0]).toMatchObject({ horseName: '번개', named: true, coat: first.coat });
    expect(applyCommand(s, map, 'me', { type: 'nameHorse', horseId: h.id, name: '아주아주긴말의이름' })).toEqual({ ok: false, error: 'badName' });
    expect(applyCommand(s, map, 'me', { type: 'nameHorse', horseId: 999, name: '구름' })).toEqual({ ok: false, error: 'noHorse' });
    expect(applyCommand(s, map, 'me', { type: 'nameHorse', horseId: h.id, name: '' }).ok).toBe(true);
    expect(playerView(s, map, 'me').horses[0]).toMatchObject({ horseName: first.horseName, named: false });
  });
});
