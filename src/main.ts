// import http from 'http';

import { exit } from 'process';
import { WaterRower } from './waterrower-serial/waterrower-serial';
import debug from 'debug';
import { FitnessMachineService } from './ble';
import bleno from '@abandonware/bleno';

const logger = debug('MAIN');

// export const server = http.createServer((req, res) => {
//   res.writeHead(200, { 'Content-Type': 'application/json' });
//   res.end(
//     JSON.stringify({ data: 'It Works!' })
//   );
// });

// server.listen(3000, () => {
//   logger('Server running on http://localhost:3000/');
// });


function replayRecording(waterrower: WaterRower): void {
  waterrower.reads$.subscribe({
    next: data => logger(data),
    complete: () => logger('completed'),
  });

  waterrower.playRecording('recording.txt').then(() => {
    logger('replay session finished');
  });
}
function startRecording(waterrower: WaterRower): void {
  waterrower.on('initialized', () => {
    waterrower.reset();
    waterrower.startRecording('recording.txt');
  });
}

function startWorkout(waterrower: WaterRower): void {
  waterrower.on('initialized', () => {
    waterrower.reset();
  });
}

function startBLE() {
  const ftmsService = new FitnessMachineService();

  bleno.on('stateChange', state => {
    debug(`BLENO stateChange. State = ${state}`);

    if (state === 'poweredOn') {
      bleno.startAdvertising('WaterRower', [ftmsService.uuid]);
    }

    bleno.stopAdvertising();
  });
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
      startBLE();
      break;
  }
}

try {
  main();
} catch (error) {
  logger(error);
  exit(1);
}


