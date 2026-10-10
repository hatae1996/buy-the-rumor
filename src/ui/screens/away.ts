// 자리를 비운 사이 (기획서 "화면 구성", 0.0.5 → 0.1.6 목업 docs/reference/away-*-mockup-0.1.6.png): 가운데 뜨는 창, 카드는 많아야 5장.
// 중요한 순서: 장날 결과 → 급한 일(일당 부족, 곧 상할 짐, 말 먹이) → 신문 머리기사 → 보고(도착, 말·일꾼 추첨, 일꾼·마부) → 새 소문.
// 나머지는 소식 탭 보고에 쌓인다.
import sprigL from '../../../assets/ui/orn_sprig_l.png';
import sprigR from '../../../assets/ui/orn_sprig_r.png';
import hourglassImg from '../../../assets/ui/icon_hourglass.png';
import marketImg from '../../../assets/ui/bld_market.png';
import innImg from '../../../assets/ui/bld_inn.png';
import paperImg from '../../../assets/ui/tab_news.png';
import letterImg from '../../../assets/ui/report_letter.png';
import noticeImg from '../../../assets/ui/icon_notice.png';
import { RUMORS } from '../../sim/constants';
import type { LedgerEntry } from '../../sim/economy';
import { goodName, ledgerLine, money } from '../format';
import type { AwaySummary, Game } from '../game';
import { itemArt } from '../itemArt';
import { openInn } from './buildings/inn';
import { noteItem, topNotes } from './noteItem';
import { openPaper } from './paperPage';

/** 많아야 이만큼 */
const MAX_CARDS = 5;
/** 장날 결과에 보이는 거래 줄 */
const TRADE_ROWS = 4;

