import { Component, inject, OnDestroy, OnInit, signal,NgZone   } from '@angular/core';


import { Cliente, Venta, Producto, Paths, ProductoVenta } from '../../../models/models';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { startWith, debounceTime, map } from 'rxjs/operators';


import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { VentaService } from 'src/app/services/venta.service';
import { FirestoreService } from 'src/app/services/firestore.service';
import { InteraccionService } from 'src/app/services/interaccion.service';
import {
  IonHeader,
  IonGrid,
  IonToolbar,
  IonRow,
  IonButtons,
  IonTitle,
  IonIcon,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonMenuButton,
  IonCol,
  IonInput,
  IonFooter,
  PopoverController
} from "@ionic/angular/standalone";
import { DatePipe, AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { addIcons } from 'ionicons';
import {
  save,
  closeCircle,
  create,
  addCircle,
  search,
  remove,
  add,
  trash
} from 'ionicons/icons';

import { PopAddProductoComponent } from '../../components/pop-add-producto/pop-add-producto.component';
import { EpsonPrinterService } from 'src/app/core/printer/epson-printer.service';
import { PAPER_WIDTH_CHARS } from '../../../core/printer/epson.config';
import { PrintSale } from '../../../core/printer/print.types';



export interface User {
  name: string;
}

@Component({
    selector: 'app-venta',
    templateUrl: './venta.component.html',
    styleUrls: ['./venta.component.scss'],
    imports: [
      IonLabel,
      IonItem,
      IonContent,
      IonButton,
      IonIcon,
      IonTitle,
      IonButtons,
      IonRow,
      IonToolbar,
      IonGrid,
      IonHeader,
      IonMenuButton,
      IonCol,
      IonInput,
      IonFooter,
      DatePipe,
      AsyncPipe,
      RouterLink,
      FormsModule,
      MatFormFieldModule,
      MatInputModule,
      MatAutocompleteModule,
      ReactiveFormsModule,
      MatIconModule
    ]
})



export default class VentaComponent implements OnInit, OnDestroy {
  private ventaService = inject(VentaService);
  //private printer = inject(PrinterService);
  private firestoreService = inject(FirestoreService);
  private interaccionService = inject(InteraccionService);
  private popoverController = inject(PopoverController);
  private printer = inject(EpsonPrinterService); 


  venta?: Venta;
  suscriberVenta: Subscription;
  vuelto: number = 0;
  pago: number = 0;
  sale?: PrintSale

  codigoTimer: any;    // para manejar el debounce manual
  //codigoTimers: { [index: number]: any } = {}; // Un timer por input
  private relojInterval!: any;

// Timers por input (fila)
codigoTimers: { [index: number]: any } = {};
// Suprime keyups inmediatamente después de un Enter (scanner)
suppressUntil: Record<number, number> = {};
// Evita re-entradas simultáneas por fila
inFlightByIndex: Record<number, boolean> = {};

  encabezados = ['Código', 'Nombre', 'Stock', 'Cantidad', 'Precio', 'SubTotal']
  clienteControl = new FormControl<string | Cliente>('');
  clientes$!: Observable<Cliente[]>;
  clientesFiltrados$!: Observable<Cliente[]>;     // Clientes filtrados por input
  clienteSeleccionado?: Cliente;


  constructor() {

        addIcons({save, closeCircle,create,addCircle,search,remove,add,trash });
        this.venta = this.ventaService.getVenta();
        this.suscriberVenta = this.ventaService.getVentaChanges().subscribe( res => {
              this.venta = res;
              this.addProducto();
              this.calcularValores();
              this.changePago();
        });
        this.addProducto();
        this.calcularValores();
  }


  ngOnInit() {
    // 1. Obtener todos los clientes en tiempo real (funciona offline)
    this.clientes$ = this.firestoreService.getCollectionChanges<Cliente>(Paths.clientes, 'nombre');

    this.iniciarRelojVenta();

    // 2. Filtrar localmente según input
    this.clientesFiltrados$ = combineLatest([
      this.clienteControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300)
      ),
      this.clientes$
    ]).pipe(
      map(([input, clientes]) => {
        const texto = typeof input === 'string' ? input.toLowerCase() : input?.nombre?.toLowerCase() || '';
        return clientes.filter(cliente =>
          cliente.nombre.toLowerCase().includes(texto) ||
          cliente.ruc?.toLowerCase().includes(texto)
        );
      })
    );
  }


  iniciarRelojVenta() {
  this.relojInterval = setInterval(() => {
    if (this.venta) {
      this.venta.fecha = new Date();
    }
  }, 1000);

}


  displayFn(cliente: Cliente): string {
    return cliente?.nombre ?? '';
  }

  seleccionarCliente(cliente: Cliente) {
    this.clienteSeleccionado = cliente;
    // Aquí puedes llenar los campos visuales, o vincularlo a la venta
      this.venta!.cliente = cliente;
       this.ventaService.saveVenta();
  }

  ngOnDestroy() {
    if (this.suscriberVenta) {
      this.suscriberVenta.unsubscribe();
    }
    if (this.relojInterval) {
    clearInterval(this.relojInterval);
  }
  }


  addProducto() {
    if (this.venta) {
      const productoVenta = {
        cantidad: 1,
        producto: {
            nombre: '',
            descripcion: '',
            costo_compra: 0,
            check_iva: false,
            costo_sin_iva: 0,
            pvp: 0,
            codigo: '',
            stock: 0,
            fecha_caducidad: new Date(),
            stock_minimo: 0,
            diferencia: 0
        },
        precio: 0,
      }
      if (!this.venta.productos.length) {
          this.venta.productos.push(productoVenta);
      } else {
          if (this.venta.productos[this.venta.productos.length - 1].producto.codigo.length) {
              this.venta.productos.push(productoVenta);
          }
      }

    }
    this.setFocusNewProducto();
  }

  // Escritura manual: dispara tras 600ms sin teclear
