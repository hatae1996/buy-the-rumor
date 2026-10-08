// 마을 이름 리본. 3D 위치를 화면 좌표로 옮겨 DOM으로 얹는다 (글자는 그림에 넣지 않는다).
// 칸이 작아 손가락으로 누르기 어려우니 리본도 누를 수 있게 한다.
import * as THREE from 'three';

interface Label {
  el: HTMLButtonElement;
  anchor: THREE.Vector3;
}

const tmp = new THREE.Vector3();

export class TownLabels {
  private labels: Label[] = [];

  constructor(
    private readonly layer: HTMLElement,
    private readonly onTap: (townId: number) => void,
  ) {}

  set(towns: readonly { id: number; name: string; city: boolean; anchor: THREE.Vector3 }[]): void {
    this.layer.replaceChildren();
    this.labels = towns.map((t) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = t.city ? 'map-label city' : 'map-label';
      const ribbon = document.createElement('span');
      ribbon.textContent = t.name;
      el.appendChild(ribbon);
      el.addEventListener('click', () => this.onTap(t.id));
      this.layer.appendChild(el);
      return { el, anchor: t.anchor.clone() };
    });
  }

  update(camera: THREE.Camera, width: number, height: number): void {
    for (const { el, anchor } of this.labels) {
      tmp.copy(anchor).project(camera);
      const visible = tmp.z < 1;
      el.style.display = visible ? '' : 'none';
      if (!visible) continue;
      el.style.transform = `translate(${((tmp.x + 1) / 2) * width}px, ${((1 - tmp.y) / 2) * height}px) translate(-50%, 0)`;
    }
  }

  dispose(): void {
    this.layer.replaceChildren();
    this.labels = [];
  }
}
