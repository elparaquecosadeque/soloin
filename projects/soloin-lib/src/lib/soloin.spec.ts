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

  describe('session state', () => {
    it('is null when untouched', () => {
      expect(component.getSessionState()).toBeNull();
    });

    it('carries only the fields that differ from the defaults', () => {
      component.keyMarks.set(new Set(['1:1', '0:0']));
      expect(component.getSessionState()).toEqual({ marks: [0, 14] });

      component.tuningName.set('dropD');
      component.selectedKey.set({ root: 9, mode: 'minor' });
      component.scaleOverride.set('dorian');
      expect(component.getSessionState()).toEqual({ marks: [0, 14], tuning: 'dropD', key: 19, scale: 'dorian' });
    });

    it('round-trips through applySessionState and lands on Key mode', () => {
      component.keyMarks.set(new Set(['2:5']));
      component.tuningName.set('dadgad');
      component.selectedKey.set({ root: 2, mode: 'major' });
      component.scaleOverride.set('mixolydian');
      const saved = component.getSessionState()!;

      component.resetSessionState();
      expect(component.getSessionState()).toBeNull();

      component.applySessionState(saved);
      expect(component.getSessionState()).toEqual(saved);
      expect(component.mode()).toBe('key');
      expect(component.keyMarkMode()).toBe(false);
    });

    it('treats absent fields as defaults and ignores invalid ones', () => {
      component.tuningName.set('dropD');
      component.applySessionState({
        marks: [3, 999, -2],
        tuning: 'nope' as never,
        key: 99,
        scale: 'nope' as never,
      });
      expect(component.getSessionState()).toEqual({ marks: [3] });
    });

    it('resetSessionState leaves mode and the progression alone', () => {
      component.mode.set('progression');
      component.progressionInput.set('Dm, G');
      component.keyMarks.set(new Set(['0:0']));
      component.resetSessionState();
      expect(component.mode()).toBe('progression');
      expect(component.progressionInput()).toBe('Dm, G');
      expect(component.keyMarks().size).toBe(0);
    });

    it('adds a marked-notes line to the text summary only in Key mode', () => {
      component.keyMarks.set(new Set(['0:0', '1:1', '2:0'])); // E, C, G on standard tuning
      component.mode.set('key');
      expect(component.summaryText()).toContain('Marked notes: C, E, G');
      component.mode.set('progression');
      expect(component.summaryText()).not.toContain('Marked notes');
    });
  });
});
