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

/** 이메일로 로그인 링크를 보낸다. 실패하면 까닭 */
export async function signInWithEmail(email: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: here() } });
  return error?.message ?? null;
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
