// Extracted from the supplied blackhole.html SHA256 507230420142b0b9ff28ff76edf5d5e891f20caebd4cfb30d1064f9399b8c338.
// Ray and temporal strings retain original bytes; nebula retains the original hash slice and bake formula.

export const rayVertex=`
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const rayFragment=`
precision highp float;

uniform vec2  uResolution;
uniform vec2  uJitter;      // sub-pixel offset for temporal accumulation
uniform float uFrame;
uniform float uTime;
uniform vec3  uCamPos;
uniform mat4  uCamToWorld;
uniform mat4  uInvProj;
uniform vec3  uObsVel;      // observer velocity relative to the local ZAMO frame (units of c)
uniform int   uSteps;
uniform float uEscape;
uniform float uParity;      // checkerboard: which half of the pixels is traced this frame

uniform float uSpin;        // Kerr parameter a (rs = 1, so M = 0.5 and 0 <= a < 0.5)
uniform float uHorizon;     // outer horizon radius r+
uniform float uLensing;
uniform float uDoppler;

uniform float uInner;
uniform float uOuter;
uniform float uThick;       // 0 = infinitely thin disk, > 0 = volumetric
uniform float uTemp;
uniform float uBright;
uniform float uSpeed;
uniform float uHotR;
uniform float uJet;
uniform float uStars;
uniform float uNebula;

uniform highp sampler3D uNoise;
uniform sampler2D uNebTex;    // (fbmHash(d*3+4), fbmHash(d*7-2)) baked once on a lat-long grid

const float M = 0.5;

// NaN/Inf test on the bit pattern: isnan() is optimised away by fast-math shader compilers (D3D, Metal)
bool badFloat(float v) { return (floatBitsToUint(v) & 0x7f800000u) == 0x7f800000u; }

// ---------- noise ----------
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
// hashed value noise: kept for the sky (one evaluation per pixel) so the galaxy looks exactly as tuned
float vnoiseHash(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i),                    hash13(i + vec3(1,0,0)), f.x),
                 mix(hash13(i + vec3(0,1,0)),      hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)),      hash13(i + vec3(1,0,1)), f.x),
                 mix(hash13(i + vec3(0,1,1)),      hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbmHash(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoiseHash(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// smoothstep-interpolated value noise: remapping the fractional part turns the hardware trilinear
// filter of the lattice texture into the same smooth interpolation as eight hashed corners
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  // explicit LOD: implicit-derivative sampling inside the divergent ray loop forces the compiler to flatten it
  return textureLod(uNoise, (i + f + 0.5) * (1.0 / 128.0), 0.0).r;
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s * 1.14;
}

// ---------- blackbody (approx., returns linear RGB, max channel ~1) ----------
vec3 blackbody(float t) {
  t = clamp(t, 800.0, 40000.0) / 100.0;
  // keep pow/log arguments positive in both branches (GPUs may evaluate both sides)
  float t60 = max(t - 60.0, 1.0), t10 = max(t - 10.0, 1.0);
  float r = t <= 66.0 ? 1.0 : clamp(1.29293618606 * pow(t60, -0.1332047592), 0.0, 1.0);
  float g = t <= 66.0 ? clamp(0.39008157876 * log(t) - 0.63184144378, 0.0, 1.0)
                      : clamp(1.12989086089 * pow(t60, -0.0755148492), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.54320678911 * log(t10) - 1.19625408914, 0.0, 1.0));
  return pow(max(vec3(r, g, b), vec3(1e-6)), vec3(2.2));
}

// ---------- background sky ----------
vec3 sky(vec3 d) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 90.0 + fl * 110.0;
    vec3 p = d * sc;
    vec3 id = floor(p);
    vec3 h = hash33(id + fl * 37.0);
    vec3 c = id + 0.5 + (h - 0.5) * 0.7;
    float dist = length(p - c);
    float on = step(0.93 - fl * 0.025, h.x);
    float b = pow(h.y, 8.0) * 3.0 + 0.06;
    float s = (1.0 - smoothstep(0.0, 0.2, dist)) * on * b;   // edge0 must be < edge1 (undefined otherwise, e.g. on Metal)
    vec3 tint = mix(vec3(1.0, 0.75, 0.55), vec3(0.65, 0.8, 1.0), h.z);
    col += s * tint;
  }
  col *= uStars;

  // faint galactic band
  vec3 bandN = normalize(vec3(0.35, 1.0, 0.25));
  float db = dot(d, bandN);   // can be negative: square it directly, pow(x<0, 2.0) is undefined
  float band = exp(-db * db * 9.0);
  if (band * uNebula < 0.01) return col;
  // the band is smooth: a bilinear lookup of the baked noise matches per-pixel evaluation to < 1/255
  vec2 nn = textureLod(uNebTex, vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5), 0.0).rg;
  float n = nn.x, n2 = nn.y;
  vec3 neb = mix(vec3(0.10, 0.06, 0.16), vec3(0.32, 0.20, 0.13), n2);
  col += neb * band * smoothstep(0.35, 0.85, n) * uNebula;
  col += vec3(0.25, 0.22, 0.30) * band * pow(n2, 3.0) * 0.25 * uNebula;
  return col;
}

