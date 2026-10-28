/* Zirve · GLSL for the stage. Every shader reads and writes plain sRGB (colour management is off in stage.mjs), so
   the trail texture's mid-grey zero and the page's obsidian match exactly. */

export const COMMON = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
vec2 cover(vec2 uv, vec2 r, vec2 t){ float pr = r.x / r.y, tr = t.x / t.y; vec2 s = pr > tr ? vec2(1., tr / pr) : vec2(pr / tr, 1.); return (uv - .5) * s + .5; }
vec2 coverF(vec2 uv, vec2 r, vec2 t, vec2 f){ float pr = r.x / r.y, tr = t.x / t.y; vec2 s = pr > tr ? vec2(1., tr / pr) : vec2(pr / tr, 1.); return (uv - .5) * s + .5 + (f - .5) * (1. - s); }
vec3 chrome(float t){ t = fract(t);
  vec3 a = vec3(.70, .73, .78), b = vec3(.95, .96, .98), c = vec3(.80, .76, .93), d = vec3(.72, .80, .90);
  return t < .25 ? mix(a, b, t / .25) : t < .5 ? mix(b, c, (t - .25) / .25) : t < .75 ? mix(c, d, (t - .5) / .25) : mix(d, a, (t - .75) / .25); }
vec3 trail(sampler2D tex, vec2 suv){ return (texture2D(tex, suv).rgb - .50196) * 2.; }
`;

export const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
export const FLAT_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

/* The cursor leaves a liquid trail in a small ping-pong texture: xy = push, z = energy. */
export const TRAIL_FS = `
uniform sampler2D uPrev; uniform vec2 uMouse, uMV; uniform float uAspect, uOn; varying vec2 vUv;
vec3 dec(vec3 c){ return (c - .50196) * 2.; }
void main(){
  vec3 here = dec(texture2D(uPrev, vUv).rgb);
  vec3 p = dec(texture2D(uPrev, vUv - here.xy * .01).rgb);
  p.xy = sign(p.xy) * max(abs(p.xy) * .955 - .009, 0.);
  p.z = max(p.z * .95 - .009, 0.);
  vec2 d = vUv - uMouse; d.x *= uAspect;
  float f = exp(-dot(d, d) / .0065) * uOn;
  p.xy += uMV * f * .6; p.z += f * .4;
  p = clamp(p, vec3(-1., -1., 0.), vec3(1.));
  gl_FragColor = vec4(p * .5 + .50196, 1.);
}`;

/* Picture planes bend with the gallery's curve and with a drag; they lean with scroll speed. */
export const PLANE_VS = `
uniform float uVel, uDrag, uCurve; varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.);
  w.y -= sin(uv.x * 3.14159) * uVel * .3;
  w.x -= sin(uv.y * 3.14159) * uDrag * .6;
  w.z -= w.x * w.x * uCurve;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/* A picture: arrives behind a chrome wipe, ripples under the cursor, splits its channels with speed. uDev < 1 keeps
   it silver (a photograph still developing); uRipple > 0 turns the cursor's trail into rings on water. */
export const IMG_FS = `
uniform sampler2D uTex, uTrail; uniform vec2 uTexRes, uRes, uScreen;
uniform float uReveal, uTime, uVel, uHover, uPar, uDev, uRipple, uArch; uniform vec2 uFocus;
varying vec2 vUv;
${COMMON}
void main(){
  vec2 suv = gl_FragCoord.xy / uScreen; vec3 tr = trail(uTrail, suv);
  float rv = uReveal;
  float zoom = 1.08 + (1. - rv) * .22 + uHover * .06;
  vec2 uv = (coverF(vUv, uRes, uTexRes, uFocus) - .5) / zoom + .5;
  uv.y += uPar * .035;
  float ring = sin(length(tr.xy) * 46. - uTime * 5.) * tr.z;
  uv -= tr.xy * .012 * (1. + uRipple * 1.6) + vec2(ring) * .005 * uRipple;
  float sp = clamp(abs(uVel) * .00026 + length(tr.xy) * .0035, 0., .012);
  vec3 c = vec3(texture2D(uTex, uv + vec2(0., sp)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(0., sp)).b);
  c += vec3(.92, .95, 1.) * pow(max(ring, 0.), 2.) * .3 * uRipple;
  // Developing: colour blooms up from the bottom behind a thin chrome front.
  float lum = dot(c, vec3(.299, .587, .114));
  vec3 silver = vec3(lum * 1.06) * vec3(.93, .93, 1.02);
  float dn = noise(vUv * vec2(5., 3.) + uTime * .06);
  float e = vUv.y * .82 + dn * .18;
  float fr = uDev * 1.3 - .12;
  float dm = 1. - smoothstep(fr - .07, fr, e);
  float dband = smoothstep(fr - .05, fr - .02, e) * (1. - smoothstep(fr - .015, fr, e)) * (1. - step(.999, uDev));
  c = mix(silver, c, dm);
  c = mix(c, chrome(vUv.x * .7 + uTime * .05), dband * .45);
  // Arrival: a noisy wipe upward with a chrome edge.
  float n = noise(vUv * vec2(4., 2.5) + vec2(0., uTime * .12));
  float er = vUv.y * .82 + n * .18;
  float r = rv * 1.3 - .08;
  float m = 1. - smoothstep(r - .1, r, er);
  float band = smoothstep(r - .13, r - .05, er) * (1. - smoothstep(r - .04, r, er)) * (1. - smoothstep(.92, 1., rv));
  c = mix(c, chrome(vUv.x * .8 + uTime * .05), band * .9);
  c *= 1. - uHover * .05;
  c += (hash(vUv * uRes + fract(uTime) * 61.) - .5) * .028;
  // An arched top (the colonnade, the sales office): the half circle as wide as the picture.
  if (uArch > .5) { vec2 px = vUv * uRes; float rr = uRes.x * .5; vec2 cc = vec2(rr, uRes.y - rr); if (px.y > cc.y) m *= clamp(rr - length(px - cc) + .5, 0., 1.); }
  gl_FragColor = vec4(c, m);
}`;

