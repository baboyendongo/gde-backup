import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { DemandeService } from '../../demande/services/demande-service';

/** Agrégats métier (une même demande peut contribuer à plusieurs compteurs si statut + statut final). */
export interface StatistiqueKpiDetail {
  initiees: number;
  soumises: number;
  enCoursSI: number;
  enCoursAdmin: number;
  enCoursPartenaire: number;
  aCorrigerDemandeur: number;
  retourEquipeSI: number;
  acceptees: number;
  livrees: number;
  enTest: number;
  enPreprod: number;
}

export interface StatistiqueData {
  totalDemandes: number;
  demandesResolues: number;
  demandesEnCours: number;
  demandesRejetees: number;
  delaiMoyen: number;
  demandesParPriorite: Record<string, number>;
  demandesParType: Record<string, number>;
  demandesParStatut: Record<string, number>;
  /** Répartition des statuts finaux (TEST, PREPROD, LIVRE, etc.) quand renseignés. */
  demandesParStatutFinal: Record<string, number>;
  demandesParApplication: Record<string, number>;
  demandesParDepartement: Record<string, number>;
  kpiDetail: StatistiqueKpiDetail;
  /** Libellé mois (ex. 2026-01) -> nombre de demandes créées */
  demandesParMoisCreation: Record<string, number>;
}

export type ValidationAction = 'CLOSE'  | 'ESCALADE_ADMIN' | 'ESCALADE_PARTENAIRE'  ;

