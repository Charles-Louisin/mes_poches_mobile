# Publication sur Google Play — MES POCHES

Ce guide liste ce que le code prévoit déjà pour Google Play, puis ce qu’il faut saisir dans la Play Console.
Les réponses ci-dessous correspondent au comportement réel de l’app et du backend au 11 novembre 2026 :
si une fonctionnalité change, mettez à jour la fiche « Sécurité des données ».

## 1. Ce que le build Play Store fait différemment

Le profil EAS `playstore` (`eas.json`) produit un **AAB** et écrit `com.mespoches.DISTRIBUTION=play`
dans le manifeste. L’app lit cette valeur côté natif (`src/lib/distribution.ts`), donc une mise à jour OTA
ne peut pas la changer.

| Sujet | Règle Google Play | Build Play Store |
| --- | --- | --- |
| Permissions SMS (`READ_SMS`, `RECEIVE_SMS`) | Réservées aux apps SMS par défaut ou aux exceptions validées | Retirées de **toutes** les versions (APK compris) : aucune déclaration SMS à remplir. La détection passe par l’accès aux notifications. |
| Mise à jour par APK depuis l’app | Interdit : mises à jour uniquement via Google Play | Désactivée (`checkApkUpdate` renvoie `null`), `REQUEST_INSTALL_PACKAGES` bloquée |
| Paiement de l’abonnement (SasPay) | Les contenus numériques vendus dans l’app doivent passer par Google Play Billing | Paiement masqué dans l’app (`isPaymentsEnabled()` = false). Un abonnement payé sur le site reste reconnu. |
| `USE_EXACT_ALARM` | Réservée aux réveils et agendas | Bloquée. Le rappel de 19 h utilise `SCHEDULE_EXACT_ALARM` si l’utilisateur l’accorde, sinon une alarme en veille (quelques minutes de décalage possibles). |
| Service de premier plan « lecture média » | Déclaration et vidéo exigées | Supprimé (`enableBackgroundPlayback: false`) |
| Accès aux notifications | Divulgation visible avant la demande | Écran « Détection Mobile Money » : texte « Ce que Mes Poches lit et envoie » + lien vers la politique, avant le bouton Autoriser |
| Suppression de compte | Dans l’app et via une URL web | App : Plus → Profil → Effacer le compte. Web : `https://www.mespoches.store/suppression-compte` |

L’APK du site (profil `production`) garde la mise à jour par APK et le paiement SasPay. Aucune version ne lit les SMS.

## 2. Commandes

Build Play Store (AAB) :

```bash
npx eas-cli build --platform android --profile playstore
```

Envoi sur la piste de test interne (brouillon). Le premier envoi doit se faire à la main dans la Play Console :

```bash
npx eas-cli submit --platform android --profile playstore --latest
```

Mises à jour OTA du build Play Store (canal distinct de l’APK) :

```bash
EXPO_PUBLIC_DISTRIBUTION=play EXPO_PUBLIC_PAYMENTS_ENABLED=false npx eas-cli update --channel playstore --message "..."
```

## 3. Play Console — Contenu de l’application

- **Règles de confidentialité** : `https://www.mespoches.store/legal/privacy`
- **Accès à l’application** : « Toutes les fonctionnalités ne sont pas accessibles sans restriction ». Fournir
  un compte de test (e-mail + mot de passe) **sans double authentification**, avec quelques poches et
  transactions. Préciser : « La détection Mobile Money demande l’accès aux notifications : Plus → Détection
  mobile money. »
- **Annonces** : non, l’app ne contient pas de publicité.
- **Classification du contenu** : catégorie « Utilitaire, productivité, communication ou autre ». Pas de
  violence, de contenu sexuel, de jeux d’argent ni de partage de contenus entre utilisateurs.
- **Public cible** : 18 ans et plus (la politique exclut les moins de 16 ans ; ne pas cocher d’âge enfant).
- **Application d’actualités** : non.
- **Fonctionnalités financières** : « Gestion d’argent personnel / budget ». Aucun prêt, aucun paiement
  pour le compte de tiers, aucune crypto.
