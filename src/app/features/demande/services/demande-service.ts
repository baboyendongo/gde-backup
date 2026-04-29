import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Demande } from '../models/demande';
import { Dashboard } from '../models/dashbord';
import { AuthService } from '../../../core/service/auth.service';
import { Role } from '../../../core/models/role';

@Injectable({
  providedIn: 'root',
})
export class DemandeService {

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Toutes les demandes — réservé à ROLE_ADMIN uniquement.
   * Les autres rôles doivent utiliser getDemandesList() ou getDemandesByEquipes().
   */
  getAllDemandes(): Observable<Demande[]> {
    return this.http.get<Demande[]>(
      `${this.apiUrl}/demande/liste-demande-all`
    );
  }

  /**
   * Appel brut des demandes pour une équipe SI donnée (sans contrôle de rôle).
   * Backend : GET /demande/equipe-si/{codeEquipe}
   */
  private getDemandesByEquipeSIRaw(codeEquipe: string): Observable<Demande[]> {
    const safe = encodeURIComponent(codeEquipe);
    return this.http.get<Demande[]>(
      `${this.apiUrl}/demande/equipe-si/${safe}`
    );
  }

  /**
   * Demandes pour une équipe SI (avec contrôles de sécurité).
   * Vérifie que l'utilisateur a bien ROLE_SI et appartient à l'équipe.
   */
  getDemandesByEquipeSI(codeEquipe: string): Observable<Demande[]> {
    if (!this.authService.hasRole(Role.SI)) {
      return throwError(
        () => new Error('Accès refusé : seul un utilisateur avec le rôle ROLE_SI peut consulter les demandes d’une équipe SI.')
      );
    }

    const equipesUser = this.authService.getEquipes();
    if (!equipesUser.includes(codeEquipe)) {
      return throwError(
        () => new Error('Accès refusé : vous ne faites pas partie de cette équipe SI.')
      );
    }

    return this.getDemandesByEquipeSIRaw(codeEquipe);
  }

  /**
   * Liste des demandes selon le rôle :
   * - ROLE_ADMIN       : toutes les demandes (getAllDemandes).
   * - ROLE_SI          : demandes de l'équipe SI (getDemandesByEquipeSI).
   * - ROLE_APPLICATION : demandes filtrées par codeEquipe (paramètre ?codeEquipe=...).
   * - Autres           : mes demandes (getMyDemandes).
   */
  getDemandesList(): Observable<Demande[]> {
    if (this.authService.hasRole(Role.ADMIN)) {
      return this.getAllDemandes().pipe(
        map((list) => this.filterUnsubmittedDemandesForVisibility(list))
      );
    }
    if (this.authService.hasRole(Role.SI)) {
      const equipes = this.authService.getEquipes();
      if (equipes.length === 0) {
        // Pas d'équipe déclarée : fusion "all" + "mes demandes"
        return forkJoin([this.getAllDemandes(), this.getMyDemandes()]).pipe(
          map(([allDemandes, myDemandes]) => this.mergeDemandesUniqueById(allDemandes, myDemandes)),
          map((list) => this.filterUnsubmittedDemandesForVisibility(list))
        );
      }

      if (equipes.length === 1) {
        // Un seul code équipe : on fusionne avec mes demandes pour ne pas perdre les brouillons INITIE.
        return forkJoin([this.getDemandesByEquipeSI(equipes[0]), this.getMyDemandes()]).pipe(
          map(([teamDemandes, myDemandes]) => this.mergeDemandesUniqueById(teamDemandes, myDemandes)),
          map((list) => this.filterUnsubmittedDemandesForVisibility(list))
        );
      }

      // Plusieurs équipes : on récupère les demandes pour chaque équipe
      return forkJoin([
        forkJoin(equipes.map(code => this.getDemandesByEquipeSIRaw(code))),
        this.getMyDemandes()
      ]).pipe(
        map(([results, myDemandes]: [Demande[][], Demande[]]) => {
          const teamDemandes = results.flat();
          return this.mergeDemandesUniqueById(teamDemandes, myDemandes);
        }),
        map((list) => this.filterUnsubmittedDemandesForVisibility(list))
      );
    }
  
    return this.getMyDemandes().pipe(
      map((list) => this.filterUnsubmittedDemandesForVisibility(list))
    );
  }

  private mergeDemandesUniqueById(...lists: Array<Demande[] | null | undefined>): Demande[] {
    const merged: Demande[] = [];
    const seen = new Set<number>();

    for (const list of lists) {
      const safeList = Array.isArray(list) ? list : [];
      for (const demande of safeList) {
        const id = Number((demande as any)?.id);
        if (Number.isFinite(id) && id > 0) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        merged.push(demande);
      }
    }

    return merged;
  }

