import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Paths, Cliente } from '../../../models/models';
import { FirestoreService } from '../../../services/firestore.service';

import { PopsetclientComponent } from '../../components/popsetclient/popsetclient.component';
import { FireAuthService } from '../../../services/fire-auth.service';
import { environment } from '../../../../environments/environment';
import { InteraccionService } from '../../../services/interaccion.service';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonInput,
  IonMenuButton,
  PopoverController
} from "@ionic/angular/standalone";

import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';

import { addIcons } from 'ionicons';
import {
  options,
  trash,
  create,
  addCircleSharp
} from 'ionicons/icons';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss'],
  imports: [
    IonInput,
    IonIcon,
    IonButton,
    IonLabel,
    IonItem,
    IonContent,
    IonTitle,
    IonButtons,
    IonToolbar,
    IonHeader,
    IonMenuButton,
    MatTableModule,
    MatPaginatorModule
  ]
})

export default class ClientesComponent implements OnInit, OnDestroy {

  private firestoreService = inject(FirestoreService);
  private popoverController = inject(PopoverController);
  private fireAuthService = inject(FireAuthService);
  private interaccionService = inject(InteraccionService);

  displayedColumns: string[] = [
    'editar', 'ruc', 'nombre',
    'direccion',
    'telefono',
    'email'
  ];
  dataSource?: MatTableDataSource<Cliente>;
  campos = [{ campo: 'ruc', label: 'Cédula o Ruc' },
  { campo: 'nombre', label: 'Nombre' },
  { campo: 'direccion', label: 'Dirección' },
  { campo: 'telefono', label: 'Teléfono' },
  { campo: 'email', label: 'Email' }
  ]

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  clientes: Cliente[] = [];
  vendedor = true;
  uidAdmin = environment.uidAdmin;
  subscriptionClientes?: Subscription;

  constructor() {
    addIcons({ trash, options, create, addCircleSharp })
  }

  ngOnInit() {

    this.permisos();
  }

  ngOnDestroy(): void {
    this.subscriptionClientes?.unsubscribe();
  }

  permisos() {
    this.fireAuthService.stateAuth.subscribe(res => {
      if (res !== null) {
        this.getClientes();
        if (res.uid === this.uidAdmin) {
          this.vendedor = false;
        }

      }
    });
  }


  async getClientes() {
    console.log('me volvi a llamar');
    this.subscriptionClientes = this.firestoreService.getCollectionChanges<Cliente>(Paths.clientes, 'nombre').subscribe((clientes) => {
      this.clientes = clientes;
      if (!this.dataSource) {
        this.dataSource = new MatTableDataSource<Cliente>(this.clientes);
        this.dataSource.paginator = this.paginator!;
        this.dataSource.sort = this.sort!;
      } else {
        this.dataSource.data = this.clientes;
      }
    })
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource!.filter = filterValue.trim().toLowerCase();

    if (this.dataSource!.paginator) {
      this.dataSource!.paginator.firstPage();
    }
  }

  async setClient(newcliente: Cliente) {
    const popover = await this.popoverController.create({
      component: PopsetclientComponent,
      cssClass: 'popoverCssCliente',
      translucent: false,
      backdropDismiss: true,
      componentProps: { newcliente },
      mode: 'ios'
    });
    await popover.present();
  }

  async addCliente() {
    const popover = await this.popoverController.create({
      component: PopsetclientComponent,
      cssClass: 'popoverCssCliente',
      translucent: false,
      backdropDismiss: true,
      mode: 'ios'
    });
    await popover.present();
  }

  delete(cliente: Cliente) {
    this.interaccionService.preguntaAlert('Alerta',
      '¿Seguro que desea eliminar?').then(res => {
        if (res) {
          this.firestoreService.deleteDocumentID(Paths.clientes, cliente.id!);
        }
      })
  }



}
