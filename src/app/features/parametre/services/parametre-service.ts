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

  /**
   * Récupère la liste des statuts finaux.
   * GET /api/evolution/parametre/liste-statut-final
   */
  getListeStatutFinal(): Observable<StatutFinalItem[]> {
    return this.http.get<StatutFinalItem[]>(
      `${this.apiUrl}/parametre/liste-statut-final`
    ).pipe(timeout(15000));
  }

  /**
   * Créer un statut final.
   * POST /api/evolution/parametre/statut-final
   */
  createStatutFinal(body: CreateStatutFinalRequest): Observable<StatutFinalItem> {
    const payload = {
      id: body.id ?? 0,
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      active: body.active === true
    };
    return this.http.post<StatutFinalItem>(
      `${this.apiUrl}/parametre/statut-final`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  /**
   * Met à jour un statut final.
   * PUT /api/evolution/parametre/statut-final/{id}
   */
  updateStatutFinal(id: number, body: CreateStatutFinalRequest): Observable<StatutFinalItem> {
    const safeId = Number(id);
    const payload = {
      id: safeId,
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      active: body.active === true
    };
    return this.http.put<StatutFinalItem>(
      `${this.apiUrl}/parametre/statut-final/${safeId}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  /**
   * Supprime un statut final.
   * DELETE /api/evolution/parametre/statut-final/{id}
   */
  deleteStatutFinal(id: number): Observable<void> {
    const safeId = Number(id);
    return this.http.delete<void>(
      `${this.apiUrl}/parametre/statut-final/${safeId}`
    ).pipe(timeout(15000));
  }

  /**
   * Récupère la liste des types de demande.
   * GET /api/evolution/typedemande
   */
  getListeTypeDemande(): Observable<TypeDemandeItem[]> {
    return this.http.get<TypeDemandeItem[]>(
      `${this.apiUrl}/typedemande`
    ).pipe(timeout(15000));
  }

  /**
   * Récupère un type de demande par id.
   * GET /api/evolution/typedemande/{id}
   */
  getTypeDemandeById(id: number): Observable<TypeDemandeItem> {
    const safeId = Number(id);
    return this.http.get<TypeDemandeItem>(
      `${this.apiUrl}/typedemande/${safeId}`
    ).pipe(timeout(15000));
  }

  /**
   * Récupère les champs d'un type de demande.
   * GET /api/evolution/typedemande/{id}/champs
   */
  getTypeDemandeChamps(id: number): Observable<TypeDemandeChampItem[]> {
    const safeId = Number(id);
    return this.http.get<TypeDemandeChampItem[]>(
      `${this.apiUrl}/typedemande/${safeId}/champs`
    ).pipe(timeout(15000));
  }

  /**
   * Créer un type de demande.
   * POST /api/evolution/typedemande
   */
  createTypeDemande(body: CreateTypeDemandeRequest): Observable<TypeDemandeItem> {
    const payload = {
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      description: (body.description ?? '').trim()
    };
    return this.http.post<TypeDemandeItem>(
      `${this.apiUrl}/typedemande`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  /**
   * Met à jour un type de demande.
   * PUT /api/evolution/typedemande/{id}
   */
  updateTypeDemande(id: number, body: CreateTypeDemandeRequest): Observable<TypeDemandeItem> {
    const safeId = Number(id);
    const payload = {
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      description: (body.description ?? '').trim()
    };
    return this.http.put<TypeDemandeItem>(
      `${this.apiUrl}/typedemande/${safeId}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  /**
   * Supprime un type de demande.
   * DELETE /api/evolution/typedemande/{id}
   */
  deleteTypeDemande(id: number): Observable<void> {
    const safeId = Number(id);
    return this.http.delete<void>(
      `${this.apiUrl}/typedemande/${safeId}`
    ).pipe(timeout(15000));
  }

  /**
   * Créer / mettre à jour un champ de type de demande.
   * POST /api/evolution/typedemande/champs/{idChamp}
   */
  postTypeDemandeChamp(idChamp: number, body: CreateTypeDemandeChampRequest): Observable<TypeDemandeChampItem> {
    const safeIdChamp = Number(idChamp);
    const payload = {
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      typeChamp: (body.typeChamp ?? '').trim(),
      obligatoire: body.obligatoire === true,
      ordre: Number(body.ordre ?? 0),
      optionsJson: (body.optionsJson ?? '').trim()
    };
    return this.http.post<TypeDemandeChampItem>(
      `${this.apiUrl}/typedemande/champs/${safeIdChamp}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  /**
   * Met à jour un champ de type de demande.
   * PUT /api/evolution/typedemande/champs/{idChamp}
   */
  updateTypeDemandeChamp(idChamp: number, body: CreateTypeDemandeChampRequest): Observable<TypeDemandeChampItem> {
    const safeIdChamp = Number(idChamp);
    const payload = {
      code: (body.code ?? '').trim(),
      libelle: (body.libelle ?? '').trim(),
      typeChamp: (body.typeChamp ?? '').trim(),
      obligatoire: body.obligatoire === true,
      ordre: Number(body.ordre ?? 0),
      optionsJson: (body.optionsJson ?? '').trim()
    };
    return this.http.put<TypeDemandeChampItem>(
      `${this.apiUrl}/typedemande/champs/${safeIdChamp}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    ).pipe(timeout(15000));
  }

  /**
   * Supprime un champ de type de demande.
   * DELETE /api/evolution/typedemande/champs/{idChamp}
   */
  deleteTypeDemandeChamp(idChamp: number): Observable<void> {
    const safeIdChamp = Number(idChamp);
    return this.http.delete<void>(
      `${this.apiUrl}/typedemande/champs/${safeIdChamp}`
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

export interface StatutFinalItem {
  id?: number;
  code?: string;
  libelle?: string;
  active?: boolean;
}

export interface CreateStatutFinalRequest {
  id?: number;
  code: string;
  libelle: string;
  active: boolean;
}

export interface TypeDemandeItem {
  id?: number;
  code?: string;
  libelle?: string;
  description?: string;
}

export interface CreateTypeDemandeRequest {
  code: string;
  libelle: string;
  description: string;
}

export interface TypeDemandeChampItem {
  idChamp?: number;
  code?: string;
  libelle?: string;
  typeChamp?: string;
  obligatoire?: boolean;
  ordre?: number;
  optionsJson?: string;
}

export interface CreateTypeDemandeChampRequest {
  code: string;
  libelle: string;
  typeChamp: string;
  obligatoire: boolean;
  ordre: number;
  optionsJson: string;
}