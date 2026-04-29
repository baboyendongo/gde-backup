import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DemandeService } from '../../services/demande-service';
import { of } from 'rxjs';
import { switchMap, finalize } from 'rxjs/operators';
import { NotificationService } from '../../../../services/notification.service';
import { DEMANDE_TYPE_OPTIONS } from '../../constants/demande-types';

@Component({
  selector: 'app-add-demande',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './add-demande.html',
  styleUrls: ['./add-demande.css']
})
export class AddDemande implements OnInit {

  demandeForm!: FormGroup;
  isSubmitting = false;
  applications: any[] = [];
  niveauxPriorite: any[] = [];
  selectedFileName: string | null = null;
  selectedFileNames: string[] = [];
  selectedFiles: File[] = [];
  isDragOver = false;
  readonly demandeTypeOptions = DEMANDE_TYPE_OPTIONS;
  readonly departementOptions = ['SI', 'RH', 'COM'];
  typeDemandes: Array<{ id: number; code: string; libelle: string; actif: boolean }> = [];
  selectedTypeDemandeChamps: Array<{ id: number; code: string; libelle: string; typeChamp: string; obligatoire: boolean; options: string[] }> = [];
  isLoadingTypeDemandes = false;
  isLoadingTypeChamps = false;
  private typeChampsCache = new Map<number, Array<{ id: number; code: string; libelle: string; typeChamp: string; obligatoire: boolean; options: string[] }>>();
  private currentLoadedTypeId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private demandeService: DemandeService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

   ngOnInit() {
    this.demandeForm = this.fb.group({
      objet: ['', Validators.required],
      description: ['', Validators.required],
      codenp: ['', Validators.required],
      codeapp: ['', Validators.required],
      typedemande: ['', Validators.required],
      codeDepartement: ['', Validators.required],
      file: [null]
    });
    this.listeApps();
    this.chargerNiveauPriorite();
    this.loadTypeDemandes();

    this.demandeForm.get('typedemande')?.valueChanges.subscribe((code) => {
      this.onTypeDemandeSelected((code ?? '').toString().trim());
    });
  }
   chargerNiveauPriorite() {
    this.demandeService.listeNiveauPriorite().subscribe({
      next: (data: any) => {
        this.niveauxPriorite = data;
        console.log('Niveau de priorité :', data);    
      },
      error: (err: any) => {
        console.error('Erreur lors de la récupération du niveau de priorité :', err);
      }
    });
  }

   listeApps(){
      this.demandeService.listeAppp().subscribe({
        next: (data: any) => {
          this.applications = data;
          console.log('Applications :', data);    
        },
        error: (err: any) => {
          console.error('Erreur lors de la récupération des applications :', err);
        }
      }); 
    }

  private getTypeDemandeId(item: any): number | null {
    const rawId = item?.id ?? item?.iddemande ?? item?.idDemande ?? item?.idTypeDemande ?? item?.typeDemandeId;
    const id = Number(rawId);
    return Number.isFinite(id) ? id : null;
  }

  private getTypeDemandeCode(item: any): string {
    return String(item?.code ?? item?.typedemande ?? item?.typeDemande ?? '').trim();
  }

