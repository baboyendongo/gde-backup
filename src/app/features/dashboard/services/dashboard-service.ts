import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Dashboard } from '../models/dashboard';



@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  
 constructor() {}
 
  
  getStats(): Observable<Dashboard> {
    // Remplacez par appel HTTP réel si besoin
    return of({
      total: 5,
      open: 2,
      inProgress: 2,
      urgent: 1
    });
  }

  getSections(): Observable<Array<{title: string, subtitle?: string, count?: number, icon?: string}>> {
    return of([
      { title: 'Gestion des demandes', subtitle: 'Gérer et suivre toutes vos demandes', count: 5, icon: 'list' },
      { title: 'Tableau de bord', subtitle: 'Statistiques et analyses des demandes', count: 4, icon: 'dashboard' }
    ]);
  }
}
