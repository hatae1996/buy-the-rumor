// 견습 일곱 장면을 명령으로 끝까지 지난다 (src/sim/apprentice/apprentice.test.ts의 graduate와 같은 길).
// 명령을 보내는 법과 하루를 보내는 법을 받아, 시뮬을 바로 부르는 시험과 서버(game 함수)를 거치는 시험이 같이 쓴다.
// 마지막 졸업 출발(travel)은 하지 않고 갈 마을만 돌려준다.
import type { SceneId } from '../../src/sim/apprentice';
import type { Command, CommandResult, PlayerView } from '../../src/sim/economy';

export interface ApprenticeDriver {
  cmd(c: Command): Promise<CommandResult> | CommandResult;
  view(): Promise<PlayerView> | PlayerView;
  passDay(): Promise<void> | void;
}

async function must(d: ApprenticeDriver, c: Command): Promise<void> {
  const r = await d.cmd(c);
  if (!r.ok) throw new Error(`${JSON.stringify(c)} → ${r.error}`);
}

async function scene(d: ApprenticeDriver): Promise<SceneId | null> {
  return (await d.view()).apprentice?.scene ?? null;
}

async function expectScene(d: ApprenticeDriver, s: SceneId): Promise<void> {
  const now = await scene(d);
  if (now !== s) throw new Error(`장면이 ${s}가 아니라 ${now}`);
}

/** 졸업 장면까지 간다. 돌려주는 것: 졸업하고 갈 마을 */
export async function walkApprentice(d: ApprenticeDriver, picks = [1, 1, 0]): Promise<number> {
  await expectScene(d, 'start');
  await must(d, { type: 'startExpedition' });
  for (const choice of picks) await must(d, { type: 'chooseExpeditionCard', choice });
  await expectScene(d, 'firstLoad');
  await must(d, { type: 'packCart' });
  await expectScene(d, 'firstSale');
  const v = await d.view();
  for (const g of new Set(v.cargo.map((l) => l.good))) {
    if (g === 'meat') continue;
    const qty = v.cargo.filter((l) => l.good === g).reduce((s, l) => s + l.qty, 0);
    await must(d, { type: 'placeSellOrder', good: g, qty, minPrice: Math.max(1, Math.round(v.market!.price[g] * 0.9)) });
  }
  await d.passDay();
  await expectScene(d, 'firstNews');
  await must(d, { type: 'buyNewspaper' });
  const paper = (await d.view()).newspaper.papers[0]!;
  await must(d, { type: 'readPaper', day: paper.day });
  await expectScene(d, 'firstBuy');
  const price = (await d.view()).market!.price.wood;
  await must(d, { type: 'placeBuyOrder', good: 'wood', qty: 2, maxPrice: Math.round(price * 1.1) });
  await d.passDay();
  await expectScene(d, 'graduation');
  const ap = (await d.view()).apprentice!;
  return ap.destination;
}
