import { Routes } from '@angular/router';
import { authGuards } from './guards/auth.guard';



export const routes: Routes = [
  {
    path: 'market',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./market/pages/login/login.component')
      },
      {
        path: 'venta',
        loadComponent: () => import('./market/pages/venta/venta.component'),
        canActivate: [authGuards.isLoggin]
      },
      {
        path: 'ventas',
        loadComponent: () => import('./market/pages/ventas/ventas.component'),
        canActivate: [authGuards.isLoggin]
      },
      {
        path: 'inventario',
        loadComponent: () => import('./market/pages/inventario/inventario.component'),
        canActivate: [authGuards.isLoggin]
      },
      {
        path: 'generarCodigo',
        loadComponent: () => import('./market/pages/generar-codigo/generar-codigo.component'),
        canActivate: [authGuards.isLoggin]
      },
      {
        path: 'clientes',
        loadComponent: () => import('./market/pages/clientes/clientes.component'),
        canActivate: [authGuards.isLoggin]
      },
      {
        path: 'diseno',
        //loadComponent: () => import('./market/pages/Diseño/diseno.component'),
        loadComponent: () => import('./market/test/test-epos/test-epos.component'),
        canActivate: [authGuards.isLoggin]
      },
      {
        path: '**',
        redirectTo: 'venta',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'market',
    pathMatch: 'full',
  },
];
