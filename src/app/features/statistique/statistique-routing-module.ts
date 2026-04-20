import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => 
      import('./pages/statistique/statistique').then(m => m.Statistique),
    data: { title: 'Statistiques et Reporting' }
  },
  {
    path: 'reporting',
    loadComponent: () => 
      import('./pages/statistique/statistique').then(m => m.Statistique),
    data: { title: 'Reporting détaillé' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StatistiqueRoutingModule { }
