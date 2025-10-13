import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FireAuthService } from '../../../services/fire-auth.service';
import { InteraccionService } from '../../../services/interaccion.service';
import { IonCard, IonItem, IonLabel,IonGrid, IonRow, IonCol,IonButton } from '@ionic/angular/standalone';

import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    IonCard,
    IonItem,
    IonLabel,
    IonGrid,
    IonRow,
    IonCol,
    IonButton
  ],
})
export default class LoginComponent implements OnInit {

  private fb = inject(UntypedFormBuilder);
  private fireAuthService = inject(FireAuthService);
  private route = inject(Router);
  private interaccionService = inject(InteraccionService)

  passwordVisible: boolean = false;

  userForm: UntypedFormGroup = this.fb.group({
    email: ['',[Validators.required, Validators.email]],
    contrasena: ['',[Validators.required, Validators.minLength(6)]]
  });


  constructor() { }

  user = {
    email: '',
    contrasena: ''
  }

  ngOnInit() {

  }


  ingresar(){
    this.user.email = this.userForm.controls['email'].value;
    this.user.contrasena = this.userForm.controls['contrasena'].value;
    this.fireAuthService.login(this.user.email, this.user.contrasena).then( res => {
      this.route.navigate(['/market/venta']);
      this.userForm.reset();
    }).catch( () => {
      this.interaccionService.showToast("Usuario o contraseña incorrectos");
    });
    this.obtener();
  }



  campoNoValido(campo: string){
    return this.userForm.controls[campo].errors &&
            this.userForm.controls[campo].touched;
  }

  async obtener(){
    const uid = await this.fireAuthService.getUid();
    console.log(uid);
  }


}
