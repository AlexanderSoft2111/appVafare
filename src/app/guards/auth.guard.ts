import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { FireAuthService } from '../services/fire-auth.service';

export namespace authGuards {
  export const isLoggin: CanActivateFn = () => {
  const authService = inject(FireAuthService);
  const router = inject(Router);

  // stateAuth(): Observable<User|null>
  return authService.stateAuth.pipe(
    take(1), // tomar el primer valor (evita quedar suscrito)
    map(user => user ? true : router.createUrlTree(['/market/login']))
  );

  }
}

/* export const authGuard = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const isLogged = await new Promise<boolean>(res => {
    const unsub = onAuthStateChanged(auth, u => { res(!!u); unsub(); });
  });
  return isLogged ? true : router.createUrlTree(['/login']);
}; */

/* export const authGuard: CanMatchFn = async (
  route: Route,
  segments: UrlSegment[]
) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const isLogged = await new Promise<boolean>(res => {
  const unsub = onAuthStateChanged(auth, u => { res(!!u); unsub(); });
  });
  return isLogged ? true : router.createUrlTree(['/login']);
}; */
