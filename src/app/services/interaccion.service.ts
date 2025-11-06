import { Injectable } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root'
})
export class InteraccionService {

  loading: any;
  present = false;

  constructor(public toastCtrl: ToastController,
              public loadingController: LoadingController,
              public alertController: AlertController) { }

  async showToast(message: string, duration: number = 2000) {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      position: 'middle',
      cssClass: 'aviso',
    });
    toast.present();
  }

  async presentLoading(message?: string) {
    if (message === undefined) {
      message = 'Procesando';
    }
    if (this.present) { return; }
    this.present = true;
    this.loading = await this.loadingController.create({
      cssClass: 'aviso',
      message: message,
      duration: 0,
      backdropDismiss: true
    });
    await this.loading.present();
  }

  async dismissLoading() {
      this.present = false;
      this.loading.dismiss();
  }

  preguntaAlert(header: string, message: string): Promise<boolean> {

    return new Promise(  async  (resolve) => {
        const alert = await this.alertController.create({
          header,
          message,
          cssClass: 'aviso',
          buttons: [
            {
              text: 'Cancelar',
              role: 'cancel',
              cssClass: 'aviso',
              handler: _ => {
                    resolve(false);
              }
            }, {
              text: 'SI',
              cssClass: 'aviso',
              handler: async () => {
                resolve(true);
              }
            }
          ]
        });
        await alert.present();
    });
  }

  async presentToastWithOptions(header: string, message: string, 
                                position: "bottom" | "top" | "middle",
                                buttons: any[],
                                duration: number,
                                color: string = 'dark') {
    const toast = await this.toastCtrl.create({
      header,
      message,
      position,
      buttons,
      duration,
      color,
      cssClass: 'aviso',
    });
    toast.present();
  }

}


