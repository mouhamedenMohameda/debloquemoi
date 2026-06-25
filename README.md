# Bac/mobile — App mobile Débloque-moi (Expo SDK 56)

Application mobile React Native (Expo) qui consomme le backend Next.js
de `Bac/app` (API routes hébergées sur Vercel/VPS).

## Stack

- Expo SDK 56 + React Native 0.85 + React 19
- Expo Router (routing fichier-based)
- NativeWind v4 (Tailwind CSS pour RN)
- `expo-secure-store` pour le token de session
- `expo-camera` + `expo-image-picker` pour l'OCR (à venir)

## Démarrage

```bash
cp .env.local.example .env.local
# édite EXPO_PUBLIC_API_URL pour pointer vers ton backend Next.js déployé
npm install --legacy-peer-deps
npx expo start
```

Scanne le QR code avec **Expo Go** (App Store / Play Store) pour tester sur device.

Sur web : `npx expo start --web` (utile pour itérer sans device).

## Structure

```
app/
  _layout.tsx     # layout racine (StatusBar, Stack, NativeWind)
  index.tsx       # gate session → redirige vers /login ou /home
  login.tsx       # écran de connexion
  home.tsx        # écran principal (demande d'indice)
lib/
  config.ts       # URL du backend
  auth.ts         # SecureStore (token)
  api.ts          # client fetch + ApiError
  useSession.ts   # hook auth (login/logout/me)
```

## Endpoints backend attendus

À implémenter / vérifier côté `Bac/app` :

- `POST /api/auth/login` → `{ token, user }`
- `GET /api/auth/me` → `{ user_id, email, ... }` (auth via `Authorization: Bearer`)
- `POST /api/hint` (déjà existant — à adapter pour accepter Bearer en plus du cookie)

## CORS

Le backend Next.js doit autoriser :
- `Origin: http://localhost:8081` (dev web Expo)
- `Origin: capacitor://localhost` (futur build natif — pas applicable Expo Go)
- En dev Expo Go : pas de CORS car requête native, pas WebView.

## TODO

- [ ] OCR caméra (`expo-camera`)
- [ ] Rendu Markdown + LaTeX des indices (`react-native-markdown-display` + math)
- [ ] Écrans `/profile`, `/topup`, `/referrals`
- [ ] Onboarding `/register`
- [ ] Push notifications
- [ ] Build EAS (App Store / Play Store)
