// 개발용 관찰 화면의 서버 칸 (작업목록-0.2.0 12번): 운영자 함수(admin)로 서버 세계를 본다(운영자만, 비밀 값).
// 세계 목록과 운영 로그, 멈춘 세계 풀기, 세계 상태(숨은 숫자 포함, JSON 내려받기), 기록 표(사람마다 한 줄, CSV 내려받기).
// 비밀 값은 저장하지 않는다(이 화면이 열려 있는 동안만).
import { playerList } from '../sim/economy';
import { netWorth } from '../sim/ranking';
import { seasonMap, type WorldBlob } from '../sim/service';
import type { MetricsRow, WorldMetrics } from '../server/metrics';
import { SUPABASE_URL } from '../ui/config';

type Reply<T> = ({ ok: true } & T) | { ok: false; error: string };

function download(name: string, text: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function mountServerPanel(root: HTMLElement): void {
  root.innerHTML = `
    <h2 class="dev-h2">서버 세계 (운영자)</h2>
    <div class="dev-bar">
      <input type="url" aria-label="운영자 함수 주소" placeholder="https://<ref>.supabase.co/functions/v1/admin" value="${SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/admin` : ''}" data-url size="44" />
      <input type="password" aria-label="운영자 비밀 값" placeholder="운영자 비밀 값" data-secret autocomplete="off" />
      <input type="text" aria-label="시즌 id" placeholder="2026-10-26" data-season size="11" />
      <input type="text" aria-label="세계 id" placeholder="w1" data-world size="4" />
    </div>
    <div class="dev-bar">
      <button type="button" class="dev-btn" data-list>세계 목록·운영 로그</button>
      <button type="button" class="dev-btn" data-state>세계 상태</button>
      <button type="button" class="dev-btn alt" data-metrics>기록 표 (CSV)</button>
    </div>
    <p class="dev-note" data-msg></p>
    <div data-out></div>`;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const out = $('[data-out]');
  const msg = (t: string) => ($('[data-msg]').textContent = t);
  const season = () => $<HTMLInputElement>('[data-season]').value.trim();
  const world = () => $<HTMLInputElement>('[data-world]').value.trim() || 'w1';

  async function call<T>(body: Record<string, unknown>): Promise<Reply<T> | null> {
    const url = $<HTMLInputElement>('[data-url]').value.trim();
    const secret = $<HTMLInputElement>('[data-secret]').value;
    if (!url || !secret || !season()) {
      msg('함수 주소, 비밀 값, 시즌 id를 넣어 주세요.');
      return null;
    }
    msg('불러오는 중…');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify(body) });
      if (res.status === 403) {
        msg('비밀 값이 맞지 않아요.');
        return null;
      }
      const r = (await res.json()) as Reply<T>;
      msg(r.ok ? '' : `실패: ${r.error}`);
      return r;
    } catch (e) {
      msg(`닿지 못했어요: ${String(e)}`);
      return null;
    }
  }

  $('[data-list]').addEventListener('click', async () => {
    type W = { id: string; humans: number; bots: number; day: number; halted: string | null; settled: boolean; last_tick_at: string | null };
    type L = { at: string; level: string; message: string; data: unknown };
    const r = await call<{ worlds: W[]; log: L[] }>({ action: 'worlds', seasonId: season() });
    if (!r?.ok) return;
    out.innerHTML = `
      <section class="dev-slip"><h2>세계</h2><table class="dev-table">
        <tr><th>세계</th><th>사람</th><th>봇</th><th>다음 장날</th><th>마지막 장날</th><th>결산</th><th>멈춤</th></tr>
        ${r.worlds
          .map(
            (w) =>
              `<tr><td>${esc(w.id)}</td><td>${w.humans}</td><td>${w.bots}</td><td>${w.day}일째</td><td>${esc(w.last_tick_at)}</td><td>${w.settled ? '끝' : ''}</td>
               <td>${w.halted ? `${esc(w.halted)} <button type="button" class="dev-btn alt" data-unhalt="${esc(w.id)}">풀기</button>` : ''}</td></tr>`,
          )
          .join('')}
      </table></section>
      <section class="dev-slip"><h2>운영 로그 (최근 50)</h2><table class="dev-table">
        ${r.log.map((l) => `<tr><td>${esc(l.at)}</td><td>${esc(l.level)}</td><td>${esc(l.message)}</td><td><code>${esc(JSON.stringify(l.data))}</code></td></tr>`).join('')}
      </table></section>`;
    out.querySelectorAll<HTMLButtonElement>('[data-unhalt]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm(`${b.dataset.unhalt} 세계의 멈춤을 풀까요? 맞는 시뮬 번들을 올린 뒤에만 푸세요.`)) return;
        const u = await call({ action: 'unhalt', seasonId: season(), worldId: b.dataset.unhalt });
        if (u?.ok) msg('풀었어요. 다음 tick에 장날이 돌아요.');
      }),
    );
  });

  $('[data-state]').addEventListener('click', async () => {
    const r = await call<{ blob: WorldBlob; halted: string | null; rev: number }>({ action: 'world', seasonId: season(), worldId: world() });
    if (!r?.ok) return;
    const { state } = r.blob;
    const map = seasonMap(season());
    const town = (id: number) => map.towns[id]?.name ?? id;
    out.innerHTML = `
      <section class="dev-slip"><h2>${esc(world())} · ${state.day}일째 · rev ${r.rev} · 시뮬 버전 ${r.blob.simVersion}${r.halted ? ` · 멈춤: ${esc(r.halted)}` : ''}</h2>
        <button type="button" class="dev-btn alt" data-json>상태 JSON 내려받기</button>
        <table class="dev-table">
          <tr><th>상단</th><th>번호</th><th>봇</th><th>골드</th><th>순자산</th><th>있는 곳</th><th>들어온 날</th></tr>
          ${playerList(state)
            .map(
              (p) =>
                `<tr><td>${esc(p.certificate.name)}</td><td>${p.certificate.merchantNo ?? ''}</td><td>${p.bot ? '떠돌이' : ''}</td><td>${p.gold}</td><td>${netWorth(state, p)}</td>
                 <td>${p.travel ? `${town(p.travel.from)} → ${town(p.travel.to)} (${p.travel.daysLeft}일)` : town(p.town)}</td><td>${p.record?.joinedDay ?? ''}</td></tr>`,
            )
            .join('')}
        </table>
      </section>`;
    out.querySelector('[data-json]')!.addEventListener('click', () => download(`${season()}-${world()}-${state.day}.json`, JSON.stringify(r.blob), 'application/json'));
  });

  $('[data-metrics]').addEventListener('click', async () => {
    const r = await call<{ rows: MetricsRow[]; worlds: WorldMetrics[]; csv: string }>({ action: 'metrics', seasonId: season() });
    if (!r?.ok) return;
    const keys = r.rows.length ? (Object.keys(r.rows[0]!) as (keyof MetricsRow)[]) : [];
    out.innerHTML = `
      <section class="dev-slip"><h2>세계마다 독점 (답 92, 사람 기준은 답 133)</h2><table class="dev-table">
        <tr><th>세계</th><th>사람</th><th>봇</th><th>장날</th><th>독점 날 (전체)</th><th>독점 날 (사람)</th></tr>
        ${r.worlds.map((w) => `<tr><td>${esc(w.worldId)}</td><td>${w.humans}</td><td>${w.bots}</td><td>${w.monopolyAll.days}</td><td>${w.monopolyAll.soleDays}${w.monopolyAll.monopoly ? ' (독점)' : ''}</td><td>${w.monopolyHumans.soleDays}${w.monopolyHumans.monopoly ? ' (독점)' : ''}</td></tr>`).join('')}
      </table></section>
      <section class="dev-slip"><h2>봄 구휼 (답 139: 사람이 있는 세계도 채워진 양이 50%를 못 넘으면 다음 시즌 200 → 100)</h2><table class="dev-table">
        <tr><th>세계</th><th>마을</th><th>날</th><th>주문 양</th><th>값</th><th>채워진 양</th><th>판 양 (사람 / 봇)</th><th>판 사람 (사람 / 봇)</th><th>판 값</th></tr>
        ${
          r.worlds
            .flatMap((w) =>
              w.relief.map(
                (x) =>
                  `<tr><td>${esc(w.worldId)}</td><td>${x.town}</td><td>${x.day}~${x.end}</td><td>${x.ordered}</td><td>${x.price}</td>
                   <td>${x.filled} (${x.ordered ? Math.round((x.filled / x.ordered) * 100) : 0}%)${w.humans > 0 && x.filled * 2 < x.ordered ? ' · 절반 못 채움' : ''}</td>
                   <td>${x.sold.humans} / ${x.sold.bots}</td><td>${x.sellers.humans} / ${x.sellers.bots}</td><td>${x.soldPrice ?? ''}</td></tr>`,
              ),
            )
            .join('') || '<tr><td colspan="9">이번 시즌에는 아직 봄 구휼이 없었어요.</td></tr>'
        }
      </table></section>
      <section class="dev-slip"><h2>사람마다 (${r.rows.length}명)</h2>
        <button type="button" class="dev-btn alt" data-csv>CSV 내려받기</button>
        <div class="dev-scroll"><table class="dev-table">
          <tr>${keys.map((k) => `<th>${esc(k)}</th>`).join('')}</tr>
          ${r.rows.map((row) => `<tr>${keys.map((k) => `<td>${esc(Array.isArray(row[k]) ? (row[k] as unknown[]).join(' ') : row[k])}</td>`).join('')}</tr>`).join('')}
        </table></div>
      </section>`;
    out.querySelector('[data-csv]')!.addEventListener('click', () => download(`기록표-${season()}.csv`, `﻿${r.csv}`, 'text/csv'));
  });
}
