# Publier une version de Mes Poches (Android, hors Play Store)

## Pourquoi des utilisateurs ne voyaient pas les mises à jour (novembre 2026)

- Tous les APK distribués (release GitHub `v1.0.0`) avaient été construits avec le profil **`preview`** →
  ils écoutent le canal EAS **`preview`**.
- Les mises à jour OTA étaient publiées sur le canal **`production`** → ces téléphones ne les recevaient jamais.
- `expo-updates` télécharge l'OTA en arrière-plan au lancement mais ne l'applique qu'au **prochain démarrage à froid** ;
  Android garde souvent l'app en mémoire. L'app propose désormais « Redémarrer maintenant » dès qu'elle est prête,
  et revérifie à chaque retour au premier plan.

## Règle : un seul canal pour les utilisateurs, `production`

| Usage | Profil EAS | Canal | Sortie |
| - | - | - | - |
| APK distribué aux utilisateurs | `production` | `production` | APK |
| Tests internes | `preview` | `preview` | APK |

## Règle de version (sinon l'app redemande la mise à jour après installation)

Le tag de la release GitHub **doit être identique** à `expo.version` de `app.json` au moment du build
(ex. build `1.2.0` → release `v1.2.0`). En novembre 2026, la release `v1.1.1` contenait un APK construit en `1.1.0` :
l'app se croyait toujours en retard. Depuis la 1.2.0, l'app reconnaît aussi une release installée après un
téléchargement lancé depuis le modal, et ne propose chaque version qu'une seule fois.

## Nouvel APK (changement natif : SDK, module natif, permissions, `app.json`)

1. Incrémenter `expo.version` dans `app.json` (ex. `1.1.0` → `1.2.0`). Avec `runtimeVersion: appVersion`,
   c'est ce qui empêche une OTA d'atteindre un APK incompatible.
2. `npx eas-cli build --platform android --profile production`
3. Créer une release GitHub **`v1.2.0`** sur `Charles-Louisin/mespoches` avec l'APK nommé exactement
   **`MES.POCHES.apk`** ; le texte de la release devient le message affiché dans l'app.
4. C'est tout : `GET /api/app/version` lit la release, l'app affiche le modal (guide Play Protect + lien direct
   `releases/latest/download/MES.POCHES.apk`), le site pointe déjà sur ce lien.
   Mise à jour obligatoire : `APP_MIN_VERSION=1.2.0` sur Railway.

## Mise à jour OTA (JavaScript uniquement, même version d'APK)

```bash
npx eas-cli update --channel production --message "Correctifs …"
```

Les variables `EXPO_PUBLIC_*` sont lues dans `.env` au moment de la commande (pas dans `eas.json`).

## Téléphones déjà installés en 1.0.0 (canal `preview`)

Ils ne peuvent recevoir que des OTA de runtime `1.0.0` (SDK 57). Pour leur annoncer le nouvel APK, il faut publier
une OTA construite depuis le code SDK 57 qui contient le modal de téléchargement, sur les canaux `preview` et
`production`. À faire une seule fois, avant d'abandonner la 1.0.0.

## Mise à jour passerelle (préparée le 10/11/2026)

- Dossier : `C:\realProject\mes-poches-bridge-1.0.0` (worktree git détaché sur `cde5efc`, SDK 57, version 1.0.0).
- Contenu : uniquement l'annonce du nouvel APK (`src/lib/app-version.ts`, `src/components/apk-update-modal.tsx`,
  branchement dans `src/components/app-update-prompt.tsx`). Source : `/api/app/version`, sinon l'API GitHub.
- Le modal n'apparaît que si une version > 1.0.0 est annoncée (release GitHub ou publication admin) :
  publier la passerelle avant l'APK 1.1.0 est sans effet visible.
- Publication (après accord) :

```bash
cd C:\realProject\mes-poches-bridge-1.0.0
npx eas-cli update --channel preview --message "Annonce de la nouvelle version de l'app"
npx eas-cli update --channel production --message "Annonce de la nouvelle version de l'app"
```

- Ensuite : `git worktree remove ..\mes-poches-bridge-1.0.0` depuis `mes-poches-mobile`.
