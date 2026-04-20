import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppConfirmDialog } from './app-confirm-dialog';

describe('AppConfirmDialog', () => {
  let component: AppConfirmDialog;
  let fixture: ComponentFixture<AppConfirmDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppConfirmDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppConfirmDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