// ---------- Kerr–Schild metric ----------
// g_mn = eta_mn + f k_m k_n, with k_m = (1, k) null. Spin axis is +y, prograde = from +x toward +z.
// The tracer follows the time-reversed photon, i.e. a forward photon in the spin -a spacetime.
void kerrSchild(vec3 p, out float r, out float f, out vec3 k) {
  float a = -uSpin;
  float a2 = a * a;
  float y2 = p.y * p.y;
  float b = dot(p, p) - a2;
  float r2 = 0.5 * b + sqrt(0.25 * b * b + a2 * y2);
  r = sqrt(max(r2, 1e-8));
  f = uLensing * 2.0 * M * r2 * r / (r2 * r2 + a2 * y2 + 1e-12);
  float inv = 1.0 / (r2 + a2);
  k = vec3((r * p.x + a * p.z) * inv, p.y / r, (r * p.z - a * p.x) * inv);
}
// Kerr–Schild quantities plus the analytic gradient of G = f (1 + k.P)^2, the position-dependent
// part of the Hamiltonian H = 1/2 (|P|^2 - 1 - G). Replaces three extra metric evaluations per step.
void kerrSchildGrad(vec3 p, vec3 P, out float r, out float f, out vec3 k, out vec3 gradG) {
#ifdef SPIN_ZERO
  // Schwarzschild: r = |p|, f = 2M/r, k = p/r
  float ir = inversesqrt(dot(p, p));
  r = 1.0 / ir;
  f = uLensing * 2.0 * M * ir;
  k = p * ir;
  float pP = dot(p, P);
  float kp = 1.0 + pP * ir;
  vec3 dkp = (P - pP * ir * ir * p) * ir;
  gradG = f * kp * (2.0 * dkp - kp * ir * ir * p);
#else
  float a = -uSpin;
  float a2 = a * a;
  float y = p.y;
  float b = dot(p, p) - a2;
  float sq = sqrt(0.25 * b * b + a2 * y * y);
  float r2 = 0.5 * b + sq;
  r = sqrt(max(r2, 1e-8));
  float Q = r2 * r2 + a2 * y * y + 1e-12;
  f = uLensing * 2.0 * M * r2 * r / Q;
  float S = r2 + a2;
  k = vec3((r * p.x + a * p.z) / S, y / r, (r * p.z - a * p.x) / S);
  float kp = 1.0 + dot(k, P);

  vec3 dr = (p * r2 + vec3(0.0, a2 * y, 0.0)) / max(2.0 * r * sq, 1e-8);   // grad r
  vec3 df = f * (3.0 * dr / r - (4.0 * r2 * r * dr + vec3(0.0, 2.0 * a2 * y, 0.0)) / Q);
  float u = P.x * p.x + P.z * p.z, w = P.x * p.z - P.z * p.x;
  float N = r * u + a * w;
  vec3 dN = dr * u + r * vec3(P.x, 0.0, P.z) + a * vec3(-P.z, 0.0, P.x);
  vec3 dkp = dN / S - N * 2.0 * r * dr / (S * S) + vec3(0.0, P.y / r, 0.0) - P.y * y * dr / r2;
  gradG = df * kp * kp + 2.0 * f * kp * dkp;
#endif
}
// metric inner product of two 4-vectors stored as (x, y, z, t)
float gdot(vec4 A, vec4 B, float f, vec3 k) {
  float kA = A.w + dot(k, A.xyz);
  float kB = B.w + dot(k, B.xyz);
  return -A.w * B.w + dot(A.xyz, B.xyz) + f * kA * kB;
}

