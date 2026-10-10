// 로그인과 표 직접 넣기 (0.2.0 4·11번). 서버 모드에서만 불러온다(로컬 빌드에는 supabase-js가 들어가지 않게 boot.ts가 늦게 부름).
// 로그인: 구글 계정, 이메일 링크 (답 109). 폰이 표에 직접 넣는 것은 내 의견(feedback)과 기록 사건(play_events)뿐 (RLS).
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/** 로그인한 뒤 돌아올 주소 (지금 주소, 쿼리 없이) */
const here = () => `${location.origin}${location.pathname}`;

export async function session(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}

/** 함수에 보낼 로그인 토큰 (만료가 가까우면 supabase-js가 새로 받는다) */
export async function token(): Promise<string | null> {
  return (await session())?.access_token ?? null;
}

export async function signInWithGoogle(): Promise<string | null> {
  const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
  return error?.message ?? null;
}

/** Supabase 로그인 오류를 화면 글로 */
function authErrorText(message: string): string {
  if (/rate limit|too many/i.test(message)) return '메일을 너무 자주 보냈어요. 잠시 뒤에 다시 해 주세요.';
  if (/expired|invalid|otp/i.test(message)) return '숫자가 맞지 않거나 시간이 지났어요. 메일을 다시 받아 주세요.';
  if (/sending|smtp|email/i.test(message)) return '메일을 보내지 못했어요. 잠시 뒤에 다시 해 주세요.';
  return message;
}

/**
 * 이메일로 로그인 메일을 보낸다: 링크와 숫자 코드가 함께 간다(메일 틀에 {{ .Token }}, supabase/README.md "로그인 설정").
 * 실패하면 까닭
 */
export async function signInWithEmail(email: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: here() } });
  return error ? authErrorText(error.message) : null;
}

/** 메일에 온 숫자로 이 기기에서 로그인 (링크를 다른 기기에서 받았을 때). 실패하면 까닭 */
export async function verifyEmailCode(email: string, code: string): Promise<string | null> {
  const { error } = await supabase().auth.verifyOtp({ email, token: code, type: 'email' });
  return error ? authErrorText(error.message) : null;
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

export interface FeedbackRow {
  body: string;
  screen: string;
  season_id: string | null;
  world_id: string | null;
  game_day: number | null;
}

export async function insertFeedback(row: FeedbackRow): Promise<boolean> {
  const { data } = await supabase().auth.getSession();
  if (!data.session) return false;
  const { error } = await supabase()
    .from('feedback')
    .insert({ ...row, account_id: data.session.user.id });
  return !error;
}

export interface EventRow {
  kind: string;
  season_id: string | null;
  world_id: string | null;
  game_day: number | null;
  data: Record<string, unknown> | null;
}

export async function insertEvent(row: EventRow): Promise<void> {
  const { data } = await supabase().auth.getSession();
  if (!data.session) return;
  await supabase()
    .from('play_events')
    .insert({ ...row, account_id: data.session.user.id });
}
