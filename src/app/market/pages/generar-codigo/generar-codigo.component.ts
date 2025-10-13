import { Component, OnInit} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, UntypedFormGroup } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonItem,
  IonLabel,
  IonButton,
  IonMenuButton
} from '@ionic/angular/standalone';

import {MatFormFieldModule} from '@angular/material/form-field';
import {MatCardModule} from '@angular/material/card';
import {MatSelectModule} from '@angular/material/select';
import { MatInputModule }       from '@angular/material/input';

import { addIcons } from 'ionicons';
import { barcode, saveOutline, saveSharp } from 'ionicons/icons';

import { NgxBarcode6Module } from 'ngx-barcode6';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';


@Component({
  selector: 'app-generar-codigo',
  templateUrl: './generar-codigo.component.html',
  styleUrls: ['./generar-codigo.component.scss'],
  imports: [
    IonButton,
    IonLabel,
    IonItem,
    IonIcon,
    IonCol,
    IonRow,
    IonGrid,
    IonContent,
    IonTitle,
    IonButtons,
    IonToolbar,
    IonHeader,
    IonMenuButton,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatCardModule,
    MatSelectModule,
    MatInputModule,
    NgxBarcode6Module
]
})
export default class GenerarCodigoComponent implements OnInit {

  articuloForm:UntypedFormGroup = this.fb.group({
    codigo: ['', Validators.required],
  });

  campoinValido = false;

  codigo = '';
  titulo = 'Nuevo Código';
  descripcion = 'Generar nuevo código';
  ocultar = false;
  elementType: "canvas" | "img" | "svg" = 'svg';
  value = '';
  format: "" | "CODE128" | "CODE128A" | "CODE128B" | "CODE128C" | "EAN" | "UPC" | "EAN8" | "EAN5" | "EAN2" | "CODE39" | "ITF14" | "MSI" | "MSI10" | "MSI11" | "MSI1010" | "MSI1110" | "pharmacode" | "codabar" = 'CODE128';
  lineColor = '#000000';
  width = 2;
  height = 100;
  displayValue = true;
  fontOptions = '';
  font = 'monospace';
  textAlign = 'center';
  textPosition = 'bottom';
  textMargin = 2;
  fontSize = 20;
  background = '#ffffff';
  margin = 10;
  marginTop = 10;
  marginBottom = 10;
  marginLeft = 10;
  marginRight = 10;
  numeroImpresion = 0;

  get values(): string[] {
    return this.value.split('\n')
  }

  codeList: string[] = [
    '', 'CODE128',
    'CODE128A', 'CODE128B', 'CODE128C',
    'UPC', 'EAN8', 'EAN5', 'EAN2',
    'CODE39',
    'ITF14',
    'MSI', 'MSI10', 'MSI11', 'MSI1010', 'MSI1110',
    'pharmacode',
    'codabar'
  ];

  selectedValue?: string;

  numeros = [
    {value: 3, viewValue: '3'},
    {value: 6, viewValue: '6'},
    {value: 9, viewValue: '9'},
    {value: 12, viewValue: '12'},
    {value: 15, viewValue: '15'},
    {value: 18, viewValue: '18'},
    {value: 21, viewValue: '21'},
  ];


  constructor(private fb:FormBuilder) {
    addIcons({ barcode, 'save-outline': saveOutline, 'save-sharp': saveSharp });
   }

  ngOnInit() {

  }

  posicion(pos: number){
      this.numeroImpresion = pos;
      this.campoinValido = false;
  }

  valuechangeInput(){
    this.value = this.articuloForm.controls['codigo'].value ?? '';
  }

  campoNoValido(campo: string){
    return  this.articuloForm.controls[campo].errors &&
      this.articuloForm.controls[campo].touched;
  }


async generarPdfSvg() {
  // Validaciones del form y de numeroImpresion
  if (this.articuloForm.invalid) {
    this.articuloForm.markAllAsTouched();
    return;
  }
  if (this.numeroImpresion <= 0) {
    this.campoinValido = true;
    return;
  }

  // 1) Localiza el SVG del código de barras ya renderizado en el DOM
  //    (asegúrate de que el template tenga <div id="contenido"><ngx-barcode6 .../></div>)
  const svg = document.querySelector<SVGSVGElement>('#contenido svg');
  if (!svg) {
    console.error('No se encontró el SVG dentro de #contenido');
    return;
  }

  // 2) Crea el PDF y pinta tu cabecera
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(30);
  doc.setTextColor(126, 0, 46);
  doc.text('Minimercado AppMarket', 50, 12);

  // 3) Posiciones predefinidas (idénticas a tu switch antiguo)
  //    3 columnas por fila: x = 10, 75, 140; y empieza en 20 y va bajando
  const columnsX = [10, 75, 140];
  const rowStartY = 20;
  const rowStep = 40; // distancia vertical entre filas (20->60->100->...)
  const width = 60;
  const height = 30;

  // función utilitaria: genera las posiciones (x, y) necesarias
  const getPositions = (count: number): Array<{ x: number; y: number }> => {
    const coords: Array<{ x: number; y: number }> = [];
    let placed = 0;
    let row = 0;
    while (placed < count) {
      for (let col = 0; col < columnsX.length && placed < count; col++) {
        coords.push({ x: columnsX[col], y: rowStartY + rowStep * row });
        placed++;
      }
      row++;
    }
    return coords;
  };

  const positions = getPositions(this.numeroImpresion);

  // 4) Pegar el MISMO SVG en todas las posiciones (vectorial y nítido)
  for (const { x, y } of positions) {
    // @ts-ignore – si no agregaste tipos, doc.svg existe por el plugin
    await (doc as any).svg(svg, {
      x, y,
      width, height, // tamaño del bloque del barcode en el PDF
      // optional:
      // preserveAspectRatio: 'xMidYMid meet'
    });
  }

  // 5) Limpieza / guardar
  this.articuloForm.reset();
  this.value = '';
  doc.save('codigos.pdf');
}
}
