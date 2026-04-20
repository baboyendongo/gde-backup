import { Component } from '@angular/core';

@Component({
  selector: 'app-unauthorized-component',
  standalone: true,
  template: `
    <div class="unauthorized">
      <h2>Accès refusé</h2>
      <p>Vous n'avez pas les permissions nécessaires.</p>
      <button routerLink="/">Retour</button>
    </div>
  `,
  styleUrls: ['./unauthorized-component.css'],
})
export class UnauthorizedComponent {}

