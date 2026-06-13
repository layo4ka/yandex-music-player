const https = require('https');

// Mock token for testing if needed, or we can just test if the endpoint returns 401 vs 404
const options = {
  hostname: 'api.music.yandex.net',
  port: 443,
  path: '/rotor/station/user:onyourwave/tracks',
  method: 'GET',
  headers: {
    'User-Agent': 'YandexMusicAndroid/24020331',
    // 'Authorization': 'OAuth YOUR_TOKEN'
  }
};

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
