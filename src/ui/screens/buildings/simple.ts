// 잡화점, 바깥(원정), 작업장, 은행, 길드 회관 쪽지.
import { money } from '../../format';
import type { Game } from '../../game';
import { openLiveSheet } from '../../liveSheet';
import { openExpeditionSheet } from '../expeditionSheet';
import { openGearSheet } from '../gearSheet';
import { openMealSheet } from '../mealSheet';
import type { PlayerView } from '../../../sim/economy';

/** 피로 막대: 칸 10개 */
export function fatigueBar(v: PlayerView): string {
  const cells = Array.from({ length: v.fatigueMax }, (_, i) => `<i class="${i < v.fatigue ? 'on' : ''}"></i>`).join('');
  const word = v.fatigue === 0 ? '쌩쌩해요' : v.tired ? '많이 지쳤어요' : v.fatigue >= 4 ? '조금 지쳤어요' : '괜찮아요';
  return `<div class="fatigue"><div class="fatigue-cells" aria-hidden="true">${cells}</div><span>${word}</span></div>`;
}

export function openStore(game: Game): void {
  openLiveSheet(game, '잡화점', (body, v) => {
    body.innerHTML = `
      <h3>음식 먹기</h3>
      ${fatigueBar(v)}
      <div class="btn-row">
        <button type="button" class="secondary-btn" data-meal ${v.fatigue > 0 && v.mealsLeft > 0 ? '' : 'disabled'}>짐에 있는 음식 먹기<small>오늘 ${v.mealsLeft}끼 더</small></button>
      </div>
      ${
        v.apprentice
          ? ''
          : `<h3>장비</h3>
             <p class="muted">장비는 원정 카드에 새 선택지를 열어 줘요. 수레의 도구 ${v.tools}개.</p>
             <div class="btn-row"><button type="button" class="secondary-btn" data-gear>장비 사기·고치기<small>${v.gear.filter((g) => (g.uses ?? 0) > 0).length}개 쓸 만함</small></button></div>`
      }`;
    body.querySelector('[data-meal]')?.addEventListener('click', () => openMealSheet(game));
    body.querySelector('[data-gear]')?.addEventListener('click', () => openGearSheet(game));
  });
}

export function openOutside(game: Game): void {
  openLiveSheet(game, '바깥', (body, v, sheet) => {
    body.innerHTML = `
      <header class="card-head"><h3>원정</h3><span class="badge">기회 ${v.expeditionChances} / 6</span></header>
      <p class="muted">이 마을에 머무는 동안 하루에 한 번씩 원정 기회가 생겨요. 떠나면 사라져요.</p>
      ${fatigueBar(v)}
      <div class="btn-row">
        ${
          v.expedition
            ? '<button type="button" class="primary-btn" data-resume>원정 이어가기</button>'
            : `<button type="button" class="primary-btn" data-start ${v.expeditionChances > 0 && v.fatigue < v.fatigueMax ? '' : 'disabled'}>${
                v.expeditionChances === 0 ? '내일 기회가 생겨요' : v.fatigue >= v.fatigueMax ? '너무 지쳤어요' : '떠나기 (카드 3~4장)'
              }</button>`
        }
      </div>`;
    body.querySelector('[data-resume]')?.addEventListener('click', () => openExpeditionSheet(game));
    body.querySelector('[data-start]')?.addEventListener('click', () => {
      if (sheet.send({ type: 'startExpedition' })) openExpeditionSheet(game);
    });
  });
}

export function openWorkshop(game: Game): void {
  openLiveSheet(game, '작업장', (body) => {
    body.innerHTML = `<p>도시 대장간과 염장 공방이 재료를 사서 도구와 염장 식품을 만들어요.</p>
      <p class="muted">내 작업장(염장소, 대장간)을 사거나 짓는 것은 다음 버전에서 열려요.</p>`;
  });
}

export function openBank(game: Game): void {
  openLiveSheet(game, '은행', (body, v) => {
    body.innerHTML = `
      <ul class="list">
        <li class="row"><span>예금</span><b>${money(v.bank.deposit)}</b></li>
        <li class="row"><span>대출</span><b>${money(v.bank.loan)}</b></li>
      </ul>
      <p class="muted">예금 이자 시즌당 ${Math.round(v.bank.depositRate * 100)}%, 대출 이자 ${Math.round(v.bank.loanRate * 100)}%. 계좌는 하나라 어느 도시에서나 같아요.</p>
      <p class="muted">맡기기와 빌리기는 다음 버전에서 열려요.</p>`;
  });
}

export function openGuildHall(game: Game): void {
  openLiveSheet(game, '길드 회관', (body, v) => {
    body.innerHTML = guildHtml(v);
  });
}

/** 이번 시즌 테마와 의뢰 진행 (소식 탭에서도 같이 쓴다) */
export function guildHtml(v: PlayerView): string {
  const g = v.guild;
  if (!g.theme) return '<p class="muted">이번 시즌 테마가 아직 없어요.</p>';
  const tierName: Record<string, string> = { bronze: '동', silver: '은', gold: '금' };
  const rows = g.quests
    .map(
      (q) => `<li class="row"><span><b>${q.name}</b>${q.scope === 'communal' ? ' <span class="badge">공동</span>' : ''}<br /><small class="muted">${q.text} · ${q.value} / ${q.tiers.join(' · ')}</small></span>${
        q.tier ? `<span class="stamp right">${tierName[q.tier]}</span>` : ''
      }</li>`,
    )
    .join('');
  return `<p><b>${g.theme}</b> <span class="muted">(테마와 의뢰는 기획 보류 중, 참고용)</span></p><ul class="list">${rows}</ul>`;
}
