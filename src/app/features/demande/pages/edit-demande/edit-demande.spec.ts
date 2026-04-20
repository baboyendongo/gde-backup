import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditDemande } from './edit-demande';

describe('EditDemande', () => {
  let component: EditDemande;
  let fixture: ComponentFixture<EditDemande>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditDemande]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditDemande);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