- **Applications gouvernementales / santé** : non.
- **Identifiant publicitaire** : non utilisé.

## 4. Fiche « Sécurité des données »

Questions générales :

- Collecte ou partage de données requises : **Oui**
- Données chiffrées en transit : **Oui** (HTTPS)
- Suppression des données possible : **Oui** (in-app et `https://www.mespoches.store/suppression-compte`). Seules les empreintes anti-abus de l’essai gratuit (HMAC irréversible) sont conservées, ce qu’indique cette page.

| Type de donnée (Play) | Collectée | Partagée* | Facultative | Finalités |
| --- | --- | --- | --- | --- |
| Informations personnelles → Adresse e-mail | Oui | Non | Non | Fonctionnement de l’app, gestion du compte, communications |
| Informations personnelles → Nom | Oui | Non | Oui | Gestion du compte |
| Informations personnelles → ID utilisateur | Oui | Non | Non | Fonctionnement, gestion du compte, prévention de la fraude |
| Informations financières → Historique d’achats (abonnement) | Oui | Non | Oui | Fonctionnement de l’app |
| Informations financières → Autres informations financières (transactions, poches) | Oui | Non | Non | Fonctionnement de l’app |
| Messages → SMS ou MMS (texte des SMS d’opérateurs tel qu’affiché dans leur notification ; la boîte SMS n’est jamais lue) | Oui | Non | Oui | Fonctionnement de l’app |
| Messages → Autres messages dans l’application (notifications Mobile Money, support) | Oui | Non | Oui | Fonctionnement de l’app, assistance |
| Photos et vidéos → Photos (tickets scannés) | Oui | Non | Oui | Fonctionnement de l’app |
| Fichiers audio → Enregistrements vocaux (dictée) | Oui | Non | Oui | Fonctionnement de l’app |
| Activité dans l’app → Interactions (statistiques d’usage) | Oui | Non | Non | Analyses |
| Infos et performances de l’app → Diagnostics | Non | — | — | — |
| Identifiants de l’appareil → ID de l’appareil (jeton push, ID d’installation) | Oui | Non | Non | Fonctionnement, prévention de la fraude |

\* Google ne considère pas comme « partage » l’envoi à un prestataire qui traite les données pour votre
compte (hébergement, e-mails, IA, notifications push). Les prestataires sont listés dans la politique
(section 11).

Traitement éphémère : les photos de tickets, les notes vocales et les notifications sans identifiant de
transaction ne sont pas conservées après traitement. Les cocher quand même comme « collectées ».

## 5. Fiche Play Store

- **Catégorie** : Finance.
- **Coordonnées** : `contact@mespoches.store` et `https://www.mespoches.store`.
- **Éléments graphiques** : icône 512 × 512 (PNG 32 bits), image de présentation 1024 × 500, 2 à 8 captures
  de téléphone (16:9 ou 9:16, côté min. 320 px).
- **Description** : ne promettez pas de fonction absente du build Play (pas de lecture des SMS, pas de
  paiement dans l’app). Formulation sûre : « détecte les transactions Mobile Money à partir des
  notifications reçues, avec votre accord ».

## 6. Avant de soumettre

- [ ] Backend et site déployés (page `/suppression-compte`, politique à jour, `robots.txt`, `sitemap.xml`).
- [ ] Compte de test créé, double authentification désactivée.
- [ ] Le build `playstore` installé depuis la piste interne : l’écran Abonnement n’affiche pas de paiement, la
      page « Rechercher une mise à jour » ne propose pas d’APK, la divulgation s’affiche avant l’accès aux
      notifications.
- [ ] Nouveau compte développeur personnel : test fermé obligatoire avec au moins 12 testeurs pendant
      14 jours avant l’accès à la production.
- [ ] Plus tard, pour vendre l’abonnement sur Play : intégrer Google Play Billing.
