import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentsFiltre } from './components-filtre';

describe('ComponentsFiltre', () => {
  let component: ComponentsFiltre;
  let fixture: ComponentFixture<ComponentsFiltre>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ComponentsFiltre]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComponentsFiltre);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
