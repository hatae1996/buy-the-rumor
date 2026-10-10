// 자리를 비운 사이 (기획서 "화면 구성", 0.0.5): 카드는 많아야 5장.
// 중요한 순서: 장날 결과 → 급한 일(일당 부족, 곧 상할 짐, 말 먹이) → 신문 머리기사 → 보고(도착, 말·일꾼 추첨, 일꾼·마부) → 새 소문.
// 나머지는 소식 탭 보고에 쌓인다.
import merchant from '../../../assets/ui/merchant.png';
import { RUMORS } from '../../sim/constants';
import { goodName, ledgerLine, money } from '../format';
import type { AwaySummary, Game } from '../game';
import { openSheet } from '../sheet';
import { noteItem, topNotes } from './noteItem';

/** 많아야 이만큼 */
const MAX_CARDS = 5;

/** onClose: 닫은 뒤 (시즌이 끝났으면 결산을 이어서 연다) */
export function showAwaySummary(game: Game, s: AwaySummary, onClose?: () => void): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const sheet = openSheet('자리를 비운 사이', onClose);
  const cards: { title: string; html: string }[] = [];

  // 1. 장날 결과 (내가, 창고 짐이, 두 번째 행렬이)
  const trades = s.ledger.filter((e) => e.kind === 'buy' || e.kind === 'sell');
  if (trades.length) {
    const net = trades.reduce((sum, e) => sum + (ledgerLine(e, townName).amount ?? 0), 0);
    cards.push({
      title: '장날 결과',
      html: `<ul class="list">${trades.slice(-6).map((e) => `<li>${ledgerLine(e, townName).text}</li>`).join('')}</ul>
        <p>거래로 ${net >= 0 ? '번' : '쓴'} 돈 <b>${money(Math.abs(net))}</b>${trades.length > 6 ? ` <span class="muted">(${trades.length}건 중 6건)</span>` : ''}</p>`,
    });
  } else cards.push({ title: '장날 결과', html: '<p class="muted">장날에 맞춰진 신청이 없었어요.</p>' });

  // 2. 급한 일: 사람과 말, 곧 상할 짐, 상한 짐
  const urgent = s.notices.filter((n) => (n.kind === 'people' || n.kind === 'spoiling') && !n.draw).map((n) => n.text);
  for (const e of s.ledger) if (e.kind === 'spoil') urgent.push(`${goodName(e.good)} ${e.qty}개가 상했어요.`);
  if (urgent.length) cards.push({ title: '급한 일', html: `<ul class="list">${[...new Set(urgent)].slice(0, 5).map((t) => `<li>${t}</li>`).join('')}</ul>` });

  // 3. 신문 머리기사: 산 신문의 큰 소식 머리기사만 (0.1.2. 신문은 마을의 신문팔이에게서 산다, 0.1.3 시세·날씨만 있는 날은 빼고)
  const heads: [number, string][] = [];
  for (const n of s.news) if (!n.section && !heads.some(([d]) => d === n.day)) heads.push([n.day, n.text]);
  if (heads.length) {
    cards.push({
      title: '신문',
      html: `<ul class="list">${heads.slice(-3).reverse().map(([day, text]) => `<li><span class="day">${day}일째</span> ${text}</li>`).join('')}</ul>
        <p class="muted">소식 탭 신문함에서 끝까지 읽을 수 있어요.</p>`,
    });
  }

  // 4. 보고: 도착, 말·일꾼 추첨, 채집꾼, 두 번째 행렬
  const reports = [
    ...s.notices.filter((n) => n.draw).map((n) => n.text),
    ...(s.arrivedAt !== null ? [`<b>${townName(s.arrivedAt)}</b>에 도착했어요.`] : []),
    ...s.notices.filter((n) => n.kind === 'arrival' && !n.text.startsWith(`${townName(s.arrivedAt ?? -1)}에`)).map((n) => n.text),
    ...s.ledger.filter((e) => e.kind === 'gathered').map((e) => ledgerLine(e, townName).text),
  ];
  if (reports.length) cards.push({ title: '보고', html: `<ul class="list">${reports.slice(0, 5).map((t) => `<li>${t}</li>`).join('')}</ul>` });

  // 여관에 새 소문 (0.1.2): 소문은 여관에서 직접 들어야 해서 여기서는 표시만
  if (s.innFresh) cards.push({ title: '여관에 새 소문', html: '<p class="muted">이 마을 여관 소문꾼들에게 아직 못 들은 이야기가 있어요.</p>' });

  // 5. 전서구·정보원 보고: 한 번 접속에 많아야 몇 개만, 중요한 것부터
  if (s.heard.length) {
    const heard = topNotes(s.heard, RUMORS.perVisit);
    cards.push({
      title: '전해 온 이야기',
      html: `<ul class="list">${heard.map((n) => noteItem(n, s.toDay, townName)).join('')}</ul>${
        s.heard.length > heard.length ? `<p class="muted">그 밖에 ${s.heard.length - heard.length}개는 수첩에 적어 두었어요.</p>` : ''
      }${s.stamped ? `<p class="muted">수첩에 도장이 ${s.stamped}개 새로 찍혔어요.</p>` : ''}`,
    });
  }

  sheet.body.innerHTML = `
    <div class="away-head">
      <img src="${merchant}" alt="" />
      <p>${s.days === 1 ? '장날이 한 번 지났어요.' : `장날이 ${s.days}번 지났어요.`}<br />
      <span class="muted">${s.fromDay}일째 → ${s.toDay}일째</span></p>
    </div>
    ${cards
      .slice(0, MAX_CARDS)
      .map((c) => `<section class="card away-card"><h3>${c.title}</h3>${c.html}</section>`)
      .join('')}
    <button type="button" class="primary-btn" data-ok>확인</button>`;
  sheet.body.querySelector('[data-ok]')!.addEventListener('click', () => sheet.close());
}
