// import http from 'http';

import { exit } from 'process';
import { WaterRower } from './waterrower-serial/waterrower-serial';
import debug from 'debug';
import { FitnessMachineService } from './ble';
import bleno from '@abandonware/bleno';
import { tap } from 'rxjs';

const logger = debug('MAIN');
logger('start waterrower ble service')
// export const server = http.createServer((req, res) => {
//   res.writeHead(200, { 'Content-Type': 'application/json' });
//   res.end(
//     JSON.stringify({ data: 'It Works!' })
//   );
// });

// server.listen(3000, () => {
//   logger('Server running on http://localhost:3000/');
// });

function startRecording(waterrower: WaterRower): void {
  logger('start recording');
  waterrower.connectSerial();
  waterrower.on('initialized', () => {
    logger('waterrower initialized start recording');

    waterrower.reset();
    waterrower.startRecording('recording.txt');
  });
}

function startWorkout(waterrower: WaterRower): void {
  waterrower.connectSerial();
  waterrower.on('initialized', () => {
    waterrower.reset();
    startBLE(waterrower);
  });
}

function replayRecording(waterrower: WaterRower): void {
  startBLE(waterrower);
  waterrower.datapoints$.subscribe({
    next: data => logger(data),
    complete: () => logger('completed'),
  });
  waterrower.reads$.subscribe({
    next: data => logger(data),
    complete: () => logger('completed'),
  });
  waterrower.playRecording('recording.txt').then(() => {
    logger('replay session finished');
  });
}



function startBLE(waterrower: WaterRower): void {
  logger('Start BLE service');

  const ftmsService = new FitnessMachineService();
  waterrower.datapoints$
    .pipe(tap(data => {
      if (data?.name === 'stroke_rate') {
        ftmsService.updateData(null, Number(data.value) * 2);
        return;
      }
      if (data?.name === 'kcal_watts') {
        ftmsService.updateData(Number(data.value), null);
        return;
      }
    }))
    .subscribe();

  bleno.on('stateChange', state => {
    logger(`BLENO stateChange. State = ${state}`);

    if (state === 'poweredOn') {
      bleno.startAdvertising('WaterRower', [ftmsService.uuid]);
      return;
    }

    bleno.stopAdvertising();
  });

  bleno.on('advertisingStart', error => {
    logger(`BLENO advertisingStart. Error = ${error}`);
    if (error != null) {
      return;
    }

    bleno.setServices([ftmsService], error => {
      logger(`BLENO set ftmsService: ${error ?? 'success'} `)
    });
  })
}

function main(): void {
  const waterrower = new WaterRower(options => {
    options.datapoints = ['stroke_rate', 'kcal_watts', 'strokes_cnt', 'm_s_total'];
    options.portName = '/dev/ttyACM0';
    options.refreshRate = 1000;
  });

  switch (process.argv[2]) {
    case '-w':
      startWorkout(waterrower);
      break;
    case '-r':
      startRecording(waterrower);
      break;
    case '-p':
      replayRecording(waterrower);
      break;
    case '-ble':
      startBLE(waterrower);
      break;
  }
}

try {
  main();
} catch (error) {
  logger(error);
  exit(1);
}


