import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  duration?: number; // Durée en millisecondes, undefined = pas de fermeture automatique
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  /** Affiche une notification (toast). Utilisé notamment après ajout de commentaire, validation, etc. */
  show(message: string, type: 'error' | 'warning' | 'info' | 'success' = 'info', duration?: number): void {
    const notification: Notification = {
      id: this.generateId(),
      message,
      type,
      duration,
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, notification]);

    // Fermeture automatique si une durée est spécifiée
    if (duration && duration > 0) {
      setTimeout(() => {
        this.remove(notification.id);
      }, duration);
    }
  }

  remove(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next(currentNotifications.filter(n => n.id !== id));
  }

  clear(): void {
    this.notificationsSubject.next([]);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
