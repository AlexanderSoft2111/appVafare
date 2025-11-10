import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonApp,
  IonRouterOutlet,
  IonSplitPane,
  IonList,
  IonItem,
  IonContent,
  IonIcon,
  IonLabel,
  IonMenu,
  IonMenuToggle
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  addCircle,
  cart,
  exit,
  logIn,
  logInSharp,
  logoIonic,
  people,
  server,
  statsChart,
  qrCodeSharp,
  addCircleSharp,
  peopleSharp,
  statsChartSharp,
  serverSharp,
  cartSharp,
  storefrontOutline,
  cloudUploadSharp
} from 'ionicons/icons';

import { environment } from '../environments/environment';
import { FireAuthService } from './services/fire-auth.service';



@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [
    IonApp,
    IonRouterOutlet,
    IonSplitPane,
    IonMenu,
    IonLabel,
    IonIcon,
    IonContent,
    IonItem,
    IonList,
    IonMenu,
    IonMenuToggle,
    RouterLink
  ],
})

export class AppComponent {
  uidAdmin = environment.uidAdmin;
  admin = false;
  vendedor = true;
  rol = '';
  authState: boolean = false;
  public appPages = [

    { title: 'Login', url: '/market/login', icon: 'log-in' }
  ];
  private fireAuthService = inject(FireAuthService);
  constructor() {
    addIcons({
      logoIonic,
      storefrontOutline,
      exit,
      cart,
      server,
      statsChart,
      people,
      addCircle,
      logIn,
      logInSharp,
      qrCodeSharp,
      addCircleSharp,
      peopleSharp,
      statsChartSharp,
      serverSharp,
      cartSharp,
      cloudUploadSharp
    });
    this.permisos();
  }

  permisos() {
    this.fireAuthService.stateAuth.subscribe(res => {
      if (res !== null) {
        this.authState = true;
        if (res.uid === this.uidAdmin) {
          this.admin = true;
          this.vendedor = false;
          this.rol = 'Administrador';
          this.paginas();
        } else {
          this.vendedor = true;
          this.rol = 'Vendedor';
          this.admin = false;
          this.paginas();
        }

      }
    });
  }

  paginas() {
    const paginas = [
      { title: 'Nueva venta', url: '/market/venta', icon: 'cart' },
      { title: 'Clientes', url: '/market/clientes', icon: 'people' },
      { title: 'Inventario', url: '/market/inventario', icon: 'server' },
      { title: 'Ventas', url: '/market/ventas', icon: 'stats-chart' },
      { title: 'Generar Código', url: '/market/generarCodigo', icon: 'qr-code' },
      { title: 'Importar', url: '/market/importar', icon: 'cloud-upload' }

    ];
    this.appPages = paginas;
  }

  salir() {
    this.fireAuthService.logout();

    this.fireAuthService.stateAuth.subscribe(res => {
      if (res === null) {
        this.authState = false;
        this.vendedor = false;
        this.admin = false;
        this.rol = '';
        this.appPages = [
          { title: 'Login', url: '/market/login', icon: 'log-in' }
        ]
      }
      else {
        this.authState = true
      }
    });

  }
}
