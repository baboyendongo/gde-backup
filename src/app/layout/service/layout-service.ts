import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
    private _isOpen = signal<boolean>(true);
  
  // Observable public pour l'état du sidebar
  public readonly isOpen = this._isOpen.asReadonly();

  constructor() {}

  /**
   * Bascule l'état du sidebar (ouvre/ferme)
   */
  toggle(): void {
    this._isOpen.update(value => !value);
  }

  /**
   * Ouvre le sidebar
   */
  open(): void {
    this._isOpen.set(true);
  }

  /**
   * Ferme le sidebar
   */
  close(): void {
    this._isOpen.set(false);
  }
  
}