  private filterUnsubmittedDemandesForVisibility(list: Demande[] | null | undefined): Demande[] {
    const demandes = Array.isArray(list) ? list : [];
    const connectedUsername = (this.authService.getConnectedUsername() || '').trim().toLowerCase();
    const connectedFullName = (this.authService.getConnectedUserFullName() || '').trim().toLowerCase();

    // Garde-fou: si l'identité connectée n'est pas disponible, ne pas masquer
    // les brouillons par erreur côté UI.
    if (!connectedUsername && !connectedFullName) {
      return demandes;
    }

    return demandes.filter((demande) => {
      if (!this.isInitialUnsubmittedStatus(demande)) {
        return true;
      }
      return this.isDemandeCreatedByConnectedUser(demande, connectedUsername, connectedFullName);
    });
  }

  private isInitialUnsubmittedStatus(demande: Demande | any): boolean {
    const candidates = [
      this.extractStatusKey(demande?.statut),
      this.extractStatusKey(demande?.statutFinal),
      this.extractStatusKey(demande?.statutfinal),
      this.extractStatusKey(demande?.statut_final),
    ]
      .map((v) => String(v ?? '').toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_'))
      .filter((v) => v.length > 0);

    // Si au moins un statut indique "soumis", ce n'est plus un brouillon.
    const hasSubmittedStatus = candidates.some((s) =>
      s === 'SUBMITED' ||
      s === 'SUBMITTED' ||
      s === 'SOUMIS' ||
      s === 'SOUMISE' ||
      s.includes('SUBMIT') ||
      s.includes('SOUM') ||
      s === 'ENCOURS' ||
      s === 'EN_COURS' ||
      s === 'ENCOURS_CHEZ_SI' ||
      s === 'EN_COURS_DE_TRAITEMENT_SI' ||
      s === 'ENCOURS_CHEZ_ADMIN' ||
      s === 'EN_COURS_DE_TRAITEMENT_ADMIN'
    );
    if (hasSubmittedStatus) {
      return false;
    }

    // Brouillon / non soumis
    return candidates.some((s) =>
      s === 'CREE' ||
      s === 'CREATED' ||
      s === 'INITIE' ||
      s === 'INITIEE' ||
      s === 'INITIATED' ||
      s.includes('INIT')
    );
  }

  private extractStatusKey(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const code = obj['code'] ?? obj['statut'] ?? obj['name'] ?? obj['nom'];
      const label = obj['libelle'] ?? obj['label'];
      if (typeof code === 'string' && code.trim().length > 0) return code.trim();
      if (typeof label === 'string' && label.trim().length > 0) return label.trim();
    }
    return String(value ?? '').trim();
  }

  private isDemandeCreatedByConnectedUser(
    demande: Demande | any,
    connectedUsername: string,
    connectedFullName: string
  ): boolean {
    const rawCandidates: unknown[] = [
      demande?.userinput,
      demande?.createdBy,
      demande?.createdby,
      demande?.createBy,
      demande?.created_by,
      demande?.demandeur,
      demande?.createur,
      demande?.creator,
      demande?.user,
      demande?.utilisateur
    ];

    const creatorNames = rawCandidates
      .flatMap((candidate) => {
        if (typeof candidate === 'string') return [candidate];
        if (candidate && typeof candidate === 'object') {
          const obj = candidate as Record<string, unknown>;
          return [
            obj['username'],
            obj['userName'],
            obj['name'],
            obj['nom'],
            obj['fullName'],
            obj['fullname'],
            obj['nomComplet'],
            obj['nom_complet'],
            obj['login']
          ].filter((v): v is string => typeof v === 'string');
        }
        return [];
      })
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.length > 0);

    if (!creatorNames.length) {
      return false;
    }

    const connectedVariants = this.buildIdentityVariants([
      connectedUsername,
      connectedFullName,
    ]);
    if (!connectedVariants.size) {
      return false;
    }

