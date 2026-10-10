// 바다 수면 셰이더 (sea.ts가 쓴다). 로우폴리 바다:
// - 물결: 꼭짓점을 아주 낮게 출렁이고, 삼각형 면마다 법선을 따로 구해(면 하나가 한 색) 빛과 반짝임을 받는다. 해안 옆은 잔잔하다.
// - 수심 띠: 해안까지 거리를 삼각형 조각 단위로 재서 얕은 물 → 바다가 각진 계단 띠로 바뀐다.
// - 포말: 해안 옆 더 작은 삼각형 조각이 하나씩 나타났다 사라진다.

/** 공통: 거리 질감 읽기, 무늬, 삼각형 격자 */
const common = (maxDist: string) => /* glsl */ `
uniform sampler2D uDist;
uniform float uExtent;
uniform float uTime;

/** 해안까지 거리 (칸 반지름 1 기준) */
float coastDist(vec2 xz) {
  vec2 uv = xz / (2.0 * uExtent) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return ${maxDist};
  return texture2D(uDist, uv).r * ${maxDist};
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

export const seaVertexShader = (maxDist: string) => /* glsl */ `
${common(maxDist)}
uniform float uAmp;
uniform float uCalmEdge;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec2 p = world.xz;
  // 서로 다른 방향의 물결 셋. 해안 옆과 판 가장자리는 잔잔하게
  float h = sin(p.x * 1.3 + uTime * 0.8) * 0.5
          + sin(p.y * 1.7 - uTime * 0.65 + p.x * 0.4) * 0.35
          + sin((p.x + p.y) * 2.3 + uTime * 1.1) * 0.15;
  float calm = smoothstep(0.0, 1.2, coastDist(p));
  float edge = 1.0 - smoothstep(uCalmEdge * 0.8, uCalmEdge, max(abs(p.x), abs(p.y)));
  world.y += h * uAmp * calm * edge;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const seaFragmentShader = (maxDist: string, bandCell: string, foamCell: string) => /* glsl */ `
${common(maxDist)}
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uFoamAmount;
uniform vec3 uSun;
uniform float uGlint;
varying vec3 vWorld;

/** 삼각형 격자에서 이 점이 든 조각의 가운데와 조각 번호 */
vec2 triCenter(vec2 xz, float cellSize, out vec2 id) {
  vec2 s = xz / cellSize;
  vec2 cell = floor(s + (s.x + s.y) * 0.3660254);
  vec2 local = s - (cell - (cell.x + cell.y) * 0.2113249);
  vec2 corner = local.x > local.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 mid = (cell * 3.0 + corner + vec2(1.0)) / 3.0;
  id = cell * 2.0 + corner;
  return (mid - (mid.x + mid.y) * 0.2113249) * cellSize;
}

void main() {
  vec2 xz = vWorld.xz;

  // 수심 띠: 조각 가운데의 해안 거리로 색을 고르고, 얕은 쪽은 계단 띠로 끊는다
  vec2 bandId;
  float bd = coastDist(triCenter(xz, ${bandCell}, bandId));
  float shallowStep = floor(clamp(bd / 1.2, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
  vec3 col = mix(uShallow, uMid, shallowStep);
  col = mix(col, uDeep, smoothstep(2.2, 7.0, bd));

  // 면마다 법선: 화면 미분으로 삼각형 면의 기울기를 얻는다 (면 하나가 한 색)
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  float lit = dot(n, uSun) - uSun.y;
  col *= 1.0 + lit * 2.2;
  // 해가 비치는 면은 반짝인다
  vec3 view = normalize(cameraPosition - vWorld);
  float glint = pow(max(dot(n, normalize(uSun + view)), 0.0), 70.0);
  col += glint * uGlint;

  // 포말: 해안 옆 작은 조각이 해안에 가까울수록 켜지기 쉽고, 무늬가 흘러 하나씩 나타났다 사라진다
  vec2 foamId;
  vec2 fc = triCenter(xz, ${foamCell}, foamId);
  float cd = coastDist(fc);
  float wave = noise(fc * 1.3 + vec2(uTime * 0.1, -uTime * 0.06)) * 0.7 + 0.3 * (0.5 + 0.5 * sin(uTime * 0.6 + fc.x * 1.1 + fc.y * 0.8));
  float on = step(cd, 0.42) * step(0.52 + cd * 0.6, wave);
  float facet = 0.93 + 0.07 * hash(foamId);
  col = mix(col, uFoam * facet, on * uFoamAmount);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