onKeyupCodigo(index: number) {
  // Si justo acabamos de procesar un Enter del scanner, ignoramos este keyup
  if (Date.now() < (this.suppressUntil[index] || 0)) return;

  clearTimeout(this.codigoTimers[index]);

  const codigo = this.venta?.productos[index]?.producto?.codigo ?? '';
  this.codigoTimers[index] = setTimeout(() => {
    if (codigo && codigo.length > 5) {
      this.tryBuscarCodigo(codigo, index);
    }
  }, 600);
}

// Escáner (Enter): inmediato y cancela debounce de esa fila
onEnterCodigo(index: number) {
  clearTimeout(this.codigoTimers[index]);
  // Bloquea los keyup que llegan justo después del Enter
  this.suppressUntil[index] = Date.now() + 700;

  const codigo = this.venta!.productos[index].producto.codigo;
  if (codigo && codigo.length > 5) {
    this.tryBuscarCodigo(codigo, index);
  }
}

// Evita llamadas simultáneas; NO bloquea mismo código en lecturas posteriores
private async tryBuscarCodigo(codigo: string, index: number) {
  if (this.inFlightByIndex[index]) return;

  this.inFlightByIndex[index] = true;
  try {
    await this.buscarProductoPorCodigo(codigo, index);
    // si en addProductoWithCode limpias el input y agregas una nueva línea,
    // el siguiente escaneo entrará sin problemas.
  } finally {
    this.inFlightByIndex[index] = false;
  }
}

async buscarProductoPorCodigo(codigo: string, index: number) {
  const res = await this.firestoreService.getDocumentQuery<Producto>(Paths.productos, 'codigo', codigo);
  if (res) {
    this.addProductoWithCode(res, index); // tu método ya suma cantidad si existe
  } else {
    this.interaccionService.showToast('Producto no encontrado');
  }
}


  setFocusNewProducto() {
        setTimeout(() => {
          const inputs = document.getElementsByClassName("codigo") as any;

          if (inputs.length) {
            inputs[inputs.length -1].setFocus();
          }
        }, 500);
  }

  clearInput() {
      this.venta!.productos[this.venta!.productos.length - 1].producto.codigo = '';
      this.setFocusNewProducto();
  }

  // Añade un producto a la venta con el codigo escaneado
  // Aumenta la cantidad del producto si al escanear es el mismo producto
  // que ya existe
  addProductoWithCode(newproducto: Producto, index: number) {
      const productoExist = this.venta!.productos.find( producto => {
             return  producto.producto.codigo === newproducto.codigo
      });

      if (productoExist!.producto.nombre) {
        productoExist!.cantidad ++ ;
        this.clearInput();
        this.ventaService.saveVenta();
      } else {
          this.venta!.productos[index].producto = newproducto;
          this.ventaService.saveVenta();
          this.addProducto();
      }
  }


  addCantidad(producto: ProductoVenta) {
    producto.cantidad ++;
    this.ventaService.saveVenta();
  }


  removeCantidad(producto: ProductoVenta) {
  if (!this.venta) return;

  if (producto.cantidad > 1) {
    producto.cantidad--;
  } else {
    // Eliminar el producto si la cantidad es 1 y le das a "menos"
    const index = this.venta.productos.indexOf(producto);
    if (index !== -1) {
      this.venta.productos.splice(index, 1);
    }
  }

  this.ventaService.saveVenta();
}