/* A hero: poster first, then the film; the cursor's trail refracts it and splits the light at the edges. */
export const HERO_FS = `
uniform sampler2D uVideo, uPoster, uTrail; uniform vec2 uVidRes, uPosRes, uRes, uScreen;
uniform float uMix, uTime, uVel, uIntro, uProg; uniform vec2 uFocus;
varying vec2 vUv;
${COMMON}
void main(){
  vec2 suv = gl_FragCoord.xy / uScreen; vec3 tr = trail(uTrail, suv);
  float ii = uIntro;
  float zoom = 1. + (1. - ii) * .18 + uProg * .08;
  vec2 d = tr.xy * .022;
  float sp = clamp(length(tr.xy) * .0045 + abs(uVel) * .0004 + (1. - ii) * .012, 0., .02);
  vec2 a = (cover(vUv, uRes, uVidRes) - .5) / zoom + .5 - d;
  vec2 b = (coverF(vUv, uRes, uPosRes, uFocus) - .5) / zoom + .5 - d;
  vec3 p = vec3(texture2D(uPoster, b + vec2(sp, 0.)).r, texture2D(uPoster, b).g, texture2D(uPoster, b - vec2(sp, 0.)).b);
  vec3 c = p;
  if (uMix > .001) {
    vec3 v = vec3(texture2D(uVideo, a + vec2(sp, 0.)).r, texture2D(uVideo, a).g, texture2D(uVideo, a - vec2(sp, 0.)).b);
    c = mix(p, v, uMix);
  }
  c += chrome(suv.x * .6 + uTime * .04) * clamp(tr.z, 0., 1.) * .06;
  c *= (1. - uProg * .55) * mix(.15, 1., ii);
  c += (hash(vUv * uRes + fract(uTime) * 61.) - .5) * .03;
  gl_FragColor = vec4(c, 1.);
}`;

/* A pinned sequence: one picture dissolves into the next along a noisy front with a chrome band. */
export const SEQ_FS = `
uniform sampler2D uA, uB, uTrail; uniform vec2 uARes, uBRes, uRes, uScreen; uniform float uT, uTime;
varying vec2 vUv;
${COMMON}
void main(){
  vec2 suv = gl_FragCoord.xy / uScreen; vec3 tr = trail(uTrail, suv);
  float n = noise(vUv * vec2(3., 2.) + uTime * .04) * .7 + noise(vUv * 11. + 7.) * .3;
  float e = (1. - vUv.y) * .5 + vUv.x * .12 + n * .4;
  float mB = smoothstep(e - .05, e + .05, uT * 1.4 - .2);
  float band = (1. - abs(mB * 2. - 1.)) * step(.001, uT) * step(uT, .999);
  vec2 off = (vec2(n, noise(vUv * 5. + 3.)) - .5) * .14;
  vec2 a = (cover(vUv, uRes, uARes) - .5) / (1.06 + uT * .06) + .5 + off * mB - tr.xy * .014;
  vec2 b = (cover(vUv, uRes, uBRes) - .5) / (1.14 - uT * .08) + .5 - off * (1. - mB) - tr.xy * .014;
  vec3 c = mix(texture2D(uA, a).rgb, texture2D(uB, b).rgb, mB);
  c = mix(c, chrome(vUv.x + vUv.y * .3 + uTime * .05), band * .6);
  c += (hash(vUv * uRes + fract(uTime) * 61.) - .5) * .03;
  gl_FragColor = vec4(c, 1.);
}`;

