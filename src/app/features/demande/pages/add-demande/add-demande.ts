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
    const allowedTypes = new Set(this.demandeTypeOptions.map((t) => t.value));
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
    const filesToUpload = Array.isArray(this.selectedFiles)
      ? this.selectedFiles.filter((f): f is File => f instanceof File)
      : [];

    const payload = {
      objet,
      description,
      departement: (raw.codeDepartement ?? '').toString().trim(),
      typedemande: typedemande,
    };

    this.demandeService
      .addDemande(payload, codenp, codeapp)
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