import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./page/parametre/parametre').then(m => m.Parametre)
  },
  {
    path: 'role-assignment',
    loadComponent: () => import('./page/role-assignment/role-assignment').then(m => m.RoleAssignmentComponent)
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ParametreRoutingModule { }
