import { useEffect, useRef } from 'react'
import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Vector2,
  Vector3,
  Color
} from 'three'

import './PixelSnow.css'

const vertexShader = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uFlakeSize;
uniform float uMinFlakeSize;
uniform float uPixelResolution;
uniform float uSpeed;
uniform float uDepthFade;
uniform float uFarPlane;
uniform vec3 uColor;
uniform float uBrightness;
uniform float uGamma;
uniform float uDensity;
uniform float uVariant;
uniform float uDirection;
uniform vec2 uMouse;
uniform float uMouseInfluence;

#define M1 1597334677U
#define M2 3812015801U
#define M3 3299493293U
#define F0 (1.0/float(0xffffffffU))
#define hash(n) n*(n^(n>>15))
#define coord3(p) (uvec3(p).x*M1^uvec3(p).y*M2^uvec3(p).z*M3)

vec3 hash3(uint n) {
  return vec3(hash(n) * uvec3(0x1U, 0x1ffU, 0x3ffffU)) * F0;
}

// Chip/key shape - rectangular with rounded corners
float chipDist(vec2 p) {
  vec2 size = vec2(0.8, 1.2); // Wider than tall, like a chip/key
  vec2 q = abs(p) - size * 0.5;
  float rounded = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.1;
  return rounded;
}

