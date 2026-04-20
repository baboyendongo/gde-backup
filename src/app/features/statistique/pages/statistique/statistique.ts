import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatistiqueService, StatistiqueData } from '../../services/statistique-service';
import { Subject } from 'rxjs';
import { takeUntil, take, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-statistique',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistique.html',
  styleUrl: './statistique.css',
})
export class Statistique implements OnInit, OnDestroy {
  stats: StatistiqueData | null = null;
  errorMessage = '';
  isLoading = true;

  // Données pour les graphiques
  prioriteLabels: string[] = [];
  prioriteValues: number[] = [];

  typeLabels: string[] = [];
  typeValues: number[] = [];

  statusLabels: string[] = [];
  statusValues: number[] = [];

  appLabels: string[] = [];
  appValues: number[] = [];
  /** Somme des volumes du top affiché (pour % de couverture du total des demandes). */
  appChartSum = 0;

  deptLabels: string[] = [];
  deptValues: number[] = [];

  /** Statuts finaux (TEST, PREPROD, LIVRE) */
  finalLabels: string[] = [];
  finalValues: number[] = [];

  /** Créations par mois (ordonnées) */
  moisLabels: string[] = [];
  moisValues: number[] = [];

  @ViewChild('prioriteCanvas') prioriteCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('typeCanvas') typeCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('finalCanvas') finalCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('moisCanvas') moisCanvas?: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();

  constructor(
    private statistiqueService: StatistiqueService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Décaler le chargement au prochain cycle pour que la vue soit prête (évite le double clic avec loadComponent)
    setTimeout(() => this.loadStatistiques(), 0);
  }

