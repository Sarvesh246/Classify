import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at 20% 18%, rgba(88,199,184,0.72), transparent 34%), linear-gradient(180deg, #0A1C31 0%, #08192C 58%, #050E18 100%)",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 38,
            borderRadius: 132,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.04)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            color: "#F6F1E8",
            letterSpacing: "-0.08em",
          }}
        >
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 999,
              background: "#58C7B8",
              color: "#08192C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 70,
              fontWeight: 800,
            }}
          >
            C
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1,
            }}
          >
            <span style={{ fontSize: 118, fontWeight: 800 }}>Classify</span>
            <span
              style={{
                marginTop: 12,
                fontSize: 34,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(246,241,232,0.72)",
              }}
            >
              Course planning
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
