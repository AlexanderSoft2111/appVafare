import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom, inject } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { IonicStorageModule } from '@ionic/storage-angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

import { provideHttpClient } from '@angular/common/http';

import { provideFirebaseApp, initializeApp  } from '@angular/fire/app';
import { provideFirestore, enableIndexedDbPersistence, getFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth} from '@angular/fire/auth';

import { environment } from './environments/environment';

import { LOCALE_ID } from '@angular/core';
import localeEs from '@angular/common/locales/es';
import { registerLocaleData } from '@angular/common';

registerLocaleData(localeEs, 'es');

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md', animated: true }),
     provideHttpClient(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    /* Firebase */
    provideFirebaseApp(() => initializeApp( environment.firebase )),
    provideFirestore(() => {
      const db = getFirestore();
      // Habilita cache offline
      enableIndexedDbPersistence(db).catch(err => console.error('Offline persistence', err));
      return db;
    }),
    //provideFirestore(() => getFirestore()),
    provideAuth( () => getAuth()),

    // Providers de Ionic Storage (equivalente a forRoot en NgModule)
    importProvidersFrom(IonicStorageModule.forRoot()),

    //  Locale en español
    { provide: LOCALE_ID, useValue: 'es' },
  ],
});
