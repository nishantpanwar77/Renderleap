import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { WebContainerService } from '../../services/webcontainer.service';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  animations: [
    trigger('slideAnimation', [
      state(
        'closed',
        style({
          transform: 'translateX(100%)',
          visibility: 'hidden',
        })
      ),
      state(
        'open',
        style({
          transform: 'translateX(0)',
          visibility: 'visible',
        })
      ),
      transition('closed => open', [
        style({ visibility: 'visible' }),
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ]),
      transition('open => closed', [
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
        style({ visibility: 'hidden' }),
      ]),
    ]),
    // Backdrop fade animation
    trigger('backdropAnimation', [
      state(
        'hidden',
        style({
          opacity: 0,
          visibility: 'hidden',
        })
      ),
      state(
        'visible',
        style({
          opacity: 1,
          visibility: 'visible',
        })
      ),
      transition('hidden => visible', [
        style({ visibility: 'visible' }),
        animate('300ms ease-out'),
      ]),
      transition('visible => hidden', [
        animate('300ms ease-in'),
        style({ visibility: 'hidden' }),
      ]),
    ]),
  ],
})
export class SettingsComponent {
  private elementRef = inject(ElementRef);

  isOpen = input.required<boolean>();
  close = output<void>();
  webContainerService = inject(WebContainerService);

  mainbBackgrounds: { bgClass: string }[] = [
    { bgClass: 'bg-one' },
    { bgClass: 'bg-two' },
    { bgClass: 'bg-three' },
    { bgClass: 'bg-four' },
    { bgClass: 'bg-five' },
  ];

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const menu = this.elementRef.nativeElement.querySelector('.sidemenu');
        if (menu) {
          menu.focus();
        }
      }
    });
  }

  setBg(bgObject: { bgClass: string }) {
    this.webContainerService.updateObject(bgObject);
  }

  onBackdropClick(): void {
    this.closeMenu();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
    }
  }

  closeMenu(): void {
    this.close.emit();
  }
}
