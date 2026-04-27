import { Injectable } from '@angular/core';
import { Subscription, catchError, forkJoin, interval, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../core/service/auth.service';
import { NotificationService } from './notification.service';
import { InAppNotificationService } from './in-app-notification.service';
import { DemandeService } from '../features/demande/services/demande-service';

type StatusCache = Record<string, string>;

@Injectable({ providedIn: 'root' })
export class DemandeStatusWatchService {
  private sub?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly demandeService: DemandeService,
    private readonly toast: NotificationService,
    private readonly inApp: InAppNotificationService
  ) {}

  start(pollMs = 60000): void {
    if (this.sub) return;

    this.sub = interval(pollMs)
      .pipe(
        startWith(0),
        switchMap(() => {
          if (!this.authService.isAuthenticated()) return of([]);
          return this.demandeService.getMyDemandes().pipe(catchError(() => of([])));
        })
      )
      .subscribe((demandes: any[]) => {
        if (!this.authService.isAuthenticated()) return;
        if (!Array.isArray(demandes) || demandes.length === 0) {
          this.persistCache({});
          return;
        }

        const cache = this.loadCache();
        const currentStatuses = demandes
          .map(d => ({
            id: String(d?.id ?? ''),
            objet: (d?.objet ?? '').toString(),
            statut: this.getTrackedStatus(d),
          }))
          .filter(x => x.id && x.statut);

        const tracked = currentStatuses
          .filter(x => Object.prototype.hasOwnProperty.call(cache, x.id));

        const changed = tracked
          .filter(x => cache[x.id] !== x.statut)
          .map(x => ({ ...x, old: cache[x.id] }));

        // Mettre à jour le cache avec tous les statuts courants
        // (sinon le 1er passage reste vide et aucun changement n'est détecté ensuite).
        const nextCache: StatusCache = {};
        for (const d of currentStatuses) {
          const id = d?.id;
          const statut = d?.statut;
          if (id != null && statut != null) nextCache[String(id)] = String(statut);
        }
        this.persistCache(nextCache);

        if (changed.length === 0) return;

        // Récupérer les détails uniquement pour les demandes ayant changé
        const validChanged = changed.filter(c => Number.isFinite(Number(c.id)));
        if (validChanged.length === 0) return;

        const detailCalls = validChanged.map(c =>
          this.demandeService.getDemande(Number(c.id)).pipe(catchError(() => of(null)))
        );

        forkJoin(detailCalls)
          .pipe(
            map((details) => details.map((detail, idx) => ({ detail, change: validChanged[idx] })))
          )
          .subscribe((items) => {
            for (const { detail, change } of items) {
              const evo = `EVO-${change.id}`;

              const latestHistory = this.getLatestHistorique(detail?.historique);
              const oldLabel = this.statusLabel(change.old);
              const newLabel = this.statusLabel(change.statut);

              const actor = latestHistory?.userinput ? ` (par ${latestHistory.userinput})` : '';
              const comment = latestHistory?.commentaire ? ` — ${latestHistory.commentaire}` : '';

              const message = `${evo} : ${oldLabel} → ${newLabel}${actor}${comment}`;

              this.inApp.push({
                title: 'Changement de statut',
                message,
                icon: 'bi bi-arrow-repeat',
                link: `/demandes/${change.id}`,
              });

              this.toast.show(message, 'info', 5000);
            }
          });
      });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  private cacheKey(): string {
    const user = this.authService.getConnectedUsername() || 'anonymous';
    return `demande_status_cache:${user}`;
  }

  private loadCache(): StatusCache {
    try {
      const raw = localStorage.getItem(this.cacheKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw) as StatusCache;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private persistCache(cache: StatusCache): void {
    try {
      localStorage.setItem(this.cacheKey(), JSON.stringify(cache));
    } catch {
      // ignore
    }
  }

  private statusLabel(codeOrLabel: string): string {
    const v = (codeOrLabel || '').toString().trim();
    const key = v.toUpperCase().replace(/\s+/g, '_');
    const mapLabels: Record<string, string> = {
      CREATED: 'Initié',
      INITIE: 'Initié',
      CREE: 'Créé',
      EN_COURS: 'En cours',
      TERMINE: 'Terminées',
      DONE: 'Terminées',
      CLOTURE: 'Clôturé',
      REJETE: 'Rejeté',
      EN_ATTENTE: 'En attente',
      ENCOURS_CHEZ_SI: 'En cours SI',
      ENCOURS_CHEZ_ADMIN: 'En cours admin',
      ENCOURS_CHEZ_PARTENAIRE: 'En cours partenaire',
      ACCEPTE: 'Acceptée',
      VALIDEE: 'Acceptée',
      REJECTED: 'Rejetée',
      A_CORRIGER_PAR_DEMANDEUR: 'À corriger par demandeur',
      LIVRE: 'Livré',
      TEST: 'Test',
      PREPROD: 'Préprod',
    };
    return mapLabels[key] || v;
  }

  private getTrackedStatus(demande: any): string {
    const finalStatus = (demande?.statutfinal ?? demande?.statutFinal ?? demande?.statut_final ?? '').toString().trim();
    if (finalStatus) return finalStatus;
    return (demande?.statut ?? '').toString().trim();
  }

  private getLatestHistorique(h: any): any | null {
    if (!Array.isArray(h) || h.length === 0) return null;
    return [...h].sort((a, b) => new Date(b.datecreate).getTime() - new Date(a.datecreate).getTime())[0] ?? null;
  }
}