    return creatorNames.some((name) => {
      const creatorVariants = this.buildIdentityVariants([name]);
      for (const v of creatorVariants) {
        if (connectedVariants.has(v)) {
          return true;
        }
      }
      return false;
    });
  }

  private buildIdentityVariants(values: Array<string | null | undefined>): Set<string> {
    const out = new Set<string>();

    const push = (value: string): void => {
      const base = this.normalizeIdentity(value);
      if (!base) return;
      out.add(base);

      // Variante sans domaine si format email/login domaine.
      const atIdx = base.indexOf('@');
      if (atIdx > 0) {
        out.add(base.slice(0, atIdx));
      }

      // Variante sans préfixe domaine: "DOMAINE\\user" ou "domaine/user".
      const slashParts = base.split(/[\\/]/).filter(Boolean);
      if (slashParts.length > 1) {
        out.add(slashParts[slashParts.length - 1]);
      }

      // Variante simplifiée sans séparateurs (utile pour "amadou.ndongo" vs "amadoundongo").
      out.add(base.replace(/[.\-_ ]+/g, ''));
    };

    for (const raw of values) {
      const v = String(raw ?? '').trim();
      if (!v) continue;
      push(v);
    }
    return out;
  }

  private normalizeIdentity(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Workflow de validation d'une demande.
   * Backend : POST /demande/{demandeId}/validations/valider?action={action}
   * Body : { commentaire: string }
   */
  validerDemande(demandeId: number, action: string, commentaire: string): Observable<any> {
    const body = { commentaire: (commentaire ?? '').trim() };
    const safeAction = encodeURIComponent(action);

    return this.http.post(
      `${this.apiUrl}/demande/${demandeId}/validations/valider?action=${safeAction}`,
      body,
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Rejet d'une demande.
   * POST /api/evolution/demande/{demandeId}/validations/rejeter
   * Body : { commentaire: string }
   */
  rejeterDemande(demandeId: number, commentaire: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/demande/${demandeId}/validations/rejeter`,
      { commentaire: (commentaire ?? '').trim() },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Retourner une demande vers l'expéditeur.
   * POST /api/evolution/demande/{demandeId}/retourner-demande
   * Body : { id: number, commentaire: string }
   */
  retournerDemande(demandeId: number, commentaire: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/demande/${demandeId}/retourner-demande`,
      { id: Number(demandeId), commentaire: (commentaire ?? '').trim() },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Resoumettre une demande après correction.
   * POST /api/evolution/demande/{demandeId}/resoumettre
   */
  resoumettreDemande(demandeId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/demande/${demandeId}/resoumettre`,
      {},
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Soumettre explicitement une demande après création.
   * POST /api/evolution/demande/soumettre/{demandeId}
   */
  soumettreDemande(demandeId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/demande/soumettre/${demandeId}`,
      {},
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Récupérer mes demandes (utilisateur connecté)
  getMyDemandes(): Observable<Demande[]> {
    return this.http.get<Demande[]>(
      `${this.apiUrl}/demande/liste-demande-me`
    );
  }

  // Créer une nouvelle demande
  addDemande(
    payload: { objet: string; description: string; departement: string; typedemande: string },
    codenp: string,
    codeapp: string,
    typedemandeId?: number
  ): Observable<Demande> {
    const params = new URLSearchParams();
    if (codenp != null && String(codenp).trim() !== '') params.set('codenp', String(codenp).trim());
    if (codeapp != null && String(codeapp).trim() !== '') params.set('codeapp', String(codeapp).trim());
    if (Number.isFinite(Number(typedemandeId))) params.set('typedemande', String(Number(typedemandeId)));
    const query = params.toString();
    const url = query
      ? `${this.apiUrl}/demande/create-demande?${query}`
      : `${this.apiUrl}/demande/create-demande`;

    return this.http.post<Demande>(
      url,
      {
        objet: payload.objet,
        description: payload.description,
        departement: payload.departement,
        typedemande: payload.typedemande,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // listerDemandeByCodeapp(codeapp: string): Observable<Demande[]> {
  //   return this.http.get<Demande[]>(
  //     `${this.apiUrl}/demande/liste-demande-by-codeapp?codeapp=${codeapp}`
  //   );
  // } 
  listeAppp (): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/parametre/liste-application`
    );
  }
   listeNiveauPriorite (): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/parametre/liste-niveau-priorite`
    );
  }

  getTypeDemandes(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/typedemande`
    );
  }

  getTypeDemandeChamps(typeId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/typedemande/${typeId}/champs`
    );
  }


  // Récupérer une demande par ID
  getDemande(id: number): Observable<Demande> {
    return this.http.get<Demande>(
      `${this.apiUrl}/demande/demandedetail/${id}`
    );
  }

  /**
   * Changer le statut final d'une demande (ex: LIVRE, TEST, PREPROD).
   * POST /api/evolution/demande/demande-resolue
   * Body : { id: number, code: string }
   */
  marquerResolue(id: number, code: string): Observable<any> {
    const demandeId = Number(id);
    const statutCode = (code ?? '').trim().toUpperCase();
    const url = `${this.apiUrl}/demande/demande-resolue`;

    const postResolue = (payload: Record<string, unknown>) =>
      this.http.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        observe: 'response',
        responseType: 'text'
      }).pipe(map((res) => this.parseTextResponse(res.body)));

    const postResolueWithQuery = (query: Record<string, string>) =>
      this.http.post(url, null, {
        params: new HttpParams({ fromObject: query }),
        observe: 'response',
        responseType: 'text'
      }).pipe(map((res) => this.parseTextResponse(res.body)));

    // Certains backends exposent des contrats différents pour cette route.
    // On tente plusieurs payloads avant d'échouer définitivement.
    return postResolue({ id: demandeId, code: statutCode }).pipe(
      catchError(() =>
        postResolue({ demandeId, statutFinal: statutCode }).pipe(
          catchError(() =>
            postResolue({ demandeId, code: statutCode }).pipe(
              catchError(() =>
                postResolue({ idDemande: demandeId, codeStatutFinal: statutCode }).pipe(
                  catchError(() =>
                    postResolueWithQuery({ id: String(demandeId), code: statutCode }).pipe(
                      catchError(() =>
                        postResolueWithQuery({
                          demandeId: String(demandeId),
                          statutFinal: statutCode
                        })
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  private parseTextResponse(body: unknown): any {
    const text = (body ?? '').toString().trim();
    if (!text) return { message: 'Statut final mis à jour.' };
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  /**
   * Liste des commentaires d'une demande.
   * GET /api/evolution/commentaire/{id}/commentaires
   */
  getCommentaires(demandeId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/commentaire/${demandeId}/commentaires`
    );
  }

  /**
   * Ajouter un commentaire à une demande.
   * POST /api/evolution/commentaire/{id}/add-commentaire
   * Body : { texte: string }
   */
  addCommentaire(demandeId: number, texte: string): Observable<any> {
    const value = (texte ?? '').trim();
    return this.http.post<unknown>(
      `${this.apiUrl}/commentaire/${demandeId}/add-commentaire`,
      { texte: value },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  /**
   * Modifier une demande existante.
   * PUT /api/evolution/demande/demande-update
   * Body JSON : { id, objet, description, niveauPrioriteId }
   */
  editDemande(update: { id: number; objet: string; description: string; niveauPrioriteId: number; typeDemande: string; departement: string; codeapp: string; codenp: string }): Observable<Demande> {
    return this.http.put<Demande>(
      `${this.apiUrl}/demande/demande-update`,
      {
        id: Number(update.id),
        objet: update.objet,
        description: update.description,
        niveauPrioriteId: Number(update.niveauPrioriteId),
        // Compat backend: certains endpoints attendent "typedemande"
        typedemande: update.typeDemande,
        typeDemande: update.typeDemande,
        departement: update.departement,
        codeapp: update.codeapp,
        codenp: update.codenp,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Changer uniquement le type d'une demande.
   * PUT /api/evolution/demande/{id}/changer-type
   */
  changerTypeDemande(demandeId: number, typeDemande: string): Observable<any> {
    const id = Number(demandeId);
    const type = String(typeDemande || '').trim().toUpperCase();
    const safeType = encodeURIComponent(type);
    return this.http.put(
      `${this.apiUrl}/demande/${id}/changer-type?id=${id}&type=${safeType}`,
      null
    );
  }

  // Ajouter un document à une demande
  addDocument(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(
      `${this.apiUrl}/demande/${id}/add-document`,
      formData
    );
  }

  // Supprimer une demande
  deleteDemande(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/demande/${id}`
    );
  }

  // Récupérer les données du dashboard
  getDashboard(): Observable <Dashboard> {
    return this.http.get<Dashboard>(
      `${this.apiUrl}/dashboard`
    );
  }

  // Filtrer les demandes par statut
  getDemandsByStatus(status: string): Observable<Demande[]> {
    return this.http.get<Demande[]>(
      `${this.apiUrl}/demande/liste-demande-all?status=${status}`
    );
  }

  // Rechercher des demandes
  searchDemandes(keyword: string): Observable<Demande[]> {
    return this.http.get<Demande []>(
      `${this.apiUrl}/demande/liste-demande-all?search=${keyword}`
    );
  }

  // Récupérer la liste des statuts disponibles
  getListeStatut(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/demande/liste-statut`
    );
  }
}


