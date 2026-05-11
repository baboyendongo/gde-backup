import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../services/notification.service';
import { StatistiqueService,  ValidationAction } from '../../../statistique/services/statistique-service';
import { AuthService } from '../../../../core/service/auth.service';
import { Role } from '../../../../core/models/role';
import { DemandeService } from '../../services/demande-service';


@Component({
  selector: 'app-detail-demande',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './detail-demande.html',
  styleUrl: './detail-demande.css',
})
export class DetailDemande implements OnInit {


  demande: any = null;
  isLoading = true;
  activeTab = 'commentaires';
  newComment = '';
  availableStatuses: any[] = [];
  validationCommentaire: any;
  validationAction: any;
  isValidating: any;
  openValidationModal = false; // Ajouter cette propriété
  validationType: 'VALIDATION' | 'REJET' = 'VALIDATION';
  openResolueModal = false;
  resolueCode = '';
  resolueCommentaire = '';
  readonly resolueCodes: string[] = ['LIVRE', 'TEST', 'PREPROD'];
  availableFinalStatuses: any[] = [];
  isSubmittingResolue = false;
  isResoumitting = false;
  isSubmittingInitialDemande = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private demandeService: DemandeService,
    private notificationService: NotificationService,
    private statistiqueService: StatistiqueService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef // Injecter ChangeDetectorRef
  ) { }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    // Utiliser setTimeout pour éviter l'erreur ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      // Charger la liste des statuts pour afficher les libellés (backend)
      this.demandeService.getListeStatut().subscribe({
        next: (list) => {
          this.availableStatuses = Array.isArray(list) ? list : [];
          this.cdr.detectChanges();
        },
        error: () => {
          this.availableStatuses = [];
        }
      });
      this.demandeService.getListeStatutFinal().subscribe({
        next: (list) => {
          this.availableFinalStatuses = Array.isArray(list) ? list : [];
          this.cdr.detectChanges();
        },
        error: () => {
          this.availableFinalStatuses = [];
        }
      });

      this.demandeService.getDemande(id).subscribe({
        next: (data) => {
          this.demande = data;
          this.loadCommentaires(id);
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Erreur lors du chargement de la demande:', err);
          this.isLoading = false;
          if (!this.demande) {
            this.notificationService.show('Erreur lors du chargement de la demande', 'error', 5000);
          }
          this.cdr.detectChanges();
        }
      });
    }, 0);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  goToEdit(): void {
    if (this.demande) {
      this.router.navigate(['/edit-demande', this.demande.id]);
    }
  }

  canEditDemande(): boolean {
    if (!this.demande) return false;
    if (!this.isCurrentUserCreator()) return false;
    const status = this.normalizeStatusKey(this.getDisplayStatut());
    if (!status) return false;

    // Règle métier: édition autorisée uniquement pour brouillon INITIÉ
    // ou demande retournée au demandeur.
    return status === 'CREE'
      || status === 'CREATED'
      || status === 'INITIE'
      || status === 'INITIEE'
      || status === 'INITIATED'
      || status === 'A_CORRIGER_PAR_DEMANDEUR'
      || status === 'RETOURNER_SI'
      || status === 'RETOURNER_AU_SI'
      || status === 'RETOUR_SI'
      || status === 'RETOUR_A_L_EQUIPE_SI';
  }

  private normalizeStatusKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
  }

  canSIToggleTypeDemande(): boolean {
    // Changement de type explicitement désactivé.
    return false;
  }

  getNextTypeDemandeLabel(): string {
    const current = this.getCurrentTypeDemande();
    if (current === 'PARAMETRABLE') return 'Évolution';
    if (current === 'EVOLUTION') return 'Paramétrage';
    return 'Type';
  }

  toggleTypeDemandeBySI(): void {
    // Garde-fou: même en appel direct, on bloque l'action.
    this.notificationService.show(
      'Le changement du type de demande est désactivé.',
      'warning',
      3500
    );
  }

  private getCurrentTypeDemande(): string {
    return String(this.demande?.typedemande ?? this.demande?.typeDemande ?? '')
      .toUpperCase()
      .trim();
  }

  private normalizeSimpleKey(v: unknown): string {
    return String(v ?? '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .trim();
  }
  
//   valider(demandeId: number) {
//   const commentaire = this.validationCommentaire;

//   this.demandeService.validerDemande(demandeId, this.validationAction, commentaire)
//     .subscribe({
//       next: (response) => {
//         console.log('Demande validée avec succès', response);
//         alert('Demande validée avec succès');
//       },
//       error: (err) => {
//         console.error('Erreur lors de la validation', err);
//         alert('Erreur lors de la validation');
//       }
//     });
// }

 
  getStatusClass(statut: string): string {
    if (!statut) return 'badge-status-default';
    const normalized = (statut || '').toString().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    return `badge-status-${normalized}`;
  }

  getStatusLabel(statut: string): string {
    if (!statut) return 'Inconnu';
    const labelMap: Record<string, string> = {
      'CREE': 'Demande initiée', 'CREÉ': 'Demande initiée', 'CREEE': 'Demande initiée', 'CREATED': 'Demande initiée',
      'INITIE': 'Initiée', 'INITIEE': 'Initiée', 'INITIATED': 'Initiée',
      'SUBMITED': 'Demande soumise', 'SUBMITTED': 'Demande soumise', 'SOUMIS': 'Demande soumise', 'SOUMISE': 'Demande soumise',
      'EN_COURS': 'En cours', 'ENCOURS': 'En cours',
      'TERMINE': 'Terminées', 'TERMINÉ': 'Terminées', 'TERMINEE': 'Terminées', 'DONE': 'Terminées',
      'EN_ATTENTE': 'En attente', 'ENATTENTE': 'En attente'
    };
    return labelMap[(statut || '').toString().toUpperCase().replace(/\s+/g, '_')] || (statut || '').toString();
  }

  /** Statut à afficher dans le détail : privilégie le statut final (statutfinal) s'il existe. */
  getDisplayStatut(): string {
    if (!this.demande) {
      return '';
    }
    const d = this.demande as Record<string, unknown>;
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

  getPriorityClass(priority: string): string {
    if (!priority) return 'badge-priority-default';
    const normalized = (priority || '').toString().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    return `badge-priority-${normalized}`;
  }

  getPriorityLabel(priority: string): string {
    if (!priority) return 'Normal';
    const labelMap: Record<string, string> = {
      'NON_URGENT': 'Non urgent', 'NONURGENT': 'Non urgent',
      'NORMAL': 'Normal', 'ELEVE': 'Élevé', 'ÉLEVÉ': 'Élevé', 'ELEVEE': 'Élevé',
      'URGENT': 'Urgent'
    };
    return labelMap[(priority || '').toString().toUpperCase().replace(/\s+/g, '_')] || (priority || '').toString();
  }

  getApplicationDisplay(app: string | unknown): string {
    const s = this.getApplicationString(app);
    return s || '—';
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

  /** Affiche le nom de l'utilisateur qui a créé la demande. */
  getCreatedByName(): string {
    if (!this.demande) return '—';
    const d = this.demande as Record<string, unknown>;

    // 1) Priorité explicite à userinput, comme demandé
    const userInput = d['userinput'];
    if (typeof userInput === 'string' && userInput.trim().length > 0) {
      return userInput.trim();
    }

    // 2) Sinon, on tente les autres champs possibles
    const possibleCreator =
      d['createdBy'] ?? d['createdby'] ?? d['createBy'] ?? d['created_by'] ??
      d['demandeur'] ?? d['createur'] ?? d['creator'] ?? d['user'] ?? d['utilisateur'];
    if (typeof possibleCreator === 'string' && possibleCreator.trim().length > 0) return possibleCreator.trim();
    if (possibleCreator && typeof possibleCreator === 'object') {
      const o = possibleCreator as Record<string, unknown>;
      const fullName = o['fullName'] ?? o['fullname'] ?? o['nomComplet'] ?? o['nom_complet'];
      if (typeof fullName === 'string' && fullName.trim().length > 0) return fullName.trim();
      const prenom = o['prenom'] ?? o['firstName'] ?? o['firstname'];
      const nom = o['nom'] ?? o['lastName'] ?? o['lastname'];
      const composed = [prenom, nom].filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim()).join(' ');
      if (composed.length > 0) return composed;
      const single = o['nom'] ?? o['username'] ?? o['userName'] ?? o['name'] ?? o['login'];
      if (typeof single === 'string' && single.trim().length > 0) return single.trim();
    }
    return '—';
  }

  isAddingComment = false;
  selectedCommentFile: File | null = null;
  isUploadingCommentFile = false;

  /** Tout le monde peut commenter une demande affichée. */
  canComment(): boolean {
    return !!this.demande;
  }

  /** Charge les commentaires via GET /commentaire/{id}/commentaires et les met à jour sur la demande. */
  loadCommentaires(demandeId: number): void {
    this.demandeService.getCommentaires(demandeId).subscribe({
      next: (list) => {
        if (this.demande) {
          this.demande.commentaires = Array.isArray(list) ? list : [];
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.demande) {
          this.demande.commentaires = this.demande.commentaires ?? [];
        }
      }
    });
  }

  addComment(): void {
    const texte = this.newComment?.trim();
    if (!texte || !this.demande?.id) return;

    this.isAddingComment = true;
    this.demandeService.addCommentaire(this.demande.id, texte).subscribe({
      next: () => {
        this.newComment = '';
        this.notificationService.show('Commentaire ajouté avec succès', 'success', 3000);
        this.loadCommentaires(this.demande.id);
      },
      error: (err) => {
        const msg =
          err?.error?.message ??
          err?.error?.detail ??
          (Array.isArray(err?.error?.errors) ? err.error.errors.map((e: any) => e?.message ?? e).join(', ') : null) ??
          err?.message ??
          'Erreur lors de l\'ajout du commentaire.';
        this.notificationService.show(String(msg), 'error', 5000);
      },
      complete: () => {
        this.isAddingComment = false;
        this.cdr.detectChanges();
      }
    });
  }

  onCommentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files && input.files.length > 0 ? input.files[0] : null;
    this.selectedCommentFile = file;
  }

  clearSelectedCommentFile(fileInput?: HTMLInputElement): void {
    this.selectedCommentFile = null;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  uploadCommentFile(fileInput?: HTMLInputElement): void {
    if (!this.demande?.id || !this.selectedCommentFile) {
      return;
    }

    this.isUploadingCommentFile = true;
    const demandeId = Number(this.demande.id);
    const file = this.selectedCommentFile;

    this.demandeService.addDocument(demandeId, file).subscribe({
      next: (response) => {
        const msg =
          response?.message ??
          response?.detail ??
          'Fichier ajouté avec succès.';
        this.notificationService.show(String(msg), 'success', 3500);
        this.clearSelectedCommentFile(fileInput);
        // Recharger la demande pour mettre à jour la liste des documents.
        this.demandeService.getDemande(demandeId).subscribe({
          next: (data) => {
            this.demande = data;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        const errorMsg =
          err?.error?.message ??
          err?.error?.detail ??
          err?.message ??
          'Erreur lors de l’ajout du fichier.';
        this.notificationService.show(String(errorMsg), 'error', 5000);
      },
      complete: () => {
        this.isUploadingCommentFile = false;
        this.cdr.detectChanges();
      }
    });
  }

  get historique(): any[] {
    const d = this.demande;
    if (!d) return [];
    const h = d.historique ?? d.historiques ?? d.statutHistorique ?? d.history ?? [];
    if (!Array.isArray(h)) return [];
    const list = [...h];
    list.sort((a, b) => {
      const dateA = this.getHistoriqueDate(a);
      const dateB = this.getHistoriqueDate(b);
      const timeA = dateA ? new Date(dateA).getTime() : 0;
      const timeB = dateB ? new Date(dateB).getTime() : 0;
      return timeB - timeA;
    });
    return list;
  }

  /** Date d'un item historique (backend peut renvoyer datecreate, dateCreate, date, etc.). */
  getHistoriqueDate(item: any): string {
    return (item?.datecreate ?? item?.dateCreate ?? item?.date ?? item?.createdAt ?? '') ?? '';
  }

  /** Utilisateur d'un item historique. */
  getHistoriqueUser(item: any): string {
    return (item?.userinput ?? item?.user ?? item?.username ?? item?.auteur ?? '—') ?? '—';
  }

  getHistoriqueLabel(item: any): string {
    const ancien = this.getStatutLabelFromItem(item, 'ancien');
    const nouveau = this.getStatutLabelFromItem(item, 'nouveau');
    return ancien + ' → ' + nouveau;
  }

  getHistoriqueDescription(item: any): string {
    const raw = item?.commentaire ?? item?.description ?? item?.message;
    if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();

    // Fallback : si ancien statut est null/absent => création
    const ancien = item?.ancienstatut ?? item?.ancienStatut ?? item?.oldStatus ?? item?.old_statut ?? null;
    if (ancien == null) return 'Création de la demande';
    return '';
  }

  private getStatutLabelFromItem(item: any, type: 'ancien' | 'nouveau'): string {
    const statut = type === 'ancien' ? item?.ancienstatut : item?.nouveaustatut;
    if (statut == null) return '—';
    if (typeof statut === 'string') {
      return this.getBackendStatusLabel(statut) || statut;
    }
    const code = (statut.code ?? statut.name ?? statut.nom ?? '') as unknown;
    const label = (statut.libelle ?? statut.label ?? statut.name ?? statut.nom ?? '') as unknown;
    const labelStr = String(label ?? '').trim();
    if (labelStr) return labelStr;
    const codeStr = String(code ?? '').trim();
    return this.getBackendStatusLabel(codeStr) || codeStr || '—';
  }

  private normalizeCodeKey(input: unknown): string {
    return String(input ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '');
  }

  private getBackendStatusLabel(statusCode: string): string | null {
    const code = (statusCode || '').toString().trim();
    if (!code) return null;
    const upper = code.toUpperCase().replace(/\s+/g, '_');
    const key = this.normalizeCodeKey(upper);

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
        const sKey = this.normalizeCodeKey(s);
        if (sKey === key || (aliasKey && sKey === aliasKey)) return s;
        continue;
      }
      if (typeof s === 'object') {
        const o = s as Record<string, unknown>;
        const rawCode = o['code'] ?? o['statut'] ?? o['name'] ?? o['nom'];
        const rawLabel = o['libelle'] ?? o['label'] ?? o['nom'] ?? o['name'];
        const cKey = this.normalizeCodeKey(rawCode);
        if (cKey === key || (aliasKey && cKey === aliasKey)) {
          const label = String(rawLabel ?? '').trim();
          return label.length > 0 ? label : code;
        }
      }
    }
    return null;
  }

  /** Nom de l'utilisateur qui a envoyé le commentaire. */
  getCommentAuteur(c: any): string {
    const v = c?.auteur ?? c?.userinput ?? c?.nom ?? c?.username ?? c?.userName ?? c?.user ?? c?.createdBy ?? '';
    return typeof v === 'string' ? v : (v?.nom ?? v?.username ?? '—') || '—';
  }

  /** Date d'un commentaire. */
  getCommentDate(c: any): string {
    return (c?.dateCreation ?? c?.datecreate ?? c?.date ?? '') as string;
  }

  /** Texte du commentaire. */
  getCommentContenu(c: any): string {
    return (c?.texte ?? c?.contenu ?? c?.commentaire ?? c?.message ?? '') as string;
  }

  getDocumentsList(): any[] {
    const d = this.demande as Record<string, unknown> | null;
    if (!d) return [];
    const docs =
      d['documents'] ??
      d['document'] ??
      d['fichiers'] ??
      d['files'] ??
      [];
    return Array.isArray(docs) ? docs : [];
  }

  getDocumentDisplayName(doc: any): string {
    const explicitName =
      doc?.nomFichier ??
      doc?.nomfichier ??
      doc?.nom ??
      doc?.filename ??
      doc?.fileName ??
      doc?.name;
    if (typeof explicitName === 'string' && explicitName.trim()) {
      return explicitName.trim();
    }

    const path = String(doc?.chemin ?? doc?.path ?? doc?.url ?? '').replace(/\\/g, '/');
    if (path) {
      const candidate = path.split('/').pop() || '';
      if (candidate.trim()) return candidate.trim();
    }
    return 'Document';
  }

  getDocumentDownloadUrl(doc: any): string {
    const DOWNLOAD_BASE = 'http://192.168.2.129/uploademande/demandes';
    const displayName = this.getDocumentDisplayName(doc);
    const encodedFileName = encodeURIComponent(displayName);
    if (doc?.url) return doc.url;
    if (doc?.chemin) {
      const cRaw = doc.chemin as string;
      const c = String(cRaw ?? '').replace(/\\/g, '/');
      if (c.startsWith('http://') || c.startsWith('https://')) return c;
      try {
        // Cas fréquent : chemin backend du type "html/uploademande/demandes/107"
        // -> on force "/uploademande/demandes/107" depuis l'origine.
        const uploadNeedle = 'uploademande/demandes/';
        const idx = c.indexOf(uploadNeedle);
        if (idx >= 0) {
          const suffix = c.slice(idx + uploadNeedle.length);
          const normalizedSuffix = suffix.replace(/^\/+|\/+$/g, '');

          // Si le backend renvoie seulement l'id (ex: "121" ou "121/"),
          // on complète avec le nom du fichier.
          if (
            normalizedSuffix &&
            /^\d+$/.test(normalizedSuffix) &&
            displayName &&
            displayName !== 'Document'
          ) {
            return `${DOWNLOAD_BASE}/${normalizedSuffix}/${encodedFileName}`;
          }

          // Si le suffixe se termine par "/" sans nom explicite, on complète aussi.
          if (
            suffix.endsWith('/') &&
            displayName &&
            displayName !== 'Document'
          ) {
            return `${DOWNLOAD_BASE}/${normalizedSuffix}/${encodedFileName}`;
          }

          return `${DOWNLOAD_BASE}/${normalizedSuffix}`;
        }
      } catch {
        // ignore et fallback ci-dessous
      }
    }

    // Fallback: construire une URL complète avec id + nom de fichier
    // Exemple attendu: http://192.168.2.129/uploademande/demandes/119/Scan20260330155723.pdf
    const demandeId = Number(this.demande?.id);
    if (!Number.isNaN(demandeId) && demandeId > 0 && displayName && displayName !== 'Document') {
      return `${DOWNLOAD_BASE}/${demandeId}/${encodedFileName}`;
    }
    return '#';
  }

  redirectToPartner(): void {
    if (!this.demande) return;
    if (confirm('Voulez-vous rediriger cette demande vers un partenaire ?')) {
      // TODO: Implémenter la logique de redirection vers partenaire
      this.notificationService.show('Demande redirigée vers partenaire', 'success', 3000);
    }
  }


  markAsResolved(): void {
    // Ancienne action "Accepter" conservée pour compatibilité éventuelle
    this.openValidationModalMethod('valider');
  }

  openRejectModal(): void {
    this.openValidationModalMethod('rejeter');
  }

  openReturnModal(): void {
    this.openValidationModalMethod('retourner');
  }

  openCloseModal(): void {
    this.openValidationModalMethod('cloturer');
  }

  openValidationModalMethod(action: ValidationAction | string): void {
    this.validationAction = action;
    this.openValidationModal = true;
    this.validationCommentaire = '';
    this.isValidating = false;
  }

  closeValidationModal(): void {
    this.openValidationModal = false;
    this.validationAction = null
    this.validationCommentaire = '';
    this.isValidating = false;
  }

  submitValidation(): void {
    if (!this.validationCommentaire?.trim()) {
      this.notificationService.show('Le commentaire est obligatoire', 'error', 3000);
      return;
    }

    this.isValidating = true;

    const id = this.demande.id;

    const mapActionForBackend = (action: string | null): string => {
      if (!action) {
        return '';
      }
      const a = action.toUpperCase();
      // Backend : pour valider / clôturer, l'action doit être CLOSE
      if (a === 'VALIDER' || a === 'VALIDEE' || a === 'CLOTURER') {
        return 'CLOSE';
      }
      if (a === 'ESCALADE_ADMIN') {
        return 'ESCALADE_ADMIN';
      }
      if (a === 'ESCALADE_PARTENAIRE') {
        return 'ESCALADE_PARTENAIRE';
      }
      if (a === 'REJETER' || a === 'REJET' || a === 'REJECT') {
        return 'REJETER';
      }
      return a;
    };

    const buildMessage = (baseMessage: string, response: any): string => {
      if (!response) {
        return baseMessage;
      }
      const backendMessage =
        (typeof response === 'string' && response) ||
        response.message ||
        response.detail ||
        response.error ||
        response.status ||
        response.result;
      return backendMessage
        ? `${baseMessage} : ${backendMessage}`
        : baseMessage;
    };

    const handleSuccess = (baseMessage: string, response: any) => {
      const actionMessage = buildMessage(baseMessage, response);
      this.isValidating = false;
      // Fermer immédiatement le modal dès que l'action est effectuée avec succès.
      this.closeValidationModal();
      this.cdr.detectChanges();
      this.notificationService.show(actionMessage, 'success', 3000);

      const demandeId = Number(this.route.snapshot.paramMap.get('id') || id);
      this.demandeService.getDemande(demandeId).subscribe({
        next: (data) => {
          this.demande = data;
          this.cdr.detectChanges();
        }
      });
    };

    const upper = (this.validationAction || '').toUpperCase();
    const isRejet = upper === 'REJETER' || upper === 'REJET';
    const isRetour = upper === 'RETOURNER' || upper === 'RETOURNER_DEMANDE' || upper === 'RETOUR';

    // Règle métier : si la demande est en RETOURNER_SI, seule la transition
    // vers A_CORRIGER_PAR_DEMANDEUR (action RETOURNER) est autorisée.
    if (this.isRetournerSiStatus() && !isRetour) {
      this.isValidating = false;
      this.notificationService.show(
        'En statut RETOURNER_SI, seule l’action vers A_CORRIGER_PAR_DEMANDEUR est autorisée.',
        'warning',
        4500
      );
      return;
    }

    if (isRetour && !this.canReturnDemandeBySIAdmin()) {
      this.isValidating = false;
      this.notificationService.show('Le retour est réservé aux niveaux SI/Admin selon le statut actuel.', 'warning', 4000);
      return;
    }

    // Bouton Retourner: combiner validation (CLOSE) puis retour.
    if (isRetour && !this.isRetournerSiStatus()) {
      this.demandeService
        .validerDemande(this.demande.id, 'CLOSE', this.validationCommentaire)
        .subscribe({
          next: () => {
            this.demandeService.retournerDemande(this.demande.id, this.validationCommentaire).subscribe({
              next: (response) => {
                handleSuccess('Demande validée puis retournée avec succès', response);
              },
              error: (err) => {
                console.error('Erreur lors du retour après validation', err);
                const errorMsg =
                  err?.error?.message ||
                  err?.error?.detail ||
                  err?.message ||
                  'Erreur lors du retour de la demande.';
                setTimeout(() => {
                  this.isValidating = false;
                  this.notificationService.show(String(errorMsg), 'error', 5000);
                }, 0);
              }
            });
          },
          error: (err) => {
            console.error('Erreur lors de la validation préalable au retour', err);
            const errorMsg =
              err?.error?.message ||
              err?.error?.detail ||
              err?.message ||
              'Erreur lors de la validation préalable au retour.';
            setTimeout(() => {
              this.isValidating = false;
              this.notificationService.show(String(errorMsg), 'error', 5000);
            }, 0);
          }
        });
      return;
    }

    const req = isRejet
      ? this.demandeService.rejeterDemande(this.demande.id, this.validationCommentaire)
      : isRetour
        ? this.demandeService.retournerDemande(this.demande.id, this.validationCommentaire)
        : this.demandeService.validerDemande(
            this.demande.id,
            mapActionForBackend(this.validationAction),
            this.validationCommentaire
          );

    req.subscribe({
      next: (response) => {
        const backendAction = mapActionForBackend(this.validationAction);
        console.log(`Demande ${isRejet ? 'rejetée' : backendAction} avec succès`, response);

        const actionLabel = isRejet
          ? 'rejetée'
          : isRetour
            ? 'retournée vers l\'expéditeur'
            : upper === 'VALIDER' || upper === 'VALIDEE' || backendAction === 'CLOSE'
              ? 'validée'
              : upper === 'CLOTURER'
                ? 'clôturée'
                : backendAction === 'ESCALADE_ADMIN'
                  ? 'escaladée vers admin'
                  : backendAction === 'ESCALADE_PARTENAIRE'
                    ? 'escaladée vers partenaire'
                    : 'traitée';

        handleSuccess(`Demande ${actionLabel} avec succès`, response);
      },
      error: (err) => {
        console.error('Erreur lors de la validation', err);
        const errorMsg =
          err?.error?.message ||
          err?.error?.detail ||
          (Array.isArray(err?.error?.errors) ? err.error.errors.map((e: any) => e?.message ?? e).join(', ') : null) ||
          err?.error ||
          err?.message ||
          'Erreur lors de la validation';
        // Décaler pour éviter ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.isValidating = false;
          this.notificationService.show(String(errorMsg), 'error', 5000);
        }, 0);
      }
    });
  }

  escaladerAdmin(): void {
    this.openValidationModalMethod('ESCALADE_ADMIN');
  }

  escaladerPartenaire(): void {
    this.openValidationModalMethod('ESCALADE_PARTENAIRE');
  }

  isSI(): boolean {
  return this.authService.hasAnyRole([Role.SI, 'SI', 'ROLE_SI', 'AGENT_SI', 'ROLE_AGENT_SI']);
}

isAdmin(): boolean {
  return this.authService.hasAnyRole([Role.ADMIN, 'ADMIN', 'ROLE_ADMIN']);
}

isPartenaire(): boolean {
  return this.authService.hasAnyRole([Role.PARTENAIRE, 'PARTENAIRE', 'ROLE_PARTENAIRE']);
}

canValidateOrReject(): boolean {
  if (this.isDemandeInitiee()) {
    return false;
  }
  // SI, Admin et Partenaire peuvent valider / rejeter
  return this.isSI() || this.isAdmin() || this.isPartenaire();
}

canClose(): boolean {
  // Clôture réservée à SI et Admin
  return this.authService.hasAnyRole([Role.SI, Role.ADMIN]);
}

canEscalateToAdmin(): boolean {
  if (this.isDemandeInitiee()) {
    return false;
  }
  // Escalade vers Admin : réservée aux agents SI, pas aux Admin déjà au plus haut niveau
  return this.isSI() && !this.isAdmin();
}

isEncoursChezAdminStatus(): boolean {
  const statut = this.getDisplayStatut();
  if (!statut) {
    return false;
  }
  const normalized = statut
    .toString()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  return normalized === 'ENCOURS_CHEZ_ADMIN' || normalized === 'EN_COURS_CHEZ_ADMIN';
}

canSeeValidationActionsForCurrentStatus(): boolean {
  if (!this.isEncoursChezAdminStatus()) {
    return true;
  }
  // En statut ENCOURS_CHEZ_ADMIN, seul ROLE_ADMIN traite la demande.
  return this.isAdmin();
}

canEscalateToPartenaire(): boolean {
    if (this.isDemandeInitiee()) {
      return false;
    }
    // ENGAGE PARTENAIRE : seulement si Admin ET demande déjà acceptée/validée
    return this.isAdmin() && this.isDemandeValideePourResolue();
  }

  canReturnDemandeBySIAdmin(): boolean {
    if (!this.demande) return false;
    if (!(this.isSI() || this.isAdmin())) return false;
    if (this.isDemandeInitiee() || this.isDemandeRejetee()) return false;
    // Si un statut final est déjà défini, le retour à l'expéditeur n'est plus autorisé.
    if (this.getCurrentFinalStatusCode()) return false;
    // Si la demande est escaladée/traitée chez admin, on masque le bouton de retour.
    if (this.isEncoursChezAdminStatus()) return false;
    if (this.isRetournerSiStatus()) return true;
    // Si déjà acceptée/validée, retour interdit.
    if (this.isDemandeValideePourResolue()) return false;
    return true;
  }

  /** True si le statut indique que la demande a été rejetée. */
  isDemandeRejetee(): boolean {
    const sRaw = this.getDisplayStatut();
    if (!sRaw) {
      return false;
    }
    const s = String(sRaw).toUpperCase();
    return s.includes('REJET') || s.includes('REJECTED');
  }

  /**
   * Retourne true si la demande est déjà dans un état final (clôturée, rejetée, escaladée, terminée, résolue).
   * Dans ce cas, on ne doit plus afficher les boutons d'action.
   */
  isDemandeTraitee(): boolean {
    const sRaw = this.getDisplayStatut();
    if (!this.demande || !sRaw) {
      return false;
    }
    const statut = String(sRaw).toUpperCase();
    return statut.includes('CLOSE')
      || statut.includes('CLOTUR')
      || statut.includes('REJET')
      || statut.includes('ESCALADE')
      || statut.includes('TERMINE')
      || statut.includes('RÉSOLU')
      || statut.includes('RESOLU');
  }

  /**
   * Demande validée (done) : prête à être marquée résolue via le bouton unique "Résolue".
   */
  isDemandeValideePourResolue(): boolean {
    const status = this.normalizeStatusKey(this.getDisplayStatut());
    if (!status) {
      return false;
    }

    // Si déjà résolue / clôturée / rejetée -> pas de bouton "Résolue"
    if (
      status.includes('RESOLU')
      || status.includes('CLOTUR')
      || status.includes('REJET')
      || status.includes('CLOSE')
    ) {
      return false;
    }

    // Dès qu'une demande est acceptée/validée, seule l'action "Résolue" doit rester possible.
    // On couvre plusieurs variantes backend/front (avec/sans accents, libellés métier, etc.).
    return status.includes('ACCEPT')
      || status.includes('ACCEPTE')
      || status.includes('VALID')
      || status.includes('DONE')
      || status === 'VALIDE'
      || status === 'VALIDEE'
      || status === 'VALIDER'
      || status === 'APPROVED'
      || status === 'DEMANDE_ACCEPTEE'
      || status === 'DEMANDE_ACCEPTEE';
  }

  /** Afficher uniquement le bouton "Résolue" (SI ou Admin). */
  canShowResolueButton(): boolean {
    if (!this.demande) {
      return false;
    }
    if (!(this.isSI() || this.isAdmin())) {
      return false;
    }
    if (this.isDemandeRejetee()) {
      return false;
    }

    const currentFinalStatus = this.getCurrentFinalStatusCode();
    // Après LIVRE, aucune action de changement de statut final.
    if (currentFinalStatus === 'LIVRE') {
      return false;
    }

    // Cas 1: demande validée (pas encore de statut final) => on peut définir un statut final.
    if (!currentFinalStatus && this.isDemandeValideePourResolue()) {
      return true;
    }

    // Cas 2: progression de workflow final existant.
    return currentFinalStatus === 'TEST' || currentFinalStatus === 'PREPROD';
  }

  /**
   * Demandeur : uniquement quand la demande est en correction
   * (statut: A_CORRIGER_PAR_DEMANDEUR) et que l'utilisateur ne peut pas valider/rejeter.
   */
  canResoumettre(): boolean {
    if (!this.demande) return false;
    if (!this.isDemandeEnCorrectionParDemandeur()) return false;
    return this.isCurrentUserCreator();
  }

  canSoumettreDemandeInitiee(): boolean {
    if (!this.demande) return false;
    return this.isDemandeInitiee();
  }

  private isDemandeEnCorrectionParDemandeur(): boolean {
    // Pour la resoumission, on doit regarder le statut courant backend (statut),
    // pas le statut final d'implémentation/livraison.
    const sRaw = (this.demande?.statut ?? '').toString();
    if (!sRaw) return false;
    const normalized = String(sRaw)
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    return normalized === 'A_CORRIGER_PAR_DEMANDEUR'
      || normalized === 'RETOURNER_SI'
      || normalized === 'RETOURNER_AU_SI'
      || normalized === 'RETOUR_SI';
  }

  private isDemandeInitiee(): boolean {
    // Certains retours backend exposent le statut dans des champs différents.
    const candidates = [
      this.demande?.statut,
      this.demande?.statutfinal,
      this.demande?.statutFinal,
      this.demande?.statut_final,
      this.getDisplayStatut()
    ];

    return candidates.some((value) => {
      const sRaw = String(value ?? '').trim();
      if (!sRaw) return false;
      const normalized = sRaw
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');
      return normalized === 'CREE'
        || normalized === 'CREATED'
        || normalized === 'INITIE'
        || normalized === 'INITIEE'
        || normalized === 'INITIATED';
    });
  }

  private isCurrentUserCreator(): boolean {
    const connectedUsername = (this.authService.getConnectedUsername() || '').trim().toLowerCase();
    const connectedFullName = (this.authService.getConnectedUserFullName() || '').trim().toLowerCase();
    const candidates: unknown[] = [
      this.demande?.userinput,
      this.demande?.createdBy,
      this.demande?.createdby,
      this.demande?.createBy,
      this.demande?.created_by,
      this.demande?.demandeur,
      this.demande?.createur,
      this.demande?.creator,
      this.demande?.user,
      this.demande?.utilisateur,
      this.getCreatedByName()
    ];

    const creatorNames = candidates
      .flatMap((candidate) => {
        if (typeof candidate === 'string') return [candidate];
        if (candidate && typeof candidate === 'object') {
          const o = candidate as Record<string, unknown>;
          return [
            o['username'],
            o['userName'],
            o['name'],
            o['nom'],
            o['fullName'],
            o['fullname'],
            o['nomComplet'],
            o['nom_complet'],
            o['login']
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
      connectedFullName
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

      const atIdx = base.indexOf('@');
      if (atIdx > 0) {
        out.add(base.slice(0, atIdx));
      }

      const slashParts = base.split(/[\\/]/).filter(Boolean);
      if (slashParts.length > 1) {
        out.add(slashParts[slashParts.length - 1]);
      }

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

  soumettreDemandeInitiee(): void {
    if (!this.demande?.id) return;
    if (!this.canSoumettreDemandeInitiee()) return;

    if (!confirm('Voulez-vous soumettre cette demande ?')) {
      return;
    }

    this.isSubmittingInitialDemande = true;
    const id = Number(this.demande.id);

    this.demandeService.soumettreDemande(id).subscribe({
      next: (response) => {
        const msg =
          (response?.message ?? response?.detail) ??
          'Demande soumise avec succès.';

        setTimeout(() => {
          this.isSubmittingInitialDemande = false;
          if (this.demande) {
            this.demande.statut = 'SUBMITED';
          }
          this.notificationService.show(String(msg), 'success', 3000);

          this.demandeService.getDemande(id).subscribe({
            next: (data) => {
              this.demande = data;
              this.cdr.detectChanges();
            },
            error: () => {
              // On garde l'état actuel si le rechargement échoue.
            }
          });
        }, 0);
      },
      error: (err) => {
        const errorMsg =
          err?.error?.message ??
          err?.error?.detail ??
          err?.message ??
          'Erreur lors de la soumission de la demande.';

        setTimeout(() => {
          this.isSubmittingInitialDemande = false;
          this.notificationService.show(String(errorMsg), 'error', 5000);
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  resoumettreDemande(): void {
    if (!this.demande?.id) return;
    if (!this.canResoumettre()) return;

    if (!confirm('Voulez-vous resoumettre cette demande après correction ?')) {
      return;
    }

    this.isResoumitting = true;
    const id = Number(this.demande.id);

    this.demandeService.resoumettreDemande(id).subscribe({
      next: (response) => {
        const msg =
          (response?.message ?? response?.detail) ??
          'Demande resoumise avec succès.';

        setTimeout(() => {
          this.isResoumitting = false;
          this.notificationService.show(String(msg), 'success', 3000);

          this.demandeService.getDemande(id).subscribe({
            next: (data) => {
              this.demande = data;
              this.cdr.detectChanges();
            },
            error: () => {
              // si le rechargement échoue, on garde l'état actuel
            }
          });
        }, 0);
      },
      error: (err) => {
        const errorMsg =
          err?.error?.message ??
          err?.error?.detail ??
          err?.message ??
          'Erreur lors de la resoumission de la demande.';

        setTimeout(() => {
          this.isResoumitting = false;
          this.notificationService.show(String(errorMsg), 'error', 5000);
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  /**
   * Indique si les boutons d'action (Accepter / Rejeter / Clôturer / Escalader) doivent être visibles.
   * Masqués si la demande est déjà traitée ou en mode "Résolue".
   */
  canShowActions(): boolean {
    if (!this.demande) {
      return false;
    }
    // En correction demandeur, aucune action de validation côté SI.
    if (this.isCorrectionDemandeurStatus()) {
      return false;
    }
    // Ne bloquer les actions que pour les statuts finaux TERMINAUX.
    // Ex: ENCOURS_CHEZ_ADMIN ne doit pas masquer les actions de l'agent SI.
    if (this.hasTerminalFinalStatus()) {
      return false;
    }
    if (this.isDemandeRejetee()) {
      return false;
    }
    if (this.canShowResolueButton()) {
      return false;
    }
    if (this.isDemandeTraitee()) {
      return false;
    }
    return this.canValidateOrReject()
      || this.canEscalateToAdmin()
      || this.canEscalateToPartenaire();
  }

  openResolueModalMethod(): void {
    if (!this.canShowResolueButton()) {
      return;
    }
    const availableCodes = this.getAvailableResolueCodes();
    if (!availableCodes.length) {
      this.notificationService.show('Aucune transition de statut final disponible.', 'info', 3000);
      return;
    }

    this.openResolueModal = true;
    this.resolueCode = availableCodes[0];
    this.resolueCommentaire = '';
    this.isSubmittingResolue = false;
  }

  closeResolueModal(): void {
    this.openResolueModal = false;
    this.resolueCode = '';
    this.resolueCommentaire = '';
    this.isSubmittingResolue = false;
  }

  submitResolue(): void {
    if (!this.demande?.id) {
      return;
    }
    if (!this.resolueCode?.trim()) {
      this.notificationService.show('Veuillez choisir un statut (LIVRE, TEST ou PREPROD).', 'warning', 3500);
      return;
    }
    if (!this.resolueCommentaire?.trim()) {
      this.notificationService.show('Veuillez saisir un commentaire.', 'warning', 3500);
      return;
    }
    this.isSubmittingResolue = true;
    const id = this.demande.id;
    const code = this.resolueCode.trim().toUpperCase();
    const allowedCodes = new Set(this.getAvailableResolueCodes());

    if (!allowedCodes.has(code)) {
      this.isSubmittingResolue = false;
      this.notificationService.show('Transition de statut final non autorisée.', 'warning', 3500);
      return;
    }
    const selectedStatus = this.findFinalStatusByCode(code);
    const idStatutFinal = this.resolveFinalStatusId(selectedStatus);
    if (!idStatutFinal) {
      this.isSubmittingResolue = false;
      this.notificationService.show(
        `Impossible de trouver l'identifiant du statut final "${code}". Vérifiez le paramétrage.`,
        'warning',
        4500
      );
      return;
    }

    this.demandeService.marquerResolue(id, idStatutFinal, this.resolueCommentaire).subscribe({
      next: (response) => {
        const msg =
          (response?.message ?? response?.detail ?? `Statut mis à jour vers ${code}.`) as string;
        // Fermer immédiatement le popup quand l'action est effective.
        this.closeResolueModal();
        this.cdr.detectChanges();
        this.notificationService.show(String(msg), 'success', 4000);

        // Recharger les données pour mettre à jour le statut / historique
        this.demandeService.getDemande(id).subscribe({
          next: (data) => {
            this.demande = data;
          },
          error: () => {
            // si ça échoue, on laisse l'état courant
          }
        });
      },
      error: (err) => {
        // Décaler pour éviter NG0100 sur disabled
        setTimeout(() => {
          this.isSubmittingResolue = false;
        }, 0);
        let backendMessage = '';
        const rawError = err?.error;
        if (typeof rawError === 'string') {
          const trimmed = rawError.trim();
          if (trimmed) {
            try {
              const parsed = JSON.parse(trimmed);
              backendMessage = parsed?.message ?? parsed?.detail ?? '';
            } catch {
              backendMessage = trimmed;
            }
          }
        } else if (rawError && typeof rawError === 'object') {
          backendMessage = rawError?.message ?? rawError?.detail ?? '';
        }

        const errorMsg =
          backendMessage ||
          err?.message ||
          'Erreur lors du marquage en résolue.';
        this.notificationService.show(String(errorMsg), 'error', 5000);
      }
    });
  }

  getAvailableResolueCodes(): string[] {
    const currentFinal = this.getCurrentFinalStatusCode();
    const isParametrage = this.isParametrageDemandeType();

    // Règle métier: pour une demande de type Paramétrage,
    // le seul statut final autorisé est LIVRE.
    if (isParametrage) {
      if (currentFinal === 'LIVRE') {
        return [];
      }
      return ['LIVRE'];
    }

    // Workflow ciblé: TEST -> PREPROD -> LIVRE
    if (currentFinal === 'TEST') {
      return ['PREPROD'];
    }
    if (currentFinal === 'PREPROD') {
      return ['LIVRE'];
    }
    if (currentFinal === 'LIVRE') {
      return [];
    }

    // Première affectation du statut final (demande d'évolution validée) :
    // on commence par TEST pour respecter le workflow backend.
    return ['TEST'];
  }

  private findFinalStatusByCode(code: string): any | null {
    const wanted = (code ?? '').trim().toUpperCase();
    if (!wanted) return null;
    return (this.availableFinalStatuses || []).find((item: any) => {
      const itemCode = String(item?.code ?? item?.codeStatutFinal ?? '').trim().toUpperCase();
      return itemCode === wanted;
    }) ?? null;
  }

  private resolveFinalStatusId(item: any): number {
    const raw = item?.id ?? item?.idStatutFinal ?? item?.statutFinalId ?? item?.statutfinalId;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private getCurrentFinalStatusCode(): string {
    const finalStatus = (this.demande?.statutfinal ?? this.demande?.statutFinal ?? this.demande?.statut_final) as string | undefined;
    return (finalStatus ?? '').toString().trim().toUpperCase();
  }

  private isParametrageDemandeType(): boolean {
    const rawType = (this.demande?.typedemande ?? this.demande?.typeDemande ?? '').toString().trim();
    if (!rawType) {
      return false;
    }
    const normalized = rawType
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    return normalized === 'PARAMETRABLE' || normalized === 'PARAMETRAGE';
  }

  private hasTerminalFinalStatus(): boolean {
    const finalStatus = this.getCurrentFinalStatusCode();
    if (!finalStatus) {
      return false;
    }
    return finalStatus.includes('LIVRE')
      || finalStatus.includes('REJECT')
      || finalStatus.includes('REJET')
      || finalStatus.includes('RESOLU')
      || finalStatus.includes('RÉSOLU')
      || finalStatus.includes('CLOTUR')
      || finalStatus.includes('CLOSE')
      || finalStatus.includes('TERMINE');
  }

  isRetournerSiStatus(): boolean {
    // Se base sur le statut affiché (statutfinal prioritaire) pour couvrir tous les cas backend.
    const sRaw = this.getDisplayStatut();
    if (!sRaw) return false;
    const normalized = String(sRaw)
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    return normalized === 'RETOURNER_SI'
      || normalized === 'RETOURNER_AU_SI'
      || normalized === 'RETOUR_SI'
      || normalized === 'RETOUR_A_L_EQUIPE_SI';
  }

  private isCorrectionDemandeurStatus(): boolean {
    const sRaw = this.getDisplayStatut();
    if (!sRaw) return false;
    const normalized = String(sRaw)
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    return normalized === 'A_CORRIGER_PAR_DEMANDEUR';
  }

  exportDemandeToExcel(): void {
    if (!this.demande) return;

    const d = this.demande as Record<string, unknown>;
    const delimiter = ';';
    const bom = '\uFEFF'; // Aide Excel (encodage UTF-8)

    const toCell = (v: unknown): string => {
      const s = String(v ?? '');
      const needsQuotes = s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r');
      const escaped = s.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const lines: string[] = [];
    const pushRow = (cells: unknown[] = []): void => {
      if (!cells.length) {
        lines.push('');
        return;
      }
      lines.push(cells.map(toCell).join(delimiter));
    };

    const id = d['id'] ?? '';
    const typeLabel =
      d['typedemande'] === 'PARAMETRABLE'
        ? 'Paramétrage'
        : d['typedemande'] === 'EVOLUTION'
          ? 'Évolution'
          : String(d['typedemande'] ?? '').trim();

    // ================== DEMANDE ==================
    pushRow(['=== DEMANDE ===']);
    pushRow(['Champ', 'Valeur']);
    pushRow(['ID', id]);
    pushRow(['Objet', d['objet']]);
    pushRow(['Application', this.getApplicationDisplay(d['application'])]);
    pushRow(['Type de demande', typeLabel]);
    pushRow(['Statut', this.getStatusLabel(this.getDisplayStatut())]);
    pushRow(['Priorité', this.getPriorityLabel(String(d['niveaupriorite'] ?? ''))]);
    pushRow(['Date création', d['datecreate']]);
    pushRow(['Département', d['departement']]);
    pushRow(['Créé par', this.getCreatedByName()]);
    pushRow(['Statut final', d['statutfinal'] ?? d['statutFinal'] ?? d['statut_final'] ?? '']);

    pushRow([]);

    // ================== DOCUMENTS ==================
    // const docs = Array.isArray(d['documents']) ? (d['documents'] as any[]) : [];
    // pushRow(['=== DOCUMENTS ===']);
    // pushRow(['Nom', 'URL']);
    // if (!docs.length) {
    //   pushRow(['(aucun)', '']);
    // } else {
    //   for (const doc of docs) {
    //     pushRow([doc?.nomFichier ?? doc?.nom ?? doc?.filename ?? '', this.getDocumentDownloadUrl(doc)]);
    //   }
    // }

    // pushRow([]);

    // ================== COMMENTAIRES ==================
    const comments = Array.isArray(d['commentaires']) ? (d['commentaires'] as any[]) : [];
    pushRow(['=== COMMENTAIRES ===']);
    pushRow(['Auteur', 'Date', 'Contenu']);
    if (!comments.length) {
      pushRow(['(aucun)', '', '']);
    } else {
      for (const c of comments) {
        pushRow([this.getCommentAuteur(c), this.getCommentDate(c), this.getCommentContenu(c)]);
      }
    }

    pushRow([]);

    // ================== HISTORIQUE ==================
    // const history = Array.isArray(this.historique) ? this.historique : [];
    // pushRow(['=== HISTORIQUE ===']);
    // pushRow(['Changement', 'Date', 'Par', 'Description']);
    // if (!history.length) {
    //   pushRow(['(aucun)', '', '', '']);
    // } else {
    //   for (const item of history) {
    //     pushRow([
    //       this.getHistoriqueLabel(item),
    //       this.getHistoriqueDate(item),
    //       this.getHistoriqueUser(item),
    //       this.getHistoriqueDescription(item),
    //     ]);
    //   }
    // }

    const csv = bom + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().slice(0, 10);
    const safeId = String(id || 'demande').toString().replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `demande_${safeId}_${today}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }
}
