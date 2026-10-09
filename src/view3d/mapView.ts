// 3D 지도 화면. 세계와 계절을 받아 그리고, 마을을 누르면 알려 준다.
// 상태를 바꾸지 않는다: 말을 옮기라는 지시도 바깥(화면 쪽)에서 받는다.
import * as THREE from 'three';
import './mapView.css';
import type { Season } from '../sim/season';
import type { WorldMap } from '../sim/worldgen';
import { InstanceBatcher } from './batcher';
import { MapCamera } from './camera';
import { TownLabels } from './labels';
import { tileCenter } from './layout';
import { MaterialKit } from './materials';
import { BACKGROUND, MARKER_RING } from './palette';
import { addMarker, createPawn, PAWN_SLOTS, PawnGeometries, PawnMover, ringMaterial } from './pawn';
import { addProps, PropGeometries } from './props';
import { Snowfall } from './snow';
import { loadTileArt, type TileArtSet } from './tileArt';
import { buildTiles, PrismGeometries, type TileBoard } from './tiles';

export interface MapStyle {
  /** 기둥 윗면에 땅 그림을 깐다 */
  painted: boolean;
  /** 툰 외곽선 */
  outline: boolean;
  /** 나무, 산, 언덕 소품 */
  terrainProps: boolean;
}

export const DEFAULT_STYLE: MapStyle = { painted: false, outline: true, terrainProps: true };

export interface PawnSpec {
  /** 같은 말을 알아보는 이름 (예: 'me', 'trader-3') */
  key: string;
  color: number;
  /** 서 있는 칸 번호 */
  tile: number;
  slot: number;
  /** 크기 (다른 상단 말은 조금 작게). 없으면 1 */
  scale?: number;
  /** 내 말 표시(발밑 고리와 깃발)를 붙인다 */
  marker?: boolean;
}

export interface MapViewEvents {
  onTownTap?: (townId: number) => void;
  onTileTap?: (tile: number) => void;
}

/** 탭으로 볼 손가락 움직임 한도 (px) */
const TAP_SLOP = 8;
/** 내 말 고리가 한 번 퍼져 나가는 데 걸리는 초 */
const PULSE_SECONDS = 1.4;

export class MapView {
  readonly root: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly cam: MapCamera;
  private readonly kit = new MaterialKit();
  private readonly prisms = new PrismGeometries();
  private readonly propGeo = new PropGeometries();
  private readonly pawnGeo = new PawnGeometries();
  private readonly labels: TownLabels;
  private readonly snow = new Snowfall();
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;

  private map: WorldMap | null = null;
  private season: Season = 2;
  private style: MapStyle = { ...DEFAULT_STYLE };
  private art: TileArtSet | null = null;
  private board: { group: THREE.Group; tiles: TileBoard } | null = null;
  private pawns = new Map<string, { obj: THREE.Group; color: number; marker: boolean }>();
  private readonly ringMats = { ring: ringMaterial(MARKER_RING, 0.95), pulse: ringMaterial(MARKER_RING, 0.8) };
  private pulseT = 0;
  /** 카메라가 따라가는 말 */
  private focusKey: string | null = null;
  private pawnSpecs: PawnSpec[] = [];
  private mover: { key: string; mover: PawnMover; done: () => void } | null = null;

  private active = false;
  private frame = 0;
  private last = 0;
  private width = 1;
  private height = 1;
  private down: { x: number; y: number; id: number } | null = null;
  private pointers = 0;

  constructor(
    container: HTMLElement,
    private readonly events: MapViewEvents = {},
  ) {
    this.root = document.createElement('div');
    this.root.className = 'map-view';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', '3D 육각 타일 지도');
    const layer = document.createElement('div');
    layer.className = 'map-labels';
    this.root.append(canvas, layer);
    container.appendChild(this.root);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(BACKGROUND);

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4632, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-8, 14, -6);
    this.scene.add(sun);

