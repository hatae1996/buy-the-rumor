// 바다 수면 셰이더 (sea.ts가 쓴다). 로우폴리 바다:
// - 물결: 꼭짓점을 아주 낮게 출렁이고, 삼각형 면마다 법선을 따로 구해(면 하나가 한 색) 빛과 반짝임을 받는다. 해안 옆은 잔잔하다.
// - 물색: 해안까지 거리에 넓고 느린 무늬를 곱해, 얕은 물 폭이 곳마다 다르고 경계가 부드럽다 (육각형 모양이 여러 겹 번져 보이지 않게).
// - 포말: 해안에 바짝 붙은 좁은 띠에서만, 작은 삼각형 조각이 군데군데 나타났다 사라진다. 띠 폭도 곳마다 다르다.

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

export const seaFragmentShader = (maxDist: string, foamCell: string) => /* glsl */ `
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

  // 물색: 해안 거리에 넓고 느린 무늬를 곱해 얕은 물 폭을 곳마다 다르게 (해안에서는 0이라 얕은 물이 늘 닿는다)
  float dist = coastDist(xz);
  // 폭은 대부분 좁게(×1~2.2), 경계는 잔무늬로 조금 흔든다. 먼 바다 경계는 아래에서 따로
  float widthVar = 1.0 + 1.2 * noise(xz * 0.33 + vec2(4.7, 1.3));
  float wd = dist * widthVar + (noise(xz * 1.1) - 0.5) * 0.25 * smoothstep(0.0, 0.4, dist);
  vec3 col = mix(uShallow, uMid, smoothstep(0.05, 1.0, wd));
  // 먼 바다 경계: 섬 크기만 한 아주 넓은 무늬를 곱해 곳에 따라 가까웠다 멀었다 한다 (잔무늬는 구름처럼 보여 쓰지 않는다)
  float deepVar = 0.55 + 1.0 * noise(xz * 0.09 + vec2(2.3, 7.9));
  col = mix(col, uDeep, smoothstep(1.6, 6.0, dist * deepVar));

  // 면마다 법선: 화면 미분으로 삼각형 면의 기울기를 얻는다 (면 하나가 한 색)
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  // 멀리 있는 면은 화면에서 뭉개져 줄무늬가 되므로, 카메라에서 멀수록 면 명암과 반짝임을 줄인다
  float near = 1.0 - smoothstep(14.0, 30.0, distance(cameraPosition, vWorld));
  float lit = dot(n, uSun) - uSun.y;
  col *= 1.0 + lit * 1.1 * near;
  // 해가 비치는 면은 반짝인다
  vec3 view = normalize(cameraPosition - vWorld);
  float glint = pow(max(dot(n, normalize(uSun + view)), 0.0), 70.0);
  col += glint * uGlint * near;

  // 포말: 해안 옆 작은 조각이 해안에 가까울수록 켜지기 쉽고, 무늬가 흘러 하나씩 나타났다 사라진다
  vec2 foamId;
  vec2 fc = triCenter(xz, ${foamCell}, foamId);
  float cd = coastDist(fc);
  float wave = noise(fc * 1.3 + vec2(uTime * 0.1, -uTime * 0.06)) * 0.7 + 0.3 * (0.5 + 0.5 * sin(uTime * 0.6 + fc.x * 1.1 + fc.y * 0.8));
  // 띠 폭 0.1~0.3, 해안에 가까울수록 켜지기 쉽다
  float foamWidth = 0.1 + 0.2 * noise(fc * 0.5 + vec2(9.1, 2.7));
  float on = step(cd, foamWidth) * step(0.5 + cd * 1.2, wave);
  float facet = 0.93 + 0.07 * hash(foamId);
  col = mix(col, uFoam * facet, on * uFoamAmount);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
