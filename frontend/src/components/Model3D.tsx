"use client";

import { useRef, useEffect } from "react";
import * as THREE from "three";
import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment } from "@react-three/drei";
import { GLTF } from "three-stdlib";

type GLTFResult = GLTF & {
  nodes: {
    pSphere2_Mat_Nucleo_0: THREE.Mesh;
    pSphere5_Mat_Esferas2_0: THREE.Mesh;
    pSphere7_Mat_Orb_0: THREE.Mesh;
    polySurface1_Mat_Aro_0: THREE.Mesh;
    polySurface2_Mat_Esfera_0: THREE.Mesh;
    polySurface3_Mat_Esfera_0: THREE.Mesh;
    polySurface4_Mat_Aro_0: THREE.Mesh;
    polySurface5_Mat_Esfera_0: THREE.Mesh;
    polySurface6_Mat_Aro_0: THREE.Mesh;
    polySurface7_Mat_Esfera_0: THREE.Mesh;
    polySurface8_Mat_Aro_0: THREE.Mesh;
    pSphere6_Mat_Orb2_0: THREE.Mesh;
  };
  materials: Record<string, THREE.MeshPhysicalMaterial>;
};

function TheUniverse({ mousePos }: { mousePos: React.RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null!);
  const { nodes, materials, animations } = useGLTF("/the_universe.glb") as unknown as GLTFResult;
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const action = actions["-10s"];
    if (action) {
      action.reset().play();
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
  }, [actions]);

  useEffect(() => {
    Object.values(materials).forEach((mat) => {
      mat.envMapIntensity = 4;
      mat.needsUpdate = true;
    });
  }, [materials]);

  useFrame(() => {
    if (!group.current || !mousePos.current) return;
    const tx = mousePos.current.y * 0.3;
    const ty = mousePos.current.x * 0.5;
    group.current.rotation.x += (tx - group.current.rotation.x) * 0.03;
    group.current.rotation.y += (ty - group.current.rotation.y) * 0.03;
  });

  return (
    <group ref={group} dispose={null} scale={0.035}>
      <group name="Sketchfab_Scene">
        <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <group>
              <group>
                <group position={[0.034, 0, 0.083]}>
                  <mesh geometry={nodes.pSphere2_Mat_Nucleo_0.geometry} material={materials.Mat_Nucleo} />
                </group>
                <group>
                  <mesh geometry={nodes.pSphere5_Mat_Esferas2_0.geometry} material={materials.Mat_Esferas2} />
                </group>
                <group>
                  <mesh geometry={nodes.pSphere7_Mat_Orb_0.geometry} material={materials.Mat_Orb} />
                </group>
                <group>
                  <group scale={3}>
                    <mesh geometry={nodes.polySurface1_Mat_Aro_0.geometry} material={materials.Mat_Aro} />
                  </group>
                  <group rotation={[0, -1.549, 0]}>
                    <mesh geometry={nodes.polySurface2_Mat_Esfera_0.geometry} material={materials.Mat_Esfera} />
                  </group>
                  <group rotation={[-Math.PI / 2, 1.507, -Math.PI]}>
                    <mesh geometry={nodes.polySurface3_Mat_Esfera_0.geometry} material={materials.Mat_Esfera} />
                  </group>
                  <group rotation={[Math.PI / 2, 0, 0]} scale={2}>
                    <mesh geometry={nodes.polySurface4_Mat_Aro_0.geometry} material={materials.Mat_Aro} />
                  </group>
                  <group rotation={[-2.356, -1.539, -Math.PI]}>
                    <mesh geometry={nodes.polySurface5_Mat_Esfera_0.geometry} material={materials.Mat_Esfera} />
                  </group>
                  <group rotation={[Math.PI / 4, 0, 0]} scale={4}>
                    <mesh geometry={nodes.polySurface6_Mat_Aro_0.geometry} material={materials.Mat_Aro} />
                  </group>
                  <group rotation={[-Math.PI / 4, 1.547, 0]}>
                    <mesh geometry={nodes.polySurface7_Mat_Esfera_0.geometry} material={materials.Mat_Esfera} />
                  </group>
                  <group rotation={[-Math.PI / 4, 0, 0]}>
                    <mesh geometry={nodes.polySurface8_Mat_Aro_0.geometry} material={materials.Mat_Aro} />
                  </group>
                </group>
                <group scale={1.053}>
                  <mesh geometry={nodes.pSphere6_Mat_Orb2_0.geometry} material={materials.Mat_Orb2} />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function Model3D() {
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="w-full h-full bg-black">
      <Canvas
        camera={{ position: [0, 0, 1.5], fov: 60 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.4,
        }}
      >
        <Environment files="/env.hdr" background />
        <TheUniverse mousePos={mousePos} />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/the_universe.glb");
