// 마구간(말 사고팔기)과 수레방(수레 바꾸기) 쪽지 (기획서 "말").
// 말은 장날이 아니라 마구간에서 사고판다. 사기는 신청해 두면 그날 밤 신청한 사람 중에서 뽑고(0.1.0), 되팔기는 바로.
// 마구간 남은 수는 그 마을에 와야만 보인다.
import houseImg from '../../../assets/ui/house_red.png';
import wheelImg from '../../../assets/ui/cartshop_wheel.png';
import coinsImg from '../../../assets/ui/coins_stack.png';
import infoImg from '../../../assets/ui/icon_info.png';
import { CART_IMG } from '../cartBoard';
import { openLivePage } from '../livePage';
import type { HorseKindInfo, HorseView, PlayerView } from '../../sim/economy';
import { HORSES } from '../../sim/constants';
import { eulReul } from '../../sim/josa';
import { ERROR_TEXT, money } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';

/** 이동 일수 배율을 말로 */
export function speedWord(speed: number): string {
  if (speed < 0.75) return '빠름';
  if (speed < 1) return '조금 빠름';
  return '사람 걸음';
}

function kindLine(k: HorseKindInfo): string {
  return `끄는 무게 ${k.pull} · ${speedWord(k.speed)} · 하루 곡물 ${k.feed}`;
}

/** 말 피로 막대 (플레이어 피로와 같은 모양) */
export function horseFatigue(h: HorseView): string {
  const cells = Array.from({ length: h.fatigueMax }, (_, i) => `<i class="${i < h.fatigue ? 'on' : ''}"></i>`).join('');
  const word = h.hungry ? `${h.hungry}일째 굶었어요` : h.fatigue >= h.fatigueMax ? '다 지쳤어요' : h.tired ? '많이 지쳤어요' : h.fatigue ? '괜찮아요' : '쌩쌩해요';
  return `<div class="fatigue"><div class="fatigue-cells" aria-hidden="true">${cells}</div><span${h.hungry ? ' class="warn"' : ''}>${word}</span></div>`;
}

export function openStableSheet(game: Game): void {
  const sheet = openSheet('마구간');
  let error = '';
  let done = '';

  const render = () => {
    const v: PlayerView = game.view();
    const stable = v.stable;
    if (!stable) {
      sheet.close();
      return;
    }
    const waiting = v.draws.filter((d) => d.kind === 'horse' && d.town === stable.town);
    const full = v.horses.length + v.draws.filter((d) => d.kind === 'horse').length >= HORSES.maxPerOwner;
    const buy = stable.horses
      .map((k) => {
        const asked = waiting.find((d) => d.horse === k.kind);
        return `<li class="row">
          <span><b>${k.name}</b> <span class="muted">${k.stock ? `${k.stock}마리 남음` : '없음'}</span><br /><small class="muted">${kindLine(k)}</small></span>
          ${
            asked
              ? `<button type="button" class="secondary-btn" data-cancel="${asked.id}">신청 거두기<small>오늘 밤 추첨 · ${money(asked.reserved)} 맡김</small></button>`
              : `<button type="button" class="secondary-btn" data-buy="${k.kind}" ${k.price === null || full || v.gold < k.price ? 'disabled' : ''}>
            사기 신청<small>${k.price === null ? '남은 말 없음' : money(k.price)}</small>
          </button>`
          }
        </li>`;
      })
      .join('');
    const mine = v.horses
      .map(
        (h) => `<li class="row">
          <span><b>${h.name}</b><br /><small class="muted">${kindLine(h)}</small></span>
          <button type="button" class="secondary-btn" data-sell="${h.id}" ${h.sellPrice === null ? 'disabled' : ''}>
            되팔기<small>${h.sellPrice === null ? '' : money(h.sellPrice)}</small>
          </button>
        </li>`,
      )
      .join('');
    sheet.body.innerHTML = `
      <p class="muted">말은 시즌마다 정해진 수만 목장에서 나와요. 남은 수가 적을수록 비싸요. 한 사람 두 필까지.</p>
      <p class="muted">사겠다고 신청하면 오늘 밤 신청한 사람 중에서 뽑아요. 먼저 신청한다고 유리하지 않아요. 뽑히지 않으면 맡긴 돈은 그대로 돌아와요.</p>
      <ul class="list">${buy}</ul>
      ${mine ? `<h3>내 말</h3><ul class="list">${mine}</ul>` : ''}
      ${done ? `<p>${done}</p>` : ''}
      ${error ? `<p class="error">${error}</p>` : ''}`;
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const kind = b.dataset.buy as HorseKindInfo['kind'];
        const r = game.dispatch({ type: 'buyHorse', kind });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        done = r.ok ? `${eulReul(stable.horses.find((k) => k.kind === kind)!.name)} 사겠다고 신청했어요. 오늘 밤 뽑아요.` : '';
        render();
      }),
    );
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = game.dispatch({ type: 'cancelDraw', drawId: Number(b.dataset.cancel) });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        done = r.ok ? '신청을 거두고 맡긴 돈을 돌려받았어요.' : '';
        render();
      }),
    );
    sheet.body.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = game.dispatch({ type: 'sellHorse', horseId: Number(b.dataset.sell) });
        error = r.ok ? '' : ERROR_TEXT[r.error];
        done = r.ok ? '말을 마구간에 돌려주었어요.' : '';
        render();
      }),
    );
  };
  render();
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
              : `<button type="button" class="rumor-note" disabled>교체 · ${won(c.cost)}</button><small>금화 부족</small>`;
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
      <section class="ware-gold"><img src="${coinsImg}" alt="" /><b>보유 금화</b><strong>${won(v.gold)}</strong></section>`;
    body.querySelector('[data-repair]')?.addEventListener('click', () => page.send({ type: 'repairCart' }));
    body.querySelectorAll<HTMLButtonElement>('[data-cart]').forEach((b) =>
      b.addEventListener('click', () => page.send({ type: 'buyCart', cart: b.dataset.cart as (typeof v.carts)[number]['type'] })),
    );
  });
}
