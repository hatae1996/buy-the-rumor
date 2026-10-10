// NPC 얼굴 모음 (0.1.4, 0.1.6 아바타 키트): 이 맵 세계의 얼굴 있는 NPC를 직업별로 모아 보여 준다. 직업마다 옷만 보고 짐작할 수 있는지 본다.
// 시즌 id를 바꾸면 같은 세계의 얼굴이 새로 뽑힌다 (시즌 시드 + NPC 번호).
import { advanceDay, createEconomy, JOB_NAME, type EconomyState } from '../sim/economy';
import { AVAILABLE_PARTS, CLOTH_COLORS, HAIR_COLORS, PARTS, lookKey, worldLooks, worldNpcs, type Look, type LookRole } from '../sim/looks';
import type { WorldMap } from '../sim/worldgen';
import { portraitHtml } from '../ui/portrait/portrait';

const ROLE_NAME: Record<LookRole, string> = {
  ...JOB_NAME,
  innkeeper: '여관 주인',
  merchant: '장 상인',
  cityMerchant: '도시 상인 · NPC 상단',
  villager: '소문꾼',
  elder: '노상인',
};

/** 직업마다 몇 명까지 보여 주나 */
const PER_ROLE = 12;

/** 얼굴에 마우스를 올리면(길게 누르면) 보이는 조합 */
function lookTitle(look: Look): string {
  const cloth = Object.entries(look.cloth)
    .map(([code, c]) => `${code}:${CLOTH_COLORS[c].name}`)
    .join(' ');
  return [
    `${look.male ? '남' : '여'}${look.old ? ' 노인' : ''} · ${look.skin}`,
    `머리 ${look.hair ?? '-'} ${HAIR_COLORS[look.hairColor].name}`,
    `상의 ${look.top} (${cloth})`,
    look.beard ? `수염 ${look.beard}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function mountFacesPanel(root: HTMLElement): { reset(map: WorldMap): void } {
  let map: WorldMap | null = null;
  let season = 1;
  const missing = Object.keys(PARTS).filter((id) => !AVAILABLE_PARTS.has(id));
  root.innerHTML = `
    <h2>NPC 얼굴 (아바타 키트)</h2>
    <p class="dev-note">그림이 있는 파츠만 뽑는다. 아직 그림이 없는 파츠: ${missing.join(', ') || '없음'}.
      키트(assets-src/portrait/avatar-kit/parts)에 넣고 <code>npm run portraits</code>를 돌리면 다음 빌드부터 쓰인다.</p>
    <div class="dev-bar">
      <button type="button" class="dev-btn alt" data-prev>앞 시즌</button>
      <span data-season></span>
      <button type="button" class="dev-btn alt" data-next>다음 시즌</button>
    </div>
    <div data-faces></div>`;
  const out = root.querySelector<HTMLElement>('[data-faces]')!;

  const render = () => {
    if (!map) return;
    const state: EconomyState = createEconomy(map, map.seed, { warmupDays: 20, world: { seasonId: `dev-${season}`, worldId: 'dev' } });
    // 소문꾼은 시즌 첫날 밤에 생긴다
    advanceDay(state, map);
    const looks = worldLooks(state);
    const npcs = worldNpcs(state);
    const unique = new Set([...looks.values()].map(lookKey)).size;
    root.querySelector('[data-season]')!.textContent = `시즌 dev-${season} · ${npcs.length}명 · 겹치는 얼굴 ${looks.size - unique}`;
    const roles = [...new Set(npcs.map((n) => n.role))];
    out.innerHTML = roles
      .map((role) => {
        const of = npcs.filter((n) => n.role === role);
        const faces = of
          .slice(0, PER_ROLE)
          .map((n) => {
            const look = looks.get(`${n.kind}:${n.id}`)!;
            return `<span title="${lookTitle(look)}">${portraitHtml(look, 64, `${ROLE_NAME[role]} ${n.id}`)}</span>`;
          })
          .join('');
        return `<div class="dev-faces"><b>${ROLE_NAME[role]} <small>${of.length}명</small></b><div>${faces}</div></div>`;
      })
      .join('');
  };

  root.querySelector('[data-prev]')!.addEventListener('click', () => {
    season = Math.max(1, season - 1);
    render();
  });
  root.querySelector('[data-next]')!.addEventListener('click', () => {
    season++;
    render();
  });

  return {
    reset(next) {
      map = next;
      render();
    },
  };
}
