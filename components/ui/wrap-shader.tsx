import { Warp } from "@paper-design/shaders-react"

export default function WarpShaderHero() {
  return (
    <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden", backgroundColor: "#0a3a45" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <Warp
          style={{ height: "100%", width: "100%" }}
          proportion={0.45}
          softness={1}
          distortion={0.25}
          swirl={0.8}
          swirlIterations={10}
          shape="checks"
          shapeScale={0.1}
          scale={1}
          rotation={0}
          speed={1}
          colors={["hsl(200, 100%, 20%)", "hsl(160, 100%, 75%)", "hsl(180, 90%, 30%)", "hsl(170, 100%, 80%)"]}
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 2rem",
        }}
      >
        <div style={{ maxWidth: "64rem", width: "100%", textAlign: "center", padding: "2rem 1.5rem", borderRadius: "1.5rem", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(10px)" }}>
          <h1 style={{ color: "white", fontSize: "clamp(2rem, 6vw, 4rem)", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "1rem" }}>
            PREMIUM MEMBERS RESOURCE DASHBOARD
          </h1>

          <p
            style={{
              color: "rgba(255,255,255,0.95)",
              fontSize: "clamp(1rem, 2.4vw, 1.5rem)",
              fontFamily: "sans-serif",
              fontWeight: 400,
              lineHeight: 1.5,
              maxWidth: "48rem",
              margin: "0 auto",
              letterSpacing: "0.02em",
            }}
          >
            You Are Logged In As: coconutbreezemedia
          </p>

          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              alignItems: "center",
              paddingTop: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <a
              href="/"
              style={{
                padding: "0.9rem 1.8rem",
                background: "white",
                borderRadius: "9999px",
                color: "#1f2937",
                fontWeight: 700,
                fontFamily: "sans-serif",
                fontSize: "clamp(0.95rem, 2vw, 1.05rem)",
                letterSpacing: "0.03em",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              View All Post
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
