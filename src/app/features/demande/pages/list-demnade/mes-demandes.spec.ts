import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MesDemandes } from './mes-demandes';

describe('MesDemandes', () => {
  let component: MesDemandes;
  let fixture: ComponentFixture<MesDemandes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MesDemandes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MesDemandes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
