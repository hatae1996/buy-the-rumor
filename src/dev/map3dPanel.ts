// 3D 지도 실험: 계절과 그림체(땅 그림, 외곽선, 소품)를 바꿔 본다.
import type { Season } from '../sim/season';
import type { WorldMap } from '../sim/worldgen';
import { DemoMapController } from './demoMapController';
import type { MapStyle } from '../view3d';

const TOGGLES: { key: keyof MapStyle; label: string }[] = [
  { key: 'painted', label: '땅 그림' },
  { key: 'outline', label: '외곽선' },
  { key: 'terrainProps', label: '나무·산 소품' },
];

export interface Map3dPanel {
  update(map: WorldMap, season: Season): void;
}

export function mountMap3dPanel(root: HTMLElement): Map3dPanel {
  root.innerHTML = `
    <div class="dev-bar" role="group" aria-label="그림체">
      ${TOGGLES.map((t) => `<button type="button" class="dev-btn alt" data-style="${t.key}">${t.label}</button>`).join('')}
    </div>
    <div class="dev-3d" data-stage><p class="dev-3d-status" data-status></p></div>
  `;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const map3d = new DemoMapController(stage, (text) => (status.textContent = text));
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-style]');

  const sync = () =>
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(map3d.view.getStyle()[b.dataset.style as keyof MapStyle])));
  buttons.forEach((b) =>
    b.addEventListener('click', async () => {
      const key = b.dataset.style as keyof MapStyle;
      b.disabled = true;
      await map3d.setStyle({ [key]: !map3d.view.getStyle()[key] });
      b.disabled = false;
      sync();
    }),
  );
  sync();
  map3d.setActive(true);

  let shown: WorldMap | null = null;
  return {
    update(map, season) {
      if (map !== shown) {
        shown = map;
        map3d.setWorld(map);
      }
      map3d.setSeason(season);
    },
  };
}
