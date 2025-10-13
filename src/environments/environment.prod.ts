import { map } from 'rxjs/operators';

export const environment = {
  production: true,
  firebase: {
    apiKey: 'AIzaSyAxMfMkkeKntFUUYbRfPRJ0KllR2MzIQo4',
    authDomain: 'appmarket-68601.firebaseapp.com',
    projectId: 'appmarket-68601',
    storageBucket: 'appmarket-68601.appspot.com',
    messagingSenderId: '157223563753',
    appId: '1:157223563753:web:d8879df1bdb71600ce9b78'
  },
  printer: {
    ip: '192.168.1.60',
    id: 'local_printer',   // así sale en tu hoja
    portHttp: 8008,        // HTTP (dev/desktop)
    portHttps: 8043,       // HTTPS (si algún día sirves por SSL)
    widthChars: 42         // 80mm ≈ 42, 58mm ≈ 32
  },
  uidAdmin: '5zs8gIZSwnal5i5o40JtEsBokBT2',
  isAdmin: (next: any) => map( (user: any) => !!user),
};

