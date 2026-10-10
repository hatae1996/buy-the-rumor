// 서버 번들을 Deno에서 돌려 날마다 상태 해시를 JSON으로 찍는다 (npm run test:deno가 부른다).
// 쓰는 법: deno run --allow-read scripts/deno/parity.ts [날 수]
const bundle = new URL('../../supabase/functions/_shared/server.js', import.meta.url).href;
const days = Number(Deno.args[0] ?? 5);
const server = await import(bundle);
console.log(JSON.stringify(server.parityRun(days)));
