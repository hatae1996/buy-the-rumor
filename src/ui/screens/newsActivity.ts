// 소식 탭 "활동" (0.1.6 목업 docs/reference/news-activity-mockup-0.1.6.png): 활동 기록 / 상단 순위.
// 활동 기록: 날마다 장날 정산(그 마을 사고판 것을 한 줄로), 채집 보고, 정보원·전서구·직접 본 것, 원정, 길, 일꾼 소식.
// 아래에 내 상단 순위 카드(대표 부문). 상단 순위: 부문마다 1~3위와 내 순위.
import marketImg from '../../../assets/ui/bld_market.png';
import outsideImg from '../../../assets/ui/bld_outside.png';
import gatherImg from '../../../assets/ui/report_gather.png';
import letterImg from '../../../assets/ui/report_letter.png';
import trophyImg from '../../../assets/ui/rank_trophy.png';
import pinImg from '../../../assets/ui/icon_pin.png';
import infoImg from '../../../assets/ui/icon_info.png';
import wagonImg from '../../../assets/ui/travel_wagon.png';
import incomeImg from '../../../assets/ui/coins_stack.png';
import spendImg from '../../../assets/ui/coins_sack.png';
import paperImg from '../../../assets/ui/tab_news.png';
import type { LedgerEntry, PlayerView, RankingCategoryView } from '../../sim/economy';
import { agoText, goodName, ledgerLine, money } from '../format';
import { euro } from '../../sim/josa';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openCertificate } from './certificate';
import { emblemSvg } from '../emblem';
import { portraitHtml } from '../portrait/portrait';

type ActivityView = 'log' | 'rank';
let view: ActivityView = 'log';

/** 활동 기록에 보이는 날 수 */
const DAYS_SHOWN = 10;

