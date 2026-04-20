import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/service/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InAppNotification, InAppNotificationService } from '../../services/in-app-notification.service';
import { Role } from '../../core/models/role';

@Component({
  selector: 'app-nav-bar',
  standalone: false,
  templateUrl: './nav-bar.html',
  styleUrls: ['./nav-bar.css'],
})
export class NavBar implements OnInit, OnDestroy {
  connectedUserFullName = 'Utilisateur';
  displayUserEmail: string = 'email@example.com';
  searchQuery = '';
  showNotifications = false;
  showProfileMenu = false;
  notificationCount = 0;
  supportEmail = 'support@evolution-si.com';
  
  notifications: InAppNotification[] = [];

  private routerSubscription?: Subscription;
  private notificationsSub?: Subscription;
  private readonly boundKeyHandler = (e: KeyboardEvent) => this.handleKeyboardShortcuts(e);
  connectedUserRole: string = 'Utilisateur';
  connectedUserEmail: string = 'email@example.com';
  connectedUserInitials: string = 'U';
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly inAppNotifications: InAppNotificationService
  ) {}

  ngOnInit(): void {
    this.updateUserFullName();
    this.updateUserEmail();
    // Écouter les changements de route pour mettre à jour le nom d'utilisateur et fermer les menus
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateUserFullName();
        this.updateUserEmail();
        this.inAppNotifications.reload();
        this.closeAllDropdowns();
      });

    // Écouter le raccourci Ctrl+K pour la recherche
    document.addEventListener('keydown', this.boundKeyHandler);

    this.notificationsSub = this.inAppNotifications.notifications$.subscribe((list) => {
      this.notifications = list;
      this.notificationCount = list.filter(n => !n.read).length;
    });
  }
  updateUserEmail() {
    const email = this.authService.getConnectedUsername();
    if (email && email.trim().length > 0) {
      this.displayUserEmail = email;
    } else {
      this.displayUserEmail = 'email@example.com';
    }
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.notificationsSub?.unsubscribe();
    document.removeEventListener('keydown', this.boundKeyHandler);
  }

  // Fermer les dropdowns lors d'un clic à l'extérieur
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-wrapper') && !target.closest('.notification-dropdown')) {
      this.showNotifications = false;
    }
    if (!target.closest('.user-profile') && !target.closest('.profile-dropdown')) {
      this.showProfileMenu = false;
    }
  }

  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Ctrl+K pour focus sur la recherche
    if (event.ctrlKey && event.key === 'k') {
      event.preventDefault();
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  }

  private updateUserFullName(): void {
    const fullName = this.authService.getConnectedUserFullName();
    if (fullName && fullName.trim().length > 0) {
      this.connectedUserFullName = fullName;
    } else {
      this.connectedUserFullName = 'Utilisateur';
    }
  }

  get displayUserFullName(): string {
    return this.connectedUserFullName || 'Utilisateur';
  }

  getUserInitials(): string {
    const names = this.displayUserFullName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return this.displayUserFullName.substring(0, 2).toUpperCase();
  }

  /**
   * Libellé du rôle principal à afficher sous le nom,
   * uniquement pour ROLE_ADMIN ou ROLE_SI. Retourne null sinon.
   */
  get displayUserRole(): string | null {
    if (this.authService.hasRole(Role.ADMIN)) {
      return 'Administrateur';
    }
    if (this.authService.hasRole(Role.SI)) {
      return 'Équipe SI';
    }
    return null;
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    this.showProfileMenu = false;
  }

  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
    this.showNotifications = false;
  }

  closeAllDropdowns(): void {
    this.showNotifications = false;
    this.showProfileMenu = false;
  }

  onSearch(): void {
    if (this.searchQuery.trim()) {
      console.log('Recherche:', this.searchQuery);
      // Implémenter la logique de recherche
      this.router.navigate(['/mes-demandes'], { queryParams: { search: this.searchQuery } });
    }
  }

  markAllNotificationsRead(): void {
    this.inAppNotifications.markAllRead();
  }

  openNotification(notif: InAppNotification): void {
    this.inAppNotifications.markRead(notif.id);
    this.showNotifications = false;
    if (notif.link) {
      void this.router.navigateByUrl(notif.link);
    }
  }

  formatTime(iso: string): string {
    try {
      const dt = new Date(iso).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - dt);
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'À l’instant';
      if (min < 60) return `Il y a ${min} min`;
      const h = Math.floor(min / 60);
      if (h < 24) return `Il y a ${h} h`;
      const d = Math.floor(h / 24);
      return `Il y a ${d} j`;
    } catch {
      return '';
    }
  }

  logout(): void {
    // Déconnexion : nettoyer la session
    this.authService.logout();
    this.connectedUserFullName = 'Utilisateur';
    this.inAppNotifications.clear();
    this.closeAllDropdowns();
    void this.router.navigate(['']);
  }
}
