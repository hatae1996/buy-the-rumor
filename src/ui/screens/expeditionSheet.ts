// 원정 카드 쪽지: 카드 한 장씩, 좌우로 넘기거나 선택지를 누른다. 끝나면 결과를 보여 준다.
// 연출(카드 뒷면, 넘기는 소리, 결과 연출)은 나중 버전 (기획서 "채집: 원정 카드").
import fieldArt from '../../../assets/ui/field.png';
import forestArt from '../../../assets/ui/forest.png';
import innArt from '../../../assets/ui/inn.png';
import mineArt from '../../../assets/ui/mine.png';
import seaArt from '../../../assets/ui/sea.png';
import { CARDS, type TownEventKind } from '../../sim/expedition';
import { ERROR_TEXT, goodName } from '../format';
import type { Game } from '../game';
import { openSheet } from '../sheet';

/** 넘겨서 고르는 거리 (px) */
const SWIPE = 90;

const ART = { forest: forestArt, ore: mineArt, fish: seaArt, salt: seaArt, field: fieldArt, road: innArt };

/** 사건 카드 그림 */
const EVENT_ART: Partial<Record<TownEventKind, string>> = {
  storm: ART.fish,
  bigCatch: ART.fish,
  newVein: ART.ore,
  landslide: ART.ore,
  mineCollapse: ART.ore,
  drought: ART.field,
  bumperHarvest: ART.field,
  ranchFire: ART.field,
  bandits: ART.road,
  caravan: ART.road,
  boost: ART.road,
};

/** 연결·내 카드처럼 땅이 정해지지 않은 카드 */
const CARD_ART: Record<string, string> = {
  markedVein: ART.ore,
  deerHerd: ART.forest,
  bear: ART.forest,
  packHorse: ART.field,
  horseSpooked: ART.field,
};

/** 카드 그림: 카드가 들어오는 땅에 맞춘다 */
function artFor(cardId: string): string {
  const card = CARDS.find((c) => c.id === cardId);
  for (const s of card?.sources ?? []) {
    if (s.kind === 'terrain' || s.kind === 'season') return ART[s.resource];
    if (s.kind === 'tag') {
      if (s.tag === 'bears' || s.tag === 'oldGrowth' || s.tag === 'wolves') return ART.forest;
      if (s.tag === 'exposedVein') return ART.ore;
      if (s.tag === 'reef' || s.tag === 'shoals') return ART.fish;
      if (s.tag === 'fertile' || s.tag === 'ranch') return ART.field;
      return ART.road;
    }
    if (s.kind === 'event') return EVENT_ART[s.event] ?? ART.forest;
  }
  return CARD_ART[cardId] ?? ART.forest;
}

export function openExpeditionSheet(game: Game): void {
  const sheet = openSheet('원정');
  let error = '';

  const choose = async (choice: number) => {
    const r = await game.dispatch({ type: 'chooseExpeditionCard', choice });
    error = r.ok ? '' : ERROR_TEXT[r.error];
    render();
  };

  const render = () => {
    const v = game.view();
    const ex = v.expedition;
    if (!ex) return renderResult();
    const haul = ex.haul.map((h) => `${goodName(h.good)} ${h.qty}`).join(', ') || '아직 없음';
    // 앞의 둘은 왼쪽·오른쪽으로 넘겨서, 장비·말이 연 선택지는 눌러서 고른다
    const [left, right] = ex.card.choices;
    sheet.body.innerHTML = `
      <div class="exp-status">
        <span>남은 카드 ${ex.left}</span>
        <span>피로 ${v.fatigue} / ${v.fatigueMax}</span>
      </div>
      <article class="exp-card" data-card>
        <img src="${artFor(ex.card.id)}" alt="" />
        <h3>${ex.card.title}</h3>
        <p>${ex.card.text}</p>
      </article>
      <div class="exp-choices">
        ${ex.card.choices
          .map(
            (c, i) => `<button type="button" class="exp-choice${c.extra ? ' extra' : ''}" data-choice="${c.index}" ${c.disabled ? 'disabled' : ''}>
              <b>${i === 0 ? '←' : ''} ${c.label} ${i === 1 ? '→' : ''}</b><small>${c.disabled ?? c.hint}</small>
            </button>`,
          )
          .join('')}
      </div>
      ${ex.flags.length || ex.guide ? `<p class="muted">${[...ex.flags, ...(ex.guide ? ['안내인이 함께 가요'] : [])].join(' · ')}</p>` : ''}
      <p class="muted">모은 것: ${haul}</p>
      ${error ? `<p class="error">${error}</p>` : ''}
      <button type="button" class="link-btn" data-end>그만 돌아가기</button>`;

    sheet.body.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((b) =>
      b.addEventListener('click', () => choose(Number(b.dataset.choice))),
    );
    sheet.body.querySelector('[data-end]')!.addEventListener('click', () => {
      game.dispatch({ type: 'endExpedition' });
      render();
    });

    // 카드를 좌우로 넘겨 고르기
    const cardEl = sheet.body.querySelector<HTMLElement>('[data-card]')!;
    let startX: number | null = null;
    cardEl.addEventListener('pointerdown', (e) => {
      startX = e.clientX;
      cardEl.setPointerCapture(e.pointerId);
    });
    cardEl.addEventListener('pointermove', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      cardEl.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
      cardEl.dataset.lean = dx < -SWIPE / 2 ? 'left' : dx > SWIPE / 2 ? 'right' : '';
    });
    const release = (e: PointerEvent) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      cardEl.style.transform = '';
      cardEl.dataset.lean = '';
      const pick = dx <= -SWIPE ? left : dx >= SWIPE ? right : null;
      if (pick && !pick.disabled) choose(pick.index);
    };
    cardEl.addEventListener('pointerup', release);
    cardEl.addEventListener('pointercancel', release);
  };

  const renderResult = () => {
    const v = game.view();
    const r = v.lastExpedition;
    if (!r) {
      sheet.close();
      return;
    }
    const loaded = r.loaded.map((g) => `${goodName(g.good)} ${g.qty}개`).join(', ');
    const left = r.leftBehind.map((g) => `${goodName(g.good)} ${g.qty}개`).join(', ');
    sheet.body.innerHTML = `
      <h3>돌아왔어요</h3>
      <ul class="list">${r.log
        .map((l) => `<li><b>${l.title}</b> · ${l.choice}${l.outcome === 'failure' ? ' (실패)' : ''}${l.text ? `<br /><span class="muted">${l.text}</span>` : ''}</li>`)
        .join('')}</ul>
      <p>${loaded ? `수레에 실었어요: <b>${loaded}</b>` : '빈손으로 돌아왔어요.'}</p>
      ${left ? `<p class="warn">수레에 자리가 없어 두고 왔어요: ${left}</p>` : ''}
      ${r.rumors.length ? `<p class="muted">들은 이야기는 소식 탭 수첩에 적어 두었어요.</p>` : ''}
      <button type="button" class="primary-btn" data-ok>확인</button>`;
    sheet.body.querySelector('[data-ok]')!.addEventListener('click', () => sheet.close());
  };

  render();
}