eliminarProducto(index: number) {
  if (!this.venta) return;

  this.venta.productos.splice(index, 1);
  this.ventaService.saveVenta();
}


  changeCantidad(producto: ProductoVenta, index: number) {

    if (producto.cantidad === 0) {
        this.eliminarProducto(index);
          return;
      }
      producto.precio = producto.cantidad * producto.producto.pvp;
      this.ventaService.saveVenta();
  }

   calcularValores() {
      if (this.venta) {
        this.venta.total = 0;
        this.venta.subtotal_con_iva = 0;
        this.venta.subtotal_sin_iva = 0;
        this.venta.iva = 0;
        this.venta.productos.forEach( item => {
              item.precio = item.cantidad * item.producto.pvp;
              this.venta!.subtotal_sin_iva = this.venta!.subtotal_sin_iva + (item.precio / 1.15);
              if (item.producto.check_iva) {
                 this.venta!.iva = this.venta!.iva + (item.precio - (item.precio / 1.15));
                 this.venta!.subtotal_con_iva = this.venta!.subtotal_con_iva + item.precio  + this.venta!.iva;
              }
              this.venta!.total = this.venta!.subtotal_sin_iva + this.venta!.iva;
        });
      }
  }


  // AGREGA UN NUEVO PRODUCTO DE VENTA RAPIDAMENTE
   async addProductoRapido() {
    const popover = await this.popoverController.create({
      component: PopAddProductoComponent,
      cssClass: 'popoverCss',
      translucent: false,
      backdropDismiss: true,
      mode: 'ios'
    });
    await popover.present();
    const { data } = await popover.onWillDismiss();
    if (data) {
      const producto = data as Producto;

      const item: ProductoVenta = {
          cantidad: 1,
          precio: producto.pvp,
          producto,
      }
      if (!this.venta!.productos[this.venta!.productos.length - 1].producto.codigo) {
        this.venta!.productos[this.venta!.productos.length - 1] =  item;
      } else {
        this.venta!.productos.push(item);
      }
      this.ventaService.saveVenta();
      this.addProducto();
    }

}

  resetVenta() {
     this.interaccionService.preguntaAlert('Alerta',
            '¿Seguro que desea resetear la venta actual?').then( res => {
                if (res) {
                  this.ventaService.resetVenta();
                }
            })
  }

  changePago() {
      if (this.pago >= this.venta!.total) {
            this.vuelto = this.pago - this.venta!.total;
      } else {
        this.vuelto = 0;
      }
  }


async saveVenta() {
  if (!this.esVentaValida()) return;
  const respuesta = await this.interaccionService.preguntaAlert(
    'Alerta',
    '¿Terminar y guardar la venta actual?'
  );
  if (respuesta && this.venta) {

    this.venta!.productos = this.venta!.productos.slice(0, -1);
    this.sale = {
      numero: this.venta.numero,
      fecha: this.venta.fecha ?? new Date(),
      cliente: {
        nombre: this.venta.cliente?.nombre,
        ruc: this.venta.cliente?.ruc,
        telefono: this.venta.cliente?.telefono,
      },
      items: (this.venta.productos || []).map((it:any) => ({
        cantidad: it.cantidad,
        totalLinea: it.precio,
        producto: { nombre: it.producto?.nombre, pvp: it.producto?.pvp, check_iva: it.producto?.check_iva }
      })),
      subtotalSinIVA: this.venta.subtotal_sin_iva,
      iva: this.venta.iva,
      total: this.venta.total,
      pago: this.pago,
      vuelto: this.vuelto,
    };
  
    await this.ventaService.saveVentaTerminada(); // Esperar a que guarde
      // Antes de imprimir (elige 80mm o 58mm):
    this.printer.setSettings({ widthChars: PAPER_WIDTH_CHARS.W58 }); // ó W80    
      try {
        await this.printer.printSale(this.sale!);
        this.interaccionService.showToast('Ticket impreso');
      } catch (e:any) {
        console.error(e);
        this.interaccionService.showToast('No se pudo imprimir');
      }

    this.pago = 0;
    this.vuelto = 0;
  }
}


  private esVentaValida(): boolean {
    const venta = this.venta!;

    if (!venta.total) {
      this.interaccionService.showToast('No se ha registrado ningún producto');
      return false;
    }

    if (!venta.cliente.nombre?.trim()) {
      this.interaccionService.showToast('Debe ingresar los datos del cliente');
      return false;
    }

    if (this.pago < venta.total) {
      this.interaccionService.showToast('El valor pagado es menor al total de la venta');
      return false;
    }

    return true;
  }

}