  ngOnDestroy(): void {
    console.log('🔴 Statistique - ngOnDestroy');
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStatistiques(): void {
    this.errorMessage = '';
    this.isLoading = true;

    this.statistiqueService.getStatistiques()
      .pipe(
        take(1),
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          this.stats = data;
          this.prepareChartData();
          this.cdr.detectChanges();
          setTimeout(() => this.renderAllCanvases(), 0);
        },
        error: (err) => {
          console.error('❌ Erreur:', err);
          this.errorMessage = 'Erreur lors du chargement des statistiques. Veuillez réessayer.';
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Prépare les données pour les graphiques
   */
  private prepareChartData(): void {
    if (!this.stats) return;

    // Données pour le graphique de priorité (normalisées + ordonnées)
    const normalizedPriorities: Record<string, number> = {};
    const rawPriorities = this.stats.demandesParPriorite ?? {};
    Object.entries(rawPriorities).forEach(([key, value]) => {
      const normalizedKey = this.normalizePrioriteKey(key);
      normalizedPriorities[normalizedKey] = (normalizedPriorities[normalizedKey] || 0) + (Number(value) || 0);
    });

    const priorityOrder = ['URGENT', 'ELEVE', 'MOYEN', 'NORMAL', 'NON_URGENT'];
    const allPriorityKeys = Object.keys(normalizedPriorities);
    const orderedKeys = [
      ...priorityOrder.filter((k) => (normalizedPriorities[k] || 0) > 0),
      ...allPriorityKeys.filter((k) => !priorityOrder.includes(k) && (normalizedPriorities[k] || 0) > 0),
    ];

    this.prioriteLabels = orderedKeys.map((k) => this.getPrioriteDisplayLabel(k));
    this.prioriteValues = orderedKeys.map((k) => normalizedPriorities[k] || 0);

    // Données pour le graphique de type de demande (normalisées + ordonnées)
    const normalizedTypes: Record<string, number> = {};
    const rawTypes = this.stats.demandesParType ?? {};
    Object.entries(rawTypes).forEach(([key, value]) => {
      const normalizedKey = this.normalizeTypeKey(key);
      normalizedTypes[normalizedKey] = (normalizedTypes[normalizedKey] || 0) + (Number(value) || 0);
    });

    const typeOrder = ['PARAMETRABLE', 'EVOLUTION'];
    const allTypeKeys = Object.keys(normalizedTypes);
    const orderedTypeKeys = [
      ...typeOrder.filter((k) => (normalizedTypes[k] || 0) > 0),
      ...allTypeKeys.filter((k) => !typeOrder.includes(k) && (normalizedTypes[k] || 0) > 0),
    ];
    this.typeLabels = orderedTypeKeys.map((k) => this.getTypeDisplayLabel(k));
    this.typeValues = orderedTypeKeys.map((k) => normalizedTypes[k] || 0);

    // Données pour le graphique de statut (normalisées + triées par volume)
    const normalizedStatuses: Record<string, number> = {};
    const rawStatuses = this.stats.demandesParStatut ?? {};
    Object.entries(rawStatuses).forEach(([key, value]) => {
      const normalizedKey = this.normalizeStatusKey(key);
      normalizedStatuses[normalizedKey] = (normalizedStatuses[normalizedKey] || 0) + (Number(value) || 0);
    });
    const orderedStatuses = Object.entries(normalizedStatuses)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
    this.statusLabels = orderedStatuses.map(([k]) => this.getStatusDisplayLabel(k));
    this.statusValues = orderedStatuses.map(([, v]) => v);

    // Données pour le graphique d'application (tri décroissant)
    const appEntries = Object.entries(this.stats.demandesParApplication ?? {})
      .map(([k, v]) => ({ label: String(k || 'Non spécifié'), value: Number(v) || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    this.appLabels = appEntries.map((x) => x.label);
    this.appValues = appEntries.map((x) => x.value);
    this.appChartSum = appEntries.reduce((s, x) => s + x.value, 0);

    // Données pour le graphique de département (tri décroissant)
    const deptEntries = Object.entries(this.stats.demandesParDepartement ?? {})
      .map(([k, v]) => ({ label: String(k || 'Non spécifié'), value: Number(v) || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    this.deptLabels = deptEntries.map((x) => x.label);
    this.deptValues = deptEntries.map((x) => x.value);

    const rawFinal = this.stats.demandesParStatutFinal ?? {};
    const finalEntries = Object.entries(rawFinal)
      .map(([k, v]) => ({
        key: this.normalizeStatusKey(k),
        value: Number(v) || 0,
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const finalOrder = ['TEST', 'PREPROD', 'LIVRE'];
    const orderedFinal = [
      ...finalOrder
        .map((k) => finalEntries.find((e) => e.key === k))
        .filter((e): e is { key: string; value: number } => !!e),
      ...finalEntries.filter((e) => !finalOrder.includes(e.key)),
    ];
    this.finalLabels = orderedFinal.map((e) => this.getStatusDisplayLabel(e.key));
    this.finalValues = orderedFinal.map((e) => e.value);

    const moisRaw = this.stats.demandesParMoisCreation ?? {};
    const moisKeys = Object.keys(moisRaw).sort();
    const last12 = moisKeys.slice(-12);
    this.moisLabels = last12.map((k) => this.formatMoisLabel(k));
    this.moisValues = last12.map((k) => Number(moisRaw[k]) || 0);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.renderAllCanvases();
  }

  private renderAllCanvases(): void {
    this.renderVerticalBars(
      this.prioriteCanvas?.nativeElement,
      this.prioriteLabels,
      this.prioriteValues,
      this.prioriteLabels.map((label) => this.getPrioriteColor(label))
    );
    this.renderVerticalBars(
      this.typeCanvas?.nativeElement,
      this.typeLabels,
      this.typeValues,
      this.typeLabels.map(() => '#2563eb')
    );
    this.renderHorizontalBars(
      this.finalCanvas?.nativeElement,
      this.finalLabels,
      this.finalValues,
      this.finalLabels.map((_, i) => this.getFinalBarColor(i))
    );
    this.renderVerticalBars(
      this.moisCanvas?.nativeElement,
      this.moisLabels,
      this.moisValues,
      this.moisLabels.map(() => '#4f46e5')
    );
  }

  private renderVerticalBars(
    canvas: HTMLCanvasElement | undefined,
    labels: string[],
    values: number[],
    colors: string[]
  ): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentWidth = canvas.parentElement?.clientWidth ?? 300;
    const width = Math.max(280, parentWidth - 16);
    const height = 260;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!values.length) {
      this.drawEmptyMessage(ctx, width, height);
      return;
    }

    const max = Math.max(...values, 1);
    const leftPadding = 18;
    const rightPadding = 18;
    const topPadding = 18;
    const bottomPadding = 56;
    const chartWidth = width - leftPadding - rightPadding;
    const chartHeight = height - topPadding - bottomPadding;
    const slotWidth = chartWidth / values.length;
    const barWidth = Math.min(38, slotWidth * 0.55);

    values.forEach((value, i) => {
      const barHeight = (value / max) * chartHeight;
      const x = leftPadding + i * slotWidth + (slotWidth - barWidth) / 2;
      const y = topPadding + chartHeight - barHeight;

      ctx.fillStyle = colors[i] || '#2563eb';
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = '#111827';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(value), x + barWidth / 2, y - 6);

      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Arial';
      const label = labels[i] || '';
      const shortLabel = label.length > 10 ? `${label.slice(0, 10)}...` : label;
      ctx.fillText(shortLabel, x + barWidth / 2, height - 18);
    });
  }

  private renderHorizontalBars(
    canvas: HTMLCanvasElement | undefined,
    labels: string[],
    values: number[],
    colors: string[]
  ): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentWidth = canvas.parentElement?.clientWidth ?? 300;
    const width = Math.max(280, parentWidth - 16);
    const height = 260;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!values.length) {
      this.drawEmptyMessage(ctx, width, height);
      return;
    }

    const max = Math.max(...values, 1);
    const leftPadding = 110;
    const rightPadding = 28;
    const topPadding = 20;
    const rowHeight = 38;
    const barHeight = 18;
    const drawableWidth = width - leftPadding - rightPadding;

    values.forEach((value, i) => {
      const y = topPadding + i * rowHeight;
      const barWidth = (value / max) * drawableWidth;

      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(labels[i] || '', 12, y + 14);

      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(leftPadding, y, drawableWidth, barHeight);

      ctx.fillStyle = colors[i] || '#2563eb';
      ctx.fillRect(leftPadding, y, barWidth, barHeight);

      ctx.fillStyle = '#111827';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(String(value), width - 8, y + 14);
    });
  }

  private drawEmptyMessage(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Aucune donnée disponible', width / 2, height / 2);
  }

  getStatusTableRows(): Array<{ label: string; count: number; pct: number }> {
    if (!this.stats) return [];
    const total = this.stats.totalDemandes || 0;
    return this.statusLabels.map((label, i) => ({
      label,
      count: this.statusValues[i] ?? 0,
      pct: total > 0 ? Math.round(((this.statusValues[i] ?? 0) / total) * 100) : 0,
    }));
  }

  getFinalStatusTotal(): number {
    return this.finalValues.reduce((a, b) => a + b, 0);
  }

  getMoisMax(): number {
    if (!this.moisValues.length) return 1;
    return Math.max(...this.moisValues, 1);
  }

  private formatMoisLabel(ym: string): string {
    const m = ym.match(/^(\d{4})-(\d{2})$/);
    if (!m) return ym;
    const mois = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
    ];
    const idx = Number(m[2]) - 1;
    return idx >= 0 && idx < 12 ? `${mois[idx]} ${m[1]}` : ym;
  }

  /**
   * Obtient la valeur maximale d'un tableau de nombres
   */
  getMaxValue(values: number[]): number {
    if (!values || values.length === 0) return 1;
    return Math.max(...values);
  }

  /**
   * Calcule le pourcentage
   */
  getPercentage(value: number): number {
    if (!this.stats || this.stats.totalDemandes === 0) return 0;
    return Math.round((value / this.stats.totalDemandes) * 100);
  }

  getAcceptedCount(): number {
    return this.getStatusCountByAliases(['ACCEPTE', 'ACCEPTEE', 'VALIDEE', 'VALIDER']);
  }

  getEnCoursAdminCount(): number {
    return this.getStatusCountByAliases(['ENCOURS_CHEZ_ADMIN', 'EN_COURS_DE_TRAITEMENT_ADMIN']);
  }

  getEnCoursCount(): number {
    return Number(this.stats?.demandesEnCours || 0);
  }

  getResolvedCount(): number {
    return Number(this.stats?.demandesResolues || 0);
  }

  /**
   * Obtient la couleur pour une priorité
   */
  getPrioriteColor(priorite: string): string {
    const normalized = this.normalizePrioriteKey(priorite);
    const colorMap: Record<string, string> = {
      'URGENT': '#ef4444',
      'ELEVE': '#f59e0b',
      'MOYEN': '#0ea5e9',
      'NORMAL': '#2563eb',
      'NON_URGENT': '#10b981'
    };
    return colorMap[normalized] || '#6b7280';
  }

  /**
   * Obtient la hauteur de la barre pour un graphique vertical
   */
  getBarHeight(value: number, max: number): number {
    if (max === 0) return 0;
    return (value / max) * 100;
  }

  /**
   * Obtient la largeur de la barre pour un graphique horizontal
   */
  getBarWidth(value: number, max: number): number {
    if (max === 0) return 0;
    return (value / max) * 100;
  }

  getFinalBarColor(index: number): string {
    const colors = ['#2563eb', '#7c3aed', '#059669'];
    return colors[index % colors.length];
  }

  /** Part de cette application par rapport au nombre total de demandes (échantillon chargé). */
  getAppPctOfTotal(index: number): number {
    if (!this.stats?.totalDemandes) return 0;
    const v = this.appValues[index] ?? 0;
    return Math.round((v / this.stats.totalDemandes) * 100);
  }

  /** Part du top affiché par rapport au total des demandes. */
  getAppChartCoveragePct(): number {
    if (!this.stats?.totalDemandes || !this.appChartSum) return 0;
    return Math.round((this.appChartSum / this.stats.totalDemandes) * 100);
  }

  /** Dégradés distincts par rang pour différencier visuellement les applications. */
  getApplicationBarBackground(index: number): string {
    const gradients = [
      'linear-gradient(90deg, #047857 0%, #10b981 100%)',
      'linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)',
      'linear-gradient(90deg, #0369a1 0%, #0ea5e9 100%)',
      'linear-gradient(90deg, #6d28d9 0%, #8b5cf6 100%)',
      'linear-gradient(90deg, #b45309 0%, #f59e0b 100%)',
      'linear-gradient(90deg, #be185d 0%, #ec4899 100%)',
      'linear-gradient(90deg, #1e40af 0%, #3b82f6 100%)',
      'linear-gradient(90deg, #0e7490 0%, #06b6d4 100%)',
      'linear-gradient(90deg, #4d7c0f 0%, #84cc16 100%)',
      'linear-gradient(90deg, #7c2d12 0%, #ea580c 100%)',
    ];
    return gradients[index % gradients.length];
  }

  private normalizePrioriteKey(priority: string): string {
    const normalized = String(priority || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');

    if (!normalized) return 'NORMAL';
    if (normalized === 'ELEVEE' || normalized === 'ELEVE') return 'ELEVE';
    if (normalized === 'MEDIUM' || normalized === 'MOYENNE') return 'MOYEN';
    if (normalized === 'NONURGENT' || normalized === 'NON_URGENT') return 'NON_URGENT';
    return normalized;
  }

  private getPrioriteDisplayLabel(priorityKey: string): string {
    const labelMap: Record<string, string> = {
      'URGENT': 'Urgent',
      'ELEVE': 'Élevé',
      'MOYEN': 'Moyen',
      'NORMAL': 'Normal',
      'NON_URGENT': 'Non urgent',
    };
    return labelMap[priorityKey] || priorityKey.replace(/_/g, ' ');
  }

  private normalizeTypeKey(type: string): string {
    const normalized = String(type || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');

    if (!normalized) return 'EVOLUTION';
    if (normalized === 'PARAMETRAGE') return 'PARAMETRABLE';
    return normalized;
  }

  private getTypeDisplayLabel(typeKey: string): string {
    const labelMap: Record<string, string> = {
      PARAMETRABLE: 'Paramétrage',
      EVOLUTION: 'Évolution',
    };
    return labelMap[typeKey] || typeKey.replace(/_/g, ' ');
  }

  private normalizeStatusKey(status: string): string {
    return String(status || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
  }

  private getStatusDisplayLabel(statusKey: string): string {
    const labelMap: Record<string, string> = {
      CREATED: 'Créé',
      CREE: 'Créé',
      CREEE: 'Créé',
      INITIE: 'Initiée',
      INITIEE: 'Initiée',
      INITIATED: 'Initiée',
      SUBMITTED: 'Demande soumise',
      SUBMITED: 'Demande soumise',
      SOUMIS: 'Demande soumise',
      SOUMISE: 'Demande soumise',
      ENCOURS: 'Demande soumise',
      EN_COURS: 'Demande soumise',
      ENCOURS_CHEZ_SI: 'En cours SI',
      EN_COURS_DE_TRAITEMENT_SI: 'En cours SI',
      ENCOURS_CHEZ_ADMIN: 'En cours admin',
      EN_COURS_DE_TRAITEMENT_ADMIN: 'En cours admin',
      ENCOURS_CHEZ_PARTENAIRE: 'En cours partenaire',
      EN_COURS_DE_TRAITEMENT_PARTENAIRE: 'En cours partenaire',
      A_CORRIGER_PAR_DEMANDEUR: 'A corriger par demandeur',
      RETOURNER_SI: "Retour a l'equipe SI",
      REJECTED: 'Rejetée',
      REJETE: 'Rejetée',
      DONE: 'Terminée',
      TERMINE: 'Terminée',
      TERMINEE: 'Terminée',
      ACCEPTE: 'Acceptée',
      ACCEPTEE: 'Acceptée',
      VALIDEE: 'Acceptée',
      VALIDER: 'Acceptée',
      TEST: 'Test',
      PREPROD: 'Préprod',
      LIVRE: 'Livré',
      NON_RENSEIGNE: 'Non renseigné',
    };
    return labelMap[statusKey] || statusKey.replace(/_/g, ' ');
  }

  private getStatusCountByAliases(aliases: string[]): number {
    if (!this.stats?.demandesParStatut) return 0;
    const aliasSet = new Set(aliases.map((a) => this.normalizeStatusKey(a)));
    return Object.entries(this.stats.demandesParStatut).reduce((sum, [key, value]) => {
      const normalized = this.normalizeStatusKey(key);
      return aliasSet.has(normalized) ? sum + (Number(value) || 0) : sum;
    }, 0);
  }
}
