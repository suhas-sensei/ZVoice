"use client";

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import Image from "next/image";

const Model3D = lazy(() => import("@/components/Model3D"));

const images = [
  "/774e61e238994d96a6ef713d02a64d6c.jpg",
  "/975cad8b4e91ae4d0c5d8d78ed349ead.jpg",
  "/af2be367002579446e27cd6806f36685.jpg",
  "/cdf4e8a35cbcf2179ca93787e1eefb2c.jpg",
  "/d5c0526bd3026be11cc26021c6d3216c.jpg",
  "/d6d8bc18862f88ca9e5828c58d6e53cd.jpg",
  "/ed5c10419a2987c5017dc0f2971a60ec.jpg",
  "/f0c5c1baf409717dc563ab385c86a0f1.jpg",
];

type Phase = "cycling" | "stacking" | "spread" | "curtain" | "revealed";

export default function Home() {
  const [visible, setVisible] = useState(false);
  const [activeImage, setActiveImage] = useState(-1);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<Phase>("cycling");
  const [stackedCount, setStackedCount] = useState(0);
  const [curtainProgress, setCurtainProgress] = useState(0);
  const [scrollZoom, setScrollZoom] = useState(0);
  const screen2Ref = useRef<HTMLDivElement>(null);
  const totalCycles = 4;

  // Text entrance
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Phase 1: Cycling
  useEffect(() => {
    if (!visible || phase !== "cycling") return;
    let index = 0;
    const interval = setInterval(() => {
      setActiveImage(index);
      index++;
      if (index >= images.length) {
        index = 0;
        setCycle((prev) => {
          if (prev + 1 >= totalCycles) {
            clearInterval(interval);
            setTimeout(() => setPhase("stacking"), 300);
            return prev + 1;
          }
          return prev + 1;
        });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [visible, phase, cycle]);

  // Phase 2: Stacking
  useEffect(() => {
    if (phase !== "stacking") return;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setStackedCount(count);
      if (count >= images.length) {
        clearInterval(interval);
        setTimeout(() => setPhase("spread"), 600);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase 3: After spread, trigger curtain
  useEffect(() => {
    if (phase !== "spread") return;
    const timer = setTimeout(() => setPhase("curtain"), 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  // Phase 4: Curtain — cubic ease-in
  const animateCurtain = useCallback(() => {
    if (phase !== "curtain") return;
    const duration = 1800;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = t * t * t;
      setCurtainProgress(eased);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setPhase("revealed");
      }
    }
    requestAnimationFrame(tick);
  }, [phase]);

  useEffect(() => {
    animateCurtain();
  }, [animateCurtain]);

  // Scroll zoom: 3D model section expands to fullscreen
  useEffect(() => {
    if (phase !== "revealed") return;
    const handleScroll = () => {
      if (!screen2Ref.current) return;
      const rect = screen2Ref.current.getBoundingClientRect();
      const scrolled = -rect.top;
      const maxScroll = window.innerHeight * 0.8;
      const progress = Math.max(0, Math.min(scrolled / maxScroll, 1));
      setScrollZoom(progress);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [phase]);

  const getTransform = (i: number) => {
    if (phase === "spread" || phase === "curtain") {
      const totalHeight = images.length * 112;
      const y = -totalHeight / 2 + i * 112 + 48;
      return `translateY(${y}px) scale(1)`;
    }
    if (phase === "stacking" && i < stackedCount) {
      const offset = i * 12;
      return `translateY(${offset}px) scale(1)`;
    }
    return "translateY(0px) scale(1)";
  };

  const getOpacity = (i: number) => {
    if (phase === "spread" || phase === "curtain") return 1;
    if (phase === "stacking") return i < stackedCount ? 1 : 0;
    return i === activeImage ? 1 : 0;
  };

  // 3D model container size based on scroll
  const modelWidth = 280 + scrollZoom * (window?.innerWidth ? window.innerWidth - 280 : 1000);
  const modelHeight = 280 + scrollZoom * (window?.innerHeight ? window.innerHeight - 280 : 700);
  const modelOpacity = Math.min(1, 0.15 + scrollZoom * 0.85);

  return (
    <div className={phase === "revealed" ? "min-h-[250vh]" : "h-screen overflow-hidden"}>
      {/* Screen 1: Image gallery */}
      <div className="fixed inset-0 bg-[#f5f5f5] flex flex-col items-center justify-between"
        style={{ display: phase === "revealed" ? "none" : undefined }}>
        {/* Middle row */}
        <div className="flex-1 flex items-center w-full px-10 z-10">
          <span
            className={`text-lg font-medium tracking-widest uppercase transition-all duration-1000 ease-out ${
              visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"
            }`}
          >
            UNCLAIMED INVOICES
          </span>
          <div className="flex-1" />
          <span
            className={`text-lg font-medium tracking-widest uppercase transition-all duration-1000 ease-out ${
              visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
            }`}
          >
            SEAMLESS APPROVALS
          </span>
        </div>

        {/* Images container */}
        <div className="absolute inset-0 flex items-center justify-center">
          {images.map((src, i) => (
            <div
              key={src}
              className="absolute w-24 h-24 rounded-xl overflow-hidden shadow-md"
              style={{
                transform: getTransform(i),
                opacity: getOpacity(i),
                zIndex: phase === "stacking" ? i : 0,
                transition:
                  phase === "spread" || phase === "curtain"
                    ? `all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.05}s`
                    : phase === "stacking"
                      ? "all 0.3s ease-out"
                      : "all 0.15s ease-out",
              }}
            >
              <Image
                src={src}
                alt={`Image ${i + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {/* Bottom text */}
        <div
          className={`pb-8 text-center transition-all duration-1000 delay-300 ease-out z-10 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <p className="text-base text-black mix-blend-difference">
            <em>all claimable onchain</em> without leaving your inbox. Powered by{" StarkZap"}
          </p>
        </div>
      </div>

      {/* Curtain — white panel drops from top */}
      {(phase === "curtain") && (
        <div
          className="fixed inset-x-0 top-0 bg-white z-50"
          style={{ height: `${curtainProgress * 100}%` }}
        />
      )}

      {/* Screen 2: Hero with 3D model */}
      {phase === "revealed" && (
        <div ref={screen2Ref} className="relative">
          {/* Hero section — full viewport */}
          <div className="h-screen bg-white flex flex-col justify-center px-8 md:px-16 relative overflow-hidden">
            {/* Description — top right */}
            <p className="absolute top-8 right-8 md:right-16 text-sm text-black/60 max-w-[280px] text-justify leading-relaxed">
              A privacy-first reimbursement engine built on StarkNet. ZK proofs verify invoices
              without exposing email content. StarkZap pays in any token.
            </p>

            {/* Big typography */}
            <div className="select-none" style={{ opacity: 1 - scrollZoom * 0.8 }}>
              <h1 className="text-[clamp(3rem,10vw,9rem)] font-black leading-[0.9] tracking-tighter text-black uppercase">
                VERIFY
              </h1>
              <h1 className="text-[clamp(3rem,10vw,9rem)] font-black leading-[0.9] tracking-tighter text-black uppercase pl-[10vw]">
                INVOICES
              </h1>
              <div className="flex items-center gap-0">
                <h1 className="text-[clamp(3rem,10vw,9rem)] font-black leading-[0.9] tracking-tighter text-black uppercase">
                  PAY
                </h1>

                {/* 3D Model container — inline between text */}
                <div
                  className="relative bg-black overflow-hidden flex-shrink-0 transition-none"
                  style={{
                    width: scrollZoom > 0 ? modelWidth : 280,
                    height: scrollZoom > 0 ? modelHeight : 280,
                    borderRadius: scrollZoom > 0 ? `${(1 - scrollZoom) * 16}px` : "16px",
                    position: scrollZoom > 0.5 ? "fixed" : "relative",
                    top: scrollZoom > 0.5 ? "50%" : undefined,
                    left: scrollZoom > 0.5 ? "50%" : undefined,
                    transform: scrollZoom > 0.5
                      ? "translate(-50%, -50%)"
                      : undefined,
                    zIndex: scrollZoom > 0.5 ? 60 : 1,
                    opacity: modelOpacity,
                  }}
                >
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                      Loading 3D...
                    </div>
                  }>
                    <Model3D />
                  </Suspense>
                </div>

                <h1 className="text-[clamp(3rem,10vw,9rem)] font-black leading-[0.9] tracking-tighter text-black uppercase"
                  style={{ opacity: 1 - scrollZoom }}>
                  ONCHAIN
                </h1>
              </div>
            </div>

            {/* Divider bar */}
            <div className="absolute bottom-16 left-0 right-0 px-8 md:px-16"
              style={{ opacity: 1 - scrollZoom }}>
              <div className="w-full h-[3px] bg-black" />
              <div className="w-full h-[12px] bg-black mt-2" />
            </div>
          </div>

          {/* Scroll space for zoom effect */}
          <div className="h-[150vh]" />
        </div>
      )}
    </div>
  );
}
