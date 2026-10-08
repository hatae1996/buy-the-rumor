// 두 번째 행렬 카드와 지시서 (기획서 "지도 탭", 시안 prototypes/screens-0.0.5.html의 지시서).
// 마을을 차례로 넣으면 길이 되고, 마을마다 "무엇을 얼마까지 사고/팔지"를 넣는다. 마부는 지시를 바꾸지 않는다.
import { CART } from '../../sim/constants';
import { GOODS, type GoodId, type PlayerView } from '../../sim/economy';
import type { CaravanPlan, CaravanStop } from '../../sim/caravan';
import type { CartType } from '../../sim/cart';
import { euro } from '../../sim/josa';
import { goodName, money } from '../format';
import type { Game } from '../game';
import { openLiveSheet, type LiveSheet } from '../liveSheet';

const goodOptions = (sel: GoodId) => GOODS.map((g) => `<option value="${g}" ${g === sel ? 'selected' : ''}>${goodName(g)}</option>`).join('');

export function openCaravanSheet(game: Game): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const townOptions = (sel: number) => game.map.towns.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`).join('');
  /** 고치는 중인 지시서 (보내기 전까지는 쪽지 안에만 있다) */
  let draft: CaravanPlan | null = null;

  const drawEditor = (body: HTMLElement, sheet: LiveSheet) => {
    const plan = draft!;
    body.innerHTML = editorHtml(plan, townOptions);
    const redraw = () => drawEditor(body, sheet);
    const ij = (s: string) => s.split(':').map(Number) as [number, number];
    const on = <T extends HTMLElement>(sel: string, ev: string, fn: (el: T) => void, again = false) =>
      body.querySelectorAll<T>(sel).forEach((el) =>
        el.addEventListener(ev, () => {
          fn(el);
          if (again) redraw();
        }),
      );
    const num = (el: HTMLInputElement) => Math.max(1, Math.floor(Number(el.value) || 1));
    on<HTMLSelectElement>('[data-town]', 'change', (el) => (plan.stops[Number(el.dataset.town)]!.town = Number(el.value)));
    on<HTMLSelectElement>('[data-buy-good]', 'change', (el) => {
      const [i, j] = ij(el.dataset.buyGood!);
      plan.stops[i]!.buys[j]!.good = el.value as GoodId;
    });
    on<HTMLInputElement>('[data-buy-qty]', 'change', (el) => {
      const [i, j] = ij(el.dataset.buyQty!);
      plan.stops[i]!.buys[j]!.qty = num(el);
    });
    on<HTMLInputElement>('[data-buy-price]', 'change', (el) => {
      const [i, j] = ij(el.dataset.buyPrice!);
      plan.stops[i]!.buys[j]!.maxPrice = num(el);
    });
    on<HTMLSelectElement>('[data-sell-good]', 'change', (el) => {
      const [i, j] = ij(el.dataset.sellGood!);
      plan.stops[i]!.sells[j]!.good = el.value as GoodId;
    });
    on<HTMLInputElement>('[data-sell-price]', 'change', (el) => {
      const [i, j] = ij(el.dataset.sellPrice!);
      plan.stops[i]!.sells[j]!.minPrice = num(el);
    });
    on<HTMLInputElement>('[data-repeat]', 'change', (el) => (plan.repeat = el.checked));
    on('[data-add-stop]', 'click', () => plan.stops.push({ town: plan.stops.at(-1)?.town ?? 0, buys: [], sells: [] }), true);
    on('[data-del-stop]', 'click', (el) => plan.stops.splice(Number(el.dataset.delStop), 1), true);
    on('[data-add-buy]', 'click', (el) => plan.stops[Number(el.dataset.addBuy)]!.buys.push({ good: 'salt', qty: 10, maxPrice: 10 }), true);
    on('[data-add-sell]', 'click', (el) => plan.stops[Number(el.dataset.addSell)]!.sells.push({ good: 'salt', qty: 'all', minPrice: 10 }), true);
    on('[data-del-buy]', 'click', (el) => {
      const [i, j] = ij(el.dataset.delBuy!);
      plan.stops[i]!.buys.splice(j, 1);
    }, true);
    on('[data-del-sell]', 'click', (el) => {
      const [i, j] = ij(el.dataset.delSell!);
      plan.stops[i]!.sells.splice(j, 1);
    }, true);
    on('[data-cancel-edit]', 'click', () => {
      draft = null;
      sheet.close();
    });
    on('[data-send]', 'click', () => {
      // 보내면 행렬 카드로 돌아간다 (실패하면 쪽지 아래에 까닭이 뜨고 고치던 것은 남는다)
      const sent = draft;
      draft = null;
      if (!sheet.send({ type: 'setCaravanPlan', plan: sent! })) {
        draft = sent;
        redraw();
      }
    });
  };

  openLiveSheet(game, '두 번째 행렬', (body, v, sheet) => {
    const c = v.caravan;
    if (!c) {
      body.innerHTML = formHtml(v);
      body.querySelector('[data-form]')?.addEventListener('click', () => {
        const horseIds = [...body.querySelectorAll<HTMLInputElement>('[data-horse]:checked')].map((i) => Number(i.value));
        const cart = body.querySelector<HTMLSelectElement>('[data-cart]')!.value as CartType;
        sheet.send({ type: 'formCaravan', horseIds, cart });
      });
      return;
    }
    if (draft) return drawEditor(body, sheet);
    const where = c.travel ? `${euro(townName(c.travel.to))} 가는 중 · ${c.travel.daysLeft}일 남음` : `${townName(c.town)}에 있어요`;
    const plan = c.plan
      ? `<ol class="list">${c.plan.stops
          .map(
            (s, i) => `<li>${i === c.stop ? '▶ ' : ''}<b>${townName(s.town)}</b> ${
              [
                ...s.buys.map((b) => `사기 ${goodName(b.good)} ${b.qty}개 최대 ${b.maxPrice}`),
                ...s.sells.map((x) => `팔기 ${goodName(x.good)} ${x.qty === 'all' ? '전부' : `${x.qty}개`} 최소 ${x.minPrice}`),
              ].join(' · ') || '들르기만'
            }</li>`,
          )
          .join('')}</ol><p class="muted">${c.plan.repeat ? '끝나면 1번부터 다시' : '끝나면 그 마을에서 멈춰요'}</p>`
      : `<p class="muted">${c.recalled ? '내가 있는 마을로 오는 중이에요.' : '지시서가 없어요. 지시서를 보내면 다음 장날부터 움직여요.'}</p>`;
    body.innerHTML = `
      <p><b>마부 ${c.carter ?? '없음'}</b> · ${c.horses.map((h) => h.name).join(', ') || '말 없음'} · ${c.cart.name}</p>
      <p class="muted">${where} · 무게 ${c.cart.weight}/${c.cart.maxWeight}</p>
      ${c.carter ? '' : '<p class="warn">마부가 떠나 행렬이 멈췄어요. 그 마을에 가서 행렬을 푸세요.</p>'}
      <h3>지시서</h3>
      ${plan}
      <p class="muted">짐은 마부가 알아서 실어요 (칸 80%). 마부는 소문을 듣고 지시를 바꾸지 않아요.</p>
      <div class="btn-row">
        <button type="button" class="secondary-btn" data-edit ${c.carter ? '' : 'disabled'}>지시서 고치기</button>
        <button type="button" class="secondary-btn" data-recall ${c.here ? 'disabled' : ''}>불러들이기</button>
        ${c.here ? '<button type="button" class="secondary-btn" data-disband>행렬 풀기<small>수레는 팔고 말은 내 행렬로</small></button>' : ''}
      </div>`;
    body.querySelector('[data-edit]')?.addEventListener('click', () => {
      draft = c.plan ? (JSON.parse(JSON.stringify(c.plan)) as CaravanPlan) : { stops: [{ town: c.town, buys: [], sells: [] }], repeat: true };
      drawEditor(body, sheet);
    });
    body.querySelector('[data-recall]')?.addEventListener('click', () => sheet.send({ type: 'recallCaravan' }));
    body.querySelector('[data-disband]')?.addEventListener('click', () => sheet.send({ type: 'disbandCaravan' }));
  });
}

/** 행렬이 없을 때: 꾸리기 (마부, 내 말 중 일부, 이 마을 수레방에서 살 수레) */
function formHtml(v: PlayerView): string {
  const carter = v.hires.find((h) => h.role === 'carter');
  if (!carter) return '<p class="muted">여관 고용 게시판에서 마부를 고용하면 두 번째 행렬을 꾸릴 수 있어요.</p>';
  const horses = v.horses
    .map((h) => `<label class="row"><span><input type="checkbox" data-horse value="${h.id}" /> ${h.name}</span><small class="muted">끄는 무게 ${h.pull}</small></label>`)
    .join('');
  const carts = v.carts.filter((c) => c.horses > 0 || c.type === 'handcart');
  return `
    <p>마부 <b>${carter.name}</b>와 내 말, 이 마을 수레방에서 새로 살 수레로 꾸려요. 말은 두 행렬 합쳐 2필까지예요.</p>
    ${horses ? `<h3>데려갈 말</h3>${horses}` : '<p class="warn">말이 없어요. 목장 마을 마구간에서 사 오세요.</p>'}
    ${
      carts.length
        ? `<h3>행렬 수레</h3><select data-cart>${carts.map((c) => `<option value="${c.type}">${c.name} · ${money(CART.types[c.type].price)}</option>`).join('')}</select>`
        : '<p class="warn">이 마을에는 수레방이 없어요. 목재 마을이나 도시에서 꾸려요.</p>'
    }
    <button type="button" class="primary-btn" data-form ${horses && carts.length ? '' : 'disabled'}>행렬 꾸리기</button>`;
}

function editorHtml(plan: CaravanPlan, townOptions: (sel: number) => string): string {
  const stop = (s: CaravanStop, i: number) => `
    <section class="card plan-stop">
      <header class="card-head"><b>${i + 1}</b><select data-town="${i}">${townOptions(s.town)}</select><button type="button" class="link-btn" data-del-stop="${i}" ${plan.stops.length <= 1 ? 'disabled' : ''}>빼기</button></header>
      ${s.buys
        .map(
          (b, j) => `<div class="plan-line">사기 <select data-buy-good="${i}:${j}">${goodOptions(b.good)}</select>
            <input type="number" min="1" inputmode="numeric" data-buy-qty="${i}:${j}" value="${b.qty}" />개 최대
            <input type="number" min="1" inputmode="numeric" data-buy-price="${i}:${j}" value="${b.maxPrice}" />
            <button type="button" class="link-btn" data-del-buy="${i}:${j}" aria-label="빼기">✕</button></div>`,
        )
        .join('')}
      ${s.sells
        .map(
          (x, j) => `<div class="plan-line">팔기 <select data-sell-good="${i}:${j}">${goodOptions(x.good)}</select> 전부 최소
            <input type="number" min="1" inputmode="numeric" data-sell-price="${i}:${j}" value="${x.minPrice}" />
            <button type="button" class="link-btn" data-del-sell="${i}:${j}" aria-label="빼기">✕</button></div>`,
        )
        .join('')}
      <div class="btn-row"><button type="button" class="link-btn" data-add-buy="${i}">+ 사기</button><button type="button" class="link-btn" data-add-sell="${i}">+ 팔기</button></div>
    </section>`;
  return `
    <p class="muted">마을을 차례로 넣고, 마을마다 무엇을 얼마까지 사고팔지 적어요. 다섯 마을까지.</p>
    ${plan.stops.map(stop).join('')}
    <div class="btn-row"><button type="button" class="secondary-btn" data-add-stop ${plan.stops.length >= 5 ? 'disabled' : ''}>+ 마을 넣기</button></div>
    <label class="row"><span><input type="checkbox" data-repeat ${plan.repeat ? 'checked' : ''} /> 끝나면 1번부터 다시</span></label>
    <div class="btn-row"><button type="button" class="secondary-btn" data-cancel-edit>그만두기</button><button type="button" class="primary-btn" data-send>지시서 보내기</button></div>`;
}
