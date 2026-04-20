import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { NotificationService } from '../../../../services/notification.service';
import { environment } from '../../../../../environments/environment';
import { DemandeService } from '../../services/demande-service';
import { AuthService } from '../../../../core/service/auth.service';

@Component({
  selector: 'app-edit-demande',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './edit-demande.html',
  styleUrls: ['./edit-demande.css']  ,

})
  
export class EditDemande implements OnInit {
  demandeId!: number;
  demande: any = null;

  isLoading = true;
  isSaving = false;
  canEditDemande = false;
  isTypeDemandeLocked = false;

  applications: any[] = [];
  niveauxPriorite: any[] = [];

  selectedFile?: File | null = null;
  selectedFileName: string | null = null;
  isDragOver = false;
  
  demandeForm!: FormGroup;



  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private demandeService: DemandeService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    // IMPORTANT: ne pas initialiser via this.fb dans un champ de classe
    // sinon TS signale "used before initialization".
    this.demandeForm = this.fb.group({
      objet: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      codeapp: ['', Validators.required],
      codenp: ['', Validators.required],
      codeDepartement: ['', Validators.required],
      typedemande: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Comme pour Statistique : décaler le chargement d'un tick pour éviter les problèmes avec loadComponent
    setTimeout(() => this.loadDemande(), 0);
  }

  private loadDemande(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.notificationService.show('Identifiant de demande invalide', 'error', 4000);
      this.router.navigate(['/demandes/mes-demandes']);
      return;
    }

    this.demandeId = id;
    this.demande = null;
    this.isLoading = true;

    forkJoin({
      demande: this.demandeService.getDemande(id).pipe(catchError(() => of(null))),
      applications: this.demandeService.listeAppp().pipe(catchError(() => of([]))),
      niveauxPriorite: this.demandeService.listeNiveauPriorite().pipe(catchError(() => of([]))),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe(({ demande, applications, niveauxPriorite }) => {
        if (!demande) {
          this.notificationService.show('Demande introuvable', 'error', 4000);
          this.router.navigate(['/demandes/mes-demandes']);
          return;
        }

        this.demande = demande;
        this.applications = Array.isArray(applications) ? applications : [];
        this.niveauxPriorite = Array.isArray(niveauxPriorite) ? niveauxPriorite : [];

        this.canEditDemande = this.isEditableByDemandeur(this.demande);
        if (!this.canEditDemande) {
          this.notificationService.show(
            'Modification non autorisée. Seul le demandeur peut modifier une demande en statut CREATED (initiée) ou A_CORRIGER_PAR_DEMANDEUR.',
            'warning',
            5000
          );
          this.router.navigate(['/demandes', this.demandeId]);
          return;
        }

        this.isTypeDemandeLocked = this.isStatusCorrectionDemandeur(this.demande);

        // Pré-remplissage du formulaire
        const resolvedAppCode = this.resolveApplicationCode(this.demande?.application);
        const resolvedNpCode = this.resolveNiveauPrioriteCode(this.demande?.niveaupriorite);
        const resolvedType = this.normalizeTypeDemande(this.demande?.typeDemande);

        this.demandeForm.patchValue({
          objet: this.demande?.objet ?? '',
          description: this.demande?.description ?? '',
          codeapp: resolvedAppCode ?? '',
          codenp: resolvedNpCode ?? '',
          codeDepartement: this.demande?.departement ?? '',
          typedemande: resolvedType || '',
        });

        if (this.isTypeDemandeLocked) {
          this.demandeForm.get('typedemande')?.disable({ emitEvent: false });
        } else {
          this.demandeForm.get('typedemande')?.enable({ emitEvent: false });
        }

        this.demandeForm.markAsPristine();
      });
  }

  goBack(): void {
    this.router.navigate(['/demandes', this.demandeId]);
  }

  onFileSelected($event: Event): void {
    const input = $event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    this.selectedFile = file;
    this.selectedFileName = file ? file.name : null;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.selectedFile = file;
    this.selectedFileName = file ? file.name : null;
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    this.selectedFileName = null;
  }

  save(): void {
    if (!this.canEditDemande) {
      this.notificationService.show('Vous n’êtes pas autorisé à modifier cette demande.', 'error', 4000);
      return;
    }

    if (this.demandeForm.invalid || this.isSaving) {
      this.demandeForm.markAllAsTouched();
      return;
    }

    const rawForm = this.demandeForm.getRawValue();
    const { objet, description, codeapp, codenp, codeDepartement, typedemande } = rawForm;
    const lockedType = this.normalizeTypeDemande(
      this.demande?.typedemande ?? this.demande?.typeDemande ?? ''
    );
    const finalTypeDemande = this.isTypeDemandeLocked ? lockedType : typedemande;

    const npId = this.getNiveauPrioriteIdFromCode(codenp);
    if (!npId) {
      this.notificationService.show('Niveau de priorité invalide', 'error', 4000);
      return;
    }

    this.isSaving = true;

    this.demandeService
      .editDemande({
        id: this.demandeId,
        objet,
        description,
        niveauPrioriteId: npId,
        typeDemande: finalTypeDemande,
        departement: codeDepartement,
        codeapp: codeapp,
        codenp: codenp,
      })
      .pipe(
        finalize(() => {
          this.isSaving = false;
        })
      )
      .subscribe({
        next: () => {
          const finalizeResoumission = () => {
            this.demandeService.resoumettreDemande(this.demandeId).subscribe({
              next: () => {
                this.notificationService.show('Demande modifiée et resoumise avec succès', 'success', 3000);
                this.router.navigate(['/demandes', this.demandeId]);
              },
              error: (err) => {
                const msg =
                  err?.error?.message ??
                  err?.error?.detail ??
                  err?.message ??
                  'Demande modifiée, mais erreur lors de la resoumission.';
                this.notificationService.show(String(msg), 'warning', 5000);
                this.router.navigate(['/demandes', this.demandeId]);
              }
            });
          };

          const finalizeWithoutResoumission = () => {
            this.notificationService.show('Demande modifiée avec succès', 'success', 3000);
            this.router.navigate(['/demandes', this.demandeId]);
          };

          // Si une pièce jointe est sélectionnée, on l'ajoute après l'édition
          if (this.selectedFile) {
            this.demandeService.addDocument(this.demandeId, this.selectedFile).subscribe({
              next: () => {
                if (this.shouldResubmitAfterEdit(this.demande)) {
                  finalizeResoumission();
                } else {
                  finalizeWithoutResoumission();
                }
              },
              error: () => {
                this.notificationService.show('Demande mise à jour, mais pièce jointe non ajoutée', 'warning', 4500);
                if (this.shouldResubmitAfterEdit(this.demande)) {
                  finalizeResoumission();
                } else {
                  finalizeWithoutResoumission();
                }
              },
            });
            return;
          }

          if (this.shouldResubmitAfterEdit(this.demande)) {
            finalizeResoumission();
          } else {
            finalizeWithoutResoumission();
          }
        },
        error: (err) => {
          console.error('Erreur lors de la mise à jour:', err);
          const msg =
            err?.error?.message ??
            err?.error?.detail ??
            (Array.isArray(err?.error?.errors) ? err.error.errors.map((e: any) => e?.message ?? e).join(', ') : null) ??
            err?.error ??
            err?.message ??
            'Erreur lors de la mise à jour de la demande';
          this.notificationService.show(String(msg), 'error', 6000);
        },
      });
  }

  private shouldResubmitAfterEdit(demande: any): boolean {
    const status = this.extractStatusCode(demande?.statut)
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    return status === 'A_CORRIGER_PAR_DEMANDEUR'
      || status === 'RETOURNER_SI'
      || status === 'RETOURNER_AU_SI'
      || status === 'RETOUR_SI';
  }

  private isStatusCorrectionDemandeur(demande: any): boolean {
    const status = this.extractStatusCode(demande?.statut)
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    return status === 'A_CORRIGER_PAR_DEMANDEUR';
  }

  private isEditableByDemandeur(demande: any): boolean {
    const statusRaw = this.extractStatusCode(demande?.statut);
    const status = statusRaw.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
    const editableStatuses = new Set([
      'A_CORRIGER_PAR_DEMANDEUR',
      'CREATED',
      'CREE',
      'CREEE',
      'INITIE',
      'INITIEE',
      'INITIATED',
    ]);
    if (!editableStatuses.has(status)) {
      return false;
    }

    const currentUserVariants = this.buildIdentityVariants([
      this.authService.getConnectedUsername() || '',
      this.authService.getConnectedUserFullName() || ''
    ]);

    const demandeurVariants = this.buildIdentityVariants([
      demande?.userinput ??
      demande?.createdBy ??
      demande?.createBy ??
      demande?.createdby ??
      demande?.demandeur ??
      ''
    ]);

    if (!currentUserVariants.size || !demandeurVariants.size) {
      return false;
    }

    for (const v of demandeurVariants) {
      if (currentUserVariants.has(v)) {
        return true;
      }
    }
    return false;
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

  private buildIdentityVariants(values: Array<string | null | undefined>): Set<string> {
    const out = new Set<string>();

    const push = (value: string): void => {
      const base = this.normalizeUserIdentity(value);
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

  private normalizeUserIdentity(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '');
  }

  private normalizeTypeDemande(value: unknown): string {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === 'PARAMETRAGE' || raw === 'PARAMETRABLE') return 'PARAMETRABLE';
    if (raw === 'EVOLUTION' || raw === 'ÉVOLUTION') return 'EVOLUTION';
    return raw;
  }

  // ----- Helpers affichage / mapping ----- //
  getApplicationLabelByCode(code: string | null | undefined): string {
    if (!code) return '—';
    const app = this.applications.find(a => (a?.code || '').toString() === code.toString());
    return (app?.libelle || app?.nom || app?.code || code).toString();
  }

  resolveApplicationCode(appValue: any): string | null {
    if (!appValue) return null;
    const raw = appValue.toString().trim();
    const byCode = this.applications.find(a => (a?.code || '').toString().toLowerCase() === raw.toLowerCase());
    if (byCode?.code) return byCode.code;
    const byLabel = this.applications.find(a => (a?.libelle || a?.nom || '').toString().toLowerCase() === raw.toLowerCase());
    return byLabel?.code ?? null;
  }

  resolveNiveauPrioriteCode(npValue: any): string | null {
    if (!npValue) return null;
    const raw = npValue.toString().trim();
    const byCode = this.niveauxPriorite.find(n => (n?.code || '').toString().toLowerCase() === raw.toLowerCase());
    if (byCode?.code) return byCode.code;
    const byLabel = this.niveauxPriorite.find(n => (n?.libelle || '').toString().toLowerCase() === raw.toLowerCase());
    return byLabel?.code ?? null;
  }

  private getNiveauPrioriteIdFromCode(code: string | null | undefined): number | null {
    if (!code) return null;
    const raw = code.toString().trim().toLowerCase();
    const match = this.niveauxPriorite.find((n: any) => {
      const c = (n?.code || '').toString().trim().toLowerCase();
      const label = (n?.libelle || '').toString().trim().toLowerCase();
      return c === raw || label === raw;
    });
    if (match) {
      const possibleId = (match as any).id ?? (match as any).niveauPrioriteId ?? (match as any).niveauprioriteId;
      if (typeof possibleId === 'number' && !Number.isNaN(possibleId)) return possibleId;
      if (typeof possibleId === 'string') {
        const parsed = parseInt(possibleId, 10);
        return Number.isNaN(parsed) ? null : parsed;
      }
    }
    // Fallback : si la demande a niveaupriorite en objet avec id, et que le code correspond
    const np = this.demande?.niveaupriorite ?? this.demande?.niveauPriorite;
    if (np && typeof np === 'object') {
      const npCode = (np.code ?? np.libelle ?? '').toString().trim().toLowerCase();
      if (npCode === raw) {
        const id = np.id ?? np.niveauPrioriteId ?? np.niveauprioriteId;
        if (typeof id === 'number' && !Number.isNaN(id)) return id;
        if (typeof id === 'string') {
          const parsed = parseInt(id, 10);
          return Number.isNaN(parsed) ? null : parsed;
        }
      }
    }
    return null;
  }

  getDocumentDownloadUrl(doc: any): string {
    if (doc?.url) return doc.url;
    if (doc?.chemin) {
      const c = doc.chemin as string;
      if (c.startsWith('http://') || c.startsWith('https://')) return c;
      try {
        const origin = new URL(environment.apiUrl).origin;
        return origin + (c.startsWith('/') ? c : '/' + c);
      } catch {
        return c;
      }
    }
    return '#';
  }
}
