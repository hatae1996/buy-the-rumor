// 자리를 비운 사이: 앱을 다시 열거나 장날이 지나면 그동안 일어난 일을 쪽지로 보여 준다.
import merchant from '../../../assets/ui/merchant.png';
import { goodName, ledgerLine, money } from '../format';
import type { AwaySummary, Game } from '../game';
import { openSheet } from '../sheet';

export function showAwaySummary(game: Game, s: AwaySummary): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const sheet = openSheet('자리를 비운 사이');

  const trades = s.ledger.filter((e) => e.kind === 'buy' || e.kind === 'sell');
  const net = trades.reduce((sum, e) => sum + (ledgerLine(e, townName).amount ?? 0), 0);
  const spoiled = s.ledger.filter((e) => e.kind === 'spoil');
  const lines: string[] = [];
  if (s.arrivedAt !== null) lines.push(`<b>${townName(s.arrivedAt)}</b>에 도착했어요.`);
  if (trades.length) {
    lines.push(...trades.map((e) => ledgerLine(e, townName).text));
    lines.push(`거래로 ${net >= 0 ? '번' : '쓴'} 돈 <b>${money(Math.abs(net))}</b>`);
  } else lines.push('장날에 맞춰진 신청이 없었어요.');
  for (const e of spoiled) if (e.kind === 'spoil') lines.push(`${goodName(e.good)} ${e.qty}개가 상했어요.`);

  sheet.body.innerHTML = `
    <div class="away-head">
      <img src="${merchant}" alt="" />
      <p>${s.days === 1 ? '장날이 한 번 지났어요.' : `장날이 ${s.days}번 지났어요.`}<br />
      <span class="muted">${s.fromDay}일째 → ${s.toDay}일째</span></p>
    </div>
    <ul class="list">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    ${
      s.news.length
        ? `<h3>신문</h3><ul class="list">${s.news
            .slice(-3)
            .reverse()
            .map((n) => `<li>${n.text}</li>`)
            .join('')}</ul>${s.news.length > 3 ? `<p class="muted">그 밖에 ${s.news.length - 3}개 소식이 더 있어요.</p>` : ''}`
        : ''
    }
    <button type="button" class="primary-btn" data-ok>확인</button>`;
  sheet.body.querySelector('[data-ok]')!.addEventListener('click', () => sheet.close());
}
