import debug from 'debug';
import { exit } from 'process';

import { HeartRateMonitor } from './ble/heart-rate-monitor';
import { WaterRower } from './waterrower-serial/waterrower-serial';
import { WebServer } from './web-server/web-server';
import { ConfigManager } from './helper/config-manager';

const logger = debug('MAIN');
logger('Starting WaterRower Training System...');

// function startRecording(waterrower: WaterRower): void {
//   logger('start recording');
//   waterrower.connectSerial();
//   waterrower.on('initialized', () => {
//     waterrower.reset();
//     startBLE(waterrower);
//     waterrower.startRecording('recording.txt');
//   });
// }

// function startWorkout(waterrower: WaterRower): void {
//   logger('start workout');
//   waterrower.connectSerial();
//   waterrower.on('initialized', () => {
//     waterrower.reset();
//     startBLE(waterrower);
//   });
// }

// function replayRecording(waterrower: WaterRower): void {
//   logger('replay recording');
//   startBLE(waterrower);

//   // waterrower.datapoints$.subscribe({
//   //   next: data => logger(data),
//   //   complete: () => logger('completed'),
//   // });

//   waterrower.playRecording('recording.txt').then(() => {
//     logger('replay session finished');
//   });
// }

// function startBLE(waterrower: WaterRower): void {
//   logger('Start BLE service');

//   const ftmsService = new FitnessMachineService();
//   waterrower.datapoints$
//     .pipe(tap(data => {
//       if (data?.name === 'stroke_rate') {
//         ftmsService.updateData(null, Number('0x' + data.value));
//         return;
//       }
//       if (data?.name === 'kcal_watts') {
//         ftmsService.updateData(Number('0x' + data.value), null);
//         return;
//       }
//     }))
//     .subscribe();

//   bleno.on('stateChange', state => {
//     logger(`BLENO stateChange. State = ${state}`);

//     if (state === 'poweredOn') {
//       bleno.startAdvertising('WaterRower', [ftmsService.uuid]);
//       return;
//     }

//     bleno.stopAdvertising();
//   });

//   bleno.on('advertisingStart', error => {
//     logger(`BLENO advertisingStart. Error = ${error}`);
//     if (error != null) {
//       return;
//     }

//     bleno.setServices([ftmsService], error => {
//       logger(`BLENO set ftmsService: ${error ?? 'success'} `)
//     });
//   })
// }

function createWaterRower(port?: string): WaterRower {
  return new WaterRower(options => {
    options.datapoints = ['stroke_rate', 'kcal_watts', 'strokes_cnt', 'm_s_total', 'total_kcal', 'ms_average'];
    // Use saved port from config, or empty string to auto-discover
    options.portName = port || '';
    options.refreshRate = 1000;
  });
}

function main(): void {
  // Check for command line arguments for legacy modes
  const mode = process.argv[2];
  startWebServer();

  // if (mode === '-w') {
  //   startWorkout(createWaterRower());
  //   return;
  // }

  // if (mode === '-r') {
  //   startRecording(createWaterRower());
  //   return;
  // }

  // if (mode === '-p') {
  //   replayRecording(createWaterRower());
  //   return;
  // }

  // if (mode === '-ble') {
  //   startBLE(createWaterRower());
  //   return;
  // }
}

async function startWebServer(): Promise<void> {
  logger('Starting web server mode...');

  // Initialize configuration manager
  const configManager = new ConfigManager('./data');

  // Get saved HRM device
  const savedHRMDevice = configManager.getHRMDevice();

  // Initialize heart rate monitor (optional) - will auto-connect in background if device is saved
  const heartRateMonitor = new HeartRateMonitor(savedHRMDevice?.id);

  // Initialize WaterRower
  const waterRower = createWaterRower(configManager.getWaterRowerPort());

  // Create and start web server using config values
  const webServer = new WebServer({
    waterRower: waterRower,
    heartRateMonitor,
    configManager
  });

  webServer.start();
  waterRower.connectSerial();
}

try {
  main();
} catch (error) {
  console.error(error);
  exit(1);
}
