// 두 번째 행렬 페이지 (기획서 "지도 탭", 0.1.6 목업 docs/reference/caravan-mockup-0.1.6.png).
// 세 화면: 행렬 편성(준비 상태와 수레 고르기) → 행렬 관리(지금 상태, 지시서, 한 번 가서 팔기) → 지시서 편집.
// 지시서는 마을을 차례로 넣고, 마을마다 "무엇을 얼마까지 사고/팔지"를 넣는다. 마부는 지시를 바꾸지 않는다.
// 0.0.8: 두 번째 행렬은 큰 주문 도구라, "이 마을로 가서 이것을 판다" 한 번짜리 지시를 바로 보낸다 (반복 없음).
import wagonImg from '../../../assets/ui/travel_horse_wagon.png';
import cartIcon from '../../../assets/ui/travel_wagon.png';
import horseHeadImg from '../../../assets/ui/icon_horse_head.png';
import scrollImg from '../../../assets/ui/plan_scroll.png';
import weightImg from '../../../assets/ui/icon_weight.png';
import infoImg from '../../../assets/ui/icon_info.png';
import pinImg from '../../../assets/ui/icon_pin.png';
import innImg from '../../../assets/ui/bld_inn.png';
import houseImg from '../../../assets/ui/travel_house.png';
import { CART, GROWTH } from '../../sim/constants';
import { GOODS, type CaravanView, type GoodId, type PlayerView } from '../../sim/economy';
import type { CaravanPlan, CaravanStop } from '../../sim/caravan';
import { isGood, type CartType } from '../../sim/cart';
import { euro } from '../../sim/josa';
import { goodName, money } from '../format';
import type { Game } from '../game';
import { itemArt } from '../itemArt';
import { openLivePage, type LivePage } from '../livePage';
import { portraitHtml } from '../portrait/portrait';

/** 한 번 가서 팔기를 미리 채워 여는 값 (시장의 큰 주문에서 열 때) */
export interface QuickSell {
  town: number;
  good: GoodId;
  minPrice: number;
  /** 'all'이면 실은 것 전부 */
  qty?: number | 'all';
}

const MAX_STOPS = GROWTH.caravan.maxStops;
/** 파는 수량 고르기 (전부 또는 몇 개) */
const SELL_QTYS = [5, 10, 20, 30, 50] as const;

