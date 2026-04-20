import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, timeout, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Partenaire, CreatePartenaireRequest } from '../models/partenaire';
import { User, UserStatus } from '../models/users';

@Injectable({
  providedIn: 'root',
})
export class PartenaireService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) { }

  // Partenaires
  getListePartenaires(): Observable<Partenaire[]> {
    return this.http.get<Partenaire[]>(
      `${this.apiUrl}/partenaire/liste-partenaire`
    );
  }

  createPartenaire(body: CreatePartenaireRequest): Observable<Partenaire> {
    const typeVal = body.type?.trim();
    const webhookVal = body.webhookUrl?.trim();
    const payload = {
      nom: String(body.nom ?? '').trim(),
      emailContact: String(body.emailContact ?? '').trim(),
      type: typeVal && typeVal.length > 0 ? typeVal : null,
      webhookUrl: webhookVal && webhookVal.length > 0 ? webhookVal : null,
      actif: body.actif === true,
      applicationId: Array.isArray(body.applicationId)
        ? body.applicationId.filter((v) => typeof v === 'number' && Number.isFinite(v))
        : [],
    };
    return this.http.post(
      `${this.apiUrl}/partenaire/create-partenaire`,
      payload,
      { observe: 'response', responseType: 'text' }
    ).pipe(
      timeout(30000),
      map((res) => {
        if (res.body && res.body.trim().length > 0) {
          try {
            return JSON.parse(res.body) as Partenaire;
          } catch {
            return {} as Partenaire;
          }
        }
        return {} as Partenaire;
      })
    );
  }

  updatePartenaire(id: number, body: CreatePartenaireRequest): Observable<Partenaire> {
    const payload = {
      id,
      nom: body.nom,
      emailContact: body.emailContact,
      type: body.type?.trim() ? body.type.trim() : null,
      webhookUrl: body.webhookUrl?.trim() ? body.webhookUrl.trim() : null,
      actif: body.actif,
      applicationId: Array.isArray(body.applicationId)
        ? body.applicationId.filter((v) => typeof v === 'number' && Number.isFinite(v))
        : [],
    };
    return this.http.put<Partenaire>(
      `${this.apiUrl}/partenaire/update-partenaire`,
      payload
    ).pipe(timeout(30000));
  }

  deletePartenaire(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/partenaire/delete-partenaire/${id}`
    ).pipe(timeout(30000));
  }

  // Users
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/listeusers`).pipe(
      timeout(30000),
      catchError((error) => {
        // Si /listusers échoue, essayer /listeusers (ancien endpoint)
        console.warn('Échec de GET /listusers, tentative avec /listeusers');
        return this.http.get<User[]>(`${this.apiUrl}/listeusers`).pipe(
          timeout(30000)
        );
      })
    );
  }

  /**
   * Récupère la liste des rôles disponibles depuis la base de données
   */
  ListRolePermission(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rolepermission/liste-role`).pipe(timeout(30000));
  }

  /**
   * Assigne un rôle à un utilisateur
   */
  assignRoleToUser(username: string, role: string): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${username}/role`, { role }).pipe(timeout(30000));
  }

  /**
   * Récupère toutes les permissions disponibles
   */
  getListePermissions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/rolepermission/liste-permissions`).pipe(timeout(30000));
  }

  /**
   * Récupère les permissions pour un rôle spécifique
   */
  getRolePermissions(roleId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/rolepermission/roles/${roleId}/permissions`).pipe(timeout(30000));
  }

  /**
   * Assigne des permissions à un rôle spécifique
   */
  updateRolePermissions(roleId: number, permissions: any[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/rolepermission/roles/${roleId}/permissions`, { permissions }).pipe(timeout(30000));
  }

  assignPermissionsToUser(username: string, permissions: any[]): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${username}/permissions`, { permissions });
  }

  changeUserStatus(data: any): Observable<User> {

    return this.http.put<User>(`${this.apiUrl}/change-etat-user`, data);
  }

  /**
   * Assigne un utilisateur à une équipe SI.
   * POST /api/evolution/assign-user-to-equipe
   * Body: { username: string, codequipesi: string }
   */
  assignUserToEquipe(username: string, codequipesi: string): Observable<unknown> {
    return this.http.post<unknown>(
      `${this.apiUrl}/assign-user-to-equipe`,
      { username: username.trim(), codequipesi: codequipesi.trim() },
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  /**
   * Retire un utilisateur d'une équipe SI.
   * DELETE /api/evolution/remove-user-equipe
   * Body: { username: string, codequipesi: string }
   */
  removeUserEquipe(username: string, codequipesi: string): Observable<unknown> {
    return this.http.request<unknown>('DELETE', `${this.apiUrl}/remove-user-equipe`, {
      body: { username: username.trim(), codequipesi: codequipesi.trim() },
      headers: { 'Content-Type': 'application/json' }
    }).pipe(timeout(15000));
  }

  /**
   * Récupère la liste des équipes SI.
   * GET /api/evolution/parametre/liste-equipesi
   */
  getListeEquipesi(): Observable<ApplicationItem[]> {
    return this.http.get<ApplicationItem[]>(
      `${this.apiUrl}/parametre/liste-equipesi`
    ).pipe(timeout(15000));
  }

  /**
   * Créer une application (équipe SI / app à gérer).
   * POST /api/evolution/parametre/create-app
   * Body: { id?: number, code: string, libelle: string, active: boolean }
   */
  createApp(body: CreateAppRequest): Observable<ApplicationItem> {
    const payload = {
      id: body.id ?? 0,
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      active: body.active === true
    };
    return this.http.post<ApplicationItem>(
      `${this.apiUrl}/parametre/create-app`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }
}

export interface ApplicationItem {
  id?: number;
  code?: string;
  libelle?: string;
  active?: boolean;
}

export interface CreateAppRequest {
  id?: number;
  code: string;
  libelle: string;
  active: boolean;
}