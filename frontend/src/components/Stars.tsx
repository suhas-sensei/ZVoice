"use client";

export default function Stars({ count = 60 }: { count?: number }) {
  // Generate deterministic star positions using a simple seed approach
  const stars = Array.from({ length: count }, (_, i) => ({
    left: `${((i * 37 + 13) % 100)}%`,
    top: `${((i * 53 + 7) % 100)}%`,
    size: (i % 3) + 1,
    delay: `${(i * 0.7) % 5}s`,
    duration: `${2 + (i % 4)}s`,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map((star, i) => (
        <div
          key={i}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}
    </div>
  );
}
