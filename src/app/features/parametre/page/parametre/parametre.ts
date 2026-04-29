import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { User, UserStatus } from '../../models/users';
import {
  PartenaireService,
  ApplicationItem,
  CreateAppRequest,
  TypeDemandeItem,
  TypeDemandeChampItem
} from '../../services/parametre-service';
import { CreatePartenaireRequest } from '../../models/partenaire';
import { NotificationService } from '../../../../services/notification.service';
import { RolePermissionService } from '../../services/rolepermission.service';

@Component({
  selector: 'app-parametre',
  templateUrl: './parametre.html',
  styleUrls: ['./parametre.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class Parametre implements OnInit {

  partners: any;

  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm: string = '';
  public activeTab: 'users' | 'partners' | 'apps' | 'typeConfig' = 'users';
  isLoading = true;
  private loadDoneCount = 0;
  // Pour un rendu rapide de la page Paramètre, on ne bloque l'écran
  // que sur les données nécessaires à l'administration des types.
  private readonly LOAD_TOTAL = 2; // applications, types demande

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  Math = Math; // Pour l'utiliser dans le template HTML

  get paginatedUsers(): User[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredUsers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage) || 1;
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Modal
  showUserModal = false;
  editingUser: any;
  isSavingUser = false;
  isChangingUserStatus = false;

  // Modal partenaire
  showPartnerModal = false;
  editingPartner: any = null;
  isSavingPartner = false;
  private normalizeAppIds(input: any): number[] {
    if (!Array.isArray(input)) return [];
    return input
      .map((v: any) => {
        if (v == null) return NaN;
        // accepte: [1,2], ["1","2"], [{id:1}], [{applicationId:1}]
        if (typeof v === 'object') return Number(v.id ?? v.applicationId ?? v.appId);
        return Number(v);
      })
      .filter((v: number) => Number.isFinite(v));
  }

  rolesFromDatabase: any[] = [];

  // Applications / Équipes SI
  applications: ApplicationItem[] = [];
  showAppModal = false;
  editingApp: CreateAppRequest | null = null;
  isSavingApp = false;

  // Configuration par type de demande
  typeDemandes: TypeDemandeItem[] = [];
  selectedTypeDemande: TypeDemandeItem | null = null;
  selectedTypeDemandeId: number | null = null;
  typeDemandeChamps: TypeDemandeChampItem[] = [];
  isLoadingTypeChamps = false;
  isSavingTypeDemande = false;
  isSavingTypeChamp = false;
  isDeletingTypeDemandeId: number | null = null;
  editingTypeDemandeId: number | null = null;
  newTypeDemande = { code: '', libelle: '', description: '', actif: true };
  newTypeChamp = { code: '', libelle: '', typeChamp: 'TEXT', obligatoire: false, ordre: 0, optionsJson: '' };
  readonly typeChampOptions = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'TEXTAREA'];

  constructor(
    private partenaireService: PartenaireService,
    private notificationService: NotificationService,
    private rolePermissionService: RolePermissionService,
    private cdr: ChangeDetectorRef
  ) {
    this.activeTab = 'users';
  }

  ngOnInit() {
    this.loadDoneCount = 0;
    this.isLoading = true;
    // Décaler le chargement après le premier cycle de détection
    setTimeout(() => {
      this.loadUsers();
      this.loadPartenaires();
      this.loadApplications();
      this.loadTypeDemandes();
      this.loadRolesFromDatabase();
    }, 0);
  }

  private onLoadDone(): void {
    this.loadDoneCount++;
    if (this.loadDoneCount >= this.LOAD_TOTAL) {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  loadApplications() {
    this.partenaireService.getListeEquipesi().pipe(
      finalize(() => this.onLoadDone())
    ).subscribe({
      next: (list) => {
        this.applications = Array.isArray(list) ? list : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement applications / équipes SI', err);
        this.applications = [];
        this.notificationService.show('Erreur lors du chargement des applications', 'error', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  openAppModal() {
    this.editingApp = { id: 0, code: '', libelle: '', active: true };
    this.showAppModal = true;
  }

  closeAppModal() {
    this.showAppModal = false;
    this.editingApp = null;
    this.isSavingApp = false;
  }

  saveApp() {
    if (!this.editingApp || !this.editingApp.code?.trim() || !this.editingApp.libelle?.trim()) {
      this.notificationService.show('Code et libellé sont obligatoires', 'warning', 3000);
      return;
    }
    this.isSavingApp = true;
    this.partenaireService.createApp(this.editingApp).subscribe({
      next: (created) => {
        this.isSavingApp = false;
        this.notificationService.show('Application ajoutée avec succès', 'success', 3000);
        this.closeAppModal();
        this.loadApplications();
      },
      error: (err) => {
        this.isSavingApp = false;
        this.notificationService.show(
          err?.error?.message || err?.message || 'Erreur lors de l\'ajout',
          'error',
          5000
        );
      }
    });
  }

  saveAppAndOpenPartner() {
    if (!this.editingApp || !this.editingApp.code?.trim() || !this.editingApp.libelle?.trim()) {
      this.notificationService.show('Code et libellé sont obligatoires', 'warning', 3000);
      return;
    }
    this.isSavingApp = true;
    this.partenaireService.createApp(this.editingApp).subscribe({
      next: (created) => {
        this.isSavingApp = false;
        this.notificationService.show('Application ajoutée avec succès', 'success', 3000);

        const createdAppId = Number((created as any)?.id);
        this.closeAppModal();
        this.loadApplications();

        this.activeTab = 'partners';
        this.openPartnerModal();
        if (Number.isFinite(createdAppId) && this.editingPartner) {
          this.editingPartner.applicationId = [createdAppId];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingApp = false;
        this.notificationService.show(
          err?.error?.message || err?.message || 'Erreur lors de l\'ajout',
          'error',
          5000
        );
      }
    });
  }

  loadTypeDemandes(): void {
    this.partenaireService.getTypeDemandes().pipe(
      finalize(() => this.onLoadDone())
    ).subscribe({
      next: (items) => {
        this.typeDemandes = (Array.isArray(items) ? items : []).map((raw) => {
          const id = this.getTypeDemandeId(raw);
          return {
            ...raw,
            id: id ?? undefined,
            code: String((raw as any)?.code ?? (raw as any)?.codedemande ?? ''),
            libelle: String((raw as any)?.libelle ?? (raw as any)?.label ?? ''),
            actif: (raw as any)?.actif ?? (raw as any)?.active ?? true,
          } as TypeDemandeItem;
        });
        // Exiger une sélection explicite avant d'ajouter un champ
        if (!this.typeDemandes.some((t) => this.getTypeDemandeId(t) === this.selectedTypeDemandeId)) {
          this.selectedTypeDemande = null;
          this.selectedTypeDemandeId = null;
          this.typeDemandeChamps = [];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des types de demande', err);
        this.typeDemandes = [];
        this.notificationService.show('Erreur lors du chargement des types de demande', 'error', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  private getTypeDemandeId(item: TypeDemandeItem | null | undefined): number | null {
    const rawId =
      (item as any)?.id ??
      (item as any)?.iddemande ??
      (item as any)?.idDemande ??
      (item as any)?.idTypeDemande ??
      (item as any)?.typeDemandeId;
    const id = Number(rawId);
    return Number.isFinite(id) ? id : null;
  }

  private getTypeDemandeChampId(champ: TypeDemandeChampItem | null | undefined): number | null {
    const rawId =
      (champ as any)?.id ??
      (champ as any)?.idchamp ??
      (champ as any)?.idChamp;
    const id = Number(rawId);
    return Number.isFinite(id) ? id : null;
  }

  selectTypeDemande(item: TypeDemandeItem): void {
    this.selectedTypeDemande = item;
    this.selectedTypeDemandeId = this.getTypeDemandeId(item);
    const id = this.getTypeDemandeId(item);
    if (!id) {
      this.typeDemandeChamps = [];
      return;
    }
    this.isLoadingTypeChamps = true;
    this.partenaireService.getTypeDemandeChamps(id).pipe(
      finalize(() => {
        this.isLoadingTypeChamps = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (champs) => {
        this.typeDemandeChamps = (Array.isArray(champs) ? champs : []).map((raw) => {
          const id = this.getTypeDemandeChampId(raw);
          return {
            ...raw,
            id: id ?? undefined,
            code: String((raw as any)?.code ?? ''),
            libelle: String((raw as any)?.libelle ?? ''),
            typeChamp: String((raw as any)?.typeChamp ?? (raw as any)?.type ?? ''),
            obligatoire: (raw as any)?.obligatoire ?? (raw as any)?.required ?? (raw as any)?.requis ?? false
          } as TypeDemandeChampItem;
        });
      },
      error: (err) => {
        console.error('Erreur lors du chargement des champs', err);
        this.typeDemandeChamps = [];
        this.notificationService.show('Erreur lors du chargement des champs du type', 'error', 5000);
      }
    });
  }

  onSelectedTypeDemandeChange(): void {
    const id = Number(this.selectedTypeDemandeId);
    if (!Number.isFinite(id)) {
      this.selectedTypeDemande = null;
      this.typeDemandeChamps = [];
      return;
    }
    const selected = this.typeDemandes.find((t) => Number(t.id) === id) || null;
    if (!selected) {
      this.selectedTypeDemande = null;
      this.typeDemandeChamps = [];
      return;
    }
    this.selectTypeDemande(selected);
  }

  createTypeDemande(): void {
    const code = this.newTypeDemande.code.trim();
    const libelle = this.newTypeDemande.libelle.trim();
    if (!code || !libelle) {
      this.notificationService.show('Code et libellé du type sont obligatoires', 'warning', 3000);
      return;
    }
    this.isSavingTypeDemande = true;
    this.partenaireService.createTypeDemande({
      code,
      libelle,
      description: this.newTypeDemande.description?.trim() || undefined,
      actif: this.newTypeDemande.actif
    }).pipe(finalize(() => {
      this.isSavingTypeDemande = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: (created) => {
        this.notificationService.show('Type de demande créé', 'success', 3000);
        this.newTypeDemande = { code: '', libelle: '', description: '', actif: true };
        this.loadTypeDemandes();
        if (created) this.selectedTypeDemande = created;
      },
      error: (err) => {
        this.notificationService.show(err?.error?.message || 'Erreur lors de la création du type', 'error', 5000);
      }
    });
  }

  startEditTypeDemande(item: TypeDemandeItem): void {
    const id = this.getTypeDemandeId(item);
    if (!id) return;
    this.editingTypeDemandeId = id;
    this.newTypeDemande = {
      code: String((item as any)?.code ?? '').trim(),
      libelle: String((item as any)?.libelle ?? '').trim(),
      description: String((item as any)?.description ?? '').trim(),
      actif: ((item as any)?.actif ?? (item as any)?.active ?? true) !== false,
    };
    this.cdr.detectChanges();
  }

  cancelEditTypeDemande(): void {
    this.editingTypeDemandeId = null;
    this.newTypeDemande = { code: '', libelle: '', description: '', actif: true };
  }

  saveTypeDemande(): void {
    if (!this.editingTypeDemandeId) {
      this.createTypeDemande();
      return;
    }

    const code = this.newTypeDemande.code.trim();
    const libelle = this.newTypeDemande.libelle.trim();
    if (!code || !libelle) {
      this.notificationService.show('Code et libellé du type sont obligatoires', 'warning', 3000);
      return;
    }

    this.isSavingTypeDemande = true;
    this.partenaireService.updateTypeDemande(this.editingTypeDemandeId, {
      code,
      libelle,
      description: this.newTypeDemande.description?.trim() || undefined,
      actif: this.newTypeDemande.actif
    }).pipe(finalize(() => {
      this.isSavingTypeDemande = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: () => {
        this.notificationService.show('Type de demande modifié', 'success', 3000);
        this.cancelEditTypeDemande();
        this.loadTypeDemandes();
      },
      error: (err) => {
        this.notificationService.show(err?.error?.message || 'Erreur lors de la modification du type', 'error', 5000);
      }
    });
  }

  deleteTypeDemande(item: TypeDemandeItem): void {
    const id = this.getTypeDemandeId(item);
    if (!id) {
      this.notificationService.show(
        'Suppression impossible: identifiant du type introuvable dans la réponse API.',
        'error',
        5000
      );
      return;
    }
    if (this.isDeletingTypeDemandeId === id) return;
    const label = String(item.libelle || item.code || id);
    if (!confirm(`Supprimer le type de demande "${label}" ?`)) return;
    this.isDeletingTypeDemandeId = id;

    // Nettoyage UI immédiat pour éviter d'afficher des champs orphelins
    if (this.getTypeDemandeId(this.selectedTypeDemande) === id) {
      this.selectedTypeDemande = null;
      this.selectedTypeDemandeId = null;
      this.typeDemandeChamps = [];
    }
    this.typeDemandes = this.typeDemandes.filter((t) => this.getTypeDemandeId(t) !== id);
    this.cdr.detectChanges();

    this.partenaireService.getTypeDemandeChamps(id).subscribe({
      next: (champs) => {
        const champIds = (Array.isArray(champs) ? champs : [])
          .map((c) => this.getTypeDemandeChampId(c))
          .filter((cid): cid is number => typeof cid === 'number' && Number.isFinite(cid));

        const deleteChamps$ = champIds.length > 0
          ? forkJoin(champIds.map((cid) => this.partenaireService.deleteTypeDemandeChamp(cid)))
          : of([]);

        deleteChamps$.subscribe({
          next: () => {
            this.partenaireService.deleteTypeDemande(id).pipe(
              finalize(() => {
                this.isDeletingTypeDemandeId = null;
                this.cdr.detectChanges();
              })
            ).subscribe({
              next: () => {
                this.notificationService.show('Type de demande supprimé', 'success', 3000);
                if (this.getTypeDemandeId(this.selectedTypeDemande) === id) {
                  this.selectedTypeDemande = null;
                  this.selectedTypeDemandeId = null;
                  this.typeDemandeChamps = [];
                }
                this.loadTypeDemandes();
              },
              error: (err) => {
                this.notificationService.show(
                  err?.error?.message || 'Suppression impossible. Vérifiez les dépendances liées au type.',
                  'error',
                  6000
                );
              }
            });
          },
          error: () => {
            this.isDeletingTypeDemandeId = null;
            this.notificationService.show(
              'Impossible de supprimer les champs liés avant la suppression du type.',
              'error',
              6000
            );
          }
        });
      },
      error: () => {
        this.isDeletingTypeDemandeId = null;
        this.notificationService.show('Erreur lors de la préparation de suppression du type.', 'error', 5000);
      }
    });
  }

  createTypeChamp(): void {
    const typeId = this.getTypeDemandeId(this.selectedTypeDemande);
    if (!typeId) {
      this.notificationService.show('Sélectionnez un type de demande', 'warning', 3000);
      return;
    }
    const code = this.newTypeChamp.code.trim();
    const libelle = this.newTypeChamp.libelle.trim();
    if (!code || !libelle) {
      this.notificationService.show('Code et libellé du champ sont obligatoires', 'warning', 3000);
      return;
    }
    const typeChamp = (this.newTypeChamp.typeChamp || 'TEXT').trim().toUpperCase();
    if (typeChamp === 'SELECT' && !(this.newTypeChamp.optionsJson || '').trim()) {
      this.notificationService.show('Options JSON est obligatoire pour le type SELECT', 'warning', 3500);
      return;
    }
    this.isSavingTypeChamp = true;
    this.partenaireService.createTypeDemandeChamp(typeId, {
      code,
      libelle,
      typeChamp,
      obligatoire: this.newTypeChamp.obligatoire === true,
      ordre: Number.isFinite(Number(this.newTypeChamp.ordre)) ? Number(this.newTypeChamp.ordre) : 0,
      optionsJson: typeChamp === 'SELECT' ? ((this.newTypeChamp.optionsJson || '').trim() || undefined) : undefined,
      iddemande: typeId
    }).pipe(finalize(() => {
      this.isSavingTypeChamp = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: () => {
        this.notificationService.show('Champ ajouté au type', 'success', 3000);
        this.newTypeChamp = { code: '', libelle: '', typeChamp: 'TEXT', obligatoire: false, ordre: 0, optionsJson: '' };
        this.selectTypeDemande(this.selectedTypeDemande!);
      },
      error: (err) => {
        this.notificationService.show(err?.error?.message || 'Erreur lors de l’ajout du champ', 'error', 5000);
      }
    });
  }

  onTypeChampChange(): void {
    const typeChamp = (this.newTypeChamp.typeChamp || '').trim().toUpperCase();
    this.newTypeChamp.typeChamp = typeChamp;
    if (typeChamp !== 'SELECT') {
      this.newTypeChamp.optionsJson = '';
    }
  }

  deleteTypeChamp(champ: TypeDemandeChampItem): void {
    const id = Number(champ?.id);
    if (!Number.isFinite(id)) return;
    const label = String(champ.libelle || champ.code || id);
    if (!confirm(`Supprimer le champ "${label}" ?`)) return;
    this.partenaireService.deleteTypeDemandeChamp(id).subscribe({
      next: () => {
        this.notificationService.show('Champ supprimé', 'success', 3000);
        if (this.selectedTypeDemande) {
          this.selectTypeDemande(this.selectedTypeDemande);
        }
      },
      error: (err) => {
        this.notificationService.show(err?.error?.message || 'Erreur lors de la suppression du champ', 'error', 5000);
      }
    });
  }

  /** Statut par défaut : utilisateurs actifs si l'API ne renvoie rien */
  readonly UserStatus = UserStatus;

  getStatusLabel(etat: string | undefined): string {
    return this.isUserActive(etat) ? 'Actif' : 'Inactif';
  }
  getStatusClass(etat: string | undefined): string {
    return this.isUserActive(etat) ? 'active' : 'inactive';
  }
  isUserActive(etat: string | undefined): boolean {
    if (!etat) return false;
  
    const e = String(etat).toLowerCase().trim();
  
    return e === 'actif';
  }
  loadRolesFromDatabase() {
    this.partenaireService.ListRolePermission().subscribe({
      next: (roles) => {
        this.rolesFromDatabase = roles;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des rôles:', err);
        // En cas d'erreur, on utilise les rôles par défaut de l'enum
      }
    });
  }

  /** Constante pour le rôle par défaut de tous les utilisateurs */
  readonly DEFAULT_ROLE = 'ROLE_USER';

  /** Rôles assignables (fallback si la base ne renvoie rien) */
  readonly ASSIGNABLE_ROLES = ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SI'];

  /** Rôles à ne pas afficher (ex: partenaire) */
  readonly HIDDEN_ROLES = ['ROLE_PARTENAIRE', 'ROLE_PARTNER'];

  /** Équipes SI chargées depuis GET /api/evolution/parametre/liste-equipesi (utilisées aussi pour assignation utilisateur) */
  isSavingEquipe = false;

  loadUsers() {
    this.partenaireService.getAllUsers().pipe(
      finalize(() => this.cdr.detectChanges())
    ).subscribe({
      next: (users: any) => {
        this.users = users
          .map((u: any) => {
            const roles = Array.isArray(u.roles) && u.roles.length > 0
              ? u.roles
              : [this.DEFAULT_ROLE];
              const etat = String(u.etat || '').toLowerCase().trim();
              return {
                ...u,
                etat: etat,
                status: etat === 'actif' || etat === 'active' ? UserStatus.ACTIVE : UserStatus.INACTIVE,
                permissions: u.permissions || [],
                roles
              };
          })
          .filter((u: any) => u.email && u.email.trim() !== '');

        this.filteredUsers = [...this.users];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        this.notificationService.show('Erreur lors du chargement des utilisateurs', 'error', 5000);
        this.users = [];
        this.filteredUsers = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadPartenaires() {
    this.partenaireService.getListePartenaires().pipe(
      finalize(() => this.cdr.detectChanges())
    ).subscribe({
      next: (data) => {
        this.partners = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des partenaires:', err);
        this.cdr.detectChanges();
      }
    });
  }
  /** Supprime un rôle spécifique de l'utilisateur en cours d'édition */
  removeRoleFromUser(roleName: string) {
    if (!this.editingUser || !this.editingUser.username) return;
    const rolesAfterRemoval = this.editingUser.roles.filter((r: string) => r !== roleName);
    const finalRoles = rolesAfterRemoval.length > 0 ? rolesAfterRemoval : [this.DEFAULT_ROLE];

    this.isSavingUser = true;
    this.rolePermissionService.deleteUserRole(this.editingUser.username, [roleName]).subscribe({
      next: () => {
        this.editingUser.roles = finalRoles;
        this.isSavingUser = false;
        this.notificationService.show('Rôle supprimé avec succès', 'success', 5000);
        this.syncUserInList(this.editingUser.username, finalRoles);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingUser = false;
        this.notificationService.show('Erreur lors de la suppression du rôle', 'error', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  /** Ajoute un rôle à l'utilisateur en cours d'édition (localement, sauvegardé au clic sur Enregistrer) */
  addRoleToUser(roleName: string) {
    if (!this.editingUser) return;
    if (!this.editingUser.roles) this.editingUser.roles = [this.DEFAULT_ROLE];
    if (!this.editingUser.roles.includes(roleName)) {
      this.editingUser.roles = [...this.editingUser.roles, roleName];
      this.cdr.detectChanges();
    }
  }

  /** Rôles disponibles à ajouter (ceux que l'utilisateur n'a pas encore) */
  get availableRolesToAdd(): string[] {
    const fromDb = (this.rolesFromDatabase || [])
      .map((r: any) => {
        if (typeof r === 'string') return r;
        if (r && typeof r === 'object') {
          return r.name || r.roleName || r.nom || '';
        }
        return '';
      })
      .filter((name: string) => !!name && typeof name === 'string');

    const allRoles = [...new Set([...this.ASSIGNABLE_ROLES, ...fromDb])]
      .filter((r) => !this.HIDDEN_ROLES.includes(r));
    const current = (this.editingUser?.roles || []) as string[];
    return allRoles.filter((name: string) => !current.includes(name));
  }

  /** Rôles affichés dans le modal (sans ROLE_PARTENAIRE) */
  get displayedUserRoles(): string[] {
    const roles = (this.editingUser?.roles || []) as string[];
    return roles.filter((r) => !this.HIDDEN_ROLES.includes(r));
  }

  /** Indique si les rôles ont été modifiés (pour activer le bouton Enregistrer) */
  get hasRoleChanges(): boolean {
    return !!this.editingUser?.roles && Array.isArray(this.editingUser.roles);
  }

  /** Retourne les rôles à afficher (ROLE_USER par défaut si vide, sans ROLE_PARTENAIRE) */
  getDisplayRoles(user: any): string {
    const roles = (user?.roles || []) as string[];
    const filtered = roles.filter((r) => !this.HIDDEN_ROLES.includes(r));
    if (filtered.length > 0) {
      return filtered.join(', ');
    }
    return this.DEFAULT_ROLE;
  }


  // Méthode de recherche
  filterUsers() {
    this.currentPage = 1; // Revenir à la première page lors d'une recherche
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredUsers = [...this.users];
      return;
    }

    this.filteredUsers = this.users.filter(user => {
      const name = (user.cn || user.username || '').toLowerCase();
      const email = (user.email || '').toLowerCase();

      return name.includes(term) ||
        email.includes(term);
    });
  }

  // Gestion des modals
  openUserModal(user: User) {
    this.editingUser = {
      ...user,
      roles: Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles
        : [this.DEFAULT_ROLE],
      equipes: Array.isArray(user.equipes) ? [...user.equipes] : [],
      customPermissions: user.customPermissions || []
    };
    this.showUserModal = true;
    // Forcer la mise à jour de la vue pour afficher rôles/équipes immédiatement
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  closeUserModal() {
    this.showUserModal = false;
    this.editingUser = null;
    this.isSavingUser = false;
    this.isChangingUserStatus = false;
  }

  getNextUserEtat(status: UserStatus | string | undefined): 'ACTIF' | 'DESACTIF' {
    return this.isUserActive(status) ? 'DESACTIF' : 'ACTIF';
  }

  getToggleStatusButtonLabel(status: UserStatus | string | undefined): string {
    return this.isUserActive(status) ? 'Désactiver le compte' : 'Activer le compte';
  }

  toggleEditingUserStatus(): void {
    const username = String(this.editingUser?.username ?? '').trim();
    if (!username) {
      this.notificationService.show('Nom utilisateur introuvable.', 'warning', 3000);
      return;
    }

    const nextEtat = this.getNextUserEtat(this.editingUser?.status);
    const actionLabel = nextEtat === 'ACTIF' ? 'activer' : 'désactiver';
    if (!confirm(`Voulez-vous ${actionLabel} l'utilisateur "${username}" ?`)) {
      return;
    }

    this.isChangingUserStatus = true;
    this.partenaireService
      .changeUserStatus({ username, etat: nextEtat })
      .pipe(finalize(() => {
        this.isChangingUserStatus = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          // Harmoniser avec la logique isUserActive existante.
          const newStatus: UserStatus =
            nextEtat === 'ACTIF' ? UserStatus.ACTIVE : UserStatus.INACTIVE;
          this.editingUser = { ...this.editingUser, status: newStatus };
          this.syncUserStatusInList(username, newStatus);
          this.notificationService.show(
            nextEtat === 'ACTIF'
              ? 'Utilisateur activé avec succès'
              : 'Utilisateur désactivé avec succès',
            'success',
            3500
          );
          this.cdr.detectChanges();
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            err?.error?.detail ||
            err?.message ||
            'Erreur lors du changement d’état utilisateur.';
          this.notificationService.show(String(msg), 'error', 5000);
        }
      });
  }

  // Modal partenaire
  openPartnerModal(partner?: any) {
    const existingAppIds: number[] =
      this.normalizeAppIds(partner?.applicationId) ||
      this.normalizeAppIds(partner?.applicationIds) ||
      (Array.isArray(partner?.applications)
        ? this.normalizeAppIds(partner.applications.map((a: any) => a?.id))
        : []);

    this.editingPartner = partner ? { ...partner } : {
      id: undefined,
      nom: '',
      emailContact: '',
      type: '',
      webhookUrl: '',
      actif: true
    };

    // normaliser pour le template
    this.editingPartner.applicationId = existingAppIds;
    this.showPartnerModal = true;
  }

  closePartnerModal() {
    this.showPartnerModal = false;
    this.editingPartner = null;
    this.isSavingPartner = false;
  }



  savePartner() {
    if (!this.editingPartner) return;

    this.isSavingPartner = true;
    const partnerData: CreatePartenaireRequest = {
      nom: this.editingPartner.nom?.trim() || '',
      emailContact: this.editingPartner.emailContact?.trim() || '',
      type: this.editingPartner.type?.trim() || '',
      webhookUrl: this.editingPartner.webhookUrl?.trim() || '',
      actif: this.editingPartner.actif ?? true,
      applicationId: Array.isArray(this.editingPartner.applicationId)
        ? this.editingPartner.applicationId
            .map((v: any) => Number(v))
            .filter((v: number) => Number.isFinite(v))
        : []
    };

    if (this.editingPartner.id !== null && this.editingPartner.id !== undefined) {
      // Mise à jour
      this.partenaireService.updatePartenaire(this.editingPartner.id, partnerData)
        .subscribe({
          next: (updatedPartner) => {
            this.isSavingPartner = false;
            const index = this.partners.findIndex((p: any) => p.id === updatedPartner.id);
            if (index > -1) {
              this.partners[index] = updatedPartner;
            }
            this.closePartnerModal();
            alert('Partenaire mis à jour avec succès');
          },
          error: (err) => {
            this.isSavingPartner = false;
            console.error('Erreur lors de la mise à jour du partenaire:', err);
            alert(`Erreur lors de la mise à jour du partenaire: ${err.message || 'Erreur inconnue'}`);
          }
        });
    } else {
      // Création
      this.partenaireService.createPartenaire(partnerData)
        .subscribe({
          next: (newPartner) => {
            this.isSavingPartner = false;
            if (newPartner && newPartner.id) {
              this.partners = [...this.partners, newPartner];
            }
            this.closePartnerModal();
            alert('Partenaire créé avec succès');
          },
          error: (err) => {
            this.isSavingPartner = false;
            console.error('Erreur lors de la création du partenaire:', err);
            console.error('Détails:', err.error);
            alert(`Erreur lors de la création du partenaire: ${err.error?.message || err.message || 'Erreur inconnue'}`);
          }
        });
    }
  }

  deletePartner(partner: any) {
    if (!confirm(`Voulez-vous vraiment supprimer le partenaire ${partner.nom}?`)) {
      return;
    }

    if (partner.id) {
      // Suppression via API
      this.partenaireService.deletePartenaire(partner.id)
        .subscribe({
      next: () => {
        this.partners = this.partners.filter((p: any) => p.id !== partner.id);
            alert('Partenaire supprimé avec succès');
          },
          error: (err) => {
            console.error('Erreur lors de la suppression du partenaire:', err);
            alert(`Erreur lors de la suppression: ${err.message || 'Erreur inconnue'}`);
          }
        });
    } else {
      // Suppression locale (si le partenaire n'a pas d'ID)
      this.partners = this.partners.filter((p: any) => p !== partner);
    }
  }

  isPartnerApplicationSelected(appId?: number): boolean {
    if (!this.editingPartner) return false;
    if (appId == null) return false;
    const id = Number(appId);
    if (!Number.isFinite(id)) return false;
    const list = this.normalizeAppIds(this.editingPartner.applicationId);
    return list.includes(id);
  }

  togglePartnerApplication(appId?: number): void {
    if (!this.editingPartner) return;
    if (appId == null) return;
    const id = Number(appId);
    if (!Number.isFinite(id)) return;
    const current: number[] = this.normalizeAppIds(this.editingPartner.applicationId);
    const idx = current.indexOf(id);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(id);
    this.editingPartner.applicationId = current;
  }

  /** Enregistre les rôles assignés à l'utilisateur */
  assignRoleToUser() {
    if (!this.editingUser) return;

    const rolesToAssign = Array.isArray(this.editingUser.roles) && this.editingUser.roles.length > 0
      ? this.editingUser.roles
      : [this.DEFAULT_ROLE];

    this.isSavingUser = true;
    this.rolePermissionService.assignUserRole(this.editingUser.username, rolesToAssign).subscribe({
      next: () => {
        this.isSavingUser = false;
        this.notificationService.show('Rôles assignés avec succès', 'success', 3000);
        this.syncUserInList(this.editingUser.username, rolesToAssign);
        this.closeUserModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingUser = false;
        console.error('Erreur lors de l\'assignation des rôles:', err);
        this.notificationService.show(
          'Erreur lors de l\'assignation des rôles',
          'error',
          5000
        );
        this.cdr.detectChanges();
      }
    });

  }

  /** Met à jour l'utilisateur dans la liste locale après modification des rôles */
  private syncUserInList(username: string, roles: string[]) {
    const idx = this.users.findIndex((u: any) => u.username === username);
    if (idx >= 0) {
      this.users[idx] = { ...this.users[idx], roles };
      this.filteredUsers = [...this.users];
    }
  }

  /** Équipes actuellement assignées à l'utilisateur (pour l'affichage dans le modal) */
  get displayedUserEquipes(): string[] {
    return Array.isArray(this.editingUser?.equipes) ? [...this.editingUser.equipes] : [];
  }

  /** Équipes SI que l'utilisateur n'a pas encore (codes issus de liste-equipesi) */
  get availableEquipesToAdd(): string[] {
    const current = this.displayedUserEquipes;
    const codes = (this.applications || [])
      .map((a) => a.code)
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
    return codes.filter((eq) => !current.includes(eq));
  }

  /** Assigne l'utilisateur à une équipe SI (appel API puis mise à jour locale) */
  assignUserToEquipe(codequipesi: string) {
    const username = this.editingUser?.username;
    if (!username || !codequipesi.trim()) return;
    this.isSavingEquipe = true;
    this.partenaireService.assignUserToEquipe(username, codequipesi).subscribe({
      next: () => {
        if (!this.editingUser.equipes) this.editingUser.equipes = [];
        if (!this.editingUser.equipes.includes(codequipesi)) {
          this.editingUser.equipes = [...this.editingUser.equipes, codequipesi];
        }
        this.syncUserEquipesInList(username, this.editingUser.equipes);
        this.isSavingEquipe = false;
        this.notificationService.show(`Assigné à l'équipe ${codequipesi}`, 'success', 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingEquipe = false;
        this.notificationService.show(
          err?.error?.message || err?.message || 'Erreur lors de l\'assignation à l\'équipe',
          'error',
          5000
        );
        this.cdr.detectChanges();
      }
    });
  }

  /** Retire l'utilisateur d'une équipe SI (appel API puis mise à jour locale) */
  removeUserFromEquipe(codequipesi: string) {
    const username = this.editingUser?.username;
    if (!username || !codequipesi.trim()) return;
    this.isSavingEquipe = true;
    this.partenaireService.removeUserEquipe(username, codequipesi).subscribe({
      next: () => {
        if (Array.isArray(this.editingUser.equipes)) {
          this.editingUser.equipes = this.editingUser.equipes.filter((e: string) => e !== codequipesi);
        }
        this.syncUserEquipesInList(username, this.editingUser.equipes || []);
        this.isSavingEquipe = false;
        this.notificationService.show(`Retiré de l'équipe ${codequipesi}`, 'success', 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingEquipe = false;
        this.notificationService.show(
          err?.error?.message || err?.message || 'Erreur lors du retrait de l\'équipe',
          'error',
          5000
        );
        this.cdr.detectChanges();
      }
    });
  }

  private syncUserEquipesInList(username: string, equipes: string[]) {
    const idx = this.users.findIndex((u: any) => u.username === username);
    if (idx >= 0) {
      this.users[idx] = { ...this.users[idx], equipes: [...equipes] };
      this.filteredUsers = [...this.users];
    }
  }

  private syncUserStatusInList(username: string, status: UserStatus) {
    const idx = this.users.findIndex((u: any) => u.username === username);
    if (idx >= 0) {
      this.users[idx] = { ...this.users[idx], status };
      this.filteredUsers = [...this.users];
    }
  }
}
