import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit notification on show() - ex. ajout commentaire', (done) => {
    const message = 'Commentaire ajouté avec succès';
    service.notifications$.subscribe((list) => {
      if (list.length > 0 && list.some((n) => n.message === message && n.type === 'success')) {
        expect(list.some((n) => n.message === message && n.type === 'success')).toBe(true);
        done();
      }
    });
    service.show(message, 'success', 3000);
  });

  it('should support error type for failed add comment', () => {
    const message = 'Erreur lors de l\'ajout du commentaire.';
    let received: unknown[] = [];
    const sub = service.notifications$.subscribe((list) => {
      received = list;
    });
    service.show(message, 'error', 5000);
    expect(received.some((n: any) => n.message === message && n.type === 'error')).toBe(true);
    sub.unsubscribe();
  });
});
