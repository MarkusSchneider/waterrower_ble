// import http from 'http';

import { exit } from 'process';
import { WaterRower } from './waterrower-serial/waterrower-serial';

// export const server = http.createServer((req, res) => {
//   res.writeHead(200, { 'Content-Type': 'application/json' });
//   res.end(
//     JSON.stringify({ data: 'It Works!' })
//   );
// });

// server.listen(3000, () => {
//   console.log('Server running on http://localhost:3000/');
// });


function replayRecording(waterrower: WaterRower): void {
  waterrower.reads$.subscribe({
    next: data => console.log(data),
    complete: () => console.log('completed'),
  });

  waterrower.playRecording('recording.txt').then(() => {
    // console.log('replay session finished');
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
  }
}

try {
  main();
} catch (error) {
  console.log(error);
  exit(1);
}
