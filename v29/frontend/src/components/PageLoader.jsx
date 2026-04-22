import React from "react";

export default function PageLoader({
  title = "Loading...",
  subtitle = "Please wait a moment",
  fullScreen = true,
}) {
  const styles = getStyles(fullScreen);

  return (
    <div style={styles.wrapper}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img
            src="/logo.svg"
            alt="GAS Arabian Services"
            style={styles.logo}
          />
        </div>

        <div style={styles.spinnerWrap}>
          <div style={styles.ring}></div>
          <div style={styles.ringInner}></div>
        </div>

        <h2 style={styles.title}>{title}</h2>
        <p style={styles.subtitle}>{subtitle}</p>

        <div style={styles.progressTrack}>
          <div style={styles.progressBar}></div>
        </div>
      </div>
    </div>
  );
}

function getStyles(fullScreen) {
  return {
    wrapper: {
      minHeight: fullScreen ? "100vh" : "360px",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      background:
        "linear-gradient(135deg, #051128 0%, #081a3a 45%, #041020 100%)",
      borderRadius: fullScreen ? 0 : 24,
    },

    bgGlowOne: {
      position: "absolute",
      width: 300,
      height: 300,
      borderRadius: "50%",
      background: "rgba(14,165,233,0.16)",
      filter: "blur(80px)",
      top: -80,
      left: -80,
    },

    bgGlowTwo: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: "50%",
      background: "rgba(59,130,246,0.14)",
      filter: "blur(70px)",
      bottom: -80,
      right: -80,
    },

    card: {
      position: "relative",
      zIndex: 2,
      width: "min(92%, 420px)",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 28,
      padding: "30px 24px",
      backdropFilter: "blur(14px)",
      boxShadow: "0 20px 50px rgba(0,0,0,0.24)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    },

    logoWrap: {
      marginBottom: 18,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    logo: {
      width: 92,
      height: "auto",
      objectFit: "contain",
      filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.25))",
    },

    spinnerWrap: {
      position: "relative",
      width: 82,
      height: 82,
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    ring: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      border: "4px solid rgba(255,255,255,0.16)",
      borderTop: "4px solid #38bdf8",
      animation: "spin 0.9s linear infinite",
    },

    ringInner: {
      width: 46,
      height: 46,
      borderRadius: "50%",
      background:
        "radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(56,189,248,0.05) 60%, rgba(56,189,248,0) 100%)",
      boxShadow: "0 0 22px rgba(56,189,248,0.28)",
    },

    title: {
      margin: "0 0 8px 0",
      color: "#ffffff",
      fontSize: 24,
      fontWeight: 900,
      letterSpacing: "-0.03em",
    },

    subtitle: {
      margin: 0,
      color: "rgba(255,255,255,0.78)",
      fontSize: 14,
      lineHeight: 1.7,
      maxWidth: 280,
    },

    progressTrack: {
      width: "100%",
      height: 8,
      marginTop: 20,
      borderRadius: 999,
      background: "rgba(255,255,255,0.10)",
      overflow: "hidden",
    },

    progressBar: {
      width: "42%",
      height: "100%",
      borderRadius: 999,
      background: "linear-gradient(90deg, #38bdf8, #60a5fa)",
      animation: "progressMove 1.4s ease-in-out infinite",
      transformOrigin: "left center",
    },
  };
}
