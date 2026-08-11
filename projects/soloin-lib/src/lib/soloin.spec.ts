import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoloinComponent } from './soloin';

describe('SoloinComponent', () => {
  let component: SoloinComponent;
  let fixture: ComponentFixture<SoloinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoloinComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SoloinComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders Spanish content when requested', async () => {
    fixture.componentRef.setInput('language', 'es');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Progresión de acordes');
  });
});
