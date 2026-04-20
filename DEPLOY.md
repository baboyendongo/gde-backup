# Déploiement de l'application Gestion des demandes d'évolution

## 1. Build de production

À la racine du projet :

```bash
npm install
npm run build
```

Le build utilise la configuration **production** (optimisation, minification).  
Les fichiers générés se trouvent dans **`dist/`**. Après le build, regarder le message dans le terminal pour le chemin exact (souvent `dist/gestion_demande_evolution/browser/`).

## 2. Configurer l’API en production

Avant de builder, vérifier l’URL de l’API dans :

- **`src/environments/environment.prod.ts`**

Exemple :

```ts
export const environment = {
  production: true,
  apiUrl: 'https://votre-serveur.com/api/evolution',  // URL du backend en production
};
```

Adapter `apiUrl` selon l’environnement (serveur, domaine, port).

## 3. Déployer les fichiers statiques

Les fichiers dans **`dist/.../browser/`** (ou le dossier indiqué après le build) sont des fichiers statiques (HTML, JS, CSS). Ils doivent être servis par un serveur web.

### Option A : Serveur web (IIS, Nginx, Apache)

1. Copier tout le contenu du dossier de sortie du build (ex. `dist/gestion_demande_evolution/browser/`) vers la racine du site (ou le répertoire virtuel dédié).
2. Configurer le serveur pour que toutes les routes (ex. `/dashboard`, `/demandes/...`) renvoient **`index.html`** (mode SPA).

**Exemple Nginx :**

```nginx
server {
  listen 80;
  server_name votre-domaine.com;
  root /chemin/vers/dist/gestion_demande_evolution/browser;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

**Exemple IIS (web.config) :** placer un `web.config` à la racine du site avec des règles de réécriture pour renvoyer `index.html` pour les routes de l’app.

### Option B : Hébergement statique (Netlify, Vercel, GitHub Pages, etc.)

1. Lier le dépôt Git au service.
2. Commande de build : `npm run build` (ou `npm ci && npm run build`).
3. Dossier de publication : `dist/gestion_demande_evolution/browser` (à confirmer dans la sortie du build).
4. S’assurer que les redirections SPA sont activées (souvent proposées par défaut pour les apps Angular/React).

## 4. CORS et backend

Le backend (`http://192.168.2.129:8095` ou l’URL de prod) doit :

- Accepter les requêtes depuis l’origine du front (domaine où l’app est déployée).
- Exposer les en-têtes CORS nécessaires si le front et l’API ne sont pas sur le même domaine.

## 5. Vérification rapide en local après build

Pour tester le build en local sans déployer :

```bash
npx serve -s dist/gestion_demande_evolution/browser
```

Ou avec `http-server` :

```bash
npx http-server dist/gestion_demande_evolution/browser -p 8080 -c-1
```

Puis ouvrir `http://localhost:8080` (ou le port indiqué). Vérifier que l’API cible (dans `environment.prod.ts`) est bien celle que vous voulez utiliser.

---

**Résumé :**  
1. Mettre à jour `environment.prod.ts` (apiUrl).  
2. `npm install` puis `npm run build`.  
3. Déployer le contenu du dossier de sortie du build sur un serveur web en configurant la réécriture SPA (toutes les routes → `index.html`).