    this.cam = new MapCamera(canvas);
    this.labels = new TownLabels(layer, (id) => this.events.onTownTap?.(id));

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    // 사파리는 두 손가락을 모으면 페이지 전체를 확대하려 한다. 지도 위에서는 지도 확대만 한다
    this.root.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', this.onVisibility);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
  }

  setWorld(map: WorldMap): void {
    this.map = map;
    this.mover = null;
    this.rebuild();
    this.labels.set(
      map.towns.map((t) => {
        const c = tileCenter(map.tiles[t.tile]!);
        return { id: t.id, name: t.name, city: t.tier === 'city', anchor: new THREE.Vector3(c.x, c.y + 0.05, c.z + 0.75) };
      }),
    );
  }

  setSeason(season: Season): void {
    if (season === this.season) return;
    this.season = season;
    this.rebuild();
  }

  /** 땅 그림은 처음 켤 때 불러온다 */
  async setStyle(style: Partial<MapStyle>): Promise<void> {
    this.style = { ...this.style, ...style };
    if (this.style.painted && !this.art) this.art = await loadTileArt();
    this.rebuild();
  }

  getStyle(): MapStyle {
    return { ...this.style };
  }

  /**
   * 말을 세운다. key가 같은 말은 다시 만들지 않고 자리만 옮긴다 (움직이는 중이면 그대로 둔다).
   * slot은 한 칸에 여러 말이 있을 때 겹치지 않게 비켜 서는 자리.
   */
  setPawns(specs: readonly PawnSpec[]): void {
    this.pawnSpecs = specs.map((p) => ({ ...p }));
    const keep = new Set(specs.map((p) => p.key));
    for (const [key, p] of this.pawns) {
      if (!keep.has(key)) {
        this.scene.remove(p.obj);
        this.pawns.delete(key);
      }
    }
    for (const spec of specs) {
      let p = this.pawns.get(spec.key);
      const marker = spec.marker ?? false;
      if (!p || p.color !== spec.color || p.marker !== marker) {
        if (p) this.scene.remove(p.obj);
        const obj = createPawn(this.pawnGeo, this.kit, spec.color, this.style.outline);
        if (marker) addMarker(obj, this.pawnGeo, this.kit, this.ringMats, spec.color, this.style.outline);
        p = { obj, color: spec.color, marker };
        this.scene.add(p.obj);
        // 말을 다시 만들었으면 카메라도 새 말을 따라간다
        if (spec.key === this.focusKey) this.cam.follow(obj);
        this.pawns.set(spec.key, p);
      }
      p.obj.scale.setScalar(spec.scale ?? 1);
      if (this.mover?.key !== spec.key) this.placePawn(p.obj, spec.tile, spec.slot);
    }
  }

  /** 말 하나를 칸 번호 경로대로 깡충깡충 옮긴다. 마지막 칸에서는 slot 자리에 선다 */
  animatePawn(key: string, tiles: readonly number[], slot: number): Promise<void> {
    const map = this.map;
    const p = this.pawns.get(key);
    if (!map || !p || tiles.length < 2) return Promise.resolve();
    const [sx, sz] = PAWN_SLOTS[slot % PAWN_SLOTS.length]!;
    const points = tiles.map((i, k) => {
      const c = tileCenter(map.tiles[i]!);
      const last = k === tiles.length - 1;
      // 출발은 지금 서 있는 자리에서
      if (k === 0) return p.obj.position.clone();
      return new THREE.Vector3(c.x + (last ? sx : 0), c.y, c.z + (last ? sz : 0));
    });
    // 이미 움직이던 말이 있으면 끝 자리로 보낸다
    this.mover?.done();
    return new Promise((resolve) => {
      this.mover = { key, mover: new PawnMover(p.obj, points), done: resolve };
    });
  }

  /** 말 하나를 따라가며 다가간다. null이면 판 전체로 물러난다 */
  focusPawn(key: string | null): void {
    const obj = key ? (this.pawns.get(key)?.obj ?? null) : null;
    this.focusKey = obj ? key : null;
    this.cam.focusOn(obj);
  }

  get focused(): boolean {
    return this.cam.focused;
  }

  get moving(): boolean {
    return this.mover !== null;
  }

  /** 화면에 보일 때만 그린다 (배터리) */
  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.resize();
      this.start();
    } else {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  dispose(): void {
    this.setActive(false);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.clearBoard();
    for (const p of this.pawns.values()) this.scene.remove(p.obj);
    this.labels.dispose();
    this.snow.dispose();
    this.cam.dispose();
    this.prisms.dispose();
    this.propGeo.dispose();
    this.pawnGeo.dispose();
    this.ringMats.ring.dispose();
    this.ringMats.pulse.dispose();
    this.kit.dispose();
    this.renderer.dispose();
    this.root.remove();
  }

  private rebuild(): void {
    const map = this.map;
    if (!map) return;
    this.clearBoard();
    const group = new THREE.Group();
    const tiles = buildTiles(map, this.prisms, this.kit, {
      season: this.season,
      art: this.style.painted ? this.art : null,
      outline: this.style.outline,
    });
    group.add(...tiles.meshes);
    const batcher = new InstanceBatcher();
    addProps(map, batcher, this.propGeo, this.kit, {
      season: this.season,
      terrainProps: this.style.terrainProps,
      outline: this.style.outline,
    });
    group.add(...batcher.build());
    this.scene.add(group);
    this.board = { group, tiles };

    if (this.season === 3) this.scene.add(this.snow.points);
    else this.scene.remove(this.snow.points);

    // 외곽선 설정이 바뀌었을 수 있으니 말도 다시 만든다
    for (const p of this.pawns.values()) this.scene.remove(p.obj);
    this.pawns.clear();
    this.setPawns(this.pawnSpecs);
  }

  private clearBoard(): void {
    if (!this.board) return;
    this.scene.remove(this.board.group);
    // 지오메트리와 공용 재질은 남기고, 인스턴스 버퍼와 이 판의 질감만 버린다
    this.board.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    this.board.tiles.dispose();
    this.board = null;
  }

  private placePawn(obj: THREE.Object3D, tile: number, slot: number): void {
    const map = this.map;
    if (!map) return;
    const c = tileCenter(map.tiles[tile]!);
    const [dx, dz] = PAWN_SLOTS[slot % PAWN_SLOTS.length]!;
    obj.position.set(c.x + dx, c.y, c.z + dz);
  }

  private resize(): void {
    const w = Math.max(1, this.root.clientWidth);
    const h = Math.max(1, this.root.clientHeight);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.cam.resize(w, h);
  }

  private start(): void {
    if (this.frame || !this.active || document.hidden) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  private readonly loop = (now: number): void => {
    this.frame = 0;
    if (!this.active || document.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.mover && this.mover.mover.step(dt)) {
      const { done } = this.mover;
      this.mover = null;
      done();
    }
    if (this.season === 3) this.snow.step(dt);
    this.stepPulse(dt);
    this.cam.step(dt);
    this.renderer.render(this.scene, this.cam.camera);
    this.labels.update(this.cam.camera, this.width, this.height);
    this.frame = requestAnimationFrame(this.loop);
  };

  /** 내 말 발밑 고리가 퍼지며 옅어진다 */
  private stepPulse(dt: number): void {
    this.pulseT = (this.pulseT + dt / PULSE_SECONDS) % 1;
    this.ringMats.pulse.opacity = 0.8 * (1 - this.pulseT);
    const s = 1 + this.pulseT * 0.9;
    for (const p of this.pawns.values()) {
      if (p.marker) p.obj.getObjectByName('pulse')?.scale.set(s, 1, s);
    }
  }

  private readonly onVisibility = (): void => {
    if (!document.hidden) this.start();
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.pointers++;
    this.down = this.pointers === 1 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  };

  private readonly onPointerCancel = (): void => {
    this.pointers = Math.max(0, this.pointers - 1);
    this.down = null;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.pointers = Math.max(0, this.pointers - 1);
    const d = this.down;
    this.down = null;
    if (!d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP) return;
    const tile = this.pick(e.clientX, e.clientY);
    if (tile === null || !this.map) return;
    const town = this.map.towns.find((t) => t.tile === tile);
    if (town) this.events.onTownTap?.(town.id);
    else this.events.onTileTap?.(tile);
  };

  private pick(clientX: number, clientY: number): number | null {
    if (!this.board) return null;
    const r = this.root.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.cam.camera);
    const hit = this.raycaster.intersectObjects(this.board.tiles.pickable, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return this.board.tiles.tileOf(hit.object, hit.instanceId);
  }
}
