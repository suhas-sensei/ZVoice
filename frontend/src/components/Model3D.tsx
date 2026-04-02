"use client";

import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Center, Environment } from "@react-three/drei";
import * as THREE from "three";

function Scene({ mousePos }: { mousePos: React.MutableRefObject<{ x: number; y: number }> }) {
  const { scene } = useGLTF("/the_universe.glb");
  const groupRef = useRef<THREE.Group>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (scene) {
      // Auto-scale model to fit
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.5 / maxDim;
      scene.scale.setScalar(scale);

      // Center it
      const center = box.getCenter(new THREE.Vector3());
      scene.position.sub(center.multiplyScalar(scale));

      setReady(true);
    }
  }, [scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    const targetX = mousePos.current.y * 0.4;
    const targetY = mousePos.current.x * 0.6;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.04;
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.04;
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={scene} visible={ready} />
      </Center>
    </group>
  );
}

export default function Model3D() {
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="w-full h-full bg-black">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <directionalLight position={[-3, -3, 2]} intensity={0.5} />
        <pointLight position={[0, 0, 3]} intensity={1} />
        <Environment preset="city" />
        <Scene mousePos={mousePos} />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/the_universe.glb");
