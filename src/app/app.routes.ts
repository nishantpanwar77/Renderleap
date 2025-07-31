import { Routes } from '@angular/router';
import { WebWrapperComponent } from './components/web-wrapper/web-wrapper.component';

export const routes: Routes = [
  { path: '', redirectTo: 'web-container', pathMatch: 'full' },
  { path: 'web-container', component: WebWrapperComponent },
];
