/**
 * HolographicModelViewer — renders a GLB climbing wall model with a
 * holographic glass/glow aesthetic using expo-gl + Three.js.
 *
 * Features:
 *  - Fresnel rim glow in primary blue
 *  - Semi-transparent wall texture overlay
 *  - Emissive hold markers in the problem's colour
 *  - Auto-rotation with touch orbit controls
 *  - Transparent background (app's dark charcoal shows through)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
// @ts-expect-error -- three/examples/jsm has no type declarations in this version
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { colors } from '@/src/theme/colors';
import { useModelLoader } from './useModelLoader';
import { createHolographicMaterial } from './holographicMaterial';

interface HolographicModelViewerProps {
  modelUrl: string;
  holdColour: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  style?: ViewStyle;
}

/** Convert hex colour to THREE.Color */
function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex.startsWith('#') ? hex : `#${hex}`);
}

export function HolographicModelViewer({
  modelUrl,
  holdColour,
  onLoad,
  onError,
  style,
}: HolographicModelViewerProps) {
  const { arrayBuffer, loading: modelLoading, error: loadError } = useModelLoader(modelUrl);
  const [sceneReady, setSceneReady] = useState(false);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const requestIdRef = useRef<number | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const autoRotateRef = useRef(true);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);

  useEffect(() => {
    if (loadError) {
      onError?.(loadError);
    }
  }, [loadError, onError]);

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      glRef.current = gl;

      // Create renderer
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0); // transparent background
      rendererRef.current = renderer;

      // Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera
      const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      const camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 100);
      camera.position.set(0, 0.5, 1.8);
      camera.lookAt(0, 0.4, 0);
      cameraRef.current = camera;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x444466, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xa8c8ff, 0.8);
      directionalLight.position.set(-1, 2, 1);
      scene.add(directionalLight);

      // Secondary rim light
      const rimLight = new THREE.DirectionalLight(0xb2c7f0, 0.3);
      rimLight.position.set(1, -0.5, 2);
      scene.add(rimLight);

      // Add ambient particles
      const particleCount = 60;
      const particleGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 2;
        positions[i * 3 + 1] = Math.random() * 1.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      }
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0xa8c8ff,
        size: 0.008,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Load GLB model if available
      if (arrayBuffer) {
        try {
          const loader = new GLTFLoader();
          const gltf = await new Promise<any>(
            (resolve, reject) => {
              loader.parse(arrayBuffer, '', resolve, reject);
            },
          );

          const model = gltf.scene;

          // Apply holographic material to wall mesh, emissive to hold spheres
          model.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              if (child.name === 'wall_mesh' || child.name === 'geometry_0') {
                // Extract texture from original material if present
                let texture: THREE.Texture | undefined;
                const mat = child.material as THREE.MeshStandardMaterial;
                if (mat?.map) {
                  texture = mat.map;
                }
                child.material = createHolographicMaterial(texture);
              } else if (child.name.startsWith('hold_')) {
                // Emissive glow for hold markers
                const holdColor = hexToThreeColor(holdColour);
                child.material = new THREE.MeshStandardMaterial({
                  color: holdColor,
                  emissive: holdColor,
                  emissiveIntensity: 0.8,
                  metalness: 0.3,
                  roughness: 0.2,
                  transparent: true,
                  opacity: 0.9,
                });

                // Add point light at each hold position
                const pointLight = new THREE.PointLight(holdColor.getHex(), 0.15, 0.3);
                pointLight.position.copy(child.position);
                scene.add(pointLight);
              }
            }
          });

          // Center and scale model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1.0 / maxDim;
          model.scale.setScalar(scale);
          model.position.sub(center.multiplyScalar(scale));
          model.position.y += 0.4; // slight vertical offset

          scene.add(model);
          setSceneReady(true);
          onLoad?.();
        } catch (err) {
          console.error('[HolographicViewer] GLB load failed:', err);
          onError?.(err instanceof Error ? err : new Error('GLB load failed'));
        }
      }

      // Animation loop
      let time = 0;
      const animate = () => {
        requestIdRef.current = requestAnimationFrame(animate);
        time += 0.016;

        // Auto-rotation
        if (autoRotateRef.current) {
          rotationRef.current.y += 0.003;
        }

        // Apply rotation to scene
        if (scene.children.length > 0) {
          scene.rotation.y = rotationRef.current.y;
        }

        // Animate particles
        if (particles.geometry.attributes['position']) {
          const pos = particles.geometry.attributes['position'] as THREE.BufferAttribute;
          for (let i = 0; i < particleCount; i++) {
            const y = pos.getY(i);
            pos.setY(i, y + 0.0005);
            if (y > 1.5) pos.setY(i, 0);
          }
          pos.needsUpdate = true;
        }

        // Subtle particle opacity pulse
        particleMaterial.opacity = 0.3 + Math.sin(time * 2) * 0.15;

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();
    },
    [arrayBuffer, holdColour, onLoad, onError],
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (requestIdRef.current !== null) {
        cancelAnimationFrame(requestIdRef.current);
      }
    };
  }, []);

  // Touch handlers for manual rotation
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    autoRotateRef.current = false;
    const touch = e.nativeEvent;
    touchStartRef.current = { x: touch.pageX, y: touch.pageY };
  }, []);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.nativeEvent;
    const dx = touch.pageX - touchStartRef.current.x;
    const dy = touch.pageY - touchStartRef.current.y;
    rotationRef.current.y += dx * 0.005;
    rotationRef.current.x += dy * 0.005;
    touchStartRef.current = { x: touch.pageX, y: touch.pageY };
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    // Resume auto-rotation after 3 seconds
    setTimeout(() => {
      autoRotateRef.current = true;
    }, 3000);
  }, []);

  if (modelLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading 3D model...</Text>
      </View>
    );
  }

  if (loadError) {
    return null; // Graceful degradation — hide 3D section on error
  }

  if (!arrayBuffer) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
      />
      {!sceneReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
  },
  glView: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.onSurfaceVariant,
    fontSize: 13,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19, 19, 19, 0.6)',
  },
});