// prograde Keplerian angular velocity in the real (spin +a) spacetime
float kepler(float r) {
  float s = sqrt(M);
  return s / (r * sqrt(r) + uSpin * s);
}
float diskH(float r) { return uThick * (0.02 + 0.06 * r); }

// ---------- accretion disk material ----------
// rgb = emitted colour, a = opacity factor. P is the traced photon momentum, used for the redshift.
vec4 diskMaterial(vec3 p, float r, vec3 P, float gObs, float yn) {
  float inW = 0.1 + 0.15 * uInner;
  float dens = smoothstep(uInner - 0.02, uInner + inW, r) * (1.0 - smoothstep(uOuter * 0.5, uOuter, r));

  float hs = 0.0;
#ifdef HOTSPOT
  float ha = uTime * uSpeed * kepler(uHotR);
  vec2 dh = p.xz - uHotR * vec2(cos(ha), sin(ha));
  hs = exp(-dot(dh, dh) * 4.0);
#endif
  if (dens < 0.001 && hs < 0.001) return vec4(0.0);

  float rr = max(r, uHorizon * 1.05);
  float om = uSpeed * kepler(rr);
  float ang = atan(p.z, p.x);

  // flow-map: two phases crossfaded so differential rotation never over-shears
  float period = 6.0;
  float t1 = fract(uTime / period);
  float t2 = fract(uTime / period + 0.5);
  float w1 = 1.0 - abs(2.0 * t1 - 1.0);
  float a1 = ang - om * t1 * period;
  float a2 = ang - om * t2 * period;
  vec3 yo = vec3(0.31, -0.23, 0.27) * yn;
  vec3 c1 = vec3(cos(a1) * 2.2, sin(a1) * 2.2, r * 1.15) + yo;
  vec3 c2 = vec3(cos(a2) * 2.2, sin(a2) * 2.2, r * 1.15) + yo + vec3(5.3, 1.1, 7.7);
#ifdef THICK_DISK
  float n = mix(fbm3(c2), fbm3(c1), w1);
  float fine = 0.7;
#else
  float n = mix(fbm(c2), fbm(c1), w1);
  float fine = mix(vnoise(vec3(cos(a2) * 6.0, sin(a2) * 6.0, r * 5.0) + 3.7),
                   vnoise(vec3(cos(a1) * 6.0, sin(a1) * 6.0, r * 5.0)), w1);
#endif
  float streak = smoothstep(0.18, 0.85, n) * (0.55 + 0.65 * fine);
  streak *= 0.75 + 0.25 * sin(r * 7.0 + n * 5.0);

  // Novikov–Thorne-like temperature profile, normalised to peak 1
  float x = uInner / max(r, uInner);
  float prof = pow(x, 0.75) * pow(max(1.0 - sqrt(x), 0.0), 0.25) / 0.488;

  // exact redshift of a circular equatorial emitter: g = 1 / (u^t (1 - Omega L)), L = -P_phi (traced)
  float s = sqrt(M), r15 = rr * sqrt(rr);
  float ut = (r15 + uSpin * s) / (pow(rr, 0.75) * sqrt(max(r15 - 3.0 * M * sqrt(rr) + 2.0 * uSpin * s, 1e-4)));
  float Lz = p.x * P.z - p.z * P.x;
  float g = clamp(gObs / (ut * (1.0 + kepler(rr) * Lz)), 0.02, 20.0);
  g = mix(1.0, g, uDoppler);

  float T = uTemp * pow(prof, 0.8) * g;
  vec3 c = blackbody(T);
  // beaming ~ g^3, softly compressed so the approaching side doesn't blow out
  float beam = pow(g, 3.0);
  beam = beam / (1.0 + 0.25 * beam);
  float I = uBright * (0.2 + 1.2 * prof * prof) * beam * (0.3 + 1.3 * streak);

  vec3 rgb = c * I * dens + blackbody(uTemp * 1.5 * g) * (uBright * 3.0 * beam * hs);
  float opac = dens * (0.25 + 0.95 * streak) + hs;
  return vec4(rgb, opac);
}

