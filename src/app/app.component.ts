import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { OfflineBannerComponent } from './core/services/offline/offline-banner.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, OfflineBannerComponent],
})
export class AppComponent {
  constructor() {}
}
