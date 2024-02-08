// import http from 'http';

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
try {
  const waterrower = new WaterRower({ datapoints: ['stroke_rate', 'kcal_watts', 'strokes_cnt', 'm_s_total'], portName: '/dev/ttyACM0', refreshRate: 1000 });

  waterrower.on('initialized', () => {
    waterrower.reset();
    waterrower.startRecording('./recording.txt');
  });

  process.on('SIGINT', () => waterrower.stopRecording())

} catch (error) {
  console.log(error);
}