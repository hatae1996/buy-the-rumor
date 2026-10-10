// 마구간(말 사고팔기)과 수레방(수레 바꾸기) 페이지 (기획서 "말", 0.1.6 목업).
// 말은 장날이 아니라 마구간에서 사고판다. 사기는 신청해 두면 그날 밤 신청한 사람 중에서 뽑고(0.1.0), 되팔기는 바로.
// 마구간 남은 수는 그 마을에 와야만 보인다.
import wheatImg from '../../../assets/ui/icon_wheat.png';
import coinImg from '../../../assets/ui/coin.png';
import houseImg from '../../../assets/ui/house_red.png';
import wheelImg from '../../../assets/ui/cartshop_wheel.png';
import coinsImg from '../../../assets/ui/coins_stack.png';
import infoImg from '../../../assets/ui/icon_info.png';
import { CART_IMG } from '../cartBoard';
import { bindHorseNaming, horseNameHtml, horsePicHtml } from '../horseArt';
import { openLivePage } from '../livePage';
import type { HorseKindInfo, HorseView } from '../../sim/economy';
import { HORSES } from '../../sim/constants';
import { eulReul } from '../../sim/josa';
import { money } from '../format';
import type { Game } from '../game';

/** 이동 일수 배율을 말로 */
export function speedWord(speed: number): string {
  if (speed < 0.75) return '빠름';
  if (speed < 1) return '조금 빠름';
  return '사람 걸음';
}

/** 말 피로 막대 (플레이어 피로와 같은 모양) */
export function horseFatigue(h: HorseView): string {
  const cells = Array.from({ length: h.fatigueMax }, (_, i) => `<i class="${i < h.fatigue ? 'on' : ''}"></i>`).join('');
  const word = h.hungry ? `${h.hungry}일째 굶었어요` : h.fatigue >= h.fatigueMax ? '다 지쳤어요' : h.tired ? '많이 지쳤어요' : h.fatigue ? '괜찮아요' : '쌩쌩해요';
  return `<div class="fatigue"><div class="fatigue-cells" aria-hidden="true">${cells}</div><span${h.hungry ? ' class="warn"' : ''}>${word}</span></div>`;
}

/** 말 능력 줄: 운반 무게, 빠르기, 하루 곡물 (아이콘과 함께) */
const STAT_ICON = {
  weight: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6a3 3 0 0 1 6 0h3l2.5 14h-17L6 6zm2 0h2a1 1 0 0 0-2 0z" fill="currentColor"/></svg>`,
  speed: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="15" cy="4.5" r="2.2" fill="currentColor"/><path d="M13 8l-4 2-2 4M13 8l2 5 4 1M11 13l-2 5-4 1M15 13l-1 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
function statLines(k: HorseKindInfo): string {
  return `<ul class="horse-stats">
    <li>${STAT_ICON.weight}운반 무게 ${k.pull}</li>
    <li>${STAT_ICON.speed}${speedWord(k.speed)}</li>
    <li><img src="${wheatImg}" alt="" />하루 곡물 ${k.feed}</li>
  </ul>`;
}

/** 마구간 페이지 (0.1.6 목업 docs/reference/stable-mockup-0.1.6.png). 말 그림은 캐릭터처럼 부품으로 만들 예정이라 자리만 둔다 */
export function openStableSheet(game: Game): void {
  const v0 = game.view();
  if (!v0.stable || v0.location.kind !== 'town') return;
  const here = v0.location.town;
  let done = '';
  openLivePage(game, { back: '마을', title: '마구간', sub: game.map.towns[here]!.name }, (body, v, page) => {
    const stable = v.stable;
    if (!stable || v.location.kind !== 'town' || v.location.town !== here) {
      page.close();
      return;
    }
    const waiting = v.draws.filter((d) => d.kind === 'horse' && d.town === stable.town);
    const pending = v.draws.filter((d) => d.kind === 'horse').length;
    const full = v.horses.length + pending >= HORSES.maxPerOwner;
    const won = (n: number) => `${money(n)}골드`;
    const buy = stable.horses
      .map((k) => {
        const asked = waiting.find((d) => d.horse === k.kind);
        const act = asked
          ? `<button type="button" class="order-btn" data-cancel="${asked.id}">신청 거두기</button><small>오늘 밤 추첨 · ${won(asked.reserved)} 맡김</small>`
          : k.price === null
            ? '<button type="button" class="rumor-note" disabled>남은 말 없음</button>'
            : `<button type="button" class="rumor-note horse-buy" data-buy="${k.kind}" ${full || v.gold < k.price ? 'disabled' : ''}>구매 신청<span><img src="${coinImg}" alt="" />${won(k.price)}</span></button>${
                full ? '<small>두 마리까지예요</small>' : v.gold < k.price ? '<small>골드 부족</small>' : ''
              }`;
        return `<li class="horse-card">
          <span class="people-pic empty" aria-hidden="true"></span>
          <div class="horse-body">
            <div class="horse-head"><b>${k.name}</b><span class="paper-chip${k.stock ? ' now' : ''}">${k.stock ? `${k.stock}마리 남음` : '없음'}</span></div>
            ${statLines(k)}
          </div>
          <div class="horse-act">${act}</div>
        </li>`;
      })
      .join('');
    const mine = v.horses
      .map(
        (h) => `<li class="horse-card mine">
          ${horsePicHtml(h)}
          <div class="horse-body">
            <div class="horse-head">${horseNameHtml(h)}<span class="paper-chip now">보유 중</span></div>
            ${statLines(h)}
            ${horseFatigue(h)}
          </div>
          <div class="horse-act"><button type="button" class="order-btn horse-sell" data-sell="${h.id}" ${h.sellPrice === null ? 'disabled' : ''}>되팔기${h.sellPrice === null ? '' : `<small>${won(h.sellPrice)}</small>`}</button></div>
        </li>`,
      )
      .join('');
    body.innerHTML = `
      <p class="horse-strip"><img src="${infoImg}" alt="" /><span><b>구매 신청은 오늘 밤 추첨해요.</b><small>먼저 신청해도 우선권은 없어요. 뽑히지 않으면 맡긴 금액은 돌려받아요.</small></span></p>
      <div class="horse-section"><h3>구매할 말</h3><span class="shop-chip">보유 ${v.horses.length}${pending ? ` + 신청 ${pending}` : ''} / ${HORSES.maxPerOwner}마리</span></div>
      <ul class="horse-list">${buy}</ul>
      ${mine ? `<div class="horse-section"><h3>내 말</h3></div><ul class="horse-list">${mine}</ul>` : ''}
      ${done ? `<p class="ledger-note plain">${done}</p>` : ''}
      <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />말은 시즌마다 정해진 수만 목장에서 나와요. 한 사람당 ${HORSES.maxPerOwner}마리까지, 남은 수가 적을수록 비싸요.</p>`;
    body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const kind = b.dataset.buy as HorseKindInfo['kind'];
        done = `${eulReul(stable.horses.find((k) => k.kind === kind)!.name)} 사겠다고 신청했어요. 오늘 밤 뽑아요.`;
        if (!page.send({ type: 'buyHorse', kind })) done = '';
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => {
        done = '신청을 거두고 맡긴 돈을 돌려받았어요.';
        if (!page.send({ type: 'cancelDraw', drawId: Number(b.dataset.cancel) })) done = '';
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) =>
      b.addEventListener('click', () => {
        done = '말을 마구간에 돌려주었어요.';
        if (!page.send({ type: 'sellHorse', horseId: Number(b.dataset.sell) })) done = '';
      }),
    );
    bindHorseNaming(body, game);
  });
}

