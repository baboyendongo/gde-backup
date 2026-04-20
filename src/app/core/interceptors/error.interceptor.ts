import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Ne pas intercepter les erreurs de la route d'authentification
        const url = request.url.toLowerCase();
        const isAuthRequest = url.includes('/authentification') || 
                             url.includes('/api/evolution/authentification') ||
                             url.includes('/login');

        if (isAuthRequest) {
          // Pour les erreurs d'authentification, laisser le composant login les gérer
          return throwError(() => error);
        }

        // Gérer les erreurs 401 (Non autorisé) - cas véritable d'authentification invalide
        if (error.status === 401) {
          console.warn('Token expiré ou invalide (401). Déconnexion.');
          // Déconnexion de l'utilisateur
          this.authService.logout();
          
          // Rediriger vers la page de connexion seulement si on n'y est pas déjà
          if (this.router.url !== '/') {
            void this.router.navigate(['/'], { 
              queryParams: { 
                reason: 'session_expired',
                message: 'Votre session a expiré. Veuillez vous reconnecter.' 
              } 
            });
          }
        }
        return throwError(() => error); 
      })
    );

  }
}