  loadTypeDemandes(): void {
    this.isLoadingTypeDemandes = true;
    this.demandeService.getTypeDemandes().pipe(
      finalize(() => {
        this.isLoadingTypeDemandes = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (items) => {
        this.typeDemandes = (Array.isArray(items) ? items : [])
          .map((raw) => {
            const id = this.getTypeDemandeId(raw);
            const code = this.getTypeDemandeCode(raw);
            if (!id || !code) return null;
            return {
              id,
              code,
              libelle: String(raw?.libelle ?? raw?.label ?? code).trim(),
              actif: (raw?.actif ?? raw?.active ?? true) !== false
            };
          })
          .filter((x): x is { id: number; code: string; libelle: string; actif: boolean } => !!x);
      },
      error: () => {
        this.typeDemandes = this.demandeTypeOptions.map((opt, idx) => ({
          id: idx + 1,
          code: opt.value,
          libelle: opt.label,
          actif: true
        }));
      }
    });
  }

  onTypeDemandeSelected(typeCode: string): void {
    const previousTypeId = this.currentLoadedTypeId;
    if (!typeCode) return;
    const selected = this.typeDemandes.find((t) => t.code === typeCode);
    if (!selected?.id) return;
    const selectedTypeId = selected.id;

    // Ne rien recharger si le même type est déjà chargé.
    if (previousTypeId === selectedTypeId && this.selectedTypeDemandeChamps.length > 0) {
      return;
    }

    this.clearDynamicTypeControls();
    this.selectedTypeDemandeChamps = [];

    // Utiliser le cache local pour éviter les appels API répétitifs.
    const cached = this.typeChampsCache.get(selectedTypeId);
    if (cached) {
      this.selectedTypeDemandeChamps = cached;
      this.addDynamicTypeControls(this.selectedTypeDemandeChamps);
      this.currentLoadedTypeId = selectedTypeId;
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingTypeChamps = true;
    this.demandeService.getTypeDemandeChamps(selectedTypeId).pipe(
      finalize(() => {
        this.isLoadingTypeChamps = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (champs) => {
        this.selectedTypeDemandeChamps = (Array.isArray(champs) ? champs : []).map((c) => ({
          id: Number(c?.id ?? c?.idchamp ?? c?.idChamp ?? 0),
          code: String(c?.code ?? '').trim(),
          libelle: String(c?.libelle ?? c?.label ?? '').trim(),
          typeChamp: String(c?.typeChamp ?? c?.type ?? '').trim().toUpperCase(),
          obligatoire: (c?.obligatoire ?? c?.required ?? c?.requis ?? false) === true,
          options: this.extractSelectOptions(c?.optionsJson),
        }));
        this.typeChampsCache.set(selectedTypeId, this.selectedTypeDemandeChamps);
        this.currentLoadedTypeId = selectedTypeId;
        this.addDynamicTypeControls(this.selectedTypeDemandeChamps);
      },
      error: () => {
        this.selectedTypeDemandeChamps = [];
        this.currentLoadedTypeId = null;
      }
    });
  }

  private extractSelectOptions(optionsJson: unknown): string[] {
    const raw = String(optionsJson ?? '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter((v) => v.length > 0);
      }
      if (parsed && Array.isArray((parsed as any).options)) {
        return (parsed as any).options
          .map((v: unknown) => String(v).trim())
          .filter((v: string) => v.length > 0);
      }
      return [];
    } catch {
      return [];
    }
  }

  dynamicControlName(champ: { id: number; code: string }): string {
    const base = (champ.code || `champ_${champ.id}`).replace(/[^a-zA-Z0-9_]/g, '_');
    return `dynamic_${base}_${champ.id}`;
  }

  private clearDynamicTypeControls(): void {
    if (!this.demandeForm) return;
    const toRemove = Object.keys(this.demandeForm.controls).filter((k) => k.startsWith('dynamic_'));
    toRemove.forEach((k) => this.demandeForm.removeControl(k));
  }

  private addDynamicTypeControls(champs: Array<{ id: number; code: string; obligatoire: boolean; typeChamp: string }>): void {
    if (!this.demandeForm) return;
    champs.forEach((champ) => {
      const controlName = this.dynamicControlName(champ as any);
      if (this.demandeForm.get(controlName)) return;
      const validators = champ.obligatoire ? [Validators.required] : [];
      this.demandeForm.addControl(controlName, this.fb.control('', validators));
    });
  }
  onFileSelected($event: Event) {
    const input = $event.target as HTMLInputElement;
    const files = input.files && input.files.length > 0 ? Array.from(input.files) : [];

    if (!files.length) {
      this.selectedFileName = null;
      this.selectedFileNames = [];
      this.selectedFiles = [];
      this.demandeForm.patchValue({ file: null });
      return;
    }

    this.selectedFiles = files;
    this.selectedFileNames = files.map((f) => f.name);
    this.selectedFileName =
      files.length === 1 ? files[0].name : `${files.length} fichiers sélectionnés`;

    // Le backend garde un endpoint unitaire; on stocke la liste locale.
    this.demandeForm.patchValue({ file: files });
  }

    onDragOver(event: DragEvent) {
      event.preventDefault();
      this.isDragOver = true;
    }

    onDragLeave(event: DragEvent) {
      event.preventDefault();
      this.isDragOver = false;
    }

    onDrop(event: DragEvent) {
      event.preventDefault();
      this.isDragOver = false;

      const filesList = event.dataTransfer?.files;
      const files = filesList && filesList.length > 0 ? Array.from(filesList) : [];

      if (!files.length) {
        this.selectedFileName = null;
        this.selectedFileNames = [];
        this.selectedFiles = [];
        this.demandeForm.patchValue({ file: null });
        return;
      }

      this.selectedFiles = files;
      this.selectedFileNames = files.map((f) => f.name);
      this.selectedFileName =
        files.length === 1 ? files[0].name : `${files.length} fichiers sélectionnés`;

      this.demandeForm.patchValue({ file: files });
    }
  onSubmit(): void {
    if (this.demandeForm.invalid || this.isSubmitting) {
      this.demandeForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.demandeForm.disable();

    const raw = this.demandeForm.getRawValue();
    const objet = (raw.objet ?? '').toString().trim();
    const description = (raw.description ?? '').toString().trim();
    const codenp = (raw.codenp ?? '').toString().trim();
    const codeapp = (raw.codeapp ?? '').toString().trim();
    const typedemande = (raw.typedemande ?? '').toString().trim();
    const allowedTypes = new Set(
      (this.typeDemandes.length > 0
        ? this.typeDemandes.map((t) => t.code)
        : this.demandeTypeOptions.map((t) => t.value))
    );
    if (!allowedTypes.has(typedemande)) {
      this.isSubmitting = false;
      this.demandeForm.enable();
      this.notificationService.show(
        'Type de demande invalide. Valeurs autorisées : EVOLUTION ou PARAMETRABLE.',
        'error',
        5000
      );
      this.cdr.detectChanges();
      return;
    }

    const missingRequiredDynamic = this.selectedTypeDemandeChamps.some((champ) => {
      if (!champ.obligatoire) return false;
      const value = this.demandeForm.get(this.dynamicControlName(champ))?.value;
      return value == null || String(value).trim() === '';
    });
    if (missingRequiredDynamic) {
      this.notificationService.show('Veuillez renseigner les champs obligatoires liés au type de demande.', 'warning', 4000);
      this.demandeForm.markAllAsTouched();
      this.isSubmitting = false;
      this.demandeForm.enable();
      this.cdr.detectChanges();
      return;
    }
    const filesToUpload = Array.isArray(this.selectedFiles)
      ? this.selectedFiles.filter((f): f is File => f instanceof File)
      : [];
    const selectedType = this.typeDemandes.find((t) => t.code === typedemande);
    const typedemandeId = Number(selectedType?.id);
    if (!Number.isFinite(typedemandeId)) {
      this.isSubmitting = false;
      this.demandeForm.enable();
      this.notificationService.show('Type de demande invalide: identifiant introuvable.', 'error', 5000);
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      objet,
      description,
      departement: (raw.codeDepartement ?? '').toString().trim(),
      typedemande: typedemande,
    };

    this.demandeService
      .addDemande(payload, codenp, codeapp, typedemandeId)
      .pipe(
        switchMap((created: any) => {
          const createdId = Number(
            created?.id ??
            created?.demandeId ??
            created?.idDemande ??
            created?.data?.id
          );

          if (Number.isNaN(createdId) || createdId <= 0) {
            return of(created);
          }

          const maybeUpload$ = filesToUpload.reduce(
            (chain$, f) => chain$.pipe(
              switchMap(() => this.demandeService.addDocument(createdId, f))
            ),
            of(null as any)
          );

          // Après création (+ upload éventuel), on conserve la demande en brouillon/initiée.
          return maybeUpload$.pipe(
            switchMap(() => of(created))
          );
        }),
        finalize(() => {
          this.isSubmitting = false;
          this.demandeForm.enable();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/demandes/mes-demandes']);
        },
        error: (err) => {
          const msg = err?.error?.message ?? err?.error?.detail ?? err?.message ?? 'Erreur lors de la création de la demande.';
          setTimeout(() => {
            this.notificationService.show(String(msg), 'error', 5000);
          }, 0);
        },
      });
  }

  onCancel(): void {
    this.router.navigate(['/demandes/mes-demandes']);
  }
}