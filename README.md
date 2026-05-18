# Débloque-moi — Bac Mauritanie

MVP d'une app qui aide les bacheliers mauritaniens en leur donnant des **indices progressifs** sur leurs exercices, sans donner la réponse trop vite.

## Démarrer

```bash
cp .env.local.example .env.local
# édite .env.local et mets ta GROQ_API_KEY (console.groq.com)
npm run dev
```

Ouvre http://localhost:3000

## Architecture

- **Next.js 16 (App Router)** + **TypeScript** + **Tailwind v4**
- **Groq** (Llama 3.3 70B par défaut) — voir `src/lib/groq.ts`
- **KaTeX** pour le rendu des maths

### Étendre à une nouvelle matière

Tout est centralisé dans `src/lib/subjects.ts` :

```ts
{
  id: "physique",
  name: "Physique",
  emoji: "⚛️",
  pedagogy: "Tu es prof de physique du Bac C mauritanien...",
  chapters: [
    { id: "mecanique", name: "Mécanique" },
  ],
}
```

Aucun autre fichier à toucher : l'UI et l'API s'adaptent automatiquement.

### Logique des 3 niveaux d'indices

Voir `src/lib/prompts.ts` :

1. **Niveau 1** — Question d'orientation, aucune formule
2. **Niveau 2** — Méthode + première étape, pas le résultat
3. **Niveau 3** — Solution complète style Erraja/Amimath

## Prochaines étapes

- [ ] Photo d'énoncé (vision Groq)
- [ ] RAG sur le corpus PDF (cours, devoirs, bacs blancs) pour ancrer les explications
- [ ] Comptes utilisateurs + historique
- [ ] Auto-évaluation hebdomadaire (Scénario 2)
- [ ] Ajouter Physique, SVT, etc.