@Injectable({
  providedIn: 'root',
})
export class StatistiqueService {
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private demandeService: DemandeService
  ) {}

  /**
   * Récupère les demandes selon le rôle (ADMIN: toutes, SI: ses équipes, autre: mes demandes) et calcule les statistiques.
   */
  getStatistiques(): Observable<StatistiqueData> {
    return this.demandeService.getDemandesList().pipe(
      map((demandes) => this.calculerStatistiques(demandes))
    );
  }

  /**
   * Valide une demande
   */
  validerDemande(demandeId: string, action: ValidationAction, commentaire: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/demande/${demandeId}/validations/${action}`,
      { commentaire }
    );
  }

  /**
   * Calcule les statistiques à partir des demandes
   */
  private calculerStatistiques(demandes: any[]): StatistiqueData {
    const emptyKpi: StatistiqueKpiDetail = {
      initiees: 0,
      soumises: 0,
      enCoursSI: 0,
      enCoursAdmin: 0,
      enCoursPartenaire: 0,
      aCorrigerDemandeur: 0,
      retourEquipeSI: 0,
      acceptees: 0,
      livrees: 0,
      enTest: 0,
      enPreprod: 0,
    };

    const stats: StatistiqueData = {
      totalDemandes: demandes.length,
      demandesResolues: 0,
      demandesEnCours: 0,
      demandesRejetees: 0,
      delaiMoyen: 0,
      demandesParPriorite: {},
      demandesParType: {},
      demandesParStatut: {},
      demandesParStatutFinal: {},
      demandesParApplication: {},
      demandesParDepartement: {},
      kpiDetail: { ...emptyKpi },
      demandesParMoisCreation: {},
    };

    if (demandes.length === 0) return stats;

    let totalDelai = 0;
    let demandesAvecDelai = 0;

    demandes.forEach((demande) => {
      const statutKey = this.normalizeStatutKey(demande.statut);
      stats.demandesParStatut[statutKey] = (stats.demandesParStatut[statutKey] || 0) + 1;

      const finalStr = String(
        demande.statutfinal ?? demande.statutFinal ?? demande.statut_final ?? ''
      ).trim();
      const finalKey = finalStr ? this.normalizeStatutKey(finalStr) : '';
      if (finalKey) {
        stats.demandesParStatutFinal[finalKey] =
          (stats.demandesParStatutFinal[finalKey] || 0) + 1;
      }

      this.incrementKpiFromStatuts(stats.kpiDetail, statutKey, finalKey);

      // Compter par statut (codes API: DONE = résolues, REJETE/REJECTED = rejetées)
      if (
        statutKey === 'DONE' ||
        statutKey.includes('TERMIN') ||
        statutKey.includes('RESOLU') ||
        statutKey.includes('RÉSOLU')
      ) {
        stats.demandesResolues++;
      } else if (statutKey.includes('REJET') || statutKey === 'REJECTED') {
        stats.demandesRejetees++;
      } else if (statutKey.includes('COURS') || statutKey.includes('ENCOURS')) {
        stats.demandesEnCours++;
      }

      // Compter par priorité (tolérant aux variantes de noms/champs backend)
      const prioriteRaw =
        demande.niveaupriorite ??
        demande.niveauPriorite ??
        demande.priorite ??
        'NORMAL';
      const priorite = String(prioriteRaw).toUpperCase().trim();
      stats.demandesParPriorite[priorite] =
        (stats.demandesParPriorite[priorite] || 0) + 1;

      // Compter par type de demande (tolérant aux variantes de champs backend)
      const typeRaw =
        demande.typedemande ??
        demande.typeDemande ??
        demande.type_demande ??
        'EVOLUTION';
      const type = String(typeRaw).toUpperCase().trim();
      stats.demandesParType[type] = (stats.demandesParType[type] || 0) + 1;

      // Compter par application
      const app = this.applicationToLabel(demande.application);
      stats.demandesParApplication[app] =
        (stats.demandesParApplication[app] || 0) + 1;

      // Compter par département
      const dept = String(demande.departement ?? '').trim() || 'NON SPÉCIFIÉ';
      stats.demandesParDepartement[dept] =
        (stats.demandesParDepartement[dept] || 0) + 1;

      // Calculer le délai moyen en jours
      if (demande.datecreate) {
        const dateCreation = new Date(demande.datecreate);
        const dateNow = new Date();
        const delaiJours = Math.floor(
          (dateNow.getTime() - dateCreation.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDelai += delaiJours;
        demandesAvecDelai++;

        const y = dateCreation.getFullYear();
        const m = String(dateCreation.getMonth() + 1).padStart(2, '0');
        const moisCle = `${y}-${m}`;
        stats.demandesParMoisCreation[moisCle] =
          (stats.demandesParMoisCreation[moisCle] || 0) + 1;
      }
    });

    stats.delaiMoyen =
      demandesAvecDelai > 0 ? Math.round(totalDelai / demandesAvecDelai) : 0;

    return stats;
  }

  private normalizeStatutKey(raw: unknown): string {
    const s = String(raw ?? '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .trim();
    return s || 'NON_RENSEIGNE';
  }

  private applicationToLabel(app: unknown): string {
    if (app == null) return 'NON SPÉCIFIÉ';
    if (typeof app === 'string') {
      const s = app.trim();
      return s.length > 0 ? s : 'NON SPÉCIFIÉ';
    }
    if (typeof app === 'object') {
      const o = app as Record<string, unknown>;
      const s = String(o['nom'] ?? o['libelle'] ?? o['code'] ?? o['name'] ?? '').trim();
      return s.length > 0 ? s : 'NON SPÉCIFIÉ';
    }
    const s = String(app).trim();
    return s.length > 0 ? s : 'NON SPÉCIFIÉ';
  }

  private incrementKpiFromStatuts(
    kpi: StatistiqueKpiDetail,
    statutKey: string,
    finalKey: string
  ): void {
    const s = statutKey || '';

    if (
      s === 'CREE' ||
      s === 'CREATED' ||
      s === 'INITIE' ||
      s === 'INITIEE' ||
      s === 'INITIATED'
    ) {
      kpi.initiees++;
    }

    if (
      s === 'SUBMITTED' ||
      s === 'SUBMITED' ||
      s === 'SOUMIS' ||
      s === 'SOUMISE' ||
      s === 'ENCOURS' ||
      s === 'EN_COURS'
    ) {
      kpi.soumises++;
    }

    if (
      s === 'ENCOURS_CHEZ_SI' ||
      s === 'EN_COURS_DE_TRAITEMENT_SI' ||
      s === 'EN_COURS_CHEZ_SI'
    ) {
      kpi.enCoursSI++;
    }

    if (
      s === 'ENCOURS_CHEZ_ADMIN' ||
      s === 'EN_COURS_DE_TRAITEMENT_ADMIN' ||
      s === 'EN_COURS_CHEZ_ADMIN'
    ) {
      kpi.enCoursAdmin++;
    }

    if (
      s === 'ENCOURS_CHEZ_PARTENAIRE' ||
      s === 'EN_COURS_DE_TRAITEMENT_PARTENAIRE' ||
      s === 'EN_COURS_CHEZ_PARTENAIRE'
    ) {
      kpi.enCoursPartenaire++;
    }

    if (s === 'A_CORRIGER_PAR_DEMANDEUR') {
      kpi.aCorrigerDemandeur++;
    }

    if (
      s === 'RETOURNER_SI' ||
      s === 'RETOURNER_AU_SI' ||
      s === 'RETOUR_SI' ||
      s === 'RETOUR_A_L_EQUIPE_SI'
    ) {
      kpi.retourEquipeSI++;
    }

    if (
      s === 'ACCEPTE' ||
      s === 'ACCEPTEE' ||
      s === 'VALIDEE' ||
      s === 'VALIDER' ||
      s.startsWith('ACCEPTE') ||
      s === 'DONE'
    ) {
      kpi.acceptees++;
    }

    const f = finalKey;
    if (f === 'LIVRE') {
      kpi.livrees++;
    }
    if (f === 'TEST') {
      kpi.enTest++;
    }
    if (f === 'PREPROD') {
      kpi.enPreprod++;
    }
    if (!f && s === 'LIVRE') {
      kpi.livrees++;
    }
    if (!f && s === 'TEST') {
      kpi.enTest++;
    }
    if (!f && s === 'PREPROD') {
      kpi.enPreprod++;
    }
  }
}