/** 수레방 페이지 (0.1.6 목업 docs/reference/cartshop-mockup-0.1.6.png): 망가진 칸 고치기, 수레 바꾸기 */
export function openCartShopSheet(game: Game): void {
  const v0 = game.view();
  if (v0.location.kind !== 'town') return;
  const here = v0.location.town;
  const won = (n: number) => `${money(n)}골드`;
  openLivePage(game, { back: '마을', title: '수레방', sub: game.map.towns[here]!.name, icon: houseImg }, (body, v, page) => {
    if (v.location.kind !== 'town' || v.location.town !== here) {
      page.close();
      return;
    }
    const cards = v.carts
      .map((c) => {
        const cells = c.rows.join('').split('').filter((x) => x === '#').length;
        const pull = c.horses ? `말 ${c.horses}필 필요` : `사람이 운반 · 무게 ${c.humanPull}까지`;
        const img = CART_IMG.get(c.type);
        const act =
          c.cost === null
            ? '<span class="cart-using">사용 중</span>'
            : v.gold >= c.cost
              ? `<button type="button" class="rumor-note" data-cart="${c.type}">교체 · ${won(c.cost)}</button>`
              : `<button type="button" class="rumor-note" disabled>교체 · ${won(c.cost)}</button><small>골드 부족</small>`;
        return `<li class="cart-offer${c.cost === null ? ' current' : ''}">
          ${img ? `<img src="${img}" alt="" />` : ''}
          <div><span>${c.name}</span><b>${cells}칸</b><small>${pull}</small></div>
          <div class="cart-offer-act">${act}</div>
        </li>`;
      })
      .join('');
    // 길 위 사건으로 망가진 칸 고치기 (0.1.2): 칸마다 값, 돈이 되는 만큼
    const broken = v.cart.broken.length;
    const per = broken ? v.cart.repairCost / broken : 0;
    body.innerHTML = `
      <section class="cartshop-hero">
        <img src="${wheelImg}" alt="" />
        <h3>더 넓은 짐칸으로</h3>
        <small>쓰던 수레는 값의 절반으로 쳐 줘요. 짐은 새 수레로 옮겨져요. 새 수레는 멀쩡해요.</small>
      </section>
      ${
        broken
          ? `<section class="shop-card">
              <h3>짐칸 고치기</h3>
              <small class="shop-caption">${v.cart.name}의 망가진 칸 ${broken}개 · 칸마다 ${won(per)}</small>
              <button type="button" class="rumor-note shop-wide" data-repair ${v.gold < per ? 'disabled' : ''}>${
                v.gold >= v.cart.repairCost ? `모두 고치기 · ${won(v.cart.repairCost)}` : `${Math.floor(v.gold / per)}칸 고치기 · ${won(Math.floor(v.gold / per) * per)}`
              }</button>
            </section>`
          : ''
      }
      <ul class="cart-offers">${cards}</ul>
      <p class="ledger-note plain"><img class="ledger-note-i" src="${infoImg}" alt="" />말이 끄는 수레의 무게 한도는 말에 따라 달라요.</p>
      <section class="ware-gold"><img src="${coinsImg}" alt="" /><b>보유 골드</b><strong>${won(v.gold)}</strong></section>`;
    body.querySelector('[data-repair]')?.addEventListener('click', () => page.send({ type: 'repairCart' }));
    body.querySelectorAll<HTMLButtonElement>('[data-cart]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'buyCart', cart: b.dataset.cart as (typeof v.carts)[number]['type'] })),
    );
  });
}
