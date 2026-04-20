import { Injectable } from '@angular/core';
import { DemandeService } from './demande-service';

@Injectable({
  providedIn: 'root',
})
export class LoadService {
  listedemande: any
  constructor(private demandeService: DemandeService) {}

  async loadDemandes(): Promise<void> {
    const res = await this.demandeService.getDemandesList().toPromise();
    this.listedemande = res ?? [];
  }
}
