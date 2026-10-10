// 장부 탭 "인력·말" (0.1.6 목업 docs/reference/ledger-people-mockup-0.1.6.png, 유지비 줄은 작게 위로).
// 하루 유지비 한 줄, 고용 인력 카드(아바타 키트 얼굴), 보유 말 카드(그림 자리에 털색 점, 이름 짓기 0.1.7), 여관 안내.
import innImg from '../../../assets/ui/bld_inn.png';
import sackImg from '../../../assets/ui/coins_sack.png';
import type { PlayerView } from '../../sim/economy';
import { money } from '../format';
import type { Game } from '../game';
import { portraitHtml } from '../portrait/portrait';
import { openInn } from './buildings/inn';
import { horseFatigue, openStableSheet, speedWord } from './horseSheet';
import { bindHorseNaming, horseNameHtml, horsePicHtml } from '../horseArt';

const won = (n: number) => `${money(n)}골드`;

export function peopleHtml(game: Game, v: PlayerView): string {
  const townName = (id: number) => game.map.towns[id]!.name;
  const inTown = v.location.kind === 'town';
  const faces = game.hireFaces();

  const hires = v.hires
    .map(
      (h) => `<section class="people-card">
        <span class="people-pic">${portraitHtml(faces[h.id], 112, h.name)}</span>
        <div class="people-body">
          <h3>${h.name}</h3>
          <span class="people-chip">${h.roleName}</span>
          <p>${h.jobName} · ${townName(h.town)}</p>
          <div class="people-foot">
            <span>일당</span>
            <b>${won(h.wage)} / 일${h.restWage !== null ? `<small>쉬는 날 ${won(h.restWage)}</small>` : ''}</b>
            ${inTown ? '<button type="button" class="order-btn" data-people-inn>고용 관리</button>' : ''}
          </div>
        </div>
      </section>`,
    )
    .join('');
  const informants = v.informants.length
    ? `<ul class="people-mini">${v.informants.map((t) => `<li><span class="people-chip">정보원</span>${townName(t)} 소식을 알려 줘요</li>`).join('')}</ul>`
    : '';
  const people = v.hires.length + v.informants.length;

  const horseCard = (h: PlayerView['horses'][number], where: string) => `<section class="people-card">
      ${horsePicHtml(h)}
      <div class="people-body">
        <h3>${horseNameHtml(h)}</h3>
        <span class="people-chip">${where}</span>
        <p>끄는 무게 ${h.pull} · ${speedWord(h.speed)}</p>
        ${horseFatigue(h)}
        <div class="people-foot">
          <span>먹이</span>
          <b>곡물 ${h.feed}개 / 일</b>
          ${v.stable ? '<button type="button" class="order-btn" data-people-stable>말 관리</button>' : ''}
        </div>
      </div>
    </section>`;
  const horses = [...v.horses.map((h) => horseCard(h, '내 행렬')), ...(v.caravan?.horses ?? []).map((h) => horseCard(h, '두 번째 행렬'))].join('');
  const horseCount = v.horses.length + (v.caravan?.horses.length ?? 0);

  return `
    <section class="people-upkeep">
      <img src="${sackImg}" alt="" />
      <span class="acct-label">하루 유지비</span>
      <b>${won(v.upkeep.total)}</b>
      <small>${v.upkeep.parts.map((x) => `${x.what} ${won(x.perDay)}`).join(' · ') || '유지비 없음'}</small>
    </section>
    <div class="people-head"><h3 class="ledger-section-title">고용 인력</h3><span>${people}명</span></div>
    ${hires || (v.informants.length ? '' : '<p class="ledger-note">아직 데려온 사람이 없어요.</p>')}
    ${informants}
    <div class="people-head"><h3 class="ledger-section-title">보유 말</h3><span>${horseCount}마리</span></div>
    ${horses || '<p class="ledger-note">아직 말이 없어요. 목장 마을 마구간에서 살 수 있어요.</p>'}
    <p class="ledger-note people-inn"><img src="${innImg}" alt="" />일할 사람은 여관에서 찾아보세요.</p>`;
}

export function bindPeople(el: HTMLElement, game: Game): void {
  el.querySelectorAll('[data-people-inn]').forEach((b) => b.addEventListener('click', () => openInn(game, 'hire')));
  el.querySelectorAll('[data-people-stable]').forEach((b) => b.addEventListener('click', () => openStableSheet(game)));
  bindHorseNaming(el, game);
}
