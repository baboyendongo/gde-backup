import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Login } from './core/auth/login/login';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

const routes: Routes = [
  {
    path: '',
    component: Login,
    canActivate: [guestGuard]
  },
  {
    path: 'demandes',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/demande/demande-module')
        .then(m => m.DemandeModule)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/components/dashboard-component/dashboard-component')
        .then(m => m.DashboardComponent)
  },
  {
    path: 'statistiques',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/statistique/pages/statistique/statistique')
        .then(m => m.Statistique)
  },
  {
    path: 'parametre',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/parametre/parametre-module')
        .then(m => m.ParametreModule)
  },
  {
    path: 'unauthorized',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/pages/unauthorized-component/unauthorized-component')
        .then(m => m.UnauthorizedComponent)
  },
  // Legacy routes - redirections pour compatibilité
  {
    path: 'parametres',
    redirectTo: 'parametre',
    pathMatch: 'full'
  },
  {
    path: 'mes-demandes',
    redirectTo: 'demandes/mes-demandes',
    pathMatch: 'full'
  },
  {
    path: 'add-demande',
    redirectTo: 'demandes/nouvelle',
    pathMatch: 'full'
  },
  {
    path: 'demandedetail/:id',
    redirectTo: 'demandes/:id',
    pathMatch: 'full'
  },
  {
    path: 'edit-demande/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/demande/pages/edit-demande/edit-demande')
        .then(m => m.EditDemande)
  },
  {
    path: '**',
    redirectTo: ''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    enableTracing: false,
    onSameUrlNavigation: 'reload',
    useHash: true
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
