// 장비 쪽지 (잡화점의 "장비"): 원정 장비(활, 횃불, 덫, 그물)를 사고, 닳은 장비를 도구로 고친다. 0.1.6: 크림색 쪽지.
import type { GearKind } from '../../sim/expedition';
import { eulReul } from '../../sim/josa';
import { ERROR_TEXT, money } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openSheet } from '../sheet';

/** 장비가 하는 일 (기획서 "내 카드") */
const GEAR_USE: Record<GearKind, string> = {
  bow: '사슴을 멀리서 쏜다',
  torch: '곰과 늑대를 쫓는다',
  trap: '덫을 놓고 다음 원정에 확인한다',
  net: '물고기 카드의 생선 +1',
};

export function openGearSheet(game: Game): void {
  const sheet = openSheet('장비 구입·수리');
  let error = '';
  let done = '';

  const render = () => {
    const v = game.view();
    const rows = v.gear
      .map((g) => {
        const state = g.uses === null ? '없음' : g.uses === 0 ? '망가짐' : `${g.uses}/${g.maxUses}번 남음`;
        const tone = g.uses === null ? '' : g.uses === 0 ? 'coral' : 'teal';
        const art = itemArt(g.kind);
        const button =
          g.uses === null || g.uses === 0
            ? `<button type="button" class="sk-btn" data-buy="${g.kind}" ${v.location.kind !== 'town' || v.gold < g.price ? 'disabled' : ''}>사기<small>${money(g.price)}골드</small></button>`
            : '';
        const repair =
          g.uses !== null && g.uses < g.maxUses
            ? `<button type="button" class="sk-btn" data-repair="${g.kind}" ${v.tools < 1 ? 'disabled' : ''}>고치기<small>도구 1개</small></button>`
            : '';
        return `<li class="sk-row">
          <div class="sk-row-main">
            <span class="sk-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
            <span class="sk-text"><b>${g.name} <span class="sk-chip ${tone}">${state}</span></b><small>${GEAR_USE[g.kind]}</small></span>
            ${repair || button ? `<span class="sk-btns">${repair}${button}</span>` : ''}
          </div>
        </li>`;
      })
      .join('');
    const toolsArt = itemArt('tools');
    sheet.body.innerHTML = `<div class="sk">
      <p class="sk-strip">${toolsArt ? `<img src="${toolsArt}" alt="" />` : ''}<span><b>수레의 도구 ${v.tools}개${v.tools ? ` · 지금 도구 ${v.toolUsesLeft}번 더` : ''}</b><small>장비는 쓰다 보면 닳고, 수레에 실은 도구 하나로 고쳐요.</small></span></p>
      <ul class="sk-list">${rows}</ul>
      <p class="sk-note">장비는 원정 카드에 새 선택지를 열어 줘요.</p>
      ${done ? `<p class="sk-done">${done}</p>` : ''}
      ${error ? `<p class="error">${error}</p>` : ''}
    </div>`;
    const act = (attr: string, run: (kind: string) => ReturnType<Game['dispatch']>, ok: (name: string) => string) =>
      sheet.body.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((b) =>
        b.addEventListener('click', async () => {
          const kind = b.getAttribute(attr)!;
          const r = await run(kind);
          error = r.ok ? '' : ERROR_TEXT[r.error];
          done = r.ok ? ok(v.gear.find((g) => g.kind === kind)!.name) : '';
          render();
        }),
      );
    act('data-buy', (kind) => game.dispatch({ type: 'buyGear', gear: kind as GearKind }), (n) => `${eulReul(n)} 샀어요.`);
    act('data-repair', (kind) => game.dispatch({ type: 'repairGear', gear: kind as GearKind }), (n) => `${eulReul(n)} 고쳤어요.`);
  };
  render();
}
