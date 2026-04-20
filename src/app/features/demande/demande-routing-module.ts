import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'mes-demandes',
    loadComponent: () =>
      import('./pages/list-demnade/mes-demandes')
        .then(m => m.MesDemandes)
  },
  {   
    path: 'nouvelle',
    loadComponent: () =>
      import('./pages/add-demande/add-demande')
        .then(m => m.AddDemande)  
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/detail-demande/detail-demande')
        .then(m => m.DetailDemande)
  },
  {
    path: '',
    redirectTo: 'mes-demandes',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DemandeRoutingModule { }
