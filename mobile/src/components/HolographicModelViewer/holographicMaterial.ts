/**
 * Holographic ShaderMaterial for the 3D climbing wall viewer.
 *
 * Visual design:
 *  - Fresnel rim glow in primary blue (#a8c8ff)
 *  - Semi-transparent base showing wall texture at ~40% opacity
 *  - Emissive edge highlights for the glass/holographic look
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D baseTexture;
  uniform vec3 rimColor;
  uniform vec3 baseColor;
  uniform float rimPower;
  uniform float textureOpacity;
  uniform float baseOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    // Fresnel rim effect — stronger glow at grazing angles
    float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
    float rim = pow(fresnel, rimPower);

    // Sample the wall photo texture
    vec4 texColor = texture2D(baseTexture, vUv);

    // Blend: base tint + ghosted texture + rim glow
    vec3 color = baseColor * (1.0 - textureOpacity) + texColor.rgb * textureOpacity;
    color += rimColor * rim * 0.8;

    float alpha = baseOpacity + rim * 0.3;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createHolographicMaterial(texture?: THREE.Texture): THREE.ShaderMaterial {
  const uniforms = {
    baseTexture: { value: texture ?? new THREE.Texture() },
    rimColor: { value: new THREE.Color(0xa8c8ff) },    // colors.primary
    baseColor: { value: new THREE.Color(0x2a2a2a) },    // colors.surfaceContainerHigh
    rimPower: { value: 2.5 },
    textureOpacity: { value: 0.4 },
    baseOpacity: { value: 0.6 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
