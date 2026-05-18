"use client";

import { useState } from "react";

// Page de test minimale : pas de Tailwind, pas de KaTeX, pas de fetch.
// Sert à savoir si React arrive à s'hydrater sur le device.
// Si le compteur incrémente quand on tape, React marche.
// Sinon, c'est un problème de chargement JS / hydration.
export default function TestPage() {
  const [text, setText] = useState("");
  const [taps, setTaps] = useState(0);

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 600,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>
        🧪 Test React Hydration
      </h1>

      <p style={{ marginBottom: 8, color: "#444" }}>
        <strong>{text.length}</strong> caractère(s) — tape n&apos;importe quoi :
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          fontSize: 16,
          padding: 10,
          border: "2px solid #888",
          borderRadius: 8,
          boxSizing: "border-box",
        }}
      />

      <p style={{ marginTop: 20, marginBottom: 8, color: "#444" }}>
        <strong>{taps}</strong> tap(s) sur le bouton :
      </p>
      <button
        type="button"
        onClick={() => setTaps((t) => t + 1)}
        style={{
          width: "100%",
          fontSize: 16,
          padding: "14px 20px",
          background: "#4f46e5",
          color: "white",
          border: 0,
          borderRadius: 8,
          fontWeight: 600,
        }}
      >
        Tape ici (compteur de clics)
      </button>

      <hr style={{ margin: "30px 0", border: "1px solid #ddd" }} />

      <p style={{ fontSize: 13, color: "#666" }}>
        ✅ Si le compteur monte quand tu tapes → React fonctionne.
        <br />❌ Si rien ne bouge → JS bloqué sur ton tel.
      </p>

      <p style={{ fontSize: 12, color: "#888", marginTop: 20 }}>
        User Agent (info navigateur) :
        <br />
        <code id="ua" style={{ fontSize: 11, wordBreak: "break-all" }} />
      </p>

      <script
        dangerouslySetInnerHTML={{
          __html:
            "var el=document.getElementById('ua'); if(el) el.textContent=navigator.userAgent;",
        }}
      />
    </div>
  );
}