const won = (n: number) => `${money(n)}골드`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${won(Math.abs(n))}`;

/** 그림 칸과 글 칸으로 나뉜 회색 판 */
const panel = (img: string, html: string) => `<div class="away-panel"><img src="${img}" alt="" /><div>${html}</div></div>`;

/** onClose: 닫은 뒤 (시즌이 끝났으면 결산을 이어서 연다) */
export function showAwaySummary(game: Game, s: AwaySummary, onClose?: () => void): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const cards: { title: string; html: string }[] = [];

  // 1. 장날 결과 (내가, 창고 짐이, 두 번째 행렬이)
  const trades = s.ledger.filter((e): e is Extract<LedgerEntry, { kind: 'buy' | 'sell' }> => e.kind === 'buy' || e.kind === 'sell');
  if (trades.length) {
    const net = trades.reduce((sum, e) => sum + (e.kind === 'sell' ? 1 : -1) * e.qty * e.price, 0);
    const rows = trades
      .slice(-TRADE_ROWS)
      .map((e) => {
        const art = itemArt(e.good);
        const by = e.by === 'store' ? ' · 창고 짐' : e.by === 'caravan' ? ' · 두 번째 행렬' : e.by === 'guest' ? ' · 견습 손님이 약속대로 사 갔어요' : '';
        const amount = (e.kind === 'sell' ? 1 : -1) * e.qty * e.price;
        return `<li>
          <span class="away-pic">${art ? `<img src="${art}" alt="" />` : ''}</span>
          <span class="away-text"><b>${goodName(e.good)} ${e.qty}개 ${e.kind === 'sell' ? '판매' : '구매'}</b><small>${townName(e.town)} · 개당 ${won(e.price)}${by}</small></span>
          <b class="${amount >= 0 ? 'plus' : 'minus'}">${signed(amount)}</b>
        </li>`;
      })
      .join('');
    const onlySells = trades.every((e) => e.kind === 'sell');
    cards.push({
      title: '장날 결과',
      html: `<div class="away-trades"><ul>${rows}</ul>
        <p class="away-total"><span>${onlySells ? '판매 수입' : '거래 손익'}${trades.length > TRADE_ROWS ? ` <small>(${trades.length}건 중 ${TRADE_ROWS}건)</small>` : ''}</span><b>${onlySells ? won(net) : signed(net)}</b></p></div>`,
    });
  } else cards.push({ title: '장날 결과', html: panel(marketImg, '<p>체결된 거래가 없어요.</p>') });

  // 2. 급한 일: 사람과 말, 곧 상할 짐, 상한 짐
  const urgent = s.notices.filter((n) => (n.kind === 'people' || n.kind === 'spoiling') && !n.draw).map((n) => n.text);
  for (const e of s.ledger) if (e.kind === 'spoil') urgent.push(`${goodName(e.good)} ${e.qty}개가 상했어요.`);
  if (urgent.length) {
    cards.push({ title: '급한 일', html: panel(noticeImg, `<ul>${[...new Set(urgent)].slice(0, 5).map((t) => `<li>${t}</li>`).join('')}</ul>`) });
  }

  // 3. 신문 머리기사: 산 신문의 큰 소식 머리기사만 (0.1.2. 신문은 마을의 신문팔이에게서 산다, 0.1.3 시세·날씨만 있는 날은 빼고)
  const heads: [number, string][] = [];
  for (const n of s.news) if (!n.section && !heads.some(([d]) => d === n.day)) heads.push([n.day, n.text]);
  if (heads.length) {
    const latest = Math.max(...heads.map(([d]) => d));
    cards.push({
      title: '신문',
      html: panel(
        paperImg,
        `<ul>${heads.slice(-3).reverse().map(([day, text]) => `<li><small>${day}일째</small> ${text}</li>`).join('')}</ul>
         <button type="button" class="away-go" data-away-paper="${latest}">신문 읽기 ›</button>`,
      ),
    });
  }

  // 4. 보고: 도착, 말·일꾼 추첨, 채집꾼, 두 번째 행렬
  const reports = [
    ...s.notices.filter((n) => n.draw).map((n) => n.text),
    ...(s.arrivedAt !== null ? [`<b>${townName(s.arrivedAt)}</b>에 도착했어요.`] : []),
    ...s.notices.filter((n) => n.kind === 'arrival' && !n.text.startsWith(`${townName(s.arrivedAt ?? -1)}에`)).map((n) => n.text),
    ...s.ledger.filter((e) => e.kind === 'gathered').map((e) => ledgerLine(e, townName).text),
  ];
  if (reports.length) cards.push({ title: '보고', html: panel(letterImg, `<ul>${reports.slice(0, 5).map((t) => `<li>${t}</li>`).join('')}</ul>`) });

  // 여관에 새 소문 (0.1.2): 소문은 여관에서 직접 들어야 해서 여기서는 표시만 (여관으로 가는 단추)
  if (s.innFresh) {
    cards.push({
      title: '여관에 새 소문',
      html: panel(innImg, '<p>아직 듣지 않은 이야기가 있어요.</p><button type="button" class="away-go" data-away-inn>여관에서 소문 듣기 ›</button>'),
    });
  }

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

  const backdrop = document.createElement('div');
  backdrop.className = 'away-backdrop';
  backdrop.innerHTML = `
    <section class="away-modal" role="dialog" aria-modal="true" aria-label="자리를 비운 사이">
      <button type="button" class="away-close" data-ok aria-label="닫기">✕</button>
      <h2 class="away-title"><img src="${sprigL}" alt="" />자리를 비운 사이<img src="${sprigR}" alt="" /></h2>
      <div class="away-scroll">
        <div class="away-days">
          <img src="${hourglassImg}" alt="" />
          <div><b>${s.days === 1 ? '장날이 한 번 지났어요' : `장날이 ${s.days}번 지났어요`}</b><span>${s.fromDay}일째 → ${s.toDay}일째</span></div>
        </div>
        ${cards
          .slice(0, MAX_CARDS)
          .map((c) => `<section class="away-card"><h3>${c.title}</h3>${c.html}</section>`)
          .join('')}
      </div>
      <button type="button" class="rumor-note away-ok" data-ok>확인</button>
    </section>`;
  const close = () => {
    backdrop.remove();
    onClose?.();
  };
  backdrop.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', close));
  backdrop.querySelector('[data-away-inn]')?.addEventListener('click', () => {
    close();
    if (game.view().location.kind === 'town') openInn(game, 'rumors');
  });
  backdrop.querySelector<HTMLButtonElement>('[data-away-paper]')?.addEventListener('click', (e) => {
    close();
    openPaper(game, Number((e.currentTarget as HTMLButtonElement).dataset.awayPaper));
  });
  document.body.appendChild(backdrop);
}
