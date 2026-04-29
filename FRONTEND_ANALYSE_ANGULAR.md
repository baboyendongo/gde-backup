# Analyse Front-end Angular

## 1) Cartographie des flux critiques

### Authentification et session
- `AuthService` gère login/logout et persistance session via `localStorage` (`auth_token`, `auth_user`, `auth_response`).
- Le login appelle un endpoint codé en dur (`/authentification`) au lieu d'utiliser `environment`.
- Le rôle utilisateur est reconstruit côté front depuis JWT/session avec plusieurs fallbacks.

### Guards et contrôle d'accès
- `authGuard` protège les routes privées via `isAuthenticated()`.
- `guestGuard` redirige les utilisateurs connectés vers `/dashboard`.
- `RoleGuard` existe mais n'est pas utilisé dans le routing principal, ce qui limite le contrôle fin par rôle au niveau route.

### Interceptors HTTP
- `JwtInterceptor` ajoute le bearer token hors endpoints d'auth.
- Le même interceptor décode directement le JWT sans garde stricte avant `split/decode`, ce qui peut provoquer des erreurs runtime si token invalide.
- `ErrorInterceptor` capture les `401`, appelle `logout()`, puis redirige vers `/` avec message d'expiration.

### Routing applicatif
- Routing principal mixte:
  - `loadChildren` pour certaines features (`demandes`, `parametre`)
  - `loadComponent` pour d'autres (`dashboard`, `statistiques`, `unauthorized`)
- `useHash: true` est activé globalement.
- Présence de routes legacy/redirections de compatibilité.

## 2) Cohérence architecture Angular

### État actuel
- Bootstrap encore orienté `NgModule` (`bootstrapModule(AppModule)`).
- Projet hybride `NgModule + standalone` (dans la pratique, les pages sont souvent standalone chargées via `loadComponent`).
- `AppModule` importe directement `ParametreModule` alors que la feature est aussi lazy-loadée via routing.

### Impacts
- Frontière architecture peu claire pour l'équipe (ce qui est shell/module vs ce qui est standalone).
- Risque de double chargement ou de couplage implicite de features.
- Complexité accrue pour migration et maintenance.

### Décision cible recommandée
- Cible progressive: **hybride maîtrisé à court terme**, puis **uniformisation standalone** à moyen terme.
- Éviter les imports eager de modules déjà lazy-loadés.

## 3) Audit API et configuration

## Endpoints hardcodés identifiés
- `src/environments/environment.ts` et `src/environments/environment.prod.ts`: même IP/URL backend.
- `src/app/core/service/auth.service.ts`: `loginUrl` hardcodée.
- `src/app/features/demande/pages/detail-demande/detail-demande.ts`: `DOWNLOAD_BASE` hardcodée.

### Risques
- Promotion dev/preprod/prod fragile.
- Changement d'infrastructure coûteux (modifications disséminées).
- Incohérences entre composants (certaines pages utilisent `environment`, d'autres non).

### Stratégie cible
- Centraliser toutes les bases d'URL dans `environment`.
- Introduire un service de config HTTP unique (ex: `ApiConfigService`) pour normaliser la construction d'URLs.
- Supprimer les constantes réseau locales dans les composants/pages.

## 4) Maintenabilité des services métier

### Points critiques
- `DemandeService` concentre: accès API, logique de visibilité, fusion de datasets, workflows de validation, parsing/rattrapage contrats backend.
- Responsabilités transverses mélangées dans une seule classe (fort couplage + tests difficiles).
- Duplication de concepts "notification":
  - `src/app/services/notification.service.ts` (toast)
  - `src/app/core/service/notification-service.ts` (notifications applicatives)
  - `src/app/services/in-app-notification.service.ts` (in-app persisted)

### Refactor recommandé
- Découper `DemandeService` en:
  - `DemandeApiService` (I/O HTTP pur)
  - `DemandeWorkflowService` (transitions/validations métier)
  - `DemandeVisibilityService` (règles de filtrage selon rôles/identité)
- Clarifier et renommer la famille notification (toast vs in-app feed) avec responsabilités explicites.

## 5) Qualité des tests

### Constat
- Beaucoup de `*.spec.ts`, mais couverture majoritairement "should create".
- Peu de tests ciblant les règles métier sensibles (guards, interceptors, filtrage des demandes, parsing des rôles JWT).
- Exemple de test potentiellement obsolète: `app.spec.ts` attend encore le titre `Hello, gestion_demande_evolution`.

### Priorité de tests à ajouter
- Interceptors: ajout token, bypass auth endpoints, traitement 401.
- Guards: redirections selon état auth/role.
- Services métier: filtrage des demandes, transitions statut, stratégie fallback API.
- Tests contractuels pour mapping backend hétérogène (champs alternatifs).

## 6) Roadmap priorisée

### P1 - Sécurité / configuration (immédiat)
1. Centraliser toutes les URLs dans `environment`.
2. Supprimer hardcoded endpoints des services/pages.
3. Renforcer robustesse du décodage JWT dans `JwtInterceptor`.

### P2 - Stabilité architecture (court terme)
1. Nettoyer la frontière lazy/eager (`ParametreModule` et modules hérités).
2. Standardiser conventions routing (module ou standalone par feature).
3. Activer `RoleGuard` sur routes nécessitant contrôle fin.

### P3 - Maintenabilité / dette (moyen terme)
1. Refactor `DemandeService` en services ciblés.
2. Unifier la stratégie de notification.
3. Renforcer couverture de tests business.

## Backlog technique proposé

1. `refactor(config): centraliser endpoints backend dans environment`
2. `fix(auth): supprimer loginUrl hardcodée et utiliser config centralisée`
3. `fix(demande): supprimer DOWNLOAD_BASE hardcodée dans detail-demande`
4. `fix(security): sécuriser parsing token dans JwtInterceptor`
5. `refactor(routing): supprimer import eager de feature lazy-loadée`
6. `refactor(architecture): définir convention standalone/module par feature`
7. `refactor(demande): extraire DemandeApiService`
8. `refactor(demande): extraire DemandeVisibilityService`
9. `refactor(demande): extraire DemandeWorkflowService`
10. `refactor(notification): clarifier NotificationService toast vs in-app`
11. `test(interceptors): couvrir token attach + 401 handling`
12. `test(guards): couvrir authGuard/guestGuard/RoleGuard`
13. `test(demande): couvrir règles de filtrage et workflows`

