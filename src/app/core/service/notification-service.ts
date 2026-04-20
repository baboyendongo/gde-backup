import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppNotification {
  id: number;
  message: string;
  read: boolean;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  add(notification: AppNotification) {
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next([notification, ...current]);
  }

  markAsRead(id: number) {
    const updated = this.notificationsSubject.value.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    this.notificationsSubject.next(updated);
  }

  clear() {
    this.notificationsSubject.next([]);
  }
}