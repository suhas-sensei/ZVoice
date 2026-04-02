"use client";

export default function Sphere() {
  return (
    <div className="sphere-float">
      <div
        className="w-24 h-24 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, #555 0%, #222 40%, #111 70%, #000 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 -4px 12px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}
