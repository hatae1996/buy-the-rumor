// 소리 (0.2.1): 배경음 한 곡과 효과음. 원본은 assets-src/audio/, 게임용은 npm run audio(scripts/audio/build.py)가 만든다.
// - 배경음과 효과음 모두 <audio>로 튼다. 아이폰에서 Web Audio 효과음이 나지 않아(배경음 <audio>는 났다) 같은 방식으로 맞췄다.
// - 아이폰은 <audio>의 음량을 무시하므로, 소리마다 크기는 파일에 미리 넣었다(build.py의 목표 크기). 게임은 음량 1로 튼다.
// - 아이폰은 사용자 동작(touchend·click) 안에서 만지고 불러 둔 <audio>만 나중에 동작 밖에서 틀 수 있다: 첫 동작에서
//   모든 효과음을 만들고 load()해 둔다(소리는 나지 않는다. 산 뒤처럼 동작 밖에서 나는 소리를 위해).
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

const SFX_URL: Record<Sfx, string> = {
  tap: tapUrl,
  map: mapUrl,
  cart: cartUrl,
  ledger: ledgerUrl,
  paper: paperUrl,
  market: marketUrl,
  buy: buyUrl,
  travel: travelUrl,
};

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
let bgm: HTMLAudioElement | null = null;
const sfx = new Map<Sfx, HTMLAudioElement>();
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

/** 효과음을 낸다. 첫 동작 전이거나 꺼져 있으면 조용히 넘어간다. 같은 소리가 울리는 중이면 처음부터 다시 */
export function playSfx(name: Sfx): void {
  if (name !== 'tap') quietTapUntil = performance.now() + 120;
  const el = sfx.get(name);
  if (!settings.sfx || !el) return;
  el.currentTime = 0;
  void el.play().catch(() => undefined);
}

function syncBgm(): void {
  if (!unlocked) return;
  bgm ??= Object.assign(new Audio(bgmUrl), { loop: true, preload: 'auto' });
  if (settings.bgm && !document.hidden) void bgm.play().catch(() => undefined);
  else bgm.pause();
}

/** 사용자 동작(touchend·click·keydown)마다 부른다. 처음이면 소리를 열고 배경음을 틀고, 효과음을 불러 둔다 */
function onGesture(): void {
  if (unlocked) return;
  unlocked = true;
  // 무음 스위치를 따르고 다른 앱의 소리와 섞인다 (사파리 16.4+)
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'ambient';
  for (const name of Object.keys(SFX_URL) as Sfx[]) {
    const el = Object.assign(new Audio(SFX_URL[name]), { preload: 'auto' });
    el.load();
    sfx.set(name, el);
  }
  syncBgm();
}

/** 앱을 열 때 한 번: 사용자 동작을 기다리고, 버튼 터치음과 화면 전환 때 배경음 멈춤을 건다 */
export function initSound(): void {
  for (const type of ['touchend', 'click', 'keydown'] as const) document.addEventListener(type, onGesture, { capture: true });
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
    else syncBgm();
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
