import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService, Notification } from '../../../services/notification.service';
import { AuthService } from '../../service/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule], 
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements OnInit, OnDestroy {
  isSubmitting = false;
  readonly loginForm;
  notifications: Notification[] = [];
  private loginRequestSub?: Subscription;
  private notificationsSub?: Subscription;
  private loginTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notificationService: NotificationService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.nonNullable.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    // Souscrire aux notifications du service
    this.notificationsSub = this.notificationService.notifications$.subscribe(
      (notifications) => {
        this.notifications = notifications;
        this.cdr.detectChanges();
      }
    );

    // Vérifier s'il y a un message d'erreur dans les query params
    this.route.queryParams.subscribe(params => {
      if (params['message']) {
        const type = params['reason'] === 'session_expired' ? 'warning' : 'error';
        this.notificationService.show(params['message'], type, 5000);
      }
    });
  }

  ngOnDestroy(): void {
    this.notificationsSub?.unsubscribe();
    this.loginRequestSub?.unsubscribe();

    this.clearLocalTimeout();
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.setSubmittingState(true);
    this.notificationService.clear();
    this.startLocalTimeout();

    this.loginRequestSub = this.authService
      .login(this.loginForm.getRawValue())
      .pipe(
        finalize(() => {
          this.clearLocalTimeout();
          this.loginRequestSub = undefined;
        })
      )
      .subscribe({
        next: (response) => {
          this.setSubmittingState(false);
          this.authService.saveSession(response, this.loginForm.controls.username.value);
          this.notificationService.show('Connexion réussie !', 'success', 3000);
          setTimeout(() => {
            void this.router.navigate(['/dashboard']);
          }, 500);
        },
        error: (error: HttpErrorResponse) => {
          this.setSubmittingState(false);
          
          const message = this.extractErrorMessage(error);
          const type = this.getErrorType(error);
          this.notificationService.show(message, type, 5000);
        },
      });
}

removeNotification(id: string): void {
    this.notificationService.remove(id);
  }

  private startLocalTimeout(): void {
    this.clearLocalTimeout();
    this.loginTimeoutId = setTimeout(() => {
      if (!this.isSubmitting) {
        return;
      }

      this.loginRequestSub?.unsubscribe();
      this.notificationService.show(
        "Délai dépassé (10s). Vérifiez le réseau ou le serveur d'authentification.",
        'warning',
        5000
      );
      this.setSubmittingState(false);
      this.cdr.detectChanges();
    }, 11000);
  }

  private setSubmittingState(isSubmitting: boolean): void {
    this.isSubmitting = isSubmitting;
    if (isSubmitting) {
      this.loginForm.disable({ emitEvent: false });
    } else {
      this.loginForm.enable({ emitEvent: false });
    }
    this.cdr.detectChanges();
  }

  private clearLocalTimeout(): void {
    if (this.loginTimeoutId !== null) {
      clearTimeout(this.loginTimeoutId);
      this.loginTimeoutId = null;
    }
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    if (error?.error?.message) {
      return error.error.message;
    }

    switch (error.status) {
      case 0:
        return 'Impossible de se connecter au serveur. Vérifiez votre connexion réseau.';
      case 400:
        return 'Identifiants invalides. Veuillez vérifier votre nom d\'utilisateur et votre mot de passe.';
      case 401:
        return 'Nom d\'utilisateur ou mot de passe incorrect.';
      case 403:
        return 'Accès refusé. Votre compte n\'a pas les permissions nécessaires.';
      case 404:
        return 'Service d\'authentification introuvable. Veuillez contacter l\'administrateur.';
      case 500:
      case 502:
      case 503:
        return 'Erreur serveur. Veuillez réessayer dans quelques instants.';
      case 504:
        return 'Le serveur met trop de temps à répondre. Veuillez réessayer.';
      default:
        return error?.error?.error || error?.message || 'Échec de connexion. Veuillez vérifier vos identifiants.';
    }
  }

  private getErrorType(error: HttpErrorResponse): 'error' | 'warning' | 'info' {
    if (error.status === 0 || error.status >= 500) {
      return 'warning';
    }
    if (error.status === 401 || error.status === 403) {
      return 'error';
    }
    return 'error';
  }

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      'success': 'bi bi-check-circle',
      'error': 'bi bi-x-circle',
      'warning': 'bi bi-exclamation-triangle',
      'info': 'bi bi-info-circle'
    };
    return icons[type] || 'bi bi-info-circle';
  }
}
