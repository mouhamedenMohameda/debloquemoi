import { useMemo, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Rend un Markdown contenant du LaTeX ($...$ et $$...$$) dans un WebView avec
 * KaTeX (CDN). Hauteur ajustée dynamiquement via postMessage depuis la page.
 *
 * Pourquoi WebView : KaTeX est la référence pour le rendu LaTeX et n'a pas
 * d'équivalent natif RN aussi propre. Les libs `react-native-math-view` ont
 * trop de cas particuliers cassants.
 */
export function HintViewer({ markdown }: { markdown: string }) {
  const [height, setHeight] = useState(120);

  const html = useMemo(() => buildHtml(markdown), [markdown]);

  return (
    <View style={{ height, width: "100%" }} className="bg-white rounded-xl">
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled
        domStorageEnabled
        style={{ backgroundColor: "transparent" }}
        onMessage={(e) => {
          const n = Number(e.nativeEvent.data);
          if (!Number.isNaN(n) && n > 0) setHeight(Math.ceil(n) + 4);
        }}
      />
    </View>
  );
}

function escapeForTemplate(s: string): string {
  // On va injecter dans une balise <script type="text/markdown"> donc
  // on échappe juste les </script> et les backticks de template literal
  // côté JS (rien à faire pour markdown brut dans la balise textuelle).
  return s.replace(/<\/script/gi, "<\\/script");
}

function buildHtml(markdown: string): string {
  const safe = escapeForTemplate(markdown);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
<style>
  :root { color-scheme: light; }
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: #0f172a;
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  #root { padding: 4px 2px 8px; }
  p { margin: 0 0 12px; }
  p:last-child { margin-bottom: 0; }
  strong { color: #0f172a; }
  em { color: #1e293b; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin: 4px 0; }
  code {
    background: #f1f5f9;
    color: #0f172a;
    padding: 1px 6px;
    border-radius: 6px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.92em;
  }
  pre {
    background: #f1f5f9;
    padding: 10px 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0 0 12px;
  }
  pre code { background: transparent; padding: 0; border-radius: 0; }
  blockquote {
    border-left: 3px solid #2563eb;
    background: #eff6ff;
    margin: 0 0 12px;
    padding: 8px 12px;
    border-radius: 0 8px 8px 0;
    color: #1e3a8a;
  }
  h1, h2, h3 { margin: 14px 0 8px; line-height: 1.3; color: #0f172a; }
  h1 { font-size: 1.25em; }
  h2 { font-size: 1.15em; }
  h3 { font-size: 1.05em; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
  table { border-collapse: collapse; margin: 0 0 12px; width: 100%; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  .katex { font-size: 1.05em; }
  .katex-display { margin: 8px 0 12px; overflow-x: auto; overflow-y: hidden; }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/markdown" id="md">${safe}</script>
<script src="https://cdn.jsdelivr.net/npm/marked@13.0.3/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script>
  (function () {
    var src = document.getElementById('md').textContent || '';
    var root = document.getElementById('root');
    try {
      root.innerHTML = window.marked.parse(src);
    } catch (e) {
      root.textContent = src;
    }
    try {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\\\[', right: '\\\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\\\(', right: '\\\\)', display: false }
        ],
        throwOnError: false,
        strict: 'ignore'
      });
    } catch (e) {}

    function postHeight() {
      var h = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        root.scrollHeight
      );
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(String(h));
      }
    }
    // Premier ping, puis après que les fonts/CSS distantes soient chargées
    postHeight();
    setTimeout(postHeight, 50);
    setTimeout(postHeight, 250);
    setTimeout(postHeight, 700);
    window.addEventListener('load', postHeight);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(postHeight);
    }
    new ResizeObserver(postHeight).observe(document.body);
  })();
</script>
</body>
</html>`;
}