/* Day and night over the same aerial: the border is liquid, follows the hand, and bends the light near it. */
export const AERIAL_FS = `
uniform sampler2D uA, uB, uTrail; uniform vec2 uARes, uBRes, uRes, uScreen; uniform float uX, uTime;
varying vec2 vUv;
${COMMON}
void main(){
  vec2 suv = gl_FragCoord.xy / uScreen; vec3 tr = trail(uTrail, suv);
  float n = (noise(vec2(vUv.y * 4., uTime * .25)) - .5) * .045 + (noise(vUv * 14. + uTime * .1) - .5) * .012;
  float edge = uX + n + tr.x * .04;
  float d = vUv.x - edge;
  float m = smoothstep(-.0025, .0025, d);
  float lens = exp(-d * d / .0011);
  vec2 off = vec2(-sign(d) * lens * .014, 0.) - tr.xy * .006;
  vec3 c = mix(texture2D(uA, cover(vUv + off, uRes, uARes)).rgb, texture2D(uB, cover(vUv + off, uRes, uBRes)).rgb, m);
  c += chrome(vUv.y * .8 + uTime * .05) * lens * .32;
  c += (hash(vUv * uRes + fract(uTime) * 61.) - .5) * .028;
  gl_FragColor = vec4(c, 1.);
}`;

/* The amenity picture that follows the cursor over the list, swinging with its speed. */
export const AMEN_VS = `
uniform float uVx, uVy; varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  p.x += (uv.y - .5) * uVx * .012;
  p.y += sin(uv.x * 3.14159) * uVy * .006;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
export const AMEN_FS = `
uniform sampler2D uA, uB; uniform vec2 uARes, uBRes, uRes; uniform float uMix, uAlpha, uTime, uShow;
varying vec2 vUv;
${COMMON}
void main(){
  float n = noise(vUv * 4. + uTime * .3);
  float k = smoothstep(0., 1., uMix * 1.6 - n * .6);
  vec2 z = (vUv - .5) / (1.25 - uShow * .25) + .5;
  vec3 c = mix(texture2D(uA, cover(z, uRes, uARes)).rgb, texture2D(uB, cover(z, uRes, uBRes)).rgb, k);
  float edge = smoothstep(uShow * 1.2, uShow * 1.2 - .15, length(vUv - .5) * 1.42 + n * .12);
  gl_FragColor = vec4(c, edge * uAlpha);
}`;

/* Particles. position = first shape (the aerial, the mark), aPlan = second shape (the site plan), aStart = dust.
   uA gathers them, uM turns the first shape into the second with a sweep, uG keeps only the green, uR lets the
   crisp picture take over, uD scatters them upward, uBurst blows them out from the middle. */
export const PTS_VS = `
attribute vec3 aStart, aColor, aPlan, aColorB; attribute vec4 aRand;
uniform float uA, uM, uG, uR, uD, uBurst, uTime, uSize, uDpr, uCam, uRepel, uRad; uniform vec2 uMouse;
varying vec3 vColor; varying float vAlpha;
${COMMON}
void main(){
  float p = clamp((uA - aRand.x * .5) / .5, 0., 1.);
  p = 1. - pow(1. - p, 3.);
  vec3 s = aStart;
  float ang = (1. - p) * (aRand.y * 2.2 + .6) + uTime * .04 * (1. - p);
  s.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * s.xz;
  vec3 drift = vec3(sin(uTime * .5 + aRand.z * 6.283), cos(uTime * .37 + aRand.w * 6.283), sin(uTime * .29 + aRand.y * 6.283));
  float k = smoothstep(0., 1., clamp(uM * 1.6 - ((aPlan.x + .5) * .45 + aRand.z * .15), 0., 1.));
  vec3 target = mix(position, aPlan, k);
  target.z += sin(k * 3.14159) * (.05 + aRand.w * .07);
  vec3 pos = mix(s + drift * .03, target + drift * .0016 * (1. - uR), p);
  pos += normalize(aStart + 1e-4) * uBurst * (.25 + aRand.x * .6);
  vec2 dm = pos.xy - uMouse;
  float f = exp(-dot(dm, dm) / uRad) * uRepel * p;
  pos.xy += normalize(dm + 1e-5) * f * .05; pos.z += f * .09;
  float q = clamp((uD - aRand.w * .45) / .55, 0., 1.); q = q * q;
  pos += vec3(aStart.x * 1.3, abs(aStart.y) * 1.2 + .45, aStart.z * 1.3) * q;
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  gl_Position = projectionMatrix * mv;
  float fly = 1. - p;
  vec3 cb = aColorB;
  float green = smoothstep(.01, .09, cb.g - max(cb.r, cb.b) * .96);
  float gs = mix(1., mix(.16, 1.2, green), uG);
  gl_PointSize = uSize * mix(1., .55 + aRand.z * .9, fly) * (1. + q * 1.2 + f * 1.5) * mix(1., .75 + green * .5, uG) * uDpr * (uCam / -mv.z);
  float spark = .1 + .65 * pow(aRand.y, 7.);
  vAlpha = mix(1., spark, pow(fly, .35)) * (1. - q * q) * smoothstep(0., .04, uA) * (1. - uR) * gs;
  vec3 ch = chrome(aRand.z + uTime * .03 + pos.x * .4);
  vec3 col = mix(aColor, aColorB, k);
  vColor = mix(ch, col, smoothstep(.6, 1., p)) + f * .25 + ch * sin(k * 3.14159) * .45;
}`;
export const PTS_FS = `
varying vec3 vColor; varying float vAlpha;
void main(){ float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(vColor, smoothstep(.5, .12, r) * vAlpha); }`;
