import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at 24% 24%, rgba(88,199,184,0.78), transparent 36%), linear-gradient(180deg, #0B1E34 0%, #08192C 62%, #06111D 100%)",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          fontFamily: "system-ui, sans-serif",
          color: "#F6F1E8",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 124,
            height: 124,
            borderRadius: 999,
            background: "#58C7B8",
            color: "#08192C",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: "-0.08em",
          }}
        >
          C
        </div>
      </div>
    ),
    size,
  );
}
