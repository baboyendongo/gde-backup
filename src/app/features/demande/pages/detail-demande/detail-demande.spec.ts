import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailDemande } from './detail-demande';

describe('DetailDemande', () => {
  let component: DetailDemande;
  let fixture: ComponentFixture<DetailDemande>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DetailDemande]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailDemande);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
