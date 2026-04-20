import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../core/service/auth.service';

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string; // ISO
  icon: string; // bootstrap icon class
  read: boolean;
  link?: string;
}

@Injectable({ providedIn: 'root' })
export class InAppNotificationService {
  private readonly maxItems = 50;
  private readonly notificationsSubject = new BehaviorSubject<InAppNotification[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();

  constructor(private readonly authService: AuthService) {
    this.load();
  }

  get snapshot(): InAppNotification[] {
    return this.notificationsSubject.value;
  }

  get unreadCount(): number {
    return this.snapshot.filter(n => !n.read).length;
  }

  push(input: Omit<InAppNotification, 'id' | 'createdAt' | 'read'> & Partial<Pick<InAppNotification, 'icon' | 'link'>>): void {
    const notif: InAppNotification = {
      id: this.generateId(),
      title: input.title,
      message: input.message,
      createdAt: new Date().toISOString(),
      icon: input.icon || 'bi bi-bell',
      link: input.link,
      read: false,
    };

    const next = [notif, ...this.snapshot].slice(0, this.maxItems);
    this.notificationsSubject.next(next);
    this.persist(next);
  }

  markRead(id: string): void {
    const next = this.snapshot.map(n => (n.id === id ? { ...n, read: true } : n));
    this.notificationsSubject.next(next);
    this.persist(next);
  }

  markAllRead(): void {
    const next = this.snapshot.map(n => ({ ...n, read: true }));
    this.notificationsSubject.next(next);
    this.persist(next);
  }

  clear(): void {
    this.notificationsSubject.next([]);
    this.persist([]);
  }

  reload(): void {
    this.load();
  }

  private storageKey(): string {
    const user = this.authService.getConnectedUsername() || 'anonymous';
    return `inapp_notifications:${user}`;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) {
        this.notificationsSubject.next([]);
        return;
      }
      const parsed = JSON.parse(raw) as InAppNotification[];
      this.notificationsSubject.next(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.notificationsSubject.next([]);
    }
  }

  private persist(list: InAppNotification[]): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(list));
    } catch {
      // ignore storage failures
    }
  }

  private generateId(): string {
    return `inapp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

