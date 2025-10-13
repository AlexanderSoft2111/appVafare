import { Component, OnInit, Input, inject } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { Cliente, Paths } from '../../../models/models';
import { FirestoreService } from '../../../services/firestore.service';
import { InteraccionService } from '../../../services/interaccion.service';

import {
  IonGrid,
  IonRow,
  IonButtons,
  IonIcon,
  IonButton,
  IonItem,
  IonLabel,
  IonCol,
  IonCard,
  PopoverController,
  ToastController
} from "@ionic/angular/standalone";

import { addIcons } from 'ionicons';
import {
  checkbox,
  close
} from 'ionicons/icons';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';


@Component({
  selector: 'app-popsetclient',
  templateUrl: './popsetclient.component.html',
  styleUrls: ['./popsetclient.component.scss'],
  imports: [
    IonGrid,
    IonRow,
    IonButtons,
    IonIcon,
    IonButton,
    IonItem,
    IonLabel,
    IonCol,
    IonCard,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule
  ]
})

export class PopsetclientComponent implements OnInit {

  private fb = inject(UntypedFormBuilder);
  private popoverController = inject(PopoverController);
  private toastCtrl = inject(ToastController);
  private firestoreService = inject(FirestoreService);
  private interaccionService = inject(InteraccionService);

  @Input() venta: boolean = false;
  @Input() newcliente?: Cliente;


  cliente?: Cliente;
  clienteDuplicado?: Cliente;
  titulo = 'Nuevo Cliente';
  update = false;
  isSaving = false;


