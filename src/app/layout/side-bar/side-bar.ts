import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/service/auth.service';
import { Role } from '../../core/models/role';
import { CommonModule, NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, NgOptimizedImage],
  templateUrl: './side-bar.html',
  styleUrls: ['./side-bar.css'],
})
export class SideBar implements OnInit, OnDestroy {
  connectedUserFullName = 'Utilisateur';
  userInitials = 'U';
  showStatistiques = false;
  showParametres = false;
  private routerSubscription?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.updateUserInfo();
    this.updateRoleVisibility();
    
    // Écouter les changements de route pour mettre à jour les informations utilisateur
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateUserInfo();
        this.updateRoleVisibility();
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  private updateUserInfo(): void {
    const fullName = this.authService.getConnectedUserFullName();
    if (fullName && fullName.trim().length > 0) {
      this.connectedUserFullName = fullName;
      this.userInitials = this.generateInitials(fullName);
    } else {
      this.connectedUserFullName = 'Utilisateur';
      this.userInitials = 'U';
    }
  }

  /** Calcule les menus visibles une seule fois par cycle pour éviter NG0100 sur le template. */
  private updateRoleVisibility(): void {
    const isAdmin = this.authService.hasRole(Role.ADMIN);
    const isSi = this.authService.hasRole(Role.SI);
    this.showStatistiques = isAdmin || isSi;
    this.showParametres = isAdmin;
  }

  private generateInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      // Prendre la première lettre du prénom et la première lettre du nom
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      // Si un seul mot, prendre les deux premières lettres
      return parts[0].substring(0, 2).toUpperCase();
    } else if (parts[0].length > 0) {
      // Sinon, prendre la première lettre
      return parts[0][0].toUpperCase();
    }
    return 'U';
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
