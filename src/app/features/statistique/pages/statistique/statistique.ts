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
  statusKeys: string[] = [];

  appLabels: string[] = [];
  appValues: number[] = [];
  /** Somme des volumes du top affiché (pour % de couverture du total des demandes). */
  appChartSum = 0;

  /** Statuts finaux (TEST, PREPROD, LIVRE) */
  finalLabels: string[] = [];
  finalValues: number[] = [];
  moisLabels: string[] = [];
  moisValues: number[] = [];

  @ViewChild('prioriteCanvas') prioriteCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('typeCanvas') typeCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('finalCanvas') finalCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('evolutionCanvas') evolutionCanvas?: ElementRef<HTMLCanvasElement>;

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
    this.statusKeys = orderedStatuses.map(([k]) => k);
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

    const rawByMonth = this.stats.demandesParMoisCreation ?? {};
    const sortedKeys = Object.keys(rawByMonth).sort();
    const last12Keys = sortedKeys.slice(-12);
    this.moisLabels = last12Keys.map((k) => this.formatMonthKey(k));
    this.moisValues = last12Keys.map((k) => Number(rawByMonth[k]) || 0);

  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.renderAllCanvases();
  }

  private renderAllCanvases(): void {
    const evolutionPointColors = this.getEvolutionPointColors();
    this.renderLineChart(
      this.prioriteCanvas?.nativeElement,
      this.prioriteLabels,
      this.prioriteValues,
      '#f59e0b',
      this.prioriteLabels.map((label) => this.getPrioriteColor(label))
    );
    this.renderVerticalBars(
      this.typeCanvas?.nativeElement,
      this.typeLabels,
      this.typeValues,
      this.typeLabels.map((label) => this.getTypeColor(label))
    );
    this.renderPieChart(
      this.finalCanvas?.nativeElement,
      this.finalLabels,
      this.finalValues,
      this.finalLabels.map((_, i) => this.getFinalBarColor(i))
    );
    this.renderLineChart(
      this.evolutionCanvas?.nativeElement,
      this.moisLabels,
      this.moisValues,
      '#16a34a',
      evolutionPointColors
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

  private renderPieChart(
    canvas: HTMLCanvasElement | undefined,
    labels: string[],
    values: number[],
    colors: string[]
  ): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentWidth = canvas.parentElement?.clientWidth ?? 300;
    const size = Math.max(240, Math.min(320, parentWidth - 24));
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    if (!values.length) {
      this.drawEmptyMessage(ctx, size, size);
      return;
    }

    const total = values.reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (total <= 0) {
      this.drawEmptyMessage(ctx, size, size);
      return;
    }

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.36;
    const innerRadius = size * 0.2;
    let startAngle = -Math.PI / 2;

    values.forEach((value, i) => {
      const slice = (value / total) * Math.PI * 2;
      const endAngle = startAngle + slice;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i] || '#334155';
      ctx.fill();

      startAngle = endAngle;
    });

    // Cercle central pour un rendu type doughnut.
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Total', cx, cy - 4);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(String(total), cx, cy + 16);
  }

  private renderLineChart(
    canvas: HTMLCanvasElement | undefined,
    labels: string[],
    values: number[],
    strokeColor = '#2563eb',
    pointColors?: string[]
  ): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentWidth = canvas.parentElement?.clientWidth ?? 300;
    const width = Math.max(320, parentWidth - 16);
    const height = 260;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!values.length) {
      this.drawEmptyMessage(ctx, width, height);
      return;
    }

    const max = Math.max(...values, 1);
    const left = 34;
    const right = 16;
    const top = 20;
    const bottom = 44;
    const drawW = width - left - right;
    const drawH = height - top - bottom;
    const stepX = values.length > 1 ? drawW / (values.length - 1) : drawW;

    // Grille horizontale
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = top + (drawH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();
    }

    const points = values.map((v, i) => ({
      x: left + i * stepX,
      y: top + drawH - (v / max) * drawH,
      value: v,
      label: labels[i] || '',
    }));

    // Zone sous la courbe
    if (points.length > 1) {
      const area = ctx.createLinearGradient(0, top, 0, top + drawH);
      area.addColorStop(0, this.hexToRgba(strokeColor, 0.30));
      area.addColorStop(1, this.hexToRgba(strokeColor, 0.04));
      ctx.beginPath();
      ctx.moveTo(points[0].x, top + drawH);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, top + drawH);
      ctx.closePath();
      ctx.fillStyle = area;
      ctx.fill();
    }

    // Courbe (segments colorés si des couleurs de points sont fournies).
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (pointColors && pointColors.length === points.length && points.length > 1) {
      for (let i = 0; i < points.length - 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
        ctx.strokeStyle = pointColors[i] || strokeColor;
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }

    // Points
    points.forEach((p, i) => {
      const pointColor = (pointColors && pointColors[i]) ? pointColors[i] : strokeColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pointColor;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = pointColor;
      ctx.fill();
    });

    // Labels X (1 sur 2 si trop dense)
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    const skip = labels.length > 8 ? 2 : 1;
    points.forEach((p, i) => {
      if (i % skip === 0 || i === labels.length - 1) {
        ctx.fillText(p.label, p.x, height - 12);
      }
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
    const excludedStatusKeys = new Set(['ACCEPTE', 'ACCEPTEE', 'VALIDEE', 'VALIDER', 'REJECTED', 'REJETE', 'REJETEE']);
    return this.statusLabels
      .map((label, i) => ({
        key: this.statusKeys[i] ?? '',
        label,
        count: this.statusValues[i] ?? 0,
      }))
      .filter((row) => !excludedStatusKeys.has(this.normalizeStatusKey(row.key)))
      .map((row) => ({
        label: row.label,
        count: row.count,
        pct: total > 0 ? Math.round((row.count / total) * 100) : 0,
      }));
  }

  getFinalStatusTotal(): number {
    return this.finalValues.reduce((a, b) => a + b, 0);
  }

  getAcceptanceRate(): number {
    if (!this.stats?.totalDemandes) return 0;
    return Math.round((this.getAcceptedCount() / this.stats.totalDemandes) * 100);
  }

  getRejectionRate(): number {
    if (!this.stats?.totalDemandes) return 0;
    return Math.round(((this.stats.demandesRejetees || 0) / this.stats.totalDemandes) * 100);
  }

  getTopPrioriteLabel(): string {
    if (!this.prioriteValues.length) return 'Non renseignée';
    const idx = this.getTopIndex(this.prioriteValues);
    return idx >= 0 ? this.prioriteLabels[idx] : 'Non renseignée';
  }

  getTopPrioriteCount(): number {
    if (!this.prioriteValues.length) return 0;
    const idx = this.getTopIndex(this.prioriteValues);
    return idx >= 0 ? this.prioriteValues[idx] : 0;
  }

  getTopTypeLabel(): string {
    if (!this.typeValues.length) return 'Non renseigné';
    const idx = this.getTopIndex(this.typeValues);
    return idx >= 0 ? this.typeLabels[idx] : 'Non renseigné';
  }

  getTopTypeCount(): number {
    if (!this.typeValues.length) return 0;
    const idx = this.getTopIndex(this.typeValues);
    return idx >= 0 ? this.typeValues[idx] : 0;
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

  getEnCoursTotalCount(): number {
    return this.getEnCoursAdminCount() + this.getEnCoursSiCount();
  }

  getEnCoursSiCount(): number {
    return this.getStatusCountByAliases(['ENCOURS_CHEZ_SI', 'EN_COURS_DE_TRAITEMENT_SI']);
  }

  getEnCoursPartenaireCount(): number {
    return this.getStatusCountByAliases(['ENCOURS_CHEZ_PARTENAIRE', 'EN_COURS_DE_TRAITEMENT_PARTENAIRE']);
  }

  getSoumisesCount(): number {
    return this.getStatusCountByAliases([
      'SUBMITTED',
      'SUBMITED',
      'SOUMIS',
      'SOUMISE',
      'ENCOURS',
      'EN_COURS',
      'CREATED',
      'CREE',
      'CREEE',
      'INITIE',
      'INITIEE',
      'INITIATED',
    ]);
  }

  getTermineesCount(): number {
    return this.getStatusCountByAliases(['DONE', 'TERMINE', 'TERMINEE', 'LIVRE']);
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

  getTypeColor(type: string): string {
    const normalized = this.normalizeTypeKey(type);
    const colorMap: Record<string, string> = {
      PARAMETRABLE: '#f59e0b',
      EVOLUTION: '#2563eb',
    };
    return colorMap[normalized] || '#64748b';
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
    const label = this.finalLabels[index] || '';
    return this.getFinalStatusColor(label);
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

  getPrioriteLegendItems(): Array<{ label: string; value: number; pct: number; color: string }> {
    return this.buildLegendItems(
      this.prioriteLabels,
      this.prioriteValues,
      (label) => this.getPrioriteColor(label)
    );
  }

  getTypeLegendItems(): Array<{ label: string; value: number; pct: number; color: string }> {
    return this.buildLegendItems(
      this.typeLabels,
      this.typeValues,
      (label) => this.getTypeColor(label)
    );
  }

  getFinalLegendItems(): Array<{ label: string; value: number; pct: number; color: string }> {
    return this.buildLegendItems(
      this.finalLabels,
      this.finalValues,
      (label) => this.getFinalStatusColor(label)
    );
  }

  getEvolutionLegendItems(): Array<{ label: string; value: number; pct: number; color: string }> {
    return this.buildLegendItems(
      this.moisLabels,
      this.moisValues,
      (_label, index) => this.getEvolutionColor(index, this.moisLabels.length)
    );
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

  private getFinalStatusColor(status: string): string {
    const normalized = this.normalizeStatusKey(status);
    const colorMap: Record<string, string> = {
      TEST: '#f59e0b',
      PREPROD: '#7c3aed',
      LIVRE: '#059669',
      TERMINE: '#059669',
      TERMINEE: '#059669',
      DONE: '#059669',
    };
    return colorMap[normalized] || '#334155';
  }

  private getEvolutionPointColors(): string[] {
    return this.moisLabels.map((_, index) => this.getEvolutionColor(index, this.moisLabels.length));
  }

  private getEvolutionColor(index: number, total: number): string {
    const palette = [
      '#0ea5e9',
      '#3b82f6',
      '#6366f1',
      '#8b5cf6',
      '#a855f7',
      '#d946ef',
      '#ec4899',
      '#f43f5e',
      '#f97316',
      '#f59e0b',
      '#84cc16',
      '#22c55e',
    ];
    if (total <= 0) return palette[0];
    return palette[index % palette.length];
  }

  private buildLegendItems(
    labels: string[],
    values: number[],
    colorResolver: (label: string, index: number) => string
  ): Array<{ label: string; value: number; pct: number; color: string }> {
    const total = values.reduce((sum, value) => sum + (value || 0), 0);
    return labels.map((label, index) => {
      const value = values[index] || 0;
      return {
        label,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
        color: colorResolver(label, index),
      };
    });
  }

  private getTopIndex(values: number[]): number {
    if (!values.length) return -1;
    let topIndex = 0;
    let topValue = values[0];
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > topValue) {
        topValue = values[i];
        topIndex = i;
      }
    }
    return topIndex;
  }

  private formatMonthKey(ym: string): string {
    const match = String(ym).match(/^(\d{4})-(\d{2})$/);
    if (!match) return ym;
    const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = Number(match[2]) - 1;
    return idx >= 0 && idx < 12 ? `${monthNames[idx]} ${match[1]}` : ym;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const normalized = String(hex || '').replace('#', '');
    if (normalized.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

}