  miFormulario = this.fb.group({
    nombre: ['', Validators.required],
    ruc: ['', [Validators.required, Validators.minLength(10)]], // sin validador asíncrono aquí
    direccion: ['', Validators.required],
    telefono: ['', [
      Validators.required,
      Validators.pattern("^09\\d{8}$")
    ]],
    email: ['', [
      Validators.required,
      Validators.pattern("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
    ]],
  });

  constructor() { addIcons({ checkbox, close }) }

  ngOnInit() {
    if (this.newcliente !== undefined) {
      this.recibirCliente();
    }
  }

  async validarRucUnico() {
    const ruc = this.miFormulario.get('ruc')?.value?.trim();
    if (!ruc || ruc.length < 10) return;

    const clienteExistente = await this.firestoreService.getDocumentQuery<Cliente>(Paths.clientes, 'ruc', ruc);

    // Si ya existe y NO es el mismo cliente que estamos editando
    if (clienteExistente && clienteExistente.id !== this.newcliente?.id) {
      this.miFormulario.get('ruc')?.setErrors({ rucDuplicado: true });
      this.clienteDuplicado = clienteExistente; // opcional, por si quieres mostrar datos
    } else {
      this.miFormulario.get('ruc')?.setErrors(null);
    }
  }


  campoNoValido(campo: string) {
    const c = this.miFormulario.controls[campo];
    return !!(c?.hasError('required') && c?.touched);
  }

  // RUC duplicado: solo si NO falta el required
  rucDuplicado() {
    const c = this.miFormulario.get('ruc');
    return !!(c?.hasError('rucDuplicado') && !c?.hasError('required') && c?.touched);
  }

  // Email inválido por pattern: solo si NO falta el required
  emailPatternInvalido() {
    const c = this.miFormulario.get('email');
    return !!(c?.hasError('pattern') && !c?.hasError('required') && c?.touched);
  }
  // Email inválido por pattern: solo si NO falta el required
  telefonoPatternInvalido() {
    const c = this.miFormulario.get('telefono');
    return !!(c?.hasError('pattern') && !c?.hasError('required') && c?.touched);
  }

  recibirCliente() {
    console.log(this.newcliente);
    this.update = true;
    this.miFormulario.controls['nombre'].setValue(this.newcliente?.nombre);
    this.miFormulario.controls['ruc'].setValue(this.newcliente?.ruc);
    this.miFormulario.controls['direccion'].setValue(this.newcliente?.direccion);
    this.miFormulario.controls['telefono'].setValue(this.newcliente?.telefono);
    this.miFormulario.controls['email'].setValue(this.newcliente?.email);
  }



  async guardar() {
  if (this.miFormulario.invalid) {
    this.miFormulario.markAllAsTouched();
    return;
  }
  if (this.isSaving) return;
  this.isSaving = true;

  const data: Cliente = this.miFormulario.value;
  const { id, docPath, write } = await this.firestoreService.createDocumentID<Cliente>(data,Paths.clientes);

  // UX inmediata (funciona offline)
  this.interaccionService.showToast(
    this.firestoreService.isOffline() ? 'Guardado (pendiente de sincronizar)' : 'Guardado con éxito'
  );
  this.popoverController.dismiss({ cliente: { ...data, id } });
  this.miFormulario.reset();

  // (Opcional) Avisar cuando sincronice:
  const sub = this.firestoreService.observeSyncStatus(docPath).subscribe(status => {
    if (status === 'synced') {
      this.interaccionService.showToast('Sincronizado');
      sub.unsubscribe();
    }
  });

  // Manejo de error real al sincronizar con backend
  write.catch(err => {
    this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido'));
  }).finally(() => {
    this.isSaving = false;
  });
}

  async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1000,
      position: 'bottom',
      cssClass: 'aviso',
    });
    toast.present();
  }

  cancelar() {
    this.popoverController.dismiss();
  }

  async changeCodigo() {
    const ruc = this.miFormulario.get('ruc')?.value ?? '';
    if (ruc.length >= 10) {
      const res = await this.firestoreService.getDocumentQuery<Cliente>(Paths.clientes, 'ruc', ruc);
      if (res) {
        this.update = true;
        this.titulo = 'Editar Cliente';
        this.cliente = res;
        this.miFormulario.patchValue(res);
      } else {
        this.update = false;
        this.titulo = 'Nuevo Cliente';
        this.miFormulario.patchValue({ nombre: '', direccion: '', telefono: '', email: '' });
      }
    }
  }



  async updateClient() {
  if (this.miFormulario.invalid || !this.newcliente?.id) {
    this.miFormulario.markAllAsTouched();
    return;
  }
  if (this.isSaving) return;
  this.isSaving = true;

  const path = Paths.clientes;
  const updateDoc: Partial<Cliente> = {
    nombre: this.miFormulario.get('nombre')?.value,
    ruc: this.miFormulario.get('ruc')?.value,
    direccion: this.miFormulario.get('direccion')?.value,
    telefono: this.miFormulario.get('telefono')?.value,
    email: this.miFormulario.get('email')?.value,
  };

  // Lanza la actualización optimista (aplica local inmediato; la Promise espera al backend)
  const { docPath, write } = await this.firestoreService
    .updateDocumentID<Cliente>(updateDoc,path, this.newcliente.id );

  // UX inmediata (funciona sin internet)
  const offline = this.firestoreService.isOffline();
  this.interaccionService.showToast(
    offline ? 'Actualizado (pendiente de sincronizar)' : 'Actualizado con éxito'
  );

  // Cierra el popup pasando el objeto actualizado al caller
  this.popoverController.dismiss({
    cliente: { ...this.newcliente, ...updateDoc },
  });

  // (Opcional) Avisar cuando pase de pendiente -> sincronizado
  const sub = this.firestoreService.observeSyncStatus(docPath).subscribe(status => {
    if (status === 'synced') {
      this.interaccionService.showToast('Cambios sincronizados');
      sub.unsubscribe();
    }
  });

  // Manejo de error real al sincronizar con backend
  write.catch(err => {
    this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido'));
  }).finally(() => {
    this.isSaving = false;
  });
}

  close() {
    this.popoverController.dismiss();
  }

  aceptar() {
    this.popoverController.dismiss({
      cliente: this.cliente,
    });
  }


}
