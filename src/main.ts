import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { SqliteService } from './app/core/services/offline/sqlite.service';
import { NetworkService } from './app/core/services/offline/network.service';
import { OutboxService } from './app/core/services/offline/outbox.service';
import { SyncService } from './app/core/services/offline/sync.service';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md', innerHTMLTemplatesEnabled: false }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(async () => {
      const sqlite = inject(SqliteService);
      const network = inject(NetworkService);
      const outbox = inject(OutboxService);
      const sync = inject(SyncService);

      // SQLite must be ready before any read/write goes through the
      // offline-aware services, and network init seeds the online signal
      // synchronously so the first render sees the right state. Sync is
      // manual — the offline banner triggers it via a "Sync now" button.
      await sqlite.init();
      await network.init();
      await outbox.refreshPending();
      await sync.refreshOrphaned();
    }),
  ],
});
