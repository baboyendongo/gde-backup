import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { Role } from '../models/role';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token?: string;
  accessToken?: string;
  user?: unknown;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  
  private readonly loginUrl = 'http://192.168.2.129:8095/api/evolution/authentification';

  constructor(private readonly http: HttpClient) {}


  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.loginUrl, payload).pipe(timeout(10000)); // 10 secondes
  }





  saveSession(response: AuthResponse, username?: string): void {
    const token = this.extractToken(response);
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    
    // Essayer d'obtenir le nom d'utilisateur depuis différentes sources
    let finalUsername = username?.trim();
    
    // Si pas de username fourni, essayer de l'extraire de la réponse
    if (!finalUsername && response.user && typeof response.user === 'object') {
      const userObj = response.user as Record<string, unknown>;
      if (userObj['username'] && typeof userObj['username'] === 'string') {
        finalUsername = (userObj['username'] as string).trim();
      } else if (userObj['nom'] && typeof userObj['nom'] === 'string') {
        finalUsername = (userObj['nom'] as string).trim();
      } else if (userObj['name'] && typeof userObj['name'] === 'string') {
        finalUsername = (userObj['name'] as string).trim();
      }
    }
    
    // Si toujours pas de username, essayer de l'extraire du token
    if (!finalUsername && token) {
      finalUsername = this.extractUsernameFromToken(token)?.trim() || undefined;
    }
    
    // Sauvegarder le nom d'utilisateur s'il existe
    if (finalUsername && finalUsername.length > 0) {
      localStorage.setItem('auth_username', finalUsername);
    }
    
    localStorage.setItem('auth_user', JSON.stringify(response.user ?? null));
    localStorage.setItem('auth_response', JSON.stringify(response));
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_response');
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token');
    return typeof token === 'string' && token.trim().length > 0;
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
  /**
   * Extrait le rôle de l'utilisateur connecté depuis le token JWT ou la session.
   * Le rôle retourné est normalisé en majuscules avec les espaces remplacés par des underscores.
   */
  getUserRole(): string | null {
    const normalizeRole = (r: string) => r.toUpperCase().replace(/^ROLE_/, '').replace(/\s+/g, '_');

    const token = localStorage.getItem('auth_token');
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64)) as Record<string, unknown>;
          // Essayer différents formats de champ de rôle
          if (typeof payload['role'] === 'string') return normalizeRole(payload['role']);
          if (typeof payload['roles'] === 'string') return normalizeRole(payload['roles']);
          if (Array.isArray(payload['roles']) && payload['roles'].length > 0) {
            return normalizeRole(String(payload['roles'][0]));
          }
          if (Array.isArray(payload['authorities']) && payload['authorities'].length > 0) {
            const first = payload['authorities'][0];
            if (typeof first === 'string') return normalizeRole(first);
            if (first && typeof first === 'object') {
              const auth = first as Record<string, unknown>;
              if (typeof auth['authority'] === 'string') return normalizeRole(auth['authority']);
            }
          }
        } catch {
          // Ignorer les erreurs de décodage
        }
      }
    }

    // Essayer depuis la réponse stockée
    const authResponse = localStorage.getItem('auth_response');
    if (authResponse) {
      try {
        const response = JSON.parse(authResponse) as AuthResponse;
        if (response.user && typeof response.user === 'object') {
          const userObj = response.user as Record<string, unknown>;
          if (typeof userObj['role'] === 'string') return normalizeRole(userObj['role']);
          if (Array.isArray(userObj['roles']) && userObj['roles'].length > 0) {
            return normalizeRole(String(userObj['roles'][0]));
          }
        }
      } catch {
        // Ignorer les erreurs de parsing
      }
    }

    return null;
  }

 
  getConnectedUsername(): string {
    // Essayer d'abord le nom d'utilisateur stocké
    const storedUsername = localStorage.getItem('auth_username');
    if (storedUsername && storedUsername.trim().length > 0) {
      return storedUsername.trim();
    }

    // Essayer d'extraire depuis la réponse complète
    const authResponse = localStorage.getItem('auth_response');
    if (authResponse) {
      try {
        const response = JSON.parse(authResponse) as AuthResponse;
        if (response.user && typeof response.user === 'object') {
          const userObj = response.user as Record<string, unknown>;
          if (userObj['username'] && typeof userObj['username'] === 'string') {
            return (userObj['username'] as string).trim();
          }
          if (userObj['nom'] && typeof userObj['nom'] === 'string') {
            return (userObj['nom'] as string).trim();
          }
          if (userObj['name'] && typeof userObj['name'] === 'string') {
            return (userObj['name'] as string).trim();
          }
        }
      } catch {
        // Ignorer les erreurs de parsing
      }
    }

    // Essayer d'extraire depuis le token JWT
    const token = localStorage.getItem('auth_token');
    if (token) {
      const tokenUsername = this.extractUsernameFromToken(token);
      if (tokenUsername && tokenUsername.trim().length > 0) {
        return tokenUsername.trim();
      }
    }

    return 'Utilisateur';
  }

  getConnectedUserFullName(): string {
    // Priorité 1: Extraire depuis le token JWT (champ "name")
    const token = localStorage.getItem('auth_token');
    if (token) {
      const tokenName = this.extractNameFromToken(token);
      if (tokenName && tokenName.trim().length > 0) {
        return tokenName.trim();
      }
    }

    // Priorité 2: Essayer depuis la réponse complète
    const authResponse = localStorage.getItem('auth_response');
    if (authResponse) {
      try {
        const response = JSON.parse(authResponse) as AuthResponse;
        if (response.user && typeof response.user === 'object') {
          const userObj = response.user as Record<string, unknown>;
          
          // Extraire le nom et le prénom
          const nom = this.extractStringProperty(userObj, ['nom', 'lastName', 'last_name', 'familyName']);
          const prenom = this.extractStringProperty(userObj, ['prenom', 'firstName', 'first_name', 'givenName']);
          
          // Construire le nom complet
          const parts: string[] = [];
          if (prenom) parts.push(prenom);
          if (nom) parts.push(nom);
          
          if (parts.length > 0) {
            return parts.join(' ');
          }
          
          // Si pas de nom/prénom, essayer d'autres propriétés
          const fullName = this.extractStringProperty(userObj, ['fullName', 'full_name', 'name', 'displayName', 'display_name']);
          if (fullName) {
            return fullName;
          }
        }
      } catch {
        // Ignorer les erreurs de parsing
      }
    }

    // Fallback sur le username si pas de nom trouvé
    return this.getConnectedUsername();
  }

  private extractStringProperty(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = obj[key];
      if (value && typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }

  private extractToken(response: AuthResponse): string | null {
    if (typeof response.token === 'string' && response.token.length > 0) {
      return response.token;
    }
    if (typeof response.accessToken === 'string' && response.accessToken.length > 0) {
      return response.accessToken;
    }
    return null;
  }

  private extractUsernameFromToken(token: string): string | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64)) as { sub?: string; name?: string };
      // Prioriser le champ "name" au lieu de "sub"
      if (typeof payload.name === 'string' && payload.name.length > 0) {
        return payload.name;
      }
      // Fallback sur "sub" si "name" n'existe pas
      return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
    } catch {
      return null;
    }
  }

  private extractNameFromToken(token: string): string | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64)) as { name?: string };
      return typeof payload.name === 'string' && payload.name.length > 0 ? payload.name : null;
    } catch {
      return null;
    }
  }

  getUserRoles(): string[] {
    const fromUser = this.getRolesFromUser();
    if (fromUser.length > 0) {
      return fromUser;
    }
    const fromToken = this.getRolesFromToken();
    if (fromToken.length > 0) {
      return fromToken;
    }
    return [];
  }

  /** Rôles depuis auth_response.user (roles, authorities, role). */
  private getRolesFromUser(): string[] {
    const user = this.getUser();
    if (!user || typeof user !== 'object') {
      return [];
    }
    const u = user as Record<string, unknown>;
    const rawRoles = u['roles'] ?? u['authorities'];
    if (Array.isArray(rawRoles)) {
      return this.normalizeRoleArray(rawRoles);
    }
    if (typeof u['role'] === 'string' && u['role']) {
      return [this.normalizeRoleName(u['role'] as string)];
    }
    return [];
  }

  /** Rôles depuis le payload JWT (roles, authorities, role). */
  private getRolesFromToken(): string[] {
    const token = localStorage.getItem('auth_token');
    if (!token) return [];
    const parts = token.split('.');
    if (parts.length < 2) return [];
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64)) as Record<string, unknown>;
      const rawRoles = payload['roles'] ?? payload['authorities'];
      if (Array.isArray(rawRoles)) {
        const names: string[] = [];
        for (const r of rawRoles as unknown[]) {
          if (typeof r === 'string') names.push(r);
          else if (r && typeof r === 'object') {
            const o = r as Record<string, unknown>;
            const name = (o['authority'] ?? o['role'] ?? o['name'] ?? o['roleName']) as string | undefined;
            if (typeof name === 'string' && name) names.push(name);
          }
        }
        return names.map((name) => this.normalizeRoleName(name));
      }
      if (typeof payload['role'] === 'string' && payload['role']) {
        return [this.normalizeRoleName(payload['role'] as string)];
      }
    } catch {
      // ignore
    }
    return [];
  }

  private normalizeRoleArray(raw: unknown[]): string[] {
    return raw
      .map((r) => {
        if (typeof r === 'string') return r;
        if (r && typeof r === 'object') {
          const o = r as Record<string, unknown>;
          return (
            (typeof o['name'] === 'string' && o['name']) ||
            (typeof o['roleName'] === 'string' && o['roleName']) ||
            (typeof o['authority'] === 'string' && o['authority']) ||
            (typeof o['nom'] === 'string' && o['nom']) ||
            (typeof o['role'] === 'string' && o['role']) ||
            ''
          );
        }
        return '';
      })
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      .map((name) => this.normalizeRoleName(name));
  }

  getUser() {
    const authResponse = localStorage.getItem('auth_response');
    if (authResponse) {
      try {
        const response = JSON.parse(authResponse) as AuthResponse;
        return response.user;
      } catch {
        return null;
      }
    } else {
      return null;
    } 
  }

  hasRole(role: string): boolean {
    const roles = this.getUserRoles();
    const normalizedRequested = this.normalizeRoleName(role);
    return roles.includes(normalizedRequested);
  }

  hasAnyRole(roles: string[]): boolean {
    const userRoles = this.getUserRoles();
    if (!userRoles || userRoles.length === 0) {
      return false;
    }
    const requested = roles.map((r) => this.normalizeRoleName(r));
    return requested.some((r) => userRoles.includes(r));
  }

  /** Équipes de l'utilisateur (ex: SI_ERP, SI_SAGE) pour ROLE_SI.
   *  Sources possibles :
   *  - response.user.equipes / equipe / teams (session)
   *  - claim JWT "equipeSI" (array ou string)
   */
  getEquipes(): string[] {
    const normalize = (arr: unknown): string[] => {
      if (Array.isArray(arr)) {
        return arr
          .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
          .map((e) => e.trim());
      }
      if (typeof arr === 'string' && arr.trim().length > 0) {
        return [arr.trim()];
      }
      return [];
    };

    // 1) Depuis l'objet user en session
    const user = this.getUser();
    if (user && typeof user === 'object') {
      const u = user as Record<string, unknown>;
      const rawSession = u['equipes'] ?? u['equipe'] ?? u['teams'];
      const fromSession = normalize(rawSession);
      if (fromSession.length > 0) {
        return fromSession;
      }
    }

    // 2) Depuis le token JWT : claim "equipeSI"
    const token = localStorage.getItem('auth_token');
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64)) as Record<string, unknown>;
          const rawToken = payload['equipeSI'] ?? payload['equipes'] ?? payload['teams'];
          const fromToken = normalize(rawToken);
          if (fromToken.length > 0) {
            return fromToken;
          }
        } catch {
          // ignore decode errors
        }
      }
    }

    return [];
  }

  /**
   * Code d'équipe pour les utilisateurs ROLE_APPLICATION.
   * Sources possibles :
   *  - response.user.codeEquipe / codeequipe / equipeSI
   *  - claim JWT "codeEquipe" ou "equipeSI"
   */
  getCodeEquipe(): string | null {
    const normalizeOne = (val: unknown): string | null => {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        const v = (val[0] as string).trim();
        return v.length > 0 ? v : null;
      }
      if (typeof val === 'string') {
        const v = val.trim();
        return v.length > 0 ? v : null;
      }
      return null;
    };

    // 1) Depuis l'objet user en session
    const user = this.getUser();
    if (user && typeof user === 'object') {
      const u = user as Record<string, unknown>;
      const fromUser =
        normalizeOne(u['codeEquipe']) ??
        normalizeOne(u['codeequipe']) ??
        normalizeOne(u['equipeSI']) ??
        normalizeOne(u['equipes']);
      if (fromUser) return fromUser;
    }

    // 2) Depuis le token JWT
    const token = localStorage.getItem('auth_token');
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64)) as Record<string, unknown>;
          const fromToken =
            normalizeOne(payload['codeEquipe']) ??
            normalizeOne(payload['codeequipe']) ??
            normalizeOne(payload['equipeSI']) ??
            normalizeOne(payload['equipes']);
          if (fromToken) return fromToken;
        } catch {
          // ignore
        }
      }
    }

    return null;
  }

  /** Normalise un nom de rôle en supprimant le préfixe ROLE_ et en upper snake case. */
  private normalizeRoleName(role: string): string {
    return role
      .toUpperCase()
      .replace(/^ROLE_/, '')
      .replace(/\s+/g, '_');
  }

}