void main() {
#ifdef CHECKER
  // half-width target: texel x traces full-res pixel 2x + ((y + parity) mod 2)
  vec2 pix = vec2(floor(gl_FragCoord.x) * 2.0 + mod(floor(gl_FragCoord.y) + uParity, 2.0) + 0.5, gl_FragCoord.y);
#else
  vec2 pix = gl_FragCoord.xy;
#endif
  vec2 ndc = (pix + uJitter) / uResolution * 2.0 - 1.0;
  vec4 vv = uInvProj * vec4(ndc, 1.0, 1.0);
  vec3 look = normalize((uCamToWorld * vec4(vv.xyz / vv.w, 0.0)).xyz);

  // ---- local frame of a zero-angular-momentum observer (ZAMO) at the camera ----
  float rc, fc; vec3 kc;
  kerrSchild(uCamPos, rc, fc, kc);
  vec3 phiV = vec3(-uCamPos.z, 0.0, uCamPos.x);
  vec4 T = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 Phi = vec4(phiV, 0.0);
  float gpp = gdot(Phi, Phi, fc, kc);
  vec4 u = T + (gpp > 1e-8 ? -gdot(T, Phi, fc, kc) / gpp : 0.0) * Phi;
  u /= sqrt(max(-gdot(u, u, fc, kc), 1e-8));

  vec3 rh = normalize(uCamPos);
  vec3 ph = length(phiV) > 1e-4 * length(uCamPos) ? normalize(phiV) : normalize(cross(rh, vec3(0.0, 0.0, 1.0)));
  vec3 th = cross(rh, ph);
  vec4 eR = vec4(rh, 0.0); eR += gdot(eR, u, fc, kc) * u;
  eR /= sqrt(max(gdot(eR, eR, fc, kc), 1e-8));
  vec4 eP = vec4(ph, 0.0); eP += gdot(eP, u, fc, kc) * u; eP -= gdot(eP, eR, fc, kc) * eR;
  eP /= sqrt(max(gdot(eP, eP, fc, kc), 1e-8));
  vec4 eT = vec4(th, 0.0); eT += gdot(eT, u, fc, kc) * u; eT -= gdot(eT, eR, fc, kc) * eR; eT -= gdot(eT, eP, fc, kc) * eP;
  eT /= sqrt(max(gdot(eT, eT, fc, kc), 1e-8));

  // ---- relativistic aberration for a moving observer (velocity reversed with time) ----
  vec3 beta = -uObsVel;
  float b2 = dot(beta, beta);
  vec3 n = look;
  float obsDop = 1.0;
  if (b2 > 1e-10) {
    float bm = sqrt(b2);
    vec3 bh = beta / bm;
    float gam = inversesqrt(1.0 - b2);
    float np = dot(look, bh);
    n = normalize(((np + bm) * bh + (look - np * bh) / gam) / (1.0 + bm * np));
    obsDop = gam * (1.0 - dot(beta, n));
  }

  // ---- initial photon momentum, normalised to p_t = -1 ----
  vec4 pu = u + dot(n, rh) * eR + dot(n, ph) * eP + dot(n, th) * eT;
  float kpu = pu.w + dot(kc, pu.xyz);
  float ptc = -pu.w + fc * kpu;
  vec3 P = (pu.xyz + fc * kpu * kc) / (-ptc);
  float gObs = obsDop / (-ptc);   // E_observed / E_infinity

  vec3 x = uCamPos;
  vec3 vel = n;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  bool captured = false, escaped = false;
  float jit = hash12(pix + uFrame * 17.31);
  float a2 = uSpin * uSpin;

  for (int i = 0; i < 1500; i++) {
    if (i >= uSteps) { captured = true; break; }
    float r, f; vec3 k, grad;
    kerrSchildGrad(x, P, r, f, k, grad);
    if (r < uHorizon * 1.01) { captured = true; break; }
    float rho = length(x);

    // Hamilton's equations: dx/dl = P - f (1 + k.P) k,  dP/dl = 1/2 grad(f (1 + k.P)^2)
    bool strong = f > 0.08;   // within ~6 rs; further out the corrections below are negligible
    // re-project onto the null cone H = 0 (rescale P); without this, outgoing rays near the horizon drift and fall back in
    if (strong) {
      float kd = dot(k, P), A = dot(P, P) - f * kd * kd;
      if (A > 1e-6) P *= (f * kd + sqrt(f * f * kd * kd + A * (1.0 + f))) / A;
    }
    float kp = 1.0 + dot(k, P);
    vel = P - f * kp * k;
    // fine steps near the hole, much coarser in the nearly-flat far field
    const float STEP_C = 0.2;
    float ds = clamp(STEP_C * rho * max(1.0, rho / 6.0), 0.008, 4.0);
    float dl = ds / max(length(vel), 1e-4);
    // outgoing rays near the horizon carry a large, rapidly redshifting momentum: limit its change per step
    if (strong) dl = min(dl, STEP_C * 0.73 * length(P) / max(0.5 * length(grad), 1e-6));
    // Heun (2nd order): predictor with the derivatives here, corrector with those at the predicted point.
    // Twice the work per step but ~4x larger steps for lower error than first-order stepping.
    vec3 F1 = 0.5 * grad;
    vec3 xq = x + vel * dl, Pq = P + F1 * dl;
    float rq, fq; vec3 kq, gq;
    kerrSchildGrad(xq, Pq, rq, fq, kq, gq);
    vec3 vq = Pq - fq * (1.0 + dot(kq, Pq)) * kq;
    vec3 nx = x + 0.5 * dl * (vel + vq);
    P += 0.5 * dl * (F1 + 0.5 * gq);
    vel = vq;

#ifndef THICK_DISK
    // thin disk: one sample where the segment crosses the equatorial plane
    if (x.y * nx.y < 0.0) {
      vec3 pc = mix(x, nx, x.y / (x.y - nx.y));
      float rb = sqrt(max(dot(pc.xz, pc.xz) - a2, 0.0));
      vec4 d = diskMaterial(pc, rb, P, gObs, 0.0);
      float ai = clamp(d.a, 0.0, 1.0);
      col += (1.0 - alpha) * d.rgb * ai;
      alpha += (1.0 - alpha) * ai;
    }
#else
    {
      // volumetric disk: march the part of the segment inside the slab |y| < 2.5 h
      float tm = x.y * nx.y < 0.0 ? x.y / (x.y - nx.y) : (abs(x.y) < abs(nx.y) ? 0.0 : 1.0);
      vec3 pm = mix(x, nx, tm);
      float rm = sqrt(max(dot(pm.xz, pm.xz) - a2, 0.0));
      float H = 2.5 * diskH(rm) + 0.02;
      if (abs(pm.y) < H && rm > uInner * 0.7 && rm < uOuter * 1.05 + 1.0) {
        float dy = nx.y - x.y;
        float tA = 0.0, tB = 1.0;
        if (abs(dy) > 1e-6) {
          float s1 = (-H - x.y) / dy, s2 = (H - x.y) / dy;
          tA = clamp(min(s1, s2), 0.0, 1.0);
          tB = clamp(max(s1, s2), 0.0, 1.0);
        }
        float dsS = length(nx - x) * (tB - tA) / 8.0;
        for (int j = 0; j < 8; j++) {
          vec3 ps = mix(x, nx, tA + (tB - tA) * (float(j) + jit) / 8.0);
          float rb = sqrt(max(dot(ps.xz, ps.xz) - a2, 0.0));
          float h = diskH(rb) + 0.01;
          float yn = ps.y / h;
          if (abs(yn) > 3.0) continue;
          vec4 d = diskMaterial(ps, rb, P, gObs, yn);
          if (d.a <= 0.0) continue;
          float ai = 1.0 - exp(-0.8 * d.a * exp(-0.5 * yn * yn) / h * dsS);
          col += (1.0 - alpha) * d.rgb * ai;
          alpha += (1.0 - alpha) * ai;
        }
      }
    }
#endif

#ifdef JETS
    {
      // jets: analytic line integral of a gaussian cylinder around the spin axis
      vec2 dq = nx.xz - x.xz;
      float L2 = dot(dq, dq);
      float tc = L2 > 1e-10 ? clamp(-dot(x.xz, dq) / L2, 0.0, 1.0) : 0.0;
      vec3 pc = mix(x, nx, tc);
      float ay = abs(pc.y);
      float w = 0.22 + 0.1 * ay;
      float rc2 = dot(pc.xz, pc.xz);
      if (rc2 < 9.0 * w * w && ay > 0.6 && ay < 45.0) {
        float segL = length(nx - x);
        float sinA = sqrt(L2) / max(segL, 1e-5);
        float path = min(segL, 1.77 * w / max(sinA, 0.04));
        float prof = exp(-rc2 / (w * w)) * smoothstep(0.6, 2.5, ay) * exp(-ay / 16.0);
        float knots = 0.35 + 0.65 * vnoise(vec3(pc.x * 3.0, ay * 0.7 - uTime * 2.5, pc.z * 3.0));
        // plasma moving at 0.9c along the axis; the real photon travels along -vel
        float gj = 1.0 / (2.294 * (1.0 + 0.9 * sign(pc.y) * vel.y / length(vel)));
        gj = mix(1.0, gj * gObs, uDoppler);
        float jb = min(gj * gj, 25.0);
        col += (1.0 - alpha) * vec3(0.45, 0.62, 1.0) * (uJet * 1.5 * prof * knots * jb * path);
      }
    }
#endif

    x = nx;
    if (alpha > 0.995) break;
    // past everything that emits light and heading out: stop and add the remaining weak-field bending analytically
    if (rho > uEscape && dot(x, vel) > 0.0) { escaped = true; break; }
  }

  if (!captured) {
    vec3 dir = normalize(vel);
    if (escaped) {
      vec3 xp = x - dot(x, dir) * dir;   // perpendicular offset from the hole, |xp| = impact parameter b
      float b = length(xp), rx = length(x);
      if (b > 1e-3) {
        // deflection still to come between r and infinity: (rs / b) (1 - sqrt(1 - b^2/r^2)), rs = 1
        float rem = uLensing * (1.0 - sqrt(max(1.0 - b * b / (rx * rx), 0.0))) / b;
        dir = normalize(dir * cos(rem) - xp / b * sin(rem));
      }
    }
    float sg = mix(1.0, clamp(gObs * gObs * gObs, 0.0, 12.0), uDoppler);
    col += (1.0 - alpha) * sky(dir) * sg;
  }
  if (badFloat(col.x) || badFloat(col.y) || badFloat(col.z)) col = vec3(0.0);
  gl_FragColor = vec4(clamp(col, 0.0, 6.0e4), 1.0);   // stay inside half-float range
}
`;

export const temporalFragment=`uniform sampler2D tCur; uniform sampler2D tPrev; uniform float uW; uniform float uParity; uniform float uFresh;
bool bad(vec4 v) { return any(equal(floatBitsToUint(v) & 0x7f800000u, uvec4(0x7f800000u))); }
vec4 cur(ivec2 p) {
  ivec2 full = textureSize(tPrev, 0);
  p = clamp(p, ivec2(0), full - 1);
#ifdef CHECKER
  return texelFetch(tCur, ivec2(p.x >> 1, p.y), 0);
#else
  return texelFetch(tCur, p, 0);
#endif
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 h = texelFetch(tPrev, p, 0);
  bool noHist = uFresh > 0.5 || bad(h);
#ifdef CHECKER
  vec4 c;
  if (((p.x + p.y + int(uParity)) & 1) == 0) {
    c = cur(p);
  } else {
    vec4 L = cur(p + ivec2(-1, 0)), R = cur(p + ivec2(1, 0)), U = cur(p + ivec2(0, 1)), D = cur(p + ivec2(0, -1));
    if (noHist) {
      c = 0.25 * (L + R + U + D);
    } else {
      // Clamp to the neighbours only where they changed since last frame (motion); in static regions trust
      // the history as-is, so isolated stars are not clipped away every other frame.
      ivec2 full = textureSize(tPrev, 0) - 1;
      vec4 pL = texelFetch(tPrev, clamp(p + ivec2(-1, 0), ivec2(0), full), 0), pR = texelFetch(tPrev, clamp(p + ivec2(1, 0), ivec2(0), full), 0);
      vec4 pU = texelFetch(tPrev, clamp(p + ivec2(0, 1), ivec2(0), full), 0), pD = texelFetch(tPrev, clamp(p + ivec2(0, -1), ivec2(0), full), 0);
      vec3 change = abs(L - pL).rgb + abs(R - pR).rgb + abs(U - pU).rgb + abs(D - pD).rgb;
      vec3 level = (L + R + U + D).rgb + 0.05;
      float motion = smoothstep(0.03, 0.2, dot(change, vec3(1.0)) / dot(level, vec3(1.0)));
      c = mix(h, clamp(h, min(min(L, R), min(U, D)), max(max(L, R), max(U, D))), motion);
    }
  }
#else
  vec4 c = cur(p);
#endif
  if (bad(c)) c = vec4(0.0);
  if (uW >= 1.0 || noHist) h = c;   // never let bad history leak through
  gl_FragColor = mix(h, c, uW);
}`;

export const screenVertex=`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const nebulaFragment=`varying vec2 vUv;
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
// hashed value noise: kept for the sky (one evaluation per pixel) so the galaxy looks exactly as tuned
float vnoiseHash(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i),                    hash13(i + vec3(1,0,0)), f.x),
                 mix(hash13(i + vec3(0,1,0)),      hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)),      hash13(i + vec3(1,0,1)), f.x),
                 mix(hash13(i + vec3(0,1,1)),      hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbmHash(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoiseHash(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}

void main() {
  float lon = (vUv.x - 0.5) * 6.28318530718, lat = (vUv.y - 0.5) * 3.14159265359;
  vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  gl_FragColor = vec4(fbmHash(d * 3.0 + 4.0), fbmHash(d * 7.0 - 2.0), 0.0, 1.0);
}
`;
