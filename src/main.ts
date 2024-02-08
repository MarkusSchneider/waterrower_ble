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
  const waterrower = new WaterRower();

  waterrower.on('initialized', () => {
    waterrower.reset();
    waterrower.startRecording('./recording.txt');
  });

} catch (error) {
  console.log(error);
}