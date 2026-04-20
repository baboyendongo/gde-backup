import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Parametre } from './parametre';

describe('Parametre', () => {
  let component: Parametre;
  let fixture: ComponentFixture<Parametre>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Parametre]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Parametre);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
