import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';
import { NotificationService } from '../../../../services/notification.service';
import { Demande } from '../../models/demande';
import { DemandeService } from '../../services/demande-service';
import { AuthService } from '../../../../core/service/auth.service';
import { Role } from '../../../../core/models/role';

@Component({
  selector: 'app-mes-demandes',
  templateUrl: './mes-demandes.html',
  styleUrls: ['./mes-demandes.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class MesDemandes implements OnInit, OnDestroy {

  private routerSub?: Subscription;

  demandes: Demande[] = [];
  filteredDemandes: Demande[] = [];
  availableStatuses: any[] = [];
  availableApplications: any[] = [];
  statusFilterOptions: Array<{ value: string; label: string }> = [];
  applicationFilterOptions: Array<{ value: string; label: string }> = [];
  searchTerm: string = '';
  selectedType: string = '';
  selectedStatus: string = '';
  loading = false;
  errorMessage = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  readonly Math = Math;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDemandes.length / this.itemsPerPage));
  }

  get paginatedDemandes(): Demande[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredDemandes.slice(start, start + this.itemsPerPage);
  }

  private loadingTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router, 
    private demandeService: DemandeService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}
  
  goToAddDemande() {
    this.router.navigate(['/demandes/nouvelle']);
  }

  goToDetail(id: number) {
    this.router.navigate(['/demandes', id]);
  }

  goToEdit(id: number) {
    this.router.navigate(['/edit-demande', id]);
  }


  onDelete(demande: Demande) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la demande "${demande.objet}" ?`)) {
      this.demandeService.deleteDemande(demande.id).subscribe({
        next: () => {
          this.notificationService.show('Demande supprimée avec succès', 'success', 3000);
          this.loadDemandes(); // Recharger la liste
        },
        error: (err) => {
          console.error('Erreur lors de la suppression:', err);
          this.notificationService.show('Erreur lors de la suppression de la demande', 'error', 5000);
        }
      });
    }
  } 

  ngOnInit(): void {
    // Charger la liste des statuts et applications disponibles
    this.loadAvailableStatuses();
    this.loadAvailableApplications();
    // Charger les demandes immédiatement
    this.loadDemandes();
  }

  getDemandesByEquipeSI(codeEquipe: string): Observable<Demande[]> {
    return this.demandeService.getDemandesByEquipeSI(codeEquipe);
  }



  ngOnDestroy(): void {
    // Nettoyer le timeout si le composant est détruit
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }

  loadDemandes() {
    this.loading = true;
    this.errorMessage = '';
    
    // Nettoyer le timeout précédent s'il existe
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }

    // Timeout de sécurité : si le chargement prend plus de 6 secondes (légèrement supérieur au timeout HTTP)
    this.loadingTimeout = setTimeout(() => {
      console.warn('Timeout de sécurité déclenché - arrêt forcé du loading');
      // FORCER l'arrêt du loading, peu importe l'état
      this.loading = false;
      this.errorMessage = "Le chargement prend trop de temps. Veuillez réessayer.";
      this.cdr.detectChanges(); // Forcer la mise à jour de la vue
      this.notificationService.show(
        "Le chargement des demandes prend trop de temps. Vérifiez votre connexion.",
        'warning',
        5000
      );
    }, 6000); // 6 secondes (légèrement supérieur au timeout HTTP de 5s)

    // Charge toutes les demandes sans distinction de rôle
    this.demandeService.getDemandesList()
      .pipe(
        timeout(5000), // Timeout de 5 secondes pour la requête HTTP
        catchError((err) => {
          console.error('Erreur lors du chargement:', err);
          
          // Nettoyer le timeout de sécurité
          if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = undefined;
          }
          
          let errorMessage = "Erreur lors du chargement des demandes";
          if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('Timeout')) {
            errorMessage = "Le serveur met trop de temps à répondre. Veuillez réessayer.";
          } else if (err.status === 0 || !err.status) {
            errorMessage = "Impossible de se connecter au serveur. Vérifiez votre connexion.";
          }
          
          this.errorMessage = errorMessage;
          this.notificationService.show(errorMessage, 'error', 5000);
          return of([]); // Retourner un tableau vide en cas d'erreur
        }),
        finalize(() => {
          // GARANTIR que le loading s'arrête TOUJOURS, même en cas d'erreur
          console.log('Finalize appelé - arrêt du loading');
          this.loading = false;
          
          // Nettoyer le timeout de sécurité
          if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = undefined;
          }
          
          // Forcer la détection de changement pour mettre à jour la vue
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          console.log('Données reçues :', data);  
          this.demandes = Array.isArray(data) ? data : [];

          // Trier par ordre décroissant (plus récentes en premier)
          this.demandes.sort((a, b) => {
            const dateA = new Date(a.datecreate).getTime();
            const dateB = new Date(b.datecreate).getTime();
            return dateB - dateA; // Ordre décroissant
          });
          this.statusFilterOptions = this.buildAvailableStatusesForFilter();
          this.applyFilters();
          // Forcer la mise à jour de la vue
          this.cdr.detectChanges();
        },
        error: (err) => {
          // Cette erreur devrait être gérée par catchError, mais au cas où
          console.error('Erreur non gérée:', err);
          // Le finalize s'occupera de mettre loading à false
        }
      });
  }

  /** Statut à afficher : privilégie le statut final (statutfinal) s'il existe. */
  private getDisplayStatut(raw: any): string {
    if (!raw) return '';
    const d = raw as Record<string, unknown>;
    const finalStatus = d['statutfinal'] ?? d['statutFinal'] ?? d['statut_final'];
    const fromFinal = this.extractStatusCode(finalStatus);
    if (fromFinal) return fromFinal;
    const current = d['statut'];
    const fromCurrent = this.extractStatusCode(current);
    if (fromCurrent) return fromCurrent;
    return '';
  }

  private extractStatusCode(value: unknown): string {
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

  private normalizeCodeKey(input: unknown): string {
    return String(input ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, ''); // supprime espaces, underscores, tirets, etc.
  }

  private getBackendStatusLabel(statusCode: string): string | null {
    const code = (statusCode || '').toString().trim();
    if (!code) return null;
    const upper = code.toUpperCase().replace(/\s+/g, '_');
    const key = this.normalizeCodeKey(upper);

    // Alias pour compatibilité entre anciens / nouveaux codes
    const aliasMap: Record<string, string> = {
      'EN_COURS_DE_TRAITEMENT_SI': 'ENCOURS_CHEZ_SI',
      'EN_COURS_DE_TRAITEMENT_ADMIN': 'ENCOURS_CHEZ_ADMIN',
      'EN_COURS_DE_TRAITEMENT_PARTENAIRE': 'ENCOURS_CHEZ_PARTENAIRE',
      'VALIDEE': 'ACCEPTE',
      'REJETE': 'REJECTED',
    };
    const alias = aliasMap[upper];
    const aliasKey = alias ? this.normalizeCodeKey(alias) : '';

    const list = Array.isArray(this.availableStatuses) ? this.availableStatuses : [];
    for (const s of list) {
      if (s == null) continue;
      if (typeof s === 'string') {
        const sUpper = s.toUpperCase().replace(/\s+/g, '_');
        const sKey = this.normalizeCodeKey(sUpper);
        if (sKey === key || (aliasKey && sKey === aliasKey)) return s;
        continue;
      }
      if (typeof s === 'object') {
        const o = s as Record<string, unknown>;
        const rawCode = o['code'] ?? o['statut'] ?? o['name'] ?? o['nom'];
        const rawLabel = o['libelle'] ?? o['label'] ?? o['nom'] ?? o['name'];
        const c = String(rawCode ?? '').toUpperCase().replace(/\s+/g, '_');
        const cKey = this.normalizeCodeKey(c);
        if (cKey === key || (aliasKey && cKey === aliasKey)) {
          const label = String(rawLabel ?? '').trim();
          return label.length > 0 ? label : code;
        }
      }
    }
    return null;
  }

  getStatusClassFromDemande(demande: Demande | any): string {
    const statut = this.getDisplayStatut(demande);
    if (!statut) return 'badge-status-default';
    const normalized = statut
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');

    // Aligner les codes backend avec les classes CSS déjà définies.
    const classAliasMap: Record<string, string> = {
      CREE: 'initie',
      CREATED: 'initie',
      ENCOURS: 'demande_soumis',
      EN_COURS: 'demande_soumis',
      SUBMITED: 'demande_soumis',
      SUBMITTED: 'demande_soumis',
      ENCOURS_CHEZ_SI: 'en_cours_de_traitement_si',
      ENCOURS_CHEZ_ADMIN: 'admin_encours',
      ENCOURS_CHEZ_PARTENAIRE: 'partenaire_encours',
      RETOURNER_SI: 'retourner_si',
      RETOUR_A_L_EQUIPE_SI: 'retourner_si',
    };

    const classKey = classAliasMap[normalized] ?? normalized.toLowerCase();
    return `badge-status-${classKey}`;
  }

  getStatusIcon(statut: string): string {
    if (!statut) return 'bi-circle';
    const normalized = statut.toUpperCase().replace(/\s+/g, '_');
    const statusMap: Record<string, string> = {
      'CREE': 'bi-circle',
      'CREÉ': 'bi-circle',
      'CREEE': 'bi-circle',
      'EN_COURS': 'bi-clock-history',
      'ENCOURS': 'bi-clock-history',
      ' ACCEPTÉ': 'bi-check-circle-fill',
      'ACCEPTÉE': 'bi-check-circle-fill',
      'VALIDÉ': 'bi-check-circle-fill',
      'VALIDÉE': 'bi-check-circle-fill',
      'VALIDER': 'bi-check-circle-fill',
      'VALIDEE': 'bi-check-circle-fill',
      'REJECTED': 'bi-x-circle-fill',
      'A_CORRIGER_PAR_DEMANDEUR': 'bi-pencil-square',
      'RETOURNER_SI': 'bi-arrow-return-left',
      'RETOUR_A_L_EQUIPE_SI': 'bi-arrow-return-left',
      'EN_ATTENTE': 'bi-hourglass-split',
      'ENATTENTE': 'bi-hourglass-split',
      'EN ATTENTE': 'bi-hourglass-split',
      'EN_COURS_CHEZ_SI': 'bi-clock-history',
      'EN_COURS_CHEZ_ADMIN': 'bi-clock-history',
      'EN_COURS_CHEZ_PARTENAIRE': 'bi-clock-history',
      'EN_COURS_DE_TRAITEMENT_SI': 'bi-clock-history',
      'EN_COURS_DE_TRAITEMENT_ADMIN': 'bi-clock-history',
      'EN_COURS_DE_TRAITEMENT_PARTENAIRE': 'bi-clock-history',
    };
    return statusMap[normalized] || 'bi-circle';
  }

  getStatusLabelFromDemande(demande: Demande | any): string {
    const statut = this.getDisplayStatut(demande);
    if (!statut) return 'Inconnu';
    const upper = (statut || '')
      .toString()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');

    // Priorité aux libellés métier voulus, sans être écrasés par les libellés backend.
    if (upper === 'CREE' || upper === 'CREEE' || upper === 'CREATED' || upper === 'INITIE' || upper === 'INITIEE' || upper === 'INITIATED') {
      return 'Demande initiée';
    }
    if (
      upper === 'ENCOURS' ||
      upper === 'EN_COURS' ||
      upper === 'SUBMITED' ||
      upper === 'SUBMITTED' ||
      upper === 'SOUMIS' ||
      upper === 'SOUMISE'
    ) {
      return 'Demande soumise';
    }
    if (upper === 'RETOURNER_SI' || upper === 'RETOUR_A_L_EQUIPE_SI') {
      return "Retour à l'équipe SI";
    }
    const fromApi = this.getBackendStatusLabel(statut);
    if (fromApi) return fromApi;
    return upper.replace(/_/g, ' ');
  }

  getStatusLabel(statut: unknown): string {
    if (statut == null) return 'Inconnu';
    return this.getStatusLabelFromDemande({ statut });
  }

  getPriorityClass(priority: string): string {
    if (!priority) return 'badge-priority-default';
    const normalized = priority.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    return `badge-priority-${normalized}`;
  }

  getPriorityIcon(priority: string): string {
    if (!priority) return 'bi-dash-circle';
    const normalized = priority.toUpperCase().replace(/\s+/g, '_');
    const priorityMap: Record<string, string> = {
      'NON_URGENT': 'bi-arrow-down-circle',
      'NONURGENT': 'bi-arrow-down-circle',
      'MOYEN': 'bi-dash-circle',
      'NORMAL': 'bi-dash-circle',
      'ELEVE': 'bi-arrow-up-circle',
      'ÉLEVÉ': 'bi-arrow-up-circle',
      'ELEVEE': 'bi-arrow-up-circle',
      'URGENT': 'bi-exclamation-triangle-fill'
    };
    return priorityMap[normalized] || 'bi-dash-circle';
  }

  getPriorityLabel(priority: string): string {
    if (!priority) return 'Normal';
    const normalized = priority.toUpperCase().replace(/_/g, ' ');
    const labelMap: Record<string, string> = {
      'NON_URGENT': 'Non urgent',
      'MOYEN': 'Moyen',
      'NORMAL': 'Normal',
      'ELEVE': 'Élevé',
      'URGENT': 'Urgent'
    };
    return labelMap[priority.toUpperCase()] || normalized;
  }

  applyFilters(): void {
    this.currentPage = 1; // Réinitialiser la page lors d'un changement de filtre
    const search = (this.searchTerm || '').trim().toLowerCase();
    const type = (this.selectedType || '').trim();
    const status = (this.selectedStatus || '').trim();

    this.filteredDemandes = this.demandes.filter(demande => {
      const matchesSearch = !search ||
        (demande.objet || '').toLowerCase().includes(search) ||
        (demande.description || '').toLowerCase().includes(search);

      const appStr = this.getApplicationString(demande.application);
      const matchesType = !type ||
        appStr.toLowerCase() === type.toLowerCase() ||
        type.toLowerCase() === appStr.toLowerCase();

      const statutStr = this.getDisplayStatut(demande).toString().trim();
      const statusNorm = status.toLowerCase();
      const statutNorm = statutStr.toLowerCase();
      const matchesStatus = !status ||
        statutNorm === statusNorm ||
        (this.getBackendStatusLabel(statutStr) || this.getStatusLabelFromDemande(demande)).toLowerCase() === statusNorm;

      return matchesSearch && matchesType && matchesStatus;
    });
    // Évite de déclencher une boucle de change detection
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  private getApplicationString(app: string | unknown): string {
    if (app == null) return '';
    if (typeof app === 'string') return app.trim();
    if (typeof app === 'object' && app !== null) {
      const o = app as Record<string, unknown>;
      return String(o['nom'] ?? o['libelle'] ?? o['code'] ?? o['name'] ?? '').trim();
    }
    return String(app).trim();
  }

  private getBackendApplicationLabel(appCode: string): string | null {
    const code = (appCode || '').toString().trim();
    if (!code) return null;
    const upper = code.toUpperCase().replace(/\s+/g, '_');
    const key = this.normalizeCodeKey(upper);

    const list = Array.isArray(this.availableApplications) ? this.availableApplications : [];
    for (const a of list) {
      if (a == null) continue;
      if (typeof a === 'string') {
        const aUpper = a.toUpperCase().replace(/\s+/g, '_');
        const aKey = this.normalizeCodeKey(aUpper);
        if (aKey === key) return a;
        continue;
      }
      if (typeof a === 'object') {
        const o = a as Record<string, unknown>;
        const rawCode = o['code'] ?? o['nom'] ?? o['name'];
        const rawLabel = o['libelle'] ?? o['label'] ?? o['nom'] ?? o['name'];
        const c = String(rawCode ?? '').toUpperCase().replace(/\s+/g, '_');
        const cKey = this.normalizeCodeKey(c);
        if (cKey === key) {
          const label = String(rawLabel ?? '').trim();
          return label.length > 0 ? label : code;
        }
      }
    }
    return null;
  }

  getUniqueApplications(): string[] {
    const apps = this.demandes.map(d => this.getApplicationString(d.application)).filter(Boolean);
    return [...new Set(apps)].sort((a, b) => a.localeCompare(b));
  }

  getUniqueStatuses(): string[] {
    const statuses = this.demandes.map(d => (d.statut || '').toString().trim()).filter(Boolean);
    return [...new Set(statuses)].sort((a, b) => a.localeCompare(b));
  }

  private buildAvailableApplicationsForFilter(): Array<{ value: string; label: string }> {
    // N'afficher que la liste disponible sur le backend
    const list = Array.isArray(this.availableApplications) ? this.availableApplications : [];
    const items: Array<{ value: string; label: string }> = [];

    for (const a of list) {
      if (a == null) continue;
      if (typeof a === 'string') {
        const val = a.trim();
        if (val) items.push({ value: val, label: val });
        continue;
      }
      if (typeof a === 'object') {
        const o = a as Record<string, unknown>;
        const code = String(o['code'] ?? o['name'] ?? o['nom'] ?? '').trim();
        const label = String(o['libelle'] ?? o['label'] ?? o['nom'] ?? o['name'] ?? code).trim();
        if (code) items.push({ value: code, label: label || code });
      }
    }

    const seen = new Set<string>();
    const unique = items.filter((it) => {
      const key = it.value.toUpperCase().replace(/\s+/g, '_');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.sort((a, b) => a.label.localeCompare(b.label));
  }

  private buildAvailableStatusesForFilter(): Array<{ value: string; label: string }> {
    // Utiliser la liste backend + les statuts réellement présents dans les demandes chargées
    const list = Array.isArray(this.availableStatuses) ? this.availableStatuses : [];
    const items: Array<{ value: string; label: string }> = [];

    for (const s of list) {
      if (s == null) continue;
      if (typeof s === 'string') {
        const val = s.trim();
        if (val) items.push({ value: val, label: val });
        continue;
      }
      if (typeof s === 'object') {
        const o = s as Record<string, unknown>;
        const code = String(o['code'] ?? o['statut'] ?? o['name'] ?? o['nom'] ?? '').trim();
        const label = String(o['libelle'] ?? o['label'] ?? o['nom'] ?? o['name'] ?? code).trim();
        if (code) items.push({ value: code, label: label || code });
      }
    }

    // Ajouter les statuts existants dans les demandes (ex: A_CORRIGER_PAR_DEMANDEUR)
    for (const demande of this.demandes) {
      const value = this.getDisplayStatut(demande);
      if (!value) continue;
      const label = this.getStatusLabelFromDemande(demande);
      items.push({ value, label: label || value });
    }

    const seen = new Set<string>();
    const unique = items.filter((it) => {
      const key = it.value.toUpperCase().replace(/\s+/g, '_');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.sort((a, b) => a.label.localeCompare(b.label));
  }

  getApplicationDisplay(app: string | unknown): string {
    const codeOrName = this.getApplicationString(app);
    if (!codeOrName) return '—';
    return this.getBackendApplicationLabel(codeOrName) || codeOrName;
  }

  loadAvailableStatuses(): void {
    this.demandeService.getListeStatut().subscribe({
      next: (data) => {
        console.log('Statuts disponibles:', data);
        this.availableStatuses = Array.isArray(data) ? data : [];
        this.statusFilterOptions = this.buildAvailableStatusesForFilter();
        // si le statut sélectionné n'existe plus côté backend, on reset
        if (this.selectedStatus && !this.statusFilterOptions.some((s) => s.value === this.selectedStatus)) {
          this.selectedStatus = '';
        }
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des statuts:', err);
        this.availableStatuses = [];
        this.statusFilterOptions = [];
      }
    });
  }

  loadAvailableApplications(): void {
    this.demandeService.listeAppp().subscribe({
      next: (data) => {
        console.log('Applications disponibles:', data);
        this.availableApplications = Array.isArray(data) ? data : [];
        this.applicationFilterOptions = this.buildAvailableApplicationsForFilter();
        if (this.selectedType && !this.applicationFilterOptions.some((a) => a.value === this.selectedType)) {
          this.selectedType = '';
        }
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des applications:', err);
        this.availableApplications = [];
        this.applicationFilterOptions = [];
      }
    });
  }

  getCreatedByName(demande: Demande): string {
    const demandeRecord = demande as unknown as Record<string, unknown>;

    // 1) Priorité explicite à userinput (ce que tu veux afficher)
    const userInput = demandeRecord['userinput'];
    if (typeof userInput === 'string' && userInput.trim().length > 0) {
      return userInput.trim();
    }

    // 2) Sinon, on tente les autres champs possibles
    const possibleCreator =
      demandeRecord['createdBy'] ??
      demandeRecord['createdby'] ??
      demandeRecord['createBy'] ??
      demandeRecord['created_by'] ??
      demandeRecord['demandeur'] ??
      demandeRecord['createur'] ??
      demandeRecord['creator'] ??
      demandeRecord['user'] ??
      demandeRecord['utilisateur'];

    if (typeof possibleCreator === 'string' && possibleCreator.trim().length > 0) {
      return possibleCreator.trim();
    }

    if (possibleCreator && typeof possibleCreator === 'object') {
      const creatorObject = possibleCreator as Record<string, unknown>;

      const fullName =
        creatorObject['fullName'] ??
        creatorObject['fullname'] ??
        creatorObject['nomComplet'] ??
        creatorObject['nom_complet'];

      if (typeof fullName === 'string' && fullName.trim().length > 0) {
        return fullName.trim();
      }

      const firstName =
        creatorObject['prenom'] ??
        creatorObject['firstName'] ??
        creatorObject['firstname'];

      const lastName =
        creatorObject['nom'] ??
        creatorObject['lastName'] ??
        creatorObject['lastname'];

      const composedName = [firstName, lastName]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.trim())
        .join(' ');

      if (composedName.length > 0) {
        return composedName;
      }

      const single = creatorObject['nom'] ?? creatorObject['username'] ?? creatorObject['userName'] ?? creatorObject['name'] ?? creatorObject['login'];
      if (typeof single === 'string' && single.trim().length > 0) {
        return single.trim();
      }
    }

    return '—';
  }
}


