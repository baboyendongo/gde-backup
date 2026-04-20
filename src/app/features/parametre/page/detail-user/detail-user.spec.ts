import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailUser } from './detail-user';

describe('DetailUser', () => {
  let component: DetailUser;
  let fixture: ComponentFixture<DetailUser>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DetailUser]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailUser);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