const ICON = {
  send: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 11.5 21 3l-6.5 18-3-7.5zM11.5 13.5 21 3" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="currentColor"/><path d="M9 11h7M9 15h7M9 7h4" stroke="#2f8f8a" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  recall: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor"/></svg>`,
  disband: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 4h2.5l2 11h10l2-8H7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19" r="1.7" fill="currentColor"/><circle cx="17" cy="19" r="1.7" fill="currentColor"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

const goodOptions = (sel: GoodId) => GOODS.map((g) => `<option value="${g}" ${g === sel ? 'selected' : ''}>${goodName(g)}</option>`).join('');
const goodPic = (g: GoodId) => {
  const src = itemArt(g);
  return src ? `<img src="${src}" alt="" data-good-pic />` : '<i data-good-pic></i>';
};
const sellQtyOptions = (sel: number | 'all') =>
  [`<option value="all" ${sel === 'all' ? 'selected' : ''}>전부</option>`, ...[...new Set([...SELL_QTYS, ...(sel === 'all' ? [] : [sel])])].sort((a, b) => a - b).map((n) => `<option value="${n}" ${n === sel ? 'selected' : ''}>${n}개</option>`)].join('');
const readQty = (value: string): number | 'all' => (value === 'all' ? 'all' : Math.max(1, Math.floor(Number(value) || 1)));
const num = (el: HTMLInputElement) => Math.max(1, Math.floor(Number(el.value) || 1));

export function openCaravanSheet(game: Game, preset?: QuickSell, back = '지도'): void {
  const townName = (id: number) => game.map.towns[id]!.name;
  const townOptions = (sel: number) => game.map.towns.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`).join('');
  /** 고치는 중인 지시서 (보내기 전까지는 페이지 안에만 있다) */
  let draft: CaravanPlan | null = null;
  /** 한 번 가서 팔기 칸 (다시 그려도 남는다) */
  let quick: QuickSell | null = preset ?? null;
  /** 편성: 고른 말과 수레 ("수레:buy" 또는 "수레:rent") */
  const picked = new Set<number>();
  let cartPick = '';
  /** 해산은 두 번 눌러야 한다 */
  let disbandArmed = false;

  openLivePage(game, { back, title: '두 번째 행렬', sub: '행렬 관리' }, (body, v, page) => {
    const sub = page.el.querySelector('.page-head h2 small');
    const setSub = (s: string) => {
      if (sub) sub.textContent = s;
    };
    const c = v.caravan;
    if (!c) {
      setSub('행렬 편성');
      drawForm(body, v, page);
      return;
    }
    if (draft) {
      setSub('지시서 편집');
      drawEditor(body, page);
      return;
    }
    setSub('행렬 관리');
    drawManage(body, v, c, page);
  });

  // ───── 행렬 편성 ─────
  function drawForm(body: HTMLElement, v: PlayerView, page: LivePage): void {
    const carter = v.hires.find((h) => h.role === 'carter');
    for (const id of picked) if (!v.horses.some((h) => h.id === id)) picked.delete(id);
    const carts = v.carts.filter((c) => c.horses > 0 || c.type === 'handcart');
    const cartChoices = carts.flatMap((c) => [
      ...(c.rentPerDay !== null ? [{ value: `${c.type}:rent`, label: `${c.name} 빌리기`, price: `하루 ${money(c.rentPerDay)}골드` }] : []),
      { value: `${c.type}:buy`, label: `${c.name} 사기`, price: `${money(CART.types[c.type].price)}골드` },
    ]);
    if (!cartChoices.some((o) => o.value === cartPick)) cartPick = '';
    const chosenCart = cartChoices.find((o) => o.value === cartPick);

    const state = (ok: boolean, okText: string, badText: string, soft = false) =>
      ok ? `<span class="cv-state ok"><i>✓</i>${okText}</span>` : `<span class="cv-state ${soft ? 'soft' : 'bad'}"><i>!</i>${badText}</span>`;
    const face = carter ? portraitHtml(game.hireFaces()[carter.id], 40, carter.name) : `<img src="${innImg}" alt="" />`;
    const horseOk = picked.size > 0;
    const missing = !carter
      ? { btn: '마부를 고용해 주세요', hint: '여관 고용 게시판에서 마부를 고용하세요.', icon: innImg }
      : !v.horses.length
        ? { btn: '말을 준비해 주세요', hint: '목장 마을의 마구간에서 말을 구입하세요.', icon: houseImg }
        : !horseOk
          ? { btn: '데려갈 말을 골라 주세요', hint: '', icon: '' }
          : !cartChoices.length
            ? { btn: '수레방이 있는 마을에서 꾸려요', hint: '이 마을에는 수레방이 없어요. 목재 마을이나 도시로 가 보세요.', icon: houseImg }
            : !chosenCart
              ? { btn: '수레를 골라 주세요', hint: '', icon: '' }
              : null;
    const horses = v.horses.length
      ? `<div class="cv-horses">${v.horses
          .map(
            (h) => `<label class="cv-horse${picked.has(h.id) ? ' on' : ''}"><input type="checkbox" data-horse value="${h.id}" ${picked.has(h.id) ? 'checked' : ''} />
              <img src="${horseHeadImg}" alt="" /><span><b>${h.name}</b><small>끄는 무게 ${h.pull}</small></span></label>`,
          )
          .join('')}</div>`
      : '';

    body.innerHTML = `
      <p class="cv-lead">마을을 오가며 물건을 사고팔 두 번째 행렬을 준비해 주세요.</p>
      <img class="cv-hero" src="${wagonImg}" alt="" />
      <section class="cv-card">
        <h3>준비 상태</h3>
        <ul class="cv-ready">
          <li><span class="cv-ready-pic face">${face}</span><b>${carter ? `마부 ${carter.name}` : '마부'}</b>${state(!!carter, '고용 중', '고용 필요')}</li>
          <li><span class="cv-ready-pic"><img src="${horseHeadImg}" alt="" /></span><b>말</b>${state(horseOk, `${picked.size}필 데려감`, v.horses.length ? '고르기 필요' : '보유한 말 없음', v.horses.length > 0)}</li>
          <li><span class="cv-ready-pic"><img src="${cartIcon}" alt="" /></span><b>수레</b>${state(!!chosenCart, chosenCart?.label ?? '', '선택 필요', true)}</li>
        </ul>
        ${horses}
        ${missing?.hint ? `<p class="cv-hint"><img src="${missing.icon}" alt="" />${missing.hint}</p>` : ''}
      </section>
      <section class="cv-card">
        <h3 class="cv-h-icon"><img src="${cartIcon}" alt="" />행렬에 사용할 수레</h3>
        ${
          cartChoices.length
            ? `<label class="cv-select big"><img src="${cartIcon}" alt="" /><select data-cart aria-label="행렬에 사용할 수레">
                <option value="" ${cartPick ? '' : 'selected'}>수레를 고르세요</option>
                ${cartChoices.map((o) => `<option value="${o.value}" ${o.value === cartPick ? 'selected' : ''}>${o.label} · ${o.price}</option>`).join('')}
              </select></label>`
            : '<p class="cv-muted">이 마을에는 수레방이 없어요.</p>'
        }
        <ul class="cv-info">
          <li><img src="${infoImg}" alt="" />빌린 수레는 해산할 때 반납해요. 밤마다 하루 값을 내요.</li>
          <li><img src="${infoImg}" alt="" />구입한 수레는 해산할 때 반값에 팔아요.</li>
        </ul>
        <p class="cv-strip"><img src="${horseHeadImg}" alt="" />말은 두 행렬을 합쳐 최대 2필까지예요.</p>
      </section>
      <button type="button" class="cv-btn coral big" data-form ${missing ? 'disabled' : ''}>${missing ? missing.btn : '행렬 꾸리기'}</button>`;

    body.querySelectorAll<HTMLInputElement>('[data-horse]').forEach((el) =>
      el.addEventListener('change', () => {
        const id = Number(el.value);
        if (el.checked) picked.add(id);
        else picked.delete(id);
        page.redraw();
      }),
    );
    body.querySelector<HTMLSelectElement>('[data-cart]')?.addEventListener('change', (e) => {
      cartPick = (e.target as HTMLSelectElement).value;
      page.redraw();
    });
    body.querySelector('[data-form]')?.addEventListener('click', async () => {
      const [cart, how] = cartPick.split(':') as [CartType, string];
      if (await page.send({ type: 'formCaravan', horseIds: [...picked], cart, rent: how === 'rent' })) {
        picked.clear();
        cartPick = '';
      }
    });
  }

  // ───── 행렬 관리 ─────
  function drawManage(body: HTMLElement, v: PlayerView, c: CaravanView, page: LivePage): void {
    // 한 번 가서 팔기: 정하지 않았으면 행렬 짐 중 가장 많은 것을 행렬이 있는 마을에서, 기억하는 값으로
    const cargo = new Map<GoodId, number>();
    for (const p of c.cart.pieces) if (isGood(p.good)) cargo.set(p.good, (cargo.get(p.good) ?? 0) + p.qty);
    const knownPrice = (town: number, good: GoodId) => v.memory[town]?.prices[good] ?? (v.market?.town === town ? v.market.price[good] : 1);
    if (!quick) {
      const good = [...cargo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'salt';
      quick = { town: c.town, good, minPrice: knownPrice(c.town, good) };
    }
    const q = quick;
    const share = c.cart.maxWeight ? Math.min(100, Math.round((c.cart.weight / c.cart.maxWeight) * 100)) : 0;
    const where = c.travel
      ? `<span><small>가는 길</small><b>${euro(townName(c.travel.to))} · ${c.travel.daysLeft}일 남음</b></span>`
      : `<span><small>현재 마을</small><b>${townName(c.town)}</b></span>`;
    const lines = (s: CaravanStop) =>
      [
        ...s.buys.map((b) => `<span class="cv-tag buy">사기</span>${goodName(b.good)} ${b.qty}개 · 최대 ${money(b.maxPrice)}골드`),
        ...s.sells.map((x) => `<span class="cv-tag sell">팔기</span>${goodName(x.good)} ${x.qty === 'all' ? '전부' : `${x.qty}개`} · 최소 ${money(x.minPrice)}골드`),
      ]
        .map((l) => `<li>${l}</li>`)
        .join('') || '<li class="cv-muted">들르기만</li>';
    const plan = c.plan
      ? `<ol class="cv-plan">${c.plan.stops
          .map((s, i) => `<li class="${i === c.stop ? 'now' : ''}"><i>${i + 1}</i><div><b>${townName(s.town)}${i === c.stop ? '<small>지금 차례</small>' : ''}</b><ul>${lines(s)}</ul></div></li>`)
          .join('')}</ol><p class="cv-muted">${c.plan.repeat ? '마지막 마을을 마치면 처음부터 반복해요.' : '마지막 마을을 마치면 그 마을에 머물러요.'}</p>`
      : `<div class="cv-empty"><img src="${scrollImg}" alt="" /><b>${c.recalled ? '내가 있는 마을로 오는 중이에요.' : '아직 지시서가 없어요.'}</b>${c.recalled ? '' : '<small>보내면 다음 장날부터 움직여요.</small>'}</div>`;
    const horseNames = c.horses.map((h) => h.name).join(', ') || '말 없음';
    const disbandSub = disbandArmed ? '한 번 더 누르면 해산해요' : `${c.rent ? '대여 수레 반납' : '수레는 반값에 팔고'} · 말은 내 행렬로`;

    body.innerHTML = `
      <section class="cv-card cv-status">
        <div class="cv-status-top">
          <img src="${wagonImg}" alt="" />
          <div>
            <b>마부 ${c.carter ?? '없음'} · ${horseNames}</b>
            <small>${c.cart.name}${c.rent ? ' · 대여 중' : ''}</small>
            ${c.rent ? `<span class="cv-chip">하루 ${money(c.rent.perDay)}골드</span>` : ''}
          </div>
        </div>
        <div class="cv-status-row">
          <div class="cv-where"><img src="${pinImg}" alt="" />${where}</div>
          <div class="cv-weight"><img src="${weightImg}" alt="" /><span><small>적재 무게</small><i class="cv-bar"><i style="width:${share}%"></i></i><em>${c.cart.weight} / ${c.cart.maxWeight}</em></span></div>
        </div>
        ${c.rent?.owed ? `<p class="cv-muted">밀린 수레 값 ${money(c.rent.owed)}골드 (행렬을 풀 때 다 내요)</p>` : ''}
      </section>
      ${c.carter ? '' : '<p class="cv-hint"><img src="' + innImg + '" alt="" />마부가 떠나 행렬이 멈췄어요. 그 마을에 가서 행렬을 푸세요.</p>'}
      <section class="cv-card">
        <h3 class="cv-h-icon"><img src="${scrollImg}" alt="" />현재 지시서</h3>
        ${plan}
      </section>
      <ul class="cv-info box">
        <li><img src="${infoImg}" alt="" />짐은 마부가 알아서 실어요. 칸의 80%까지예요.</li>
        <li><img src="${infoImg}" alt="" />마부는 소문에 따라 지시서를 바꾸지 않아요.</li>
      </ul>
      ${
        c.carter
          ? `<section class="cv-card">
        <h3 class="cv-h-icon"><span class="cv-h-svg">${ICON.cart}</span>한 번 가서 팔기</h3>
        <div class="cv-quick">
          <label><small>목적지</small><span class="cv-select"><img src="${pinImg}" alt="" /><select data-quick-town aria-label="목적지">${townOptions(q.town)}</select></span></label>
          <label><small>물품</small><span class="cv-select">${goodPic(q.good)}<select data-quick-good aria-label="물품">${goodOptions(q.good)}</select></span></label>
          <label><small>수량</small><span class="cv-select plain"><select data-quick-qty aria-label="수량">${sellQtyOptions(q.qty ?? 'all')}</select></span></label>
          <label><small>최소 단가</small><span class="cv-num"><input type="number" min="1" inputmode="numeric" data-quick-price aria-label="최소 단가" value="${q.minPrice}" /><em>골드</em></span></label>
        </div>
        <p class="cv-muted">행렬 짐: ${[...cargo.entries()].map(([g, n]) => `${goodName(g)} ${n}`).join(', ') || '없음'} · 지금 지시서 대신 보내요. 다 팔면 도착한 마을에 머물러요.</p>
        <button type="button" class="cv-btn coral" data-quick-send>${ICON.send}판매 지시 보내기</button>
        <div class="cv-two">
          <button type="button" class="cv-btn teal" data-edit>${ICON.edit}지시서 편집</button>
          <button type="button" class="cv-btn grey" data-recall ${c.here || c.recalled ? 'disabled' : ''}>${ICON.recall}불러들이기</button>
        </div>
      </section>`
          : ''
      }
      <button type="button" class="cv-disband${disbandArmed ? ' armed' : ''}" data-disband ${c.here ? '' : 'disabled'}>
        <span class="cv-disband-i">${ICON.disband}</span>
        <span><b>행렬 해산</b><small>${c.here ? disbandSub : '행렬이 내 마을에 와야 풀 수 있어요'}</small></span>
        ${ICON.chevron}
      </button>`;

    const setPrice = () => {
      q.minPrice = knownPrice(q.town, q.good);
      body.querySelector<HTMLInputElement>('[data-quick-price]')!.value = String(q.minPrice);
    };
    body.querySelector<HTMLSelectElement>('[data-quick-town]')?.addEventListener('change', (e) => {
      q.town = Number((e.target as HTMLSelectElement).value);
      setPrice();
    });
    body.querySelector<HTMLSelectElement>('[data-quick-good]')?.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      q.good = sel.value as GoodId;
      sel.parentElement!.querySelector('[data-good-pic]')!.outerHTML = goodPic(q.good);
      setPrice();
    });
    body.querySelector<HTMLSelectElement>('[data-quick-qty]')?.addEventListener('change', (e) => (q.qty = readQty((e.target as HTMLSelectElement).value)));
    body.querySelector<HTMLInputElement>('[data-quick-price]')?.addEventListener('change', (e) => (q.minPrice = num(e.target as HTMLInputElement)));
    body.querySelector('[data-quick-send]')?.addEventListener('click', () => {
      page.send({ type: 'setCaravanPlan', plan: { stops: [{ town: q.town, buys: [], sells: [{ good: q.good, qty: q.qty ?? 'all', minPrice: q.minPrice }] }], repeat: false } });
    });
    body.querySelector('[data-edit]')?.addEventListener('click', () => {
      // 새 지시서는 한 번짜리가 기본이다 (0.0.8: 같은 길을 도는 반복은 장이 넘치기 쉽다)
      draft = c.plan ? (JSON.parse(JSON.stringify(c.plan)) as CaravanPlan) : { stops: [{ town: c.town, buys: [], sells: [] }], repeat: false };
      page.redraw();
      page.body.scrollTop = 0;
    });
    body.querySelector('[data-recall]')?.addEventListener('click', () => page.send({ type: 'recallCaravan' }));
    body.querySelector('[data-disband]')?.addEventListener('click', async () => {
      if (!disbandArmed) {
        disbandArmed = true;
        page.redraw();
        return;
      }
      disbandArmed = false;
      if (!await page.send({ type: 'disbandCaravan' })) page.redraw();
    });
  }

  // ───── 지시서 편집 ─────
  function drawEditor(body: HTMLElement, page: LivePage): void {
    const plan = draft!;
    body.innerHTML = editorHtml(plan, townOptions);
    const redraw = () => page.redraw();
    const ij = (s: string) => s.split(':').map(Number) as [number, number];
    const on = <T extends HTMLElement>(sel: string, ev: string, fn: (el: T) => void, again = false) =>
      body.querySelectorAll<T>(sel).forEach((el) =>
        el.addEventListener(ev, () => {
          fn(el);
          if (again) redraw();
        }),
      );
    on<HTMLSelectElement>('[data-town]', 'change', (el) => (plan.stops[Number(el.dataset.town)]!.town = Number(el.value)));
    on<HTMLSelectElement>('[data-buy-good]', 'change', (el) => {
      const [i, j] = ij(el.dataset.buyGood!);
      plan.stops[i]!.buys[j]!.good = el.value as GoodId;
    }, true);
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
    }, true);
    on<HTMLSelectElement>('[data-sell-qty]', 'change', (el) => {
      const [i, j] = ij(el.dataset.sellQty!);
      plan.stops[i]!.sells[j]!.qty = readQty(el.value);
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
      redraw();
    });
    on('[data-send]', 'click', async () => {
      // 보내면 행렬 관리로 돌아간다 (실패하면 아래에 까닭이 뜨고 고치던 것은 남는다)
      const sent = draft;
      draft = null;
      if (!await page.send({ type: 'setCaravanPlan', plan: sent! })) {
        draft = sent;
        redraw();
      }
    });
  }
}

function editorHtml(plan: CaravanPlan, townOptions: (sel: number) => string): string {
  const head = (kind: 'buy' | 'sell', i: number, j: number) =>
    `<div class="cv-line-head ${kind}"><span>${ICON.cart}</span><b>${kind === 'buy' ? '사기' : '팔기'}</b><button type="button" class="cv-x" data-del-${kind}="${i}:${j}" aria-label="${kind === 'buy' ? '사기' : '팔기'} 빼기">✕</button></div>`;
  const stop = (s: CaravanStop, i: number) => `
    <li class="cv-stop">
      <i class="cv-stop-n">${i + 1}</i>
      <section class="cv-card">
        <div class="cv-stop-head">
          <span class="cv-select big"><img src="${pinImg}" alt="" /><select data-town="${i}" aria-label="${i + 1}번째 마을">${townOptions(s.town)}</select></span>
          <button type="button" class="cv-trash" data-del-stop="${i}" aria-label="이 마을 빼기" ${plan.stops.length <= 1 ? 'disabled' : ''}>${ICON.trash}</button>
        </div>
        ${s.buys
          .map(
            (b, j) => `${head('buy', i, j)}
            <div class="cv-line">
              <span class="cv-select tall">${goodPic(b.good)}<select data-buy-good="${i}:${j}" aria-label="살 물품">${goodOptions(b.good)}</select></span>
              <label><small>수량</small><span class="cv-num"><input type="number" min="1" inputmode="numeric" data-buy-qty="${i}:${j}" value="${b.qty}" /><em>개</em></span></label>
              <label><small>최대 단가</small><span class="cv-num"><input type="number" min="1" inputmode="numeric" data-buy-price="${i}:${j}" value="${b.maxPrice}" /><em>골드</em></span></label>
            </div>`,
          )
          .join('')}
        ${s.sells
          .map(
            (x, j) => `${head('sell', i, j)}
            <div class="cv-line">
              <span class="cv-select tall">${goodPic(x.good)}<select data-sell-good="${i}:${j}" aria-label="팔 물품">${goodOptions(x.good)}</select></span>
              <label><small>수량</small><span class="cv-select plain"><select data-sell-qty="${i}:${j}" aria-label="수량">${sellQtyOptions(x.qty)}</select></span></label>
              <label><small>최소 단가</small><span class="cv-num"><input type="number" min="1" inputmode="numeric" data-sell-price="${i}:${j}" value="${x.minPrice}" /><em>골드</em></span></label>
            </div>`,
          )
          .join('')}
        <div class="cv-two">
          <button type="button" class="cv-btn outline" data-add-buy="${i}">+ 사기</button>
          <button type="button" class="cv-btn outline" data-add-sell="${i}">+ 팔기</button>
        </div>
      </section>
    </li>`;
  return `
    <p class="cv-lead">최대 ${MAX_STOPS}개 마을을 순서대로 방문해요. 마을마다 무엇을 얼마에 사고팔지 적어요.</p>
    <ol class="cv-stops">${plan.stops.map(stop).join('')}</ol>
    <button type="button" class="cv-add-stop" data-add-stop ${plan.stops.length >= MAX_STOPS ? 'disabled' : ''}>${ICON.plus}마을 추가</button>
    <label class="cv-check"><input type="checkbox" data-repeat ${plan.repeat ? 'checked' : ''} /><span>마지막 마을을 마치면 처음부터 반복</span></label>
    <div class="cv-foot">
      <button type="button" class="cv-btn grey" data-cancel-edit>취소</button>
      <button type="button" class="cv-btn coral" data-send>${ICON.send}지시서 보내기</button>
    </div>`;
}
