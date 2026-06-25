# Build & publication — Bac/mobile

Procédure pour builder un IPA (iOS) / AAB (Android) **sans Xcode local**, via
EAS Build (cloud Expo). Le compte Apple Developer du projet est sur
`mohameda.mouhameden@gmail.com`.

## 1. Pré-requis (à faire une fois)

```bash
# Créer un compte Expo si pas déjà fait : https://expo.dev/signup
npm install -g eas-cli
eas login
```

## 2. Lier le projet Expo

```bash
cd Bac/mobile
eas init --id <NEW_PROJECT_ID>  # ou laisse vide pour création auto
```

La commande met à jour `app.json` avec `extra.eas.projectId`.

## 3. Build "development" (Dev Client iOS)

Génère un IPA installable sur ton iPhone qui supporte hot-reload Expo, mais
en remplacement d'Expo Go (donc plus de problème de version SDK).

```bash
eas build --profile development --platform ios
```

À la première exécution iOS, EAS te demande :
- Apple ID + mot de passe (compte Apple Developer)
- Auto-création des identifiants (bundle ID `com.debloquemoi.app`,
  provisioning profile, push key, etc.) — réponds **yes** à tout.

Build dans le cloud, ~10-15 min. À la fin, tu reçois un lien + QR.
Sur l'iPhone : ouvrir le lien dans Safari → "Install".

Pour l'utiliser ensuite :
```bash
npx expo start --dev-client
```
Puis ouvrir le Dev Client (icône Débloque-moi sur l'iPhone) → scanner QR.

## 4. Build "preview" (à partager en interne)

Pareil mais sans la couche dev (app autonome, plus rapide à lancer) :
```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

## 5. Build "production" (App Store / Play Store)

```bash
eas build --profile production --platform all
```

Ensuite :
- iOS : `eas submit --platform ios --latest` (besoin de remplir
  `ascAppId` et `appleTeamId` dans `eas.json` au préalable).
- Android : créer un compte Google Play Console (25 € unique), poser un
  fichier `google-play-service-account.json` à la racine, puis
  `eas submit --platform android --latest`.

## 6. Updates OTA (sans rebuild)

Pour les mises à jour de code JS uniquement (pas natif) :
```bash
eas update --branch production --message "Fix login bug"
```
Les users reçoivent l'update au prochain lancement de l'app, sans passer
par l'App Store.

## Variables d'env de build

Pour que l'app prod pointe vers les bons backends :
```bash
eas env:create --name EXPO_PUBLIC_AUTH_API_URL --value https://api.radar-mr.com --environment production
eas env:create --name EXPO_PUBLIC_API_URL --value https://app.radar-mr.com --environment production
```
(Remplacer la 2e URL par celle où ton Next.js est déployé.)
