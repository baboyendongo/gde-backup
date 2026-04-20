import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from '../../../services/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrls: ['./toast.css'],
})
export class ToastComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription?: Subscription;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notifications$.subscribe(
      notifications => {
        this.notifications = notifications;
        // Forcer la détection de changement pour un rendu immédiat
        this.cdr.detectChanges();
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  remove(id: string): void {
    this.notificationService.remove(id);
  }

  getIconClass(type: string): string {
    switch (type) {
      case 'error':
        return 'bi-exclamation-circle-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      case 'info':
        return 'bi-info-circle-fill';
      case 'success':
        return 'bi-check-circle-fill';
      default:
        return 'bi-info-circle-fill';
    }
  }
}
