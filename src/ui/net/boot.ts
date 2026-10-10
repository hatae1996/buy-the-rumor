// 서버 게임으로 연다 (작업목록-0.2.0 11번): 로그인 → 초대 코드 → 게임 시작 화면(처음 한 번) → 견습 또는 공유 세계.
// 서버 주소와 공개 키가 있을 때만 main.ts가 이 파일을 늦게 불러온다(로컬 빌드에 supabase-js가 들어가지 않게).
import type { Certificate } from '../../sim/ranking/types';
import { LOGIN_GOOGLE, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { setFeedbackSender } from '../feedback';
import { ERROR_TEXT, type ServerError } from '../format';
import { inAppBrowser } from '../inApp';
import { openFounding } from '../screens/founding';
import { showOpenInBrowser } from '../screens/openInBrowser';
import { noteEnterWorld, showInvite, showLogin, showWaiting } from '../screens/serverEntry';
import { mountShell } from '../shell';
import { setTracker, track } from '../track';
import { httpApi } from './api';
import * as auth from './auth';
import { ServerGame } from './serverGame';

/** 열어 둔 동안 머문 시간을 재는 신호 간격 (기록 사건) */
const HEARTBEAT_MS = 5 * 60 * 1000;

type Me = { ok: true; value: { merchantNo: number; certificate: Certificate | null } } | { ok: false; error: string };
type Done = { ok: true } | { ok: false; error: string };
type Hall = { ok: true; value: { seasonId: string; entries: { category: string; name: string }[] } | null } | { ok: false; error: string };

const text = (e: string) => ERROR_TEXT[e as ServerError] ?? e;

/** 앱 안 브라우저 안내에서 "여기서 계속하기"를 누른 탭 (이번 탭에서는 다시 묻지 않는다) */
const STAY_KEY = 'buy-the-rumor/in-app-stay';

function stayed(): boolean {
  try {
    return sessionStorage.getItem(STAY_KEY) === '1';
  } catch {
    return false;
  }
}

export async function bootServer(root: HTMLElement): Promise<void> {
  // 카톡 등 앱 안 브라우저면 먼저 사파리(기본 브라우저)로 열라고 안내한다
  const app = inAppBrowser(navigator.userAgent);
  if (app && !stayed()) {
    await new Promise<void>((resolve) =>
      showOpenInBrowser(root, app, () => {
        try {
          sessionStorage.setItem(STAY_KEY, '1');
        } catch {
          // 저장하지 못해도 이번에는 계속한다
        }
        resolve();
      }),
    );
  }
  const s = await auth.session();
  if (!s)
    return showLogin(root, {
      google: LOGIN_GOOGLE ? auth.signInWithGoogle : null,
      email: auth.signInWithEmail,
      verify: auth.verifyEmailCode,
      done: () => location.reload(),
    });
  const uid = s.user.id;
  const api = httpApi(SUPABASE_URL, SUPABASE_ANON_KEY, auth.token);

  // 초대 코드 (계정이 없으면)
  let me = await api.call<Me>('account', { action: 'me' });
  if (!me.ok && me.error === 'noAccount') {
    await showInvite(root, async (code) => {
      const r = await api.call<Done>('account', { action: 'redeem', code });
      return r.ok ? null : text(r.error);
    });
    me = await api.call<Me>('account', { action: 'me' });
  }
  if (!me.ok) return showWaiting(root, me.error, () => location.reload());

  // 게임 시작 화면: 상단 이름 → 얼굴 → 문장 (처음 한 번, 답 129)
  if (!me.value.certificate) {
    await new Promise<void>((resolve) =>
      openFounding(
        root,
        Date.now() % 1_000_000_007,
        async (f) => {
          const r = await api.call<Done>('account', { action: 'found', name: f.name, face: f.face, emblem: f.emblem });
          if (!r.ok) return text(r.error);
          resolve();
          return null;
        },
        {
          checkName: async (name) => {
            const r = await api.call<Done>('account', { action: 'checkName', name });
            return r.ok ? null : text(r.error);
          },
        },
      ),
    );
  }

  // 견습 또는 공유 세계
  let banner: HTMLElement | null = null;
  const opened = await ServerGame.open(api, uid, {
    onEnterWorld: (screen) => {
      track('graduate', { worldId: screen.worldId });
      noteEnterWorld(screen.worldId, Object.keys(screen.view.certificates).length);
    },
    onSeasonChange: () => location.reload(),
    onOffline: (off) => {
      if (off && !banner) {
        banner = document.createElement('div');
        banner.className = 'offline-banner';
        banner.setAttribute('role', 'status');
        banner.textContent = '다시 연결하는 중…';
        document.body.appendChild(banner);
      } else if (!off) {
        banner?.remove();
        banner = null;
      }
    },
  });
  if (!opened.ok) {
    // 기다리는 동안 지난 시즌 명예의 전당과 내 증서 (0.2.1, 답 138)
    const certificate = me.value.certificate ?? (await api.call<Me>('account', { action: 'me' }).then((m) => (m.ok ? m.value.certificate : null)));
    return showWaiting(root, opened.error, () => location.reload(), {
      hall: api.call<Hall>('account', { action: 'hallOfFame' }).then((r) => (r.ok ? r.value : null)),
      certificate,
      setLook: async (look) => {
        const r = await api.call<{ ok: true; value: Certificate } | { ok: false; error: string }>('account', { action: 'setLook', ...look });
        return r.ok ? r.value : text(r.error);
      },
    });
  }
  const game = opened.game;

  // 기록 사건과 의견: 지금 시즌·세계·게임 날을 붙여 표에 넣는다
  const where = () => ({ season_id: game.seasonId, world_id: game.place === 'world' ? game.worldId : null, game_day: game.view().day });
  setTracker((kind, data) => void auth.insertEvent({ kind, ...where(), data: data ?? null }));
  setFeedbackSender((body) => auth.insertFeedback({ body, screen: currentScreen(), ...where() }));
  if (game.inApprentice && game.view().apprentice?.scene === 'start') track('apprentice_start');
  track('session_start');
  setInterval(() => {
    if (!document.hidden) track('heartbeat');
  }, HEARTBEAT_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) track('session_start');
  });

  root.replaceChildren();
  mountShell(root, game, () => Date.now());
}

/** 지금 보고 있는 화면 이름 (의견에 붙인다): 아래 탭과 맨 위에 열린 페이지·쪽지 제목 */
function currentScreen(): string {
  const tab = document.querySelector<HTMLElement>('[data-tab][aria-selected="true"]')?.dataset.tab ?? 'none';
  const page = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-label]')].pop()?.getAttribute('aria-label');
  return (page ? `${tab}/${page}` : tab).slice(0, 64);
}
