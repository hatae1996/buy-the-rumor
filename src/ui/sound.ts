// 소리 (0.2.1): 배경음 한 곡과 효과음. 원본은 assets-src/audio/, 게임용은 npm run audio(scripts/audio/build.py)가 만든다.
// - 아이폰 사파리는 첫 터치 뒤에만 소리를 낸다: 첫 터치에서 배경음을 틀고 효과음을 불러 둔다.
// - 배경음은 <audio> 하나(메모리를 적게 쓴다), 효과음은 Web Audio(짧아서 겹쳐 울려도 바로 난다).
// - 무음 스위치를 따른다(navigator.audioSession "ambient", 사파리 16.4+). 다른 앱으로 가면 배경음을 멈춘다.
// - 켜고 끄기는 이 폰에만 남긴다(설정 > 소리). 게임 상태가 아니라 기기 설정이다.
import bgmUrl from '../../assets/audio/bgm_merchant_square.mp3';
import buyUrl from '../../assets/audio/sfx_buy.mp3';
import cartUrl from '../../assets/audio/sfx_cart.mp3';
import ledgerUrl from '../../assets/audio/sfx_ledger.mp3';
import mapUrl from '../../assets/audio/sfx_map.mp3';
import marketUrl from '../../assets/audio/sfx_market.mp3';
import paperUrl from '../../assets/audio/sfx_paper.mp3';
import tapUrl from '../../assets/audio/sfx_tap.mp3';
import travelUrl from '../../assets/audio/sfx_travel.mp3';

export type Sfx = 'tap' | 'map' | 'cart' | 'ledger' | 'paper' | 'market' | 'buy' | 'travel';

/** 효과음 파일과 음량 (원본마다 크기가 달라서 평균 크기를 재어 맞췄다. 터치음은 작게, 시장은 기획대로 "작게 들리게") */
const SFX: Record<Sfx, { url: string; gain: number }> = {
  tap: { url: tapUrl, gain: 0.37 },
  map: { url: mapUrl, gain: 1.38 },
  cart: { url: cartUrl, gain: 0.87 },
  ledger: { url: ledgerUrl, gain: 0.81 },
  paper: { url: paperUrl, gain: 1.38 },
  market: { url: marketUrl, gain: 0.15 },
  buy: { url: buyUrl, gain: 1.16 },
  travel: { url: travelUrl, gain: 1.8 },
};

/** 배경음 음량 (효과음 뒤에 깔리게) */
const BGM_VOLUME = 0.3;

const KEY = 'buy-the-rumor/sound';

export interface SoundSettings {
  bgm: boolean;
  sfx: boolean;
}

function load(): SoundSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SoundSettings> | null;
    return { bgm: v?.bgm !== false, sfx: v?.sfx !== false };
  } catch {
    return { bgm: true, sfx: true };
  }
}

let settings = load();
let ctx: AudioContext | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
let bgm: HTMLAudioElement | null = null;
let unlocked = false;
/** 이 시각까지는 공통 터치음을 내지 않는다 (같은 터치에서 다른 효과음이 났다) */
let quietTapUntil = 0;

export function soundSettings(): SoundSettings {
  return { ...settings };
}

export function setSoundSettings(next: Partial<SoundSettings>): void {
  settings = { ...settings, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 저장하지 못해도 이번에는 바꾼다
  }
  syncBgm();
}

/** 효과음을 낸다. 첫 터치 전이거나 꺼져 있으면 조용히 넘어간다 */
export function playSfx(name: Sfx): void {
  if (name !== 'tap') quietTapUntil = performance.now() + 120;
  if (!settings.sfx || !ctx || ctx.state !== 'running') return;
  const buf = buffers.get(name);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = SFX[name].gain;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

function syncBgm(): void {
  if (!unlocked) return;
  bgm ??= Object.assign(new Audio(bgmUrl), { loop: true, volume: BGM_VOLUME, preload: 'auto' });
  if (settings.bgm && !document.hidden) void bgm.play().catch(() => undefined);
  else bgm.pause();
}

async function loadSfx(c: AudioContext): Promise<void> {
  await Promise.all(
    (Object.keys(SFX) as Sfx[]).map(async (name) => {
      try {
        const data = await (await fetch(SFX[name].url)).arrayBuffer();
        buffers.set(name, await c.decodeAudioData(data));
      } catch {
        // 못 불러온 소리는 빠진다
      }
    }),
  );
}

/** 첫 터치: 소리를 열고, 배경음을 틀고, 효과음을 불러 둔다 */
function unlock(): void {
  if (unlocked) return;
  unlocked = true;
  // 무음 스위치를 따르고 다른 앱의 소리와 섞인다 (사파리 16.4+)
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'ambient';
  const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AC) {
    ctx = new AC();
    void ctx.resume();
    void loadSfx(ctx);
  }
  syncBgm();
}

/** 앱을 열 때 한 번: 첫 터치를 기다리고, 버튼 터치음과 화면 전환 때 배경음 멈춤을 건다 */
export function initSound(): void {
  const first = () => unlock();
  document.addEventListener('pointerdown', first, { capture: true, once: true });
  document.addEventListener('touchend', first, { capture: true, once: true });
  // 누를 수 있는 것을 누르면 터치음 (같은 터치에서 다른 효과음이 났으면 그것만)
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement | null)?.closest('button, a, [role="tab"], select, input[type="checkbox"]');
    if (!t || (t as HTMLButtonElement).disabled) return;
    queueMicrotask(() => {
      if (performance.now() >= quietTapUntil) playSfx('tap');
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) bgm?.pause();
    else {
      void ctx?.resume();
      syncBgm();
    }
  });
}

/** 바로 돈을 쓰는 명령 (산 것, 고용, 빌린 것, 사는 신청). 신문은 사고 바로 펼치므로 신문 소리만 */
const BUY_COMMANDS: ReadonlySet<string> = new Set([
  'placeBuyOrder',
  'buyHorse',
  'buyCart',
  'buyRations',
  'buyGear',
  'buyDrink',
  'repairCart',
  'repairGear',
  'hireGuide',
  'hireInformant',
  'hire',
  'rentWarehouse',
]);

/** 명령이 받아들여진 뒤의 효과음: 사면 "구매", 길을 떠나면 말 소리 */
export function commandSfx(type: string): void {
  if (type === 'travel') playSfx('travel');
  else if (BUY_COMMANDS.has(type)) playSfx('buy');
}
