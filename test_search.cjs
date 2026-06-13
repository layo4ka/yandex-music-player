const https = require('https');

const options = {
  hostname: 'api.music.yandex.net',
  port: 443,
  path: '/search?text=test&type=track&page=0',
  method: 'GET',
  headers: {
    'User-Agent': 'YandexMusicAndroid/24020331',
  }
};

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', data.substring(0, 200) + '...');
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