void main() {
  float pixelSize = max(1.0, floor(0.5 + uResolution.x / uPixelResolution));
  vec2 fragCoord = floor(gl_FragCoord.xy / pixelSize);
  vec2 res = uResolution / pixelSize;

  vec3 ray = normalize(vec3((fragCoord - res * 0.5) / res.x, 1.0));

  vec3 camK = normalize(vec3(1.0, 1.0, 1.0));
  vec3 camI = normalize(vec3(1.0, 0.0, -1.0));
  vec3 camJ = cross(camK, camI);
  ray = ray.x * camI + ray.y * camJ + ray.z * camK;

  // More vertical fall for license/chip particles
  float windX = cos(uDirection) * 0.15;
  float windY = sin(uDirection) * 0.15;
  
  // Mouse influence - convert mouse position to 3D space
  vec2 mouseNDC = (uMouse * 2.0 - 1.0) * vec2(1.0, -1.0); // Flip Y axis
  vec2 mouseWorld = mouseNDC * res.x * 0.5;
  vec3 mousePos3D = mouseWorld.x * camI + mouseWorld.y * camJ;
  
  vec3 camPos = (windX * camI + windY * camJ + 0.08 * camK) * uTime * uSpeed;
  vec3 pos = camPos;

  vec3 strides = 1.0 / max(abs(ray), vec3(0.001));
  vec3 phase = fract(pos) * strides;
  phase = mix(strides - phase, phase, step(ray, vec3(0.0)));

  float t = 0.0;
  for (int i = 0; i < 256; i++) {
    if (t >= uFarPlane) break;
    vec3 fpos = floor(pos);
    float cellHash = hash3(coord3(fpos)).x;

    if (cellHash < uDensity) {
      vec3 h = hash3(coord3(fpos));
      vec3 flakePos = 0.5 - 0.5 * cos(
        4.0 * sin(fpos.yzx * 0.073) +
        4.0 * sin(fpos.zxy * 0.27) +
        2.0 * h +
        uTime * uSpeed * 0.1 * vec3(7.0, 8.0, 5.0)
      );
      flakePos = flakePos * 0.8 + 0.1 + fpos;
      
      // Mouse interaction - push particles away from cursor
      vec2 flakePos2D = vec2(flakePos.x, flakePos.y);
      vec2 mousePos2D = vec2(mousePos3D.x, mousePos3D.y);
      vec2 toMouse = flakePos2D - mousePos2D;
      float mouseDist = length(toMouse);
      if (mouseDist < uMouseInfluence && mouseDist > 0.001) {
        vec2 pushDir = normalize(toMouse);
        float pushStrength = pow(1.0 - mouseDist / uMouseInfluence, 2.0) * 0.4;
        flakePos.x += pushDir.x * pushStrength;
        flakePos.y += pushDir.y * pushStrength;
      }

      float toIntersection = dot(flakePos - pos, camK) / dot(ray, camK);
      if (toIntersection > 0.0) {
        vec3 testPos = pos + ray * toIntersection - flakePos;
        vec2 testUV = abs(vec2(dot(testPos, camI), dot(testPos, camJ)));
        float depth = dot(flakePos - camPos, camK);
        float flakeSize = max(uFlakeSize, uMinFlakeSize * depth * 0.5 / res.x);
        float dist;
        if (uVariant < 0.5) {
          // Square chips/keys - rectangular shape
          dist = chipDist(testUV / flakeSize) * flakeSize;
        } else if (uVariant < 1.5) {
          dist = length(testUV);
        } else {
          // Diamond shape for variety
          dist = abs(testUV.x) + abs(testUV.y);
        }

        if (dist < flakeSize) {
          float intensity = exp2(-(t + toIntersection) / uDepthFade) *
                           min(1.0, pow(uFlakeSize / flakeSize, 2.0)) * uBrightness;
          gl_FragColor = vec4(uColor * pow(vec3(intensity), vec3(uGamma)), 1.0);
          return;
        }
      }
    }

    float nextStep = min(min(phase.x, phase.y), phase.z);
    vec3 sel = step(phase, vec3(nextStep));
    phase = phase - nextStep + strides * sel;
    t += nextStep;
    pos = mix(pos + ray * nextStep, floor(pos + ray * nextStep + 0.5), sel);
  }

  gl_FragColor = vec4(0.0);
}
`

interface PixelSnowProps {
  color?: string
  flakeSize?: number
  minFlakeSize?: number
  pixelResolution?: number
  speed?: number
  depthFade?: number
  farPlane?: number
  brightness?: number
  gamma?: number
  density?: number
  variant?: 'chip' | 'round' | 'diamond'
  direction?: number
  className?: string
  style?: React.CSSProperties
}

export default function PixelSnow({
  color = '#ffffff',
  flakeSize = 0.01,
  minFlakeSize = 1.25,
  pixelResolution = 200,
  speed = 1.25,
  depthFade = 8,
  farPlane = 20,
  brightness = 1,
  gamma = 0.4545,
  density = 0.3,
  variant = 'chip',
  direction = 125,
  className = '',
  style = {}
}: PixelSnowProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const renderer = new WebGLRenderer({
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    })

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.offsetWidth, container.offsetHeight)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const threeColor = new Color(color)
    const mousePos = new Vector2(0.5, 0.5)
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vector2(container.offsetWidth, container.offsetHeight) },
        uFlakeSize: { value: flakeSize },
        uMinFlakeSize: { value: minFlakeSize },
        uPixelResolution: { value: pixelResolution },
        uSpeed: { value: speed },
        uDepthFade: { value: depthFade },
        uFarPlane: { value: farPlane },
        uColor: { value: new Vector3(threeColor.r, threeColor.g, threeColor.b) },
        uBrightness: { value: brightness },
        uGamma: { value: gamma },
        uDensity: { value: density },
        uVariant: { value: variant === 'round' ? 1.0 : variant === 'diamond' ? 2.0 : 0.0 },
        uDirection: { value: (direction * Math.PI) / 180 },
        uMouse: { value: mousePos },
        uMouseInfluence: { value: 1.5 }
      },
      transparent: true
    })

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mousePos.x = (e.clientX - rect.left) / rect.width
      mousePos.y = (e.clientY - rect.top) / rect.height
      material.uniforms.uMouse.value.set(mousePos.x, mousePos.y)
    }

    const handleMouseLeave = () => {
      // Reset mouse position to center when mouse leaves
      mousePos.set(0.5, 0.5)
      material.uniforms.uMouse.value.set(0.5, 0.5)
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    const geometry = new PlaneGeometry(2, 2)
    scene.add(new Mesh(geometry, material))

    const handleResize = () => {
      const w = container.offsetWidth
      const h = container.offsetHeight
      renderer.setSize(w, h)
      material.uniforms.uResolution.value.set(w, h)
    }
    window.addEventListener('resize', handleResize)

    const startTime = performance.now()
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      material.uniforms.uTime.value = (performance.now() - startTime) * 0.001
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [
    color,
    flakeSize,
    minFlakeSize,
    pixelResolution,
    speed,
    depthFade,
    farPlane,
    brightness,
    gamma,
    density,
    variant,
    direction
  ])

  return <div ref={containerRef} className={`pixel-snow-container ${className}`} style={style} />
}

