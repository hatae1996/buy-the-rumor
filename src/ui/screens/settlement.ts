// 시즌 결산 화면 (기획서 "시즌 흐름 3", 0.1.0 작업 5): 시즌 마지막 장날 뒤.
// 결산(내 순위, 새로 받은 인장과 칭호) → 시즌 리포트(내 최고 거래, 가장 믿었던 소문꾼, 맞힌 소문 수, 다닌 길) → 상인 증서.
// 닫고 "다음 시즌 시작"을 누르면 새 시드로 새 세계가 열린다 (질문 89 답). 증서, 인장, 칭호, 연차만 남는다.
import type { RankingCategoryView, SettlementView } from '../../sim/economy';
import { goodName, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';
import { openCertificate } from './certificate';

/** 내가 오른 부문만, 순위 순으로 */
export function myPlaces(categories: readonly RankingCategoryView[]): string {
  const mine = categories.filter((c) => c.mine).sort((a, b) => a.mine!.rank - b.mine!.rank);
  if (!mine.length) return '<li class="muted">순위에 오른 부문이 없어요.</li>';
  return mine
    .map((c) => `<li class="row"><span>${c.name}</span><b>${c.mine!.rank}위 <small class="muted">/ ${c.count} · 상위 ${Math.max(1, Math.round(c.mine!.topShare * 100))}%</small></b></li>`)
    .join('');
}

function reportHtml(game: Game, st: SettlementView): string {
  const r = st.report;
  if (!r) return '<p class="muted">이번 시즌 리포트가 없어요.</p>';
  const town = (id: number) => game.map.towns[id]!.name;
  const best = r.bestTrade
    ? `${r.bestTrade.day}일째 ${town(r.bestTrade.town)}에서 ${goodName(r.bestTrade.good)} ${r.bestTrade.qty}개를 개당 ${r.bestTrade.price}에 팔아 ${money(r.bestTrade.profit)} 남겼어요.`
    : '산 값보다 비싸게 판 거래가 없었어요.';
  return `<ul class="list">
    <li><b>내 최고 거래</b><br />${best}</li>
    <li><b>가장 믿었던 소문꾼</b><br />${r.trustedGossip ? `${r.trustedGossip.name} (맞았다 ${r.trustedGossip.right}번)` : '아직 믿을 만한 소문꾼을 못 만났어요.'}</li>
    <li><b>맞힌 소문</b><br />수첩에 "맞았다" 도장 ${r.rumorsRight}개</li>
    <li><b>다닌 길</b><br />마을 ${r.towns}곳, 떠난 길 ${r.trips}번, 길 위에서 ${r.roadDays}일</li>
    <li><b>시즌 끝 순자산</b><br />${money(r.worth)} <small class="muted">(나만 봐요)</small></li>
  </ul>`;
}

export function openSettlement(game: Game, onNextSeason: () => void): void {
  const st = game.view().settlement;
  if (!st) return;
  const sheet = openSheet(`${st.season}시즌 결산`);
  sheet.body.innerHTML = `
    <p>이번 시즌이 끝났어요. 마지막 장날 뒤 순자산과 순위를 매겼어요.</p>
    ${
      st.badges.length || st.titles.length
        ? `<section class="card"><h3>새로 받은 것</h3>
            ${st.titles.length ? `<p>칭호: ${st.titles.map((t) => `<b>${t}</b>`).join(', ')}</p>` : ''}
            ${st.badges.length ? `<p>${st.badges.map((b) => `<span class="badge">${b}</span>`).join(' ')}</p>` : ''}
          </section>`
        : ''
    }
    <section class="card"><h3>내 순위</h3><ul class="list">${myPlaces(st.categories)}</ul></section>
    <section class="card"><h3>시즌 리포트</h3>${reportHtml(game, st)}</section>
    <p class="muted">다음 시즌은 새 지도, 새 마을에서 시작해요. 상인 증서와 인장, 칭호, 연차만 남고 금화와 짐, 말, 일꾼, 창고, 아는 시세와 소문은 처음부터예요.</p>
    <div class="btn-row">
      <button type="button" class="secondary-btn" data-cert>상인 증서</button>
      <button type="button" class="primary-btn" data-next>다음 시즌 시작</button>
    </div>`;
  sheet.body.querySelector('[data-cert]')!.addEventListener('click', () => openCertificate(game));
  sheet.body.querySelector('[data-next]')!.addEventListener('click', () => {
    sheet.close();
    onNextSeason();
  });
}
