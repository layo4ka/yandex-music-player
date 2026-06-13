const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json',
    'X-Retpath-Y': 'https://music.yandex.ru/'
  };
  try {
    const res = await fetch('https://api.music.yandex.net/landing3/new-releases', { headers });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Result keys:', Object.keys(data.result || {}));
    console.log('Error:', data.error);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
