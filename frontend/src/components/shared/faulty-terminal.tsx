import React from "react";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { usePerformanceDetection } from "@/lib/hooks";

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;

uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2; 
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;

  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;

  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;

  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);

  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);

  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
    vec2 grid = uGridMul * 15.0;
    vec2 s = floor(p * grid) / grid;
    p = p * grid;
    vec2 q, r;
    float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

    if(uUseMouse > 0.5){
        vec2 mouseWorld = uMouse * uScale;
        float distToMouse = distance(s, mouseWorld);
        float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
        intensity += mouseInfluence;

        float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
        intensity += ripple;
    }

    if(uUsePageLoadAnimation > 0.5){
        float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
        float cellDelay = cellRandom * 0.8;
        float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);

        float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
        intensity *= fadeAlpha;
    }

    p = fract(p);
    p *= uDigitSize;

    float px5 = p.x * 5.0;
    float py5 = (1.0 - p.y) * 5.0;
    float x = fract(px5);
    float y = fract(py5);

    float i = floor(py5) - 2.0;
    float j = floor(px5) - 2.0;
    float n = i * i + j * j;
    float f = n * 0.0625;

    float isOn = step(0.1, intensity - f);
    float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);

    return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
    float y = look.y - mod(iTime * 0.25, 1.0);
    float window = 1.0 / (1.0 + 50.0 * y * y);
    return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){

    float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
    bar *= uScanlineIntensity;

    float displacement = displace(p);
    p.x += displacement;

    if (uGlitchAmount != 1.0) {
      float extra = displacement * (uGlitchAmount - 1.0);
      p.x += extra;
    }

    float middle = digit(p);

    const float off = 0.002;
    float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

    vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
    return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
    time = iTime * 0.333333;
    vec2 uv = vUv;

    if(uCurvature != 0.0){
      uv = barrel(uv);
    }

    vec2 p = uv * uScale;
    vec3 col = getColor(p);

    if(uChromaticAberration != 0.0){
      vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
      col.r = getColor(p + ca).r;
      col.b = getColor(p - ca).b;
    }

    col *= uTint;
    col *= uBrightness;

    if(uDither > 0.0){
      float rnd = hash21(gl_FragCoord.xy);
      col += (rnd - 0.5) * (uDither * 0.003922);
    }

    gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex: string) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(h, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

interface FaultyTerminalProps {
  scale?: number;
  gridMul?: [number, number];
  digitSize?: number;
  timeScale?: number;
  pause?: boolean;
  scanlineIntensity?: number;
  glitchAmount?: number;
  flickerAmount?: number;
  noiseAmp?: number;
  chromaticAberration?: number;
  dither?: number | boolean;
  curvature?: number;
  tint?: string;
  mouseReact?: boolean;
  mouseStrength?: number;
  dpr?: number;
  pageLoadAnimation?: boolean;
  brightness?: number;
  className?: string;
  style?: React.CSSProperties;

  lowPowerMode?: boolean;
  maxFPS?: number;
  adaptiveQuality?: boolean;
}

function FaultyTerminalComponent({
  scale = 1,
  gridMul = [2, 1],
  digitSize = 1.5,
  timeScale = 0.3,
  pause = false,
  scanlineIntensity = 0.3,
  glitchAmount = 1,
  flickerAmount = 1,
  noiseAmp = 1,
  chromaticAberration = 0,
  dither = 0,
  curvature = 0.2,
  tint = "#ffffff",
  mouseReact = true,
  mouseStrength = 0.2,
  dpr = Math.min(window.devicePixelRatio || 1, 2),
  pageLoadAnimation = true,
  brightness = 1,
  className,
  style,
  lowPowerMode: lowPowerModeProp,
  maxFPS: maxFPSProp,
  adaptiveQuality: adaptiveQualityProp,
  ...rest
}: FaultyTerminalProps) {

  const { recommendedSettings } = usePerformanceDetection();

  const isIPad = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return /ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const lowPowerMode = lowPowerModeProp ?? (isIPad ? true : recommendedSettings.lowPowerMode);
  const maxFPS = maxFPSProp ?? (isIPad ? 30 : recommendedSettings.maxFPS);
  const adaptiveQuality = adaptiveQualityProp ?? true;

  const containerRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<Program | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const geometryRef = useRef<Triangle | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const frozenTimeRef = useRef(0);
  const rafRef = useRef(0);
  const loadAnimationStartRef = useRef(0);
  const timeOffsetRef = useRef(Math.random() * 100);

  const frameCountRef = useRef(0);
  const lastFPSCheckRef = useRef(0);
  const currentFPSRef = useRef(60);
  const performanceModeRef = useRef<'high' | 'medium' | 'low'>('high');
  const lastFrameTimeRef = useRef(0);
  const isVisibleRef = useRef(true);
  const contextLostRef = useRef(false);
  const renderSkippedRef = useRef(0);
  const isIPadRef = useRef(false);

  const propsRef = useRef({
    scale,
    gridMul,
    digitSize,
    timeScale,
    pause,
    scanlineIntensity,
    glitchAmount,
    flickerAmount,
    noiseAmp,
    chromaticAberration,
    dither: typeof dither === "boolean" ? (dither ? 1 : 0) : dither,
    curvature,
    tint,
    mouseReact,
    mouseStrength,
    pageLoadAnimation,
    brightness,
    lowPowerMode,
    maxFPS,
    adaptiveQuality
  });

  useEffect(() => {
    propsRef.current = {
      scale,
      gridMul,
      digitSize,
      timeScale,
      pause,
      scanlineIntensity,
      glitchAmount,
      flickerAmount,
      noiseAmp,
      chromaticAberration,
      dither: typeof dither === "boolean" ? (dither ? 1 : 0) : dither,
      curvature,
      tint,
      mouseReact,
      mouseStrength,
      pageLoadAnimation,
      brightness,
      lowPowerMode,
      maxFPS,
      adaptiveQuality
    };
  }, [
    scale,
    gridMul,
    digitSize,
    timeScale,
    pause,
    scanlineIntensity,
    glitchAmount,
    flickerAmount,
    noiseAmp,
    chromaticAberration,
    dither,
    curvature,
    tint,
    mouseReact,
    mouseStrength,
    pageLoadAnimation,
    brightness,
    lowPowerMode,
    maxFPS,
    adaptiveQuality
  ]);

  const tintVec = useMemo(() => hexToRgb(tint), [tint]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const ctn = containerRef.current;
    if (!ctn) return;
    const rect = ctn.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    mouseRef.current = { x, y };
  }, []);

  // Определяем iPad
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    isIPadRef.current = /ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Обработка видимости страницы
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const ctn = containerRef.current;
    if (!ctn) return;

    // Используем значение isIPad из useMemo
    const isIPadDevice = isIPad;
    
    const renderer = new Renderer({ 
      dpr: isIPadDevice ? Math.min(dpr, 1.5) : dpr,
      powerPreference: isIPadDevice ? 'low-power' : 'default',
      antialias: !isIPadDevice,
      depth: false,
      stencil: false,
      alpha: false
    });
    rendererRef.current = renderer;
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    // Обработка потери контекста
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      console.warn('WebGL context lost, will attempt to restore');
    };

    const handleContextRestored = () => {
      contextLostRef.current = false;
      // Пересоздаем программу и меш после восстановления контекста
      try {
        const geometry = new Triangle(gl);
        geometryRef.current = geometry;
        
        // Сохраняем старые значения uniform для восстановления
        const oldUniforms = programRef.current?.uniforms;
        
        const program = new Program(gl, {
          vertex: vertexShader,
          fragment: fragmentShader,
          uniforms: {
            iTime: { value: oldUniforms?.iTime?.value || 0 },
            iResolution: oldUniforms?.iResolution?.value || new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
            uScale: { value: oldUniforms?.uScale?.value || scale },
            uGridMul: { value: oldUniforms?.uGridMul?.value || new Float32Array(gridMul) },
            uDigitSize: { value: oldUniforms?.uDigitSize?.value || digitSize },
            uScanlineIntensity: { value: oldUniforms?.uScanlineIntensity?.value || scanlineIntensity },
            uGlitchAmount: { value: oldUniforms?.uGlitchAmount?.value || glitchAmount },
            uFlickerAmount: { value: oldUniforms?.uFlickerAmount?.value || flickerAmount },
            uNoiseAmp: { value: oldUniforms?.uNoiseAmp?.value || noiseAmp },
            uChromaticAberration: { value: oldUniforms?.uChromaticAberration?.value || chromaticAberration },
            uDither: { value: oldUniforms?.uDither?.value || (typeof dither === "boolean" ? (dither ? 1 : 0) : dither) },
            uCurvature: { value: oldUniforms?.uCurvature?.value || curvature },
            uTint: { value: oldUniforms?.uTint?.value || new Color(tintVec[0], tintVec[1], tintVec[2]) },
            uMouse: { value: oldUniforms?.uMouse?.value || new Float32Array([smoothMouseRef.current.x, smoothMouseRef.current.y]) },
            uMouseStrength: { value: oldUniforms?.uMouseStrength?.value || mouseStrength },
            uUseMouse: { value: oldUniforms?.uUseMouse?.value || (mouseReact ? 1 : 0) },
            uPageLoadProgress: { value: oldUniforms?.uPageLoadProgress?.value || (pageLoadAnimation ? 0 : 1) },
            uUsePageLoadAnimation: { value: oldUniforms?.uUsePageLoadAnimation?.value || (pageLoadAnimation ? 1 : 0) },
            uBrightness: { value: oldUniforms?.uBrightness?.value || brightness },
          },
        });
        programRef.current = program;
        
        const mesh = new Mesh(gl, { geometry, program });
        meshRef.current = mesh;
      } catch (error) {
        console.error('Error restoring WebGL context:', error);
      }
    };

    gl.canvas.addEventListener('webglcontextlost', handleContextLost);
    gl.canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const geometry = new Triangle(gl);
    geometryRef.current = geometry;

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Color(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height
          ),
        },
        uScale: { value: scale },
        uGridMul: { value: new Float32Array(gridMul) },
        uDigitSize: { value: digitSize },
        uScanlineIntensity: { value: scanlineIntensity },
        uGlitchAmount: { value: glitchAmount },
        uFlickerAmount: { value: flickerAmount },
        uNoiseAmp: { value: noiseAmp },
        uChromaticAberration: { value: chromaticAberration },
        uDither: { value: typeof dither === "boolean" ? (dither ? 1 : 0) : dither },
        uCurvature: { value: curvature },
        uTint: { value: new Color(tintVec[0], tintVec[1], tintVec[2]) },
        uMouse: {
          value: new Float32Array([
            smoothMouseRef.current.x,
            smoothMouseRef.current.y,
          ]),
        },
        uMouseStrength: { value: mouseStrength },
        uUseMouse: { value: mouseReact ? 1 : 0 },
        uPageLoadProgress: { value: pageLoadAnimation ? 0 : 1 },
        uUsePageLoadAnimation: { value: pageLoadAnimation ? 1 : 0 },
        uBrightness: { value: brightness },
      },
    });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    function resize() {
      if (!ctn || !renderer) return;
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      program.uniforms.iResolution.value = new Color(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / gl.canvas.height
      );
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(ctn);
    resize();

    const update = (t: number) => {
      const props = propsRef.current;

      // Проверяем контекст и видимость
      if (contextLostRef.current || !isVisibleRef.current) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      // Проверяем валидность WebGL контекста
      if (!gl || gl.isContextLost()) {
        contextLostRef.current = true;
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      frameCountRef.current++;
      const deltaTime = t - lastFrameTimeRef.current;
      lastFrameTimeRef.current = t;

      if (t - lastFPSCheckRef.current >= 1000) {
        currentFPSRef.current = frameCountRef.current;
        frameCountRef.current = 0;
        lastFPSCheckRef.current = t;

        if (props.adaptiveQuality) {
          if (currentFPSRef.current < 30) {
            performanceModeRef.current = 'low';
          } else if (currentFPSRef.current < 45) {
            performanceModeRef.current = 'medium';
          } else {
            performanceModeRef.current = 'high';
          }
        }
      }

      // Для iPad используем более агрессивное ограничение FPS
      const targetFPS = isIPadDevice ? Math.min(props.maxFPS, 30) : props.maxFPS;
      
      if (props.lowPowerMode && currentFPSRef.current > targetFPS) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      // Для iPad пропускаем каждый второй кадр в режиме low
      const skipFrame = isIPadDevice && performanceModeRef.current === 'low' && frameCountRef.current % 2 === 0;
      if (props.adaptiveQuality && skipFrame) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      // Дополнительная оптимизация для iPad - пропускаем кадры при низкой производительности
      // Используем deltaTime для более точного определения производительности
      if (isIPadDevice && deltaTime > 50 && renderSkippedRef.current % 2 !== 0) {
        renderSkippedRef.current++;
        rafRef.current = requestAnimationFrame(update);
        return;
      }
      renderSkippedRef.current = 0;

      rafRef.current = requestAnimationFrame(update);

      if (props.pageLoadAnimation && loadAnimationStartRef.current === 0) {
        loadAnimationStartRef.current = t;
      }

      if (!props.pause) {
        const elapsed = (t * 0.001 + timeOffsetRef.current) * props.timeScale;
        program.uniforms.iTime.value = elapsed;
        frozenTimeRef.current = elapsed;
      } else {
        program.uniforms.iTime.value = frozenTimeRef.current;
      }

      if (props.pageLoadAnimation && loadAnimationStartRef.current > 0) {
        const animationDuration = 2000;
        const animationElapsed = t - loadAnimationStartRef.current;
        const progress = Math.min(animationElapsed / animationDuration, 1);
        program.uniforms.uPageLoadProgress.value = progress;
      }

      if (props.mouseReact) {
        const dampingFactor = isIPadDevice ? 0.12 : 0.08;
        const smoothMouse = smoothMouseRef.current;
        const mouse = mouseRef.current;
        smoothMouse.x += (mouse.x - smoothMouse.x) * dampingFactor;
        smoothMouse.y += (mouse.y - smoothMouse.y) * dampingFactor;

        const mouseUniform = program.uniforms.uMouse.value;
        mouseUniform[0] = smoothMouse.x;
        mouseUniform[1] = smoothMouse.y;
      }

      try {
        renderer.render({ scene: mesh });
      } catch (error) {
        console.warn('Render error:', error);
        contextLostRef.current = true;
        // Пытаемся продолжить анимацию даже при ошибке
        rafRef.current = requestAnimationFrame(update);
        return;
      }
    };
    
    let lastRenderTime = performance.now();
    
    // Обновляем время последнего рендера в функции update
    const updateWithKeepAlive = (t: number) => {
      lastRenderTime = t;
      update(t);
    };
    
    const keepAliveInterval = isIPadDevice ? setInterval(() => {
      const now = performance.now();
      // Если прошло больше 2 секунд без обновления, перезапускаем анимацию
      if (now - lastRenderTime > 2000) {
        cancelAnimationFrame(rafRef.current);
        contextLostRef.current = false;
        lastRenderTime = now;
        rafRef.current = requestAnimationFrame(updateWithKeepAlive);
      }
    }, 1000) : null;
    
    // Запускаем анимацию
    rafRef.current = requestAnimationFrame(updateWithKeepAlive);
    ctn.appendChild(gl.canvas);

    if (mouseReact) ctn.addEventListener("mousemove", handleMouseMove);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      resizeObserver.disconnect();

      if (mouseReact) ctn.removeEventListener("mousemove", handleMouseMove);

      gl.canvas.removeEventListener('webglcontextlost', handleContextLost);
      gl.canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      if (gl.canvas.parentElement === ctn) ctn.removeChild(gl.canvas);

      meshRef.current = null;
      programRef.current = null;
      geometryRef.current = null;
      rendererRef.current = null;

      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }

      loadAnimationStartRef.current = 0;
      timeOffsetRef.current = Math.random() * 100;
      contextLostRef.current = false;
      renderSkippedRef.current = 0;
    };
  }, [dpr, handleMouseMove, isIPad]);

  useEffect(() => {
    if (!programRef.current) return;

    const program = programRef.current;
    const props = propsRef.current;

    program.uniforms.uScale.value = props.scale;
    program.uniforms.uGridMul.value = new Float32Array(props.gridMul);
    program.uniforms.uDigitSize.value = props.digitSize;
    program.uniforms.uScanlineIntensity.value = props.scanlineIntensity;
    program.uniforms.uGlitchAmount.value = props.glitchAmount;
    program.uniforms.uFlickerAmount.value = props.flickerAmount;
    program.uniforms.uNoiseAmp.value = props.noiseAmp;
    program.uniforms.uChromaticAberration.value = props.chromaticAberration;
    program.uniforms.uDither.value = props.dither;
    program.uniforms.uCurvature.value = props.curvature;
    program.uniforms.uTint.value = new Color(tintVec[0], tintVec[1], tintVec[2]);
    program.uniforms.uMouseStrength.value = props.mouseStrength;
    program.uniforms.uUseMouse.value = props.mouseReact ? 1 : 0;
    program.uniforms.uUsePageLoadAnimation.value = props.pageLoadAnimation ? 1 : 0;
    program.uniforms.uBrightness.value = props.brightness;
  }, [
    scale,
    gridMul,
    digitSize,
    scanlineIntensity,
    glitchAmount,
    flickerAmount,
    noiseAmp,
    chromaticAberration,
    dither,
    curvature,
    tintVec,
    mouseStrength,
    mouseReact,
    pageLoadAnimation,
    brightness,
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden ${className || ""}`}
      style={style}
      {...rest}
    />
  );
}

export default React.memo(FaultyTerminalComponent)