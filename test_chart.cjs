const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function test() {
  const headers = {
    'User-Agent': 'YandexMusicAndroid/24020331',
    'X-Yandex-Music-Client': 'YandexMusicAndroid/24020331',
    'Accept': 'application/json',
    'Accept-Language': 'ru'
  };
  try {
    const res = await fetch('https://api.music.yandex.net/feed/chart', { headers });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Result keys:', Object.keys(data.result || {}));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
