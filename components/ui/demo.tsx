import { siteUrl } from "../../lib/config"
import WarpShaderHero from "./wrap-shader"

const magazinePdfUrl = siteUrl('/wp-content/uploads/2026/01/Issue-1-Coral-Matters-Magazine.pdf')
const magazineImageUrl = siteUrl('/wp-content/uploads/2026/04/Issue-2-Cover-Image-212x300.png')

export default function DemoOne() {
  return (
    <div style={{ height: "100vh", width: "100%", background: "#f2f3f5", overflowY: "auto", overflowX: "hidden" }}>
      <WarpShaderHero />
      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: "4rem 1.5rem 5rem" }}>
        <div style={{ display: "flex", gap: "2.5rem", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 700px" }}>
            <h2 style={{ margin: 0, color: "#1234a6", fontSize: "clamp(2rem, 4.6vw, 3.8rem)", fontWeight: 800, fontFamily: "sans-serif", letterSpacing: "0.02em", textTransform: "uppercase" }}>
              CORAL MATTERS MAGAZINE ISSUE 2!
            </h2>
            <p style={{ marginTop: "1.5rem", color: "#151515", fontSize: "clamp(1rem, 1.8vw, 1.55rem)", lineHeight: 1.5, fontFamily: "sans-serif", maxWidth: "900px" }}>
              We are excited to announce issue 2 of our quarterly magazine ‘Coral Matters’, that aims to bring you up-to-date coral related news, research, help and advice from around the world. It is also a place where we will be featuring members work, ideas and questions. Remember this is YOUR magazine, created by coral reef scientists for coral reef scientists! Download your FREE copy now!
            </p>
            <a href={magazinePdfUrl} target="_blank" rel="noreferrer" style={{ marginTop: "2rem", display: "inline-block", padding: "1rem 2.1rem", borderRadius: "9999px", border: "2px solid #0f2f9b", color: "#ffffff", background: "linear-gradient(135deg, #1b49d4 0%, #0f2f9b 100%)", boxShadow: "0 8px 20px rgba(15,47,155,0.28)", textDecoration: "none", fontFamily: "sans-serif", fontWeight: 800, fontSize: "clamp(1rem, 1.5vw, 1.25rem)", letterSpacing: "0.02em" }}>
              View & Download Now
            </a>
          </div>
          <img src={magazineImageUrl} alt="Coral Matters Magazine Issue 2" style={{ width: "100%", maxWidth: "320px", alignSelf: "center", borderRadius: "2px" }} />
        </div>

        <div style={{ marginTop: "4.5rem", borderTop: "1px solid #dbdde1", paddingTop: "4rem", textAlign: "center" }}>
          <h3 style={{ margin: 0, color: "#0f0f0f", fontSize: "clamp(2rem, 4.2vw, 3.9rem)", fontWeight: 800, fontFamily: "sans-serif", textTransform: "uppercase" }}>
            POST TO CoRR HUB NEWS FEED
          </h3>
          <p style={{ margin: "1.7rem auto 0", color: "#151515", fontSize: "clamp(1rem, 1.8vw, 1.9rem)", lineHeight: 1.5, fontFamily: "sans-serif", maxWidth: "1120px" }}>
            Check out and read CoRR Hub news articles featuring research and other coral reef related information. You can also create your own posts and highlight news, your research or anything else coral related (questions, collaborations or whatever you like). Just please keep it good vibes only!!
          </p>
          <a href="/" style={{ marginTop: "2.25rem", display: "inline-block", padding: "1rem 2.5rem", borderRadius: "9999px", background: "#1f8098", color: "#ffffff", textDecoration: "none", fontFamily: "sans-serif", fontSize: "clamp(1.2rem, 2vw, 2rem)", fontWeight: 700, letterSpacing: "0.03em", border: "8px solid #f2f3f5", boxShadow: "0 0 0 1px #d7d9dd" }}>
            VIEW HUB NEWS FEED
          </a>
        </div>
      </section>
    </div>
  )
}
