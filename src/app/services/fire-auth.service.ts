import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  authState
} from '@angular/fire/auth';


@Injectable({ providedIn: 'root' })

export class FireAuthService {
  private auth = inject(Auth);
  public stateAuth = authState(this.auth);

  // Igual que antes: devuelve Promise<UserCredential>
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  // Igual que antes: Promise<void>
  async logout() {
    await signOut(this.auth);
    window.location.reload()
  }

  // Antes usabas: await this.auth.currentUser (en compat era Promise)
  // En modular, currentUser es síncrono (User|null)
  async getUid(): Promise<string | null> {
    const user = this.auth.currentUser as User | null;
    return user ? user.uid : null;
  }


  async createUser(email: string, password: string){
    const user = await createUserWithEmailAndPassword(this.auth,email,password);
    return user;
  }
}
