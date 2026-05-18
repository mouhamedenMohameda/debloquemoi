import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 bloque par défaut les requêtes dev cross-origin. On autorise :
  // - les IP du LAN (test sur téléphone via Wi-Fi)
  // - les tunnels Cloudflare (HTTPS depuis n'importe où)
  allowedDevOrigins: [
    "192.168.1.3",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
