import { Component, DestroyRef, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';
import gsap from 'gsap';
import { motionDuration, prefersReducedMotion } from '../../reduced-motion';

// Standard on/off switch for this lib — same visual and GSAP overshoot as
// @gblp/chord-finder's toggle (duplicated on purpose, no shared ui-kit yet).
@Component({
  selector: 'soloin-toggle-switch',
  standalone: true,
  template: `
    <label class="toggle-switch" [class.disabled]="disabled()">
      <input type="checkbox" class="toggle-input" [checked]="checked()" [disabled]="disabled()" (change)="onChange($event)" />
      <span class="track"><span #thumb class="thumb"></span></span>
      <span class="toggle-label">{{ label() }}</span>
    </label>
  `,
  styleUrl: './toggle-switch.scss',
})
export class ToggleSwitch {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly label = input.required<string>();
  readonly toggled = output<boolean>();

  private readonly thumb = viewChild<ElementRef<HTMLElement>>('thumb');
  private tween: gsap.core.Tween | null = null;

  constructor() {
    effect(() => {
      const on = this.checked();
      const el = this.thumb()?.nativeElement;
      if (!el) return;
      this.tween?.kill();
      this.tween = gsap.to(el, {
        x: on ? 14 : 0,
        duration: motionDuration(0.28),
        ease: prefersReducedMotion() ? 'none' : 'back.out(2.2)',
      });
    });
    inject(DestroyRef).onDestroy(() => this.tween?.kill());
  }

  onChange(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}