interface Row {
  art: string;
  title: string;
  detail: string;
  where?: string;
  amount: number | null;
  note?: string;
}

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}골드`;

/** 장부에서 활동으로 보일 줄 (돈만 나간 자잘한 줄, 먹기, 일당, 보관료는 뺀다) */
function shown(e: LedgerEntry): boolean {
  switch (e.kind) {
    case 'eat':
    case 'horseFeed':
    case 'horseRest':
    case 'info':
    case 'inn':
      return false;
    case 'hire':
      return e.what !== 'wage';
    case 'caravan':
      return e.what !== 'rent';
    case 'warehouse':
      return e.what !== 'rent';
    case 'roadFood':
      return e.short > 0;
    default:
      return true;
  }
}

function rowsOfDay(game: Game, v: PlayerView, day: number): Row[] {
  const townName = (id: number) => game.map.towns[id]!.name;
  const rows: Row[] = [];
  const entries = v.ledger.filter((e) => e.day === day && shown(e));
  // 장날 정산: 마을마다 사고판 것을 한 줄로
  const trades = new Map<number, { parts: string[]; net: number }>();
  for (const e of entries) {
    if (e.kind !== 'buy' && e.kind !== 'sell') continue;
    const t = trades.get(e.town) ?? { parts: [], net: 0 };
    t.parts.push(`${goodName(e.good)} ${e.qty}개 ${e.kind === 'sell' ? '판매' : '구매'}`);
    t.net += (e.kind === 'sell' ? 1 : -1) * e.qty * e.price;
    trades.set(e.town, t);
  }
  for (const [town, t] of trades) rows.push({ art: marketImg, title: `${townName(town)} 장날 정산`, detail: t.parts.join(' · '), amount: t.net, note: '거래 결과' });
  for (const e of entries) {
    if (e.kind === 'buy' || e.kind === 'sell') continue;
    if (e.kind === 'gathered') {
      const got = e.goods.map((g) => `${goodName(g.good)} ${g.qty}`).join(' · ');
      rows.push({ art: gatherImg, title: '채집 보고', detail: `${got ? `${got} 획득` : '넣은 것 없음'}${e.lost ? ` · ${e.lost}개 버림` : ''}`, where: `${townName(e.town)} 근교 · ${e.name}`, amount: null });
      continue;
    }
    if (e.kind === 'expedition') {
      const got = e.goods.map((g) => `${goodName(g.good)} ${g.qty}`).join(' · ');
      rows.push({ art: outsideImg, title: '원정', detail: `${got || '빈손'}${e.leftBehind ? ` · ${e.leftBehind}개는 두고 옴` : ''}`, where: townName(e.town), amount: null });
      continue;
    }
    if (e.kind === 'rations') {
      rows.push({ art: itemArt('rations') ?? spendImg, title: '여행 식량 구입', detail: `식량 ${e.qty}개 · ${townName(e.town)} 잡화점`, amount: -e.qty * e.price });
      continue;
    }
    if (e.kind === 'travel') {
      rows.push({ art: wagonImg, title: `${euro(townName(e.to))} 출발`, detail: `${townName(e.from)}에서 ${e.days}일 길`, amount: -e.fee });
      continue;
    }
    const { text, amount } = ledgerLine(e, townName);
    rows.push({ art: amount === null ? paperImg : amount >= 0 ? incomeImg : spendImg, title: text, detail: '', amount });
  }
  // 정보원·전서구·원정에서 직접 본 것 (수첩이 아니라 보고로 남는다, 질문 97 기본안)
  for (const n of v.rumors) {
    if (n.day !== day || (n.via !== 'informant' && n.via !== 'pigeon' && n.via !== 'seen')) continue;
    const title = n.via === 'informant' ? '정보원 보고' : n.via === 'pigeon' ? '전서구 소식' : '직접 본 것';
    rows.push({ art: letterImg, title, detail: n.text, amount: null, note: n.from });
  }
  return rows;
}

function logHtml(game: Game, v: PlayerView): string {
  const days = new Set<number>([...v.ledger.filter(shown).map((e) => e.day), ...v.rumors.filter((n) => n.via === 'informant' || n.via === 'pigeon' || n.via === 'seen').map((n) => n.day)]);
  const blocks = [...days]
    .sort((a, b) => b - a)
    .slice(0, DAYS_SHOWN)
    .map((day) => {
      const rows = rowsOfDay(game, v, day);
      if (!rows.length) return '';
      return `<h4 class="acct-day">${day}일째${day === v.day ? ' · 오늘' : ` · ${agoText(v.day, day)}`}</h4>
        <ul>${rows
          .map(
            (r) => `<li class="act-row">
              <span class="act-pic"><img src="${r.art}" alt="" /></span>
              <span class="act-text">
                <b>${r.title}</b>
                ${r.detail ? `<small>${r.detail}</small>` : ''}
                ${r.where ? `<small class="act-where"><img src="${pinImg}" alt="" />${r.where}</small>` : ''}
              </span>
              ${
                r.amount !== null
                  ? `<span class="act-amount"><b class="${r.amount >= 0 ? 'plus' : 'minus'}">${signed(r.amount)}</b>${r.note ? `<small>${r.note}</small>` : ''}</span>`
                  : r.note
                    ? `<span class="act-amount"><small>${r.note}</small></span>`
                    : ''
              }
            </li>`,
          )
          .join('')}</ul>`;
    })
    .join('');
  return `<h3 class="ledger-section-title">최근 활동</h3>
    ${blocks ? `<section class="acct-list act-list">${blocks}</section>` : '<p class="ledger-note">아직 활동이 없어요. 장날에 사고팔거나 일꾼을 두면 여기에 쌓여요.</p>'}`;
}

/** 내 상단 순위 카드: 대표 부문(맨 앞 부문)의 내 순위 */
function myRankCard(v: PlayerView): string {
  const main = v.ranking.categories.find((c) => !c.id.startsWith('goodsKing:'));
  const mine = main?.mine;
  return `<section class="rank-card">
      <img src="${trophyImg}" alt="" />
      <div>
        <span class="acct-label">내 상단 순위</span>
        ${
          v.ranking.day === null
            ? '<small>첫 장날이 지나면 순위가 매겨져요.</small>'
            : mine
              ? `<span class="rank-big">${mine.rank}위 <span class="rank-chip">상위 ${Math.max(1, Math.round(mine.topShare * 100))}%</span></span>
                 <small>${main!.name} · 시즌 전체 기준${main!.world.mine ? ` · 내 세계 ${main!.world.mine.rank}위` : ''}</small>`
              : `<small>${main?.name ?? '대표 부문'}에 아직 기록이 없어요.</small>`
        }
      </div>
      <button type="button" class="paper-read" data-activity-view="rank">전체 순위 ›</button>
    </section>`;
}

/**
 * 대표 부문은 1~3위를, 물품왕은 1위만. 이름을 누르면 상인 증서(내 세계 상단만). 남의 순자산 숫자는 보이지 않는다.
 * 순위는 시즌 전체(같은 시즌의 모든 세계)이고, 내 세계 순위를 함께 적는다 (0.1.3)
 */
function rankingHtml(v: PlayerView): string {
  const r = v.ranking;
  if (r.day === null) return '<p class="ledger-note">첫 장날이 지나면 순위가 매겨져요.</p>';
  // 내 세계 상단은 얼굴과 문장을 함께 (0.1.7), 누르면 증서
  const marks = (id: string) => {
    const c = v.certificates[id];
    return c ? `${portraitHtml(c.face, 26)}${emblemSvg(c.emblem, 20)}` : '';
  };
  const who = (t: RankingCategoryView['top'][number]) =>
    t.mine
      ? `<button type="button" class="link-btn rank-who" data-cert-id="${t.id}">${t.rank}위 ${marks(t.id)}${t.name}</button>`
      : `<span>${t.rank}위 ${t.name}</span>`;
  const mine = (c: RankingCategoryView) =>
    c.mine
      ? `<small>나 ${c.mine.rank}위 · 상위 ${Math.max(1, Math.round(c.mine.topShare * 100))}%${c.world.mine ? ` · 내 세계 ${c.world.mine.rank}위` : ''}</small>`
      : '<small>나는 아직 기록 없음</small>';
  const main = r.categories
    .filter((c) => !c.id.startsWith('goodsKing:'))
    .map((c) => `<li><span class="rank-name"><b>${c.name}</b>${mine(c)}</span><span class="rank-top">${c.top.map(who).join('') || '<span>아직 없음</span>'}</span></li>`)
    .join('');
  const kings = r.categories
    .filter((c) => c.id.startsWith('goodsKing:') && c.top.length)
    .map((c) => `<li><span class="rank-name"><b>${c.name}</b>${c.mine ? `<small>나 ${c.mine.rank}위</small>` : ''}</span><span class="rank-top">${who(c.top[0]!)}</span></li>`)
    .join('');
  return `<section class="acct-list rank-list">
      <h4 class="acct-day">${r.day}일째 장날 기준 · 시즌 전체 (같은 시즌의 모든 세계)</h4>
      <ul>${main}</ul>
      ${kings ? `<h4 class="acct-day">물품왕</h4><ul>${kings}</ul>` : ''}
    </section>
    <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />순자산 숫자는 남에게 보이지 않아요. 내 이름을 누르면 상인 증서를 봐요.</p>`;
}

export function activityHtml(game: Game, v: PlayerView): string {
  return `
    <div class="act-views" role="tablist" aria-label="활동">
      <button type="button" data-activity-view="log" aria-pressed="${view === 'log'}">활동 기록</button>
      <button type="button" data-activity-view="rank" aria-pressed="${view === 'rank'}">상단 순위</button>
    </div>
    ${
      view === 'log'
        ? `${logHtml(game, v)}${myRankCard(v)}<p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />순위는 장날마다 갱신돼요.</p>`
        : rankingHtml(v)
    }`;
}

export function bindActivity(el: HTMLElement, game: Game, rerender: () => void): void {
  el.querySelectorAll<HTMLButtonElement>('[data-activity-view]').forEach((b) =>
    b.addEventListener('click', () => {
      view = b.dataset.activityView as ActivityView;
      rerender();
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-cert-id]').forEach((b) => b.addEventListener('click', () => openCertificate(game, b.dataset.certId)));
}
