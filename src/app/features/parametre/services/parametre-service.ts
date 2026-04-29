import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, timeout, catchError } from 'rxjs';
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

  // Configuration des types de demande
  getTypeDemandes(): Observable<TypeDemandeItem[]> {
    return this.http.get<TypeDemandeItem[]>(
      `${this.apiUrl}/typedemande`
    ).pipe(timeout(15000));
  }

  getTypeDemandeById(id: number): Observable<TypeDemandeItem> {
    return this.http.get<TypeDemandeItem>(
      `${this.apiUrl}/typedemande/${id}`
    ).pipe(timeout(15000));
  }

  createTypeDemande(body: TypeDemandePayload): Observable<TypeDemandeItem> {
    return this.http.post<TypeDemandeItem>(
      `${this.apiUrl}/typedemande`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  updateTypeDemande(id: number, body: TypeDemandePayload): Observable<TypeDemandeItem> {
    return this.http.put<TypeDemandeItem>(
      `${this.apiUrl}/typedemande/${id}`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  deleteTypeDemande(id: number): Observable<unknown> {
    // Certains backends retournent un body texte (ou exigent un body DELETE).
    // On tente d'abord le DELETE standard, puis des fallbacks courants.
    return this.http.delete(
      `${this.apiUrl}/typedemande/${id}`,
      { observe: 'response', responseType: 'text' }
    ).pipe(
      timeout(15000),
      map((res) => res.body),
      catchError(() =>
        this.http.request(
          'DELETE',
          `${this.apiUrl}/typedemande/${id}`,
          {
            body: { iddemande: id },
            headers: { 'Content-Type': 'application/json' },
            observe: 'response',
            responseType: 'text'
          }
        ).pipe(
          timeout(15000),
          map((res) => res.body),
          catchError(() =>
            this.http.request(
              'DELETE',
              `${this.apiUrl}/typedemande`,
              {
                body: { iddemande: id },
                headers: { 'Content-Type': 'application/json' },
                observe: 'response',
                responseType: 'text'
              }
            ).pipe(
              timeout(15000),
              map((res) => res.body)
            )
          )
        )
      )
    );
  }

  getTypeDemandeChamps(id: number): Observable<TypeDemandeChampItem[]> {
    return this.http.get<TypeDemandeChampItem[]>(
      `${this.apiUrl}/typedemande/${id}/champs`
    ).pipe(timeout(15000));
  }

  createTypeDemandeChamp(id: number, body: TypeDemandeChampPayload): Observable<TypeDemandeChampItem> {
    return this.http.post<TypeDemandeChampItem>(
      `${this.apiUrl}/typedemande/${id}/champs`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  updateTypeDemandeChamp(idChamp: number, body: TypeDemandeChampPayload): Observable<TypeDemandeChampItem> {
    const payload: TypeDemandeChampPayload = {
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      typeChamp: (body.typeChamp ?? '').trim() || undefined,
      obligatoire: body.obligatoire === true,
      ordre: Number.isFinite(Number(body.ordre)) ? Number(body.ordre) : 0,
      optionsJson: (body.optionsJson ?? '').toString().trim() || undefined,
      iddemande: Number.isFinite(Number(body.iddemande)) ? Number(body.iddemande) : undefined
    };

    return this.http.put<TypeDemandeChampItem>(
      `${this.apiUrl}/typedemande/champs/${idChamp}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  deleteTypeDemandeChamp(idChamp: number): Observable<unknown> {
    return this.http.delete(
      `${this.apiUrl}/typedemande/champs/${idChamp}`
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

export interface TypeDemandeItem {
  id?: number;
  code?: string;
  libelle?: string;
  actif?: boolean;
  active?: boolean;
  [key: string]: unknown;
}

export interface TypeDemandePayload {
  code: string;
  libelle: string;
  description?: string;
  actif?: boolean;
  active?: boolean;
}

export interface TypeDemandeChampItem {
  id?: number;
  code?: string;
  libelle?: string;
  type?: string;
  typeChamp?: string;
  required?: boolean;
  requis?: boolean;
  obligatoire?: boolean;
  ordre?: number;
  optionsJson?: string;
  iddemande?: number;
  [key: string]: unknown;
}

export interface TypeDemandeChampPayload {
  code: string;
  libelle: string;
  typeChamp?: string;
  obligatoire?: boolean;
  ordre?: number;
  optionsJson?: string;
  iddemande?: number;
}