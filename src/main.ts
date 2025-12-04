import debug from 'debug';
import { exit } from 'process';
import { tap } from 'rxjs';

import bleno = require('@abandonware/bleno');

import { FitnessMachineService } from './ble';
import { HeartRateMonitor } from './ble/heart-rate-monitor';
import { WaterRower } from './waterrower-serial/waterrower-serial';
import { WebServer } from './web-server/web-server';

const logger = debug('MAIN');
logger('Starting WaterRower Training System...');

function startRecording(waterrower: WaterRower): void {
  logger('start recording');
  waterrower.connectSerial();
  waterrower.on('initialized', () => {
    waterrower.reset();
    startBLE(waterrower);
    waterrower.startRecording('recording.txt');
  });
}

function startWorkout(waterrower: WaterRower): void {
  logger('start workout');
  waterrower.connectSerial();
  waterrower.on('initialized', () => {
    waterrower.reset();
    startBLE(waterrower);
  });
}

function replayRecording(waterrower: WaterRower): void {
  logger('replay recording');
  startBLE(waterrower);

  // waterrower.datapoints$.subscribe({
  //   next: data => logger(data),
  //   complete: () => logger('completed'),
  // });

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
        ftmsService.updateData(null, Number('0x' + data.value));
        return;
      }
      if (data?.name === 'kcal_watts') {
        ftmsService.updateData(Number('0x' + data.value), null);
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

function createWaterRower(): WaterRower {
  return new WaterRower(options => {
    options.datapoints = ['stroke_rate', 'kcal_watts', 'strokes_cnt', 'm_s_total', 'total_kcal', 'ms_average'];
    options.portName = process.env.WATERROWER_PORT || '';
    options.refreshRate = 1000;
  });
}

function main(): void {
  // Check for command line arguments for legacy modes
  const mode = process.argv[2];
  startWebServer();

  if (mode === '-w') {
    startWorkout(createWaterRower());
    return;
  }

  if (mode === '-r') {
    startRecording(createWaterRower());
    return;
  }

  if (mode === '-p') {
    replayRecording(createWaterRower());
    return;
  }

  if (mode === '-ble') {
    startBLE(createWaterRower());
    return;
  }
}

function startWebServer(): void {
  logger('Starting web server mode...');

  // Initialize heart rate monitor (optional)
  const heartRateMonitor = new HeartRateMonitor();
  const waterRower = createWaterRower();
  waterRower.connectSerial();

  // Optional: Load Garmin credentials from environment variables
  const garminCredentials = process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD
    ? { email: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD }
    : { email: '', password: '' };

  if (garminCredentials) {
    logger('Garmin credentials loaded from environment');
  }

  // Create and start web server
  const webServer = new WebServer({
    port: parseInt(process.env.PORT || '3000'),
    waterRower: waterRower,
    heartRateMonitor,
    garminCredentials,
    fitFilesDirectory: './data/fit-files'
  });

  webServer.start();
}

try {
  main();
} catch (error) {
  console.error(error);
  exit(1);
}


