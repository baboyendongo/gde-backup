import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { LayoutService } from './layout/service/layout-service';
import { RouterOutlet } from '@angular/router';
import { SideBar } from './layout/side-bar/side-bar';
import { NavBar } from './layout/nav-bar/nav-bar';
import { DemandeStatusWatchService } from './services/demande-status-watch.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrls: ['./app.css']  

})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('gestion_demande_evolution');
  
  constructor(
    public layoutService: LayoutService,
    private readonly demandeStatusWatch: DemandeStatusWatchService
  ) {}

  ngOnInit(): void {
    // Notifications globales : surveiller les changements de statut des demandes du créateur
    this.demandeStatusWatch.start(60000);
  }

  ngOnDestroy(): void {
    this.demandeStatusWatch.stop();
  }
}
