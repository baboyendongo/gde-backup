import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddDemande } from './add-demande';

describe('AddDemande', () => {
  let component: AddDemande;
  let fixture: ComponentFixture<AddDemande>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddDemande]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddDemande);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
