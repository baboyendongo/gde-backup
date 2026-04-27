import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DemandeService } from '../../../demande/services/demande-service';
import { Demande } from '../../../demande/models/demande';
import { AuthService } from '../../../../core/service/auth.service';
import { finalize } from 'rxjs/operators';


interface DashboardStats {
  total: number;
  enCours: number;
  terminees: number;
  rejetees: number;
  completionRate: number;
}

@Component({
  selector: 'app-dashboard-component',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './dashboard-component.html',
  styleUrl: './dashboard-component.css',
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats = {
    total: 0,
    enCours: 0,
    terminees: 0,
    rejetees: 0,
    completionRate: 0
  };

  recentDemandes: Demande[] = [];
  allDemandes: Demande[] = [];
  statusKpi = {
    submitted: 0,
    enCoursSi: 0,
    enCoursAdmin: 0,
    enCoursPartenaire: 0,
    accepte: 0,
    rejected: 0,
    aCorrigerParDemandeur: 0
  };
  finalStatusKpi = {
    livre: 0,
    test: 0,
    preprod: 0
  };
  allStatusKpi: Array<{ code: string; label: string; count: number }> = [];
  finalStatusKpiList: Array<{ code: string; label: string; count: number }> = [];
  topApplications: Array<{ app: string; count: number }> = [];
  loadError: string | null = null;
  isLoading = true;
  userName = '';
  currentDate = new Date();
  private lastRefreshDate = new Date();

  constructor(
    private demandeService: DemandeService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.getConnectedUserFullName() || 'Utilisateur';
    // Décaler le chargement au prochain cycle pour que la vue soit prête (évite le double clic avec loadComponent)
    setTimeout(() => this.loadDashboardData(), 0);
  }

  loadDashboardData(): void {
    this.loadError = null;
    this.isLoading = true;

    this.demandeService
      .getDemandesList()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (demandes: Demande[]) => {
          this.allDemandes = demandes || [];
          this.calculateStats(this.allDemandes);
          this.recentDemandes = [...this.allDemandes]
            .sort((a, b) => new Date(b.datecreate || 0).getTime() - new Date(a.datecreate || 0).getTime())
            .slice(0, 5);
          this.lastRefreshDate = new Date();
          this.currentDate = this.lastRefreshDate;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Erreur lors du chargement du dashboard:', err);
          this.allDemandes = [];
          this.recentDemandes = [];
          this.calculateStats([]);
          this.loadError = err?.message || 'Impossible de charger les données du tableau de bord.';
          this.cdr.detectChanges();
        }
      });
  }

  getDescriptionPreview(demande: Demande, maxLen: number = 70): string {
    const desc = demande?.description ?? '';
    if (desc.length <= maxLen) return desc;
    return desc.substring(0, maxLen) + '...';
  }

  calculateStats(demandes: Demande[]): void {
    this.stats.total = demandes.length;
    // Résolues = DONE (API) ou TERMINÉ / RÉSOLU
    this.stats.terminees = demandes.filter(d => {
      const s = this.normalizeStatus(d.statut || '');
      return s === 'DONE' || s.includes('TERMIN') || s.includes('RÉSOLU') || s.includes('RESOLU');
    }).length;
    // Rejetées = REJETE / REJECTED (API)
    this.stats.rejetees = demandes.filter(d => {
      const s = this.normalizeStatus(d.statut || '');
      return s.includes('REJET') || s === 'REJECTED';
    }).length;
    this.stats.enCours = demandes.filter(d => this.normalizeStatus(d.statut || '').includes('COURS')).length;
    const acceptedCount = demandes.filter(d => {
      const s = this.normalizeStatus(d.statut || '');
      return s === 'ACCEPTE' || s === 'ACCEPTEE' || s === 'VALIDEE' || s === 'VALIDER';
    }).length;
    this.stats.completionRate = this.stats.total > 0 ? Math.round((acceptedCount / this.stats.total) * 100) : 0;

    this.statusKpi = {
      submitted: demandes.filter(d => {
        const s = this.normalizeStatus(d.statut || '');
        return s === 'SUBMITED' || s === 'SUBMITTED' || s === 'SOUMIS' || s === 'SOUMISE';
      }).length,
      enCoursSi: demandes.filter(d => this.normalizeStatus(d.statut || '') === 'ENCOURS_CHEZ_SI').length,
      enCoursAdmin: demandes.filter(d => this.normalizeStatus(d.statut || '') === 'ENCOURS_CHEZ_ADMIN').length,
      enCoursPartenaire: demandes.filter(d => this.normalizeStatus(d.statut || '') === 'ENCOURS_CHEZ_PARTENAIRE').length,
      accepte: acceptedCount,
      rejected: demandes.filter(d => this.normalizeStatus(d.statut || '') === 'REJECTED').length,
      aCorrigerParDemandeur: demandes.filter(d => this.normalizeStatus(d.statut || '') === 'A_CORRIGER_PAR_DEMANDEUR').length
    };

    this.finalStatusKpi = {
      livre: demandes.filter(d => this.getFinalStatusCode(d) === 'LIVRE').length,
      test: demandes.filter(d => this.getFinalStatusCode(d) === 'TEST').length,
      preprod: demandes.filter(d => this.getFinalStatusCode(d) === 'PREPROD').length
    };

    this.finalStatusKpiList = [
      { code: 'LIVRE', label: 'Livré', count: this.finalStatusKpi.livre },
      { code: 'TEST', label: 'Test', count: this.finalStatusKpi.test },
      { code: 'PREPROD', label: 'Préprod', count: this.finalStatusKpi.preprod }
    ];

    const statusMap: Record<string, number> = {};
    demandes.forEach(d => {
      const normalized = this.getDisplayStatusCode(d);
      if (!normalized) return;
      statusMap[normalized] = (statusMap[normalized] || 0) + 1;
    });

    this.allStatusKpi = Object.entries(statusMap)
      .map(([code, count]) => ({ code, count, label: this.getStatusLabel(code) }))
      .sort((a, b) => b.count - a.count);
  }

  getStatusClass(statut: string): string {
    if (!statut) return 'badge-default';
    const normalized = statut.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    return `badge-status-${normalized}`;
  }

  getStatusLabel(statut: string): string {
    if (!statut) return 'Inconnu';

    const normalized = statut
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[\s-]+/g, '_');

    const labelMap: Record<string, string> = {
      INITIE: 'Demande Initiée',
      INITIEE: 'Demande Initiée',
      INITIATED: 'Demande Initiée',
      CREATED: 'Créé',
      CREE: 'Créé',
      CREEE: 'Créé',
      EN_COURS: 'En cours',
      ENCOURS: 'En cours',
      EN_COURS_DE_TRAITEMENT_SI: 'Workflow au niveau SI',
      ENCOURS_CHEZ_SI: 'Workflow au niveau SI',
      EN_COURS_DE_TRAITEMENT_ADMIN: 'Workflow au niveau ADMIN',
      ENCOURS_CHEZ_ADMIN: 'Workflow au niveau ADMIN',
      EN_COURS_DE_TRAITEMENT_PARTENAIRE: 'Workflow au niveau Partenaire',
      ENCOURS_CHEZ_PARTENAIRE: 'Workflow au niveau Partenaire',
      VALIDEE: 'Demande acceptée',
      VALIDER: 'Demande acceptée',
      ACCEPTE: 'Demande acceptée',
      ACCEPTEE: 'Demande acceptée',
      TERMINE: 'Terminée',
      TERMINEE: 'Terminée',
      DONE: 'Terminée',
      EN_ATTENTE: 'En attente',
      ENATTENTE: 'En attente',
      REJETE: 'Rejeté',
      REJETEE: 'Rejeté',
      REJECTED: 'Rejeté',
      A_CORRIGER_PAR_DEMANDEUR: 'Retourné au demandeur',
      RETOURNER_SI: "Retour à l'équipe SI",
      SUBMITED: 'Demande soumise',
      SUBMITTED: 'Demande soumise',
      LIVRE: 'Livré',
      TEST: 'Test',
      PREPROD: 'Préprod'
    };

    return labelMap[normalized] || statut;
  }

  getRecentMainStatusCode(demande: Demande): string {
    return this.normalizeStatus(demande?.statut || '');
  }

  getRecentFinalStatusCode(demande: Demande): string {
    return this.getFinalStatusCode(demande);
  }

  hasRecentFinalStatus(demande: Demande): boolean {
    return !!this.getRecentFinalStatusCode(demande);
  }

  private getFinalStatusCode(demande: any): string {
    const finalStatus = demande?.statutfinal ?? demande?.statutFinal ?? demande?.statut_final ?? '';
    return this.normalizeStatus(finalStatus);
  }

  private getDisplayStatusCode(demande: any): string {
    const finalCode = this.getFinalStatusCode(demande);
    if (finalCode) return finalCode;
    return this.normalizeStatus(demande?.statut ?? '');
  }

  private normalizeStatus(value: string): string {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  getCompletionPercentage(): number {
    return this.stats.completionRate;
  }

  getDemandsByPriority(): Record<string, number> {
    const priorityMap: Record<string, number> = {};
    this.allDemandes.forEach(d => {
      const priority = d.niveaupriorite || 'Non défini';
      priorityMap[priority] = (priorityMap[priority] || 0) + 1;
    });
    return priorityMap;
  }

  getTopApplications(): Array<{app: string, count: number}> {
    const appMap: Record<string, number> = {};
    this.allDemandes.forEach(d => {
      const app = d.application || 'Non définie';
      appMap[app] = (appMap[app] || 0) + 1;
    });
    return Object.entries(appMap)
      .map(([app, count]) => ({ app, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  getAveragePerActiveMonth(): number {
    const activeMonths = this.getActiveMonthCount();
    if (!activeMonths) return 0;
    return Number((this.stats.total / activeMonths).toFixed(1));
  }

  getActiveMonthCount(): number {
    if (!this.allDemandes.length) return 0;
    const months = new Set<string>();
    this.allDemandes.forEach((d) => {
      const date = d?.datecreate ? new Date(d.datecreate) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    });
    return months.size;
  }

  getLast30DaysCount(): number {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return this.allDemandes.filter((d) => {
      const t = d?.datecreate ? new Date(d.datecreate).getTime() : NaN;
      return !Number.isNaN(t) && now - t <= thirtyDaysMs;
    }).length;
  }

  getPrevious30DaysCount(): number {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return this.allDemandes.filter((d) => {
      const t = d?.datecreate ? new Date(d.datecreate).getTime() : NaN;
      if (Number.isNaN(t)) return false;
      const age = now - t;
      return age > thirtyDaysMs && age <= (2 * thirtyDaysMs);
    }).length;
  }

  getThirtyDaysTrendLabel(): string {
    const current = this.getLast30DaysCount();
    const previous = this.getPrevious30DaysCount();
    const diff = current - previous;
    if (diff > 0) return `+${diff} vs 30 jours précédents`;
    if (diff < 0) return `${diff} vs 30 jours précédents`;
    return 'Stable vs 30 jours précédents';
  }

  trackByDemandeId(_: number, d: Demande): number {
    return d.id;
  }

  trackByApp(_: number, item: { app: string; count: number }): string {
    return item.app;
  }
}
