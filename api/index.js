import crypto from 'crypto';
import { spawn, exec } from 'child_process';

const curlFetch = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body || '';

    const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const args = ['-s', '-i', '-X', method, '-m', '10'];

    for (const [key, value] of Object.entries(headers)) {
      args.push('-H', `${key}: ${value}`);
    }

    if (body) {
      args.push('--data-raw', body);
    }

    args.push(url);

    console.log(`[curlFetch] Executing: ${curlCommand} ${method} to ${url}`);

    const child = spawn(curlCommand, args);

    let stdout = Buffer.from([]);
    let stderr = '';

    if (options.signal) {
      if (options.signal.aborted) {
        try { child.kill(); } catch (e) {}
        reject(new Error('Aborted'));
        return;
      }
      const onAbort = () => {
        try { child.kill(); } catch (e) {}
        reject(new Error('Aborted'));
      };
      options.signal.addEventListener('abort', onAbort);
      child.on('close', () => {
        options.signal.removeEventListener('abort', onAbort);
      });
    }

    child.stdout.on('data', (data) => {
      stdout = Buffer.concat([stdout, data]);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`curl process exited with code ${code}. Stderr: ${stderr}`));
        return;
      }

      try {
        const output = stdout.toString('utf-8');
        const headerEndIdx = output.indexOf('\r\n\r\n');
        let headerPart = '';
        let bodyPart = '';
        if (headerEndIdx !== -1) {
          headerPart = output.substring(0, headerEndIdx);
          bodyPart = output.substring(headerEndIdx + 4);
        } else {
          const lEndIdx = output.indexOf('\n\n');
          if (lEndIdx !== -1) {
            headerPart = output.substring(0, lEndIdx);
            bodyPart = output.substring(lEndIdx + 2);
          } else {
            bodyPart = output;
          }
        }

        const statusLine = headerPart.split('\r\n')[0] || headerPart.split('\n')[0] || '';
        const match = statusLine.match(/HTTP\/\d+\.\d+\s+(\d+)/);
        const status = match ? parseInt(match[1], 10) : 200;

        const responseHeaders = {};
        headerPart.split(/\r?\n/).slice(1).forEach(line => {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const key = line.substring(0, colonIdx).trim().toLowerCase();
            const val = line.substring(colonIdx + 1).trim();
            responseHeaders[key] = val;
          }
        });

        resolve({
          ok: status >= 200 && status < 300,
          status: status,
          headers: {
            get: (key) => responseHeaders[key.toLowerCase()] || null
          },
          text: async () => bodyPart,
          json: async () => JSON.parse(bodyPart)
        });
      } catch (err) {
        reject(err);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
};

const customFetch = (url, options = {}) => {
  const urlStr = typeof url === 'string' ? url : (url.url || url.toString());
  if (urlStr.includes('yandex.ru') || urlStr.includes('yandex.net')) {
    return curlFetch(urlStr, options);
  }
  return fetch(url, options);
};

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = urlObj.pathname;

  // 1. YouTube/Piped Search proxy
  if (path.startsWith('/api/search')) {
    const q = urlObj.searchParams.get('q') || '';
    const pipedInstances = [
      'https://api.piped.private.coffee',
      'https://pipedapi.adminforge.de',
      'https://piped-api.privacy.com.de',
      'https://pipedapi.nosebs.ru',
      'https://api.piped.yt'
    ];
    
    let found = null;
    for (const inst of pipedInstances) {
      try {
        const response = await customFetch(`${inst}/search?q=${encodeURIComponent(q)}&filter=videos`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.items && Array.isArray(data.items)) {
            found = data.items;
            break;
          }
        }
      } catch (e) {
        console.warn(`Node fetch failed on instance ${inst}:`, e.message);
      }
    }
    
    res.setHeader('Content-Type', 'application/json');
    if (found) {
      res.end(JSON.stringify({ items: found }));
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Failed to fetch search results from all instances' }));
    }
    return;
  }

  // 2. Yandex Music proxy endpoints
  if (path.startsWith('/api/yandex')) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^(OAuth|Bearer)\s*/i, '') || urlObj.searchParams.get('token') || '';
    console.log(`[Proxy Request] URL: ${req.url} | DEBUG_TOKEN: ${token}`);
    
    res.setHeader('Content-Type', 'application/json');

    // 2.0.1 Yandex Device Authorization - Request confirmation codes
    if (path.startsWith('/api/yandex/auth/device-code')) {
      try {
        const body = new URLSearchParams({
          client_id: '23cabbbdc6cd418abb4b39c32c41195d'
        });
        const response = await customFetch('https://oauth.yandex.ru/device/code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'YandexMusicAndroid/24020331'
          },
          body: body.toString()
        });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          const text = await response.text();
          res.end(JSON.stringify({ error: 'Failed to get device code', details: text }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.0.2 Yandex Device Authorization - Poll OAuth Token
    if (path.startsWith('/api/yandex/auth/token')) {
      const deviceCode = urlObj.searchParams.get('device_code') || '';
      if (!deviceCode) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'device_code is required' }));
        return;
      }
      try {
        const body = new URLSearchParams({
          grant_type: 'device_code',
          code: deviceCode,
          client_id: '23cabbbdc6cd418abb4b39c32c41195d',
          client_secret: '53bc75238f0c4d08a118e51fe9203300'
        });
        const response = await customFetch('https://oauth.yandex.ru/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'YandexMusicAndroid/24020331'
          },
          body: body.toString()
        });
        
        const data = await response.json();
        if (response.ok) {
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify(data));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    let hasToken = true;
    if (!token) {
      const publicPaths = [
        '/api/yandex/trends',
        '/api/yandex/chart',
        '/api/yandex/album-tracks',
        '/api/yandex/artist-info',
        '/api/yandex/search'
      ];
      const isPublic = publicPaths.some(p => path.startsWith(p));
      if (!isPublic) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'OAuth token is required' }));
        return;
      }
      hasToken = false;
    }

    const headers = {
      'User-Agent': 'YandexMusicAndroid/24020331',
      'X-Yandex-Music-Client': 'YandexMusicAndroid/24020331',
      'Accept': 'application/json',
      'Accept-Language': 'ru'
    };
    if (hasToken) {
      headers['Authorization'] = `OAuth ${token}`;
    }

    // 2.1 Yandex Status/Account
    if (path.startsWith('/api/yandex/account')) {
      try {
        const response = await customFetch('https://api.music.yandex.net/account/status', { headers });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify({ error: 'Yandex API error status' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.2 Yandex Search
    if (path.startsWith('/api/yandex/search')) {
      const text = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';
      try {
        const response = await customFetch(`https://api.music.yandex.net/search?text=${encodeURIComponent(text)}&type=all&page=0`, { headers });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify({ error: 'Yandex search failed' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.2.9 Yandex Add/Remove Likes
    if (path.startsWith('/api/yandex/likes/add') || path.startsWith('/api/yandex/likes/remove')) {
      const uid = urlObj.searchParams.get('uid') || '';
      const trackId = urlObj.searchParams.get('trackId') || '';
      if (!uid || !trackId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'uid and trackId parameters are required' }));
        return;
      }
      const isAdd = path.startsWith('/api/yandex/likes/add');
      const endpoint = isAdd ? 'add-multiple' : 'remove';
      try {
        const response = await customFetch(`https://api.music.yandex.net/users/${uid}/likes/tracks/${endpoint}`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `track-ids=${trackId}`
        });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          const text = await response.text();
          res.end(JSON.stringify({ error: `Failed to ${isAdd ? 'add' : 'remove'} liked track`, details: text }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.3 Yandex Liked Tracks
    if (path.startsWith('/api/yandex/likes')) {
      const uid = urlObj.searchParams.get('uid') || '';
      if (!uid) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'uid parameter is required' }));
        return;
      }
      try {
        const likesResponse = await customFetch(`https://api.music.yandex.net/users/${uid}/likes/tracks`, { headers });
        if (!likesResponse.ok) {
          res.statusCode = likesResponse.status;
          res.end(JSON.stringify({ error: 'Failed to fetch liked track IDs' }));
          return;
        }
        const likesData = await likesResponse.json();
        const trackIds = likesData.result?.library?.tracks?.map(t => t.id) || [];
        
        if (trackIds.length === 0) {
          res.end(JSON.stringify({ result: [] }));
          return;
        }

        const targetIds = trackIds.slice(0, 150);
        const tracksResponse = await customFetch('https://api.music.yandex.net/tracks', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `track-ids=${targetIds.join(',')}`
        });
        
        if (tracksResponse.ok) {
          const tracksData = await tracksResponse.json();
          res.end(JSON.stringify({
            result: tracksData.result || [],
            allIds: trackIds
          }));
        } else {
          res.statusCode = tracksResponse.status;
          res.end(JSON.stringify({ error: 'Failed to fetch track details' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.4 Yandex Playlists List
    if (path.startsWith('/api/yandex/playlists')) {
      const uid = urlObj.searchParams.get('uid') || '';
      if (!uid) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'uid parameter is required' }));
        return;
      }
      try {
        const response = await customFetch(`https://api.music.yandex.net/users/${uid}/playlists/list`, { headers });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify({ error: 'Failed to fetch playlists' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5 Yandex Playlist Tracks
    if (path.startsWith('/api/yandex/playlist-tracks')) {
      const uid = urlObj.searchParams.get('uid') || '';
      const kind = urlObj.searchParams.get('kind') || '';
      if (!uid || !kind) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'uid and kind parameters are required' }));
        return;
      }
      try {
        const response = await customFetch(`https://api.music.yandex.net/users/${uid}/playlists/${kind}`, { headers });
        if (response.ok) {
          const data = await response.json();
          const trackShorts = data.result?.tracks || [];
          const trackIds = trackShorts.map(t => t.id || (t.track && t.track.id)).filter(Boolean);
          
          if (trackIds.length === 0) {
            res.end(JSON.stringify({ result: [] }));
            return;
          }

          const targetIds = trackIds.slice(0, 150);
          const tracksResponse = await customFetch('https://api.music.yandex.net/tracks', {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `track-ids=${targetIds.join(',')}`
          });

          if (tracksResponse.ok) {
            const tracksData = await tracksResponse.json();
            res.end(JSON.stringify(tracksData));
          } else {
            res.statusCode = tracksResponse.status;
            res.end(JSON.stringify({ error: 'Failed to fetch playlist track details' }));
          }
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify({ error: 'Failed to fetch playlist' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.3 Yandex My Wave Station Info
    if (path.startsWith('/api/yandex/my-wave/info')) {
      try {
        const station = urlObj.searchParams.get('station') || 'user:onyourwave';
        const response = await customFetch(`https://api.music.yandex.net/rotor/station/${encodeURIComponent(station)}/info`, { headers });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          const errText = await response.text();
          res.end(JSON.stringify({ error: 'Failed to fetch station info', details: errText }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.4 Yandex My Wave Settings Update
    if (path.startsWith('/api/yandex/my-wave/settings')) {
      try {
        const station = urlObj.searchParams.get('station') || 'user:onyourwave';
        const diversity = urlObj.searchParams.get('diversity') || 'default';
        const mood_energy = urlObj.searchParams.get('mood_energy') || 'all';
        const language = urlObj.searchParams.get('language') || 'any';
        
        const payload = {
          diversity,
          mood_energy,
          language
        };
        
        console.log(`[Proxy] Updating My Wave settings for ${station}:`, payload);
        
        const response = await customFetch(`https://api.music.yandex.net/rotor/station/${encodeURIComponent(station)}/settings3`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          const errText = await response.text();
          res.end(JSON.stringify({ error: 'Failed to update settings', details: errText }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.5 Yandex My Wave (Personalized recommendations)
    if (path.startsWith('/api/yandex/my-wave')) {
      try {
        const station = urlObj.searchParams.get('station') || 'user:onyourwave';
        const response = await customFetch(`https://api.music.yandex.net/rotor/station/${encodeURIComponent(station)}/tracks`, { headers });
        let tracks = [];
        
        if (response.ok) {
          const data = await response.json();
          const sequence = data.result?.sequence || [];
          tracks = sequence.map(s => {
            if (s.track) {
              s.track.playIdentifier = s.playIdentifier || null;
              return s.track;
            }
            return null;
          }).filter(Boolean);
        } else {
          console.warn("My wave API failed, falling back to likes");
        }

        if (tracks.length === 0) {
          const uid = urlObj.searchParams.get('uid') || '';
          if (uid) {
            const likesResponse = await customFetch(`https://api.music.yandex.net/users/${uid}/likes/tracks`, { headers });
            if (likesResponse.ok) {
              const likesData = await likesResponse.json();
              const trackIds = likesData.result?.library?.tracks?.map(t => t.id) || [];
              if (trackIds.length > 0) {
                const shuffled = trackIds.sort(() => 0.5 - Math.random()).slice(0, 30);
                const tracksResponse = await customFetch('https://api.music.yandex.net/tracks', {
                  method: 'POST',
                  headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: `track-ids=${shuffled.join(',')}`
                });
                if (tracksResponse.ok) {
                  const tracksData = await tracksResponse.json();
                  tracks = tracksData.result || [];
                }
              }
            }
          }
        if (tracks.length === 0) {
          console.warn("[Proxy] My Wave and likes empty. Falling back to chart tracks.");
          try {
            const chartResponse = await customFetch('https://api.music.yandex.net/landing3/chart', { headers });
            if (chartResponse.ok) {
              const chartData = await chartResponse.json();
              const chartTracks = chartData.result?.chart?.tracks || [];
              tracks = chartTracks.map(item => item.track || item).filter(Boolean);
            }
          } catch (chartErr) {
            console.error("Chart fallback failed:", chartErr);
          }
        }

        res.end(JSON.stringify({ result: tracks }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.5.1 Yandex Radio Feedback (Rotor Feedback)
    if (path.startsWith('/api/yandex/radio-feedback')) {
      try {
        const stationId = urlObj.searchParams.get('stationId') || '';
        const trackId = urlObj.searchParams.get('trackId') || '';
        const event = urlObj.searchParams.get('event') || 'trackStarted';
        const playIdentifier = urlObj.searchParams.get('playIdentifier') || '';
        
        const body = {
          event: event,
          trackId: trackId,
          timestamp: new Date().toISOString()
        };
        if (playIdentifier) {
          body.playIdentifier = playIdentifier;
        }
        
        const response = await customFetch(`https://api.music.yandex.net/rotor/station/${encodeURIComponent(stationId)}/feedback`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          const errText = await response.text();
          res.end(JSON.stringify({ error: 'Feedback request failed', details: errText }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.6 Yandex Chart (Trending/popular tracks)
    if (path.startsWith('/api/yandex/chart')) {
      try {
        const response = await customFetch('https://api.music.yandex.net/landing3/chart', { headers });
        if (response.ok) {
          const data = await response.json();
          const chartTracks = data.result?.chart?.tracks || [];
          const tracks = chartTracks.map(item => item.track || item).filter(Boolean);
          res.end(JSON.stringify({ result: tracks }));
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify({ error: 'Failed to fetch Yandex chart' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.7 Yandex New Releases/Trends (Novices)
    if (path.startsWith('/api/yandex/trends')) {
      const fallbackReleases = [
        {
          id: "11244093",
          title: "YAMAKASI",
          year: 2020,
          type: "album",
          coverUri: "avatars.yandex.net/get-music-content/2358262/9f12015a.a.11244093-1/%%",
          artists: [{ id: 6092925, name: "Miyagi & Andy Panda" }]
        },
        {
          id: "30902842",
          title: "DOGMA",
          year: 2024,
          type: "album",
          coverUri: "avatars.yandex.net/get-music-content/9832813/bd916a24.a.30902842-1/%%",
          artists: [{ id: 6223594, name: "52" }]
        },
        {
          id: "31502931",
          title: "HOUDINI",
          year: 2024,
          type: "single",
          coverUri: "avatars.yandex.net/get-music-content/12101032/8f9202bf.a.31502931-2/%%",
          artists: [{ id: 37029, name: "Eminem" }]
        },
        {
          id: "30948291",
          title: "HIT ME HARD AND SOFT",
          year: 2024,
          type: "album",
          coverUri: "avatars.yandex.net/get-music-content/11402931/bd8a12ba.a.30948291-1/%%",
          artists: [{ id: 4683029, name: "Billie Eilish" }]
        },
        {
          id: "10294821",
          title: "STARBOY",
          year: 2016,
          type: "album",
          coverUri: "avatars.yandex.net/get-music-content/2358262/8d8102fa.a.10294821-1/%%",
          artists: [{ id: 391028, name: "The Weeknd" }]
        },
        {
          id: "4239857",
          title: "ПРАЗДНИК НА УЛИЦЕ 36",
          year: 2017,
          type: "album",
          coverUri: "avatars.yandex.net/get-music-content/163479/4d86b8ee.a.4239857-1/%%",
          artists: [{ id: 4111327, name: "Скриптонит" }]
        }
      ];

      try {
        const response = await customFetch('https://api.music.yandex.net/landing3/new-releases', { headers });
        if (response.ok) {
          const data = await response.json();
          const releases = data.result?.newReleases || [];
          
          const resolvedReleases = [];
          const albumsToFetch = [];
          for (const item of releases) {
            if (typeof item === 'object' && item !== null) {
              const albumId = item.id || item.album?.id;
              if (albumId) {
                if (item.title) {
                  resolvedReleases.push({
                    id: albumId,
                    title: item.title,
                    year: item.year,
                    type: item.type || item.metaType || 'album',
                    coverUri: item.coverUri,
                    artists: item.artists || []
                  });
                } else {
                  albumsToFetch.push(albumId);
                }
              }
            } else if (typeof item === 'number' || typeof item === 'string') {
              albumsToFetch.push(item);
            }
          }
          
          if (albumsToFetch.length > 0) {
            const targetIds = albumsToFetch.slice(0, 10);
            const fetchPromises = targetIds.map(async (id) => {
              try {
                const albRes = await customFetch(`https://api.music.yandex.net/albums/${id}`, { headers });
                if (albRes.ok) {
                  const albData = await albRes.json();
                  if (albData.result) {
                    resolvedReleases.push({
                      id: albData.result.id,
                      title: albData.result.title,
                      year: albData.result.year,
                      type: albData.result.type || albData.result.metaType || 'album',
                      coverUri: albData.result.coverUri,
                      artists: albData.result.artists || []
                    });
                  }
                }
              } catch (e) {
                console.warn(`Failed to fetch album info for ID ${id}:`, e.message);
              }
            });
            await Promise.all(fetchPromises);
          }
          
          if (resolvedReleases.length > 0) {
            res.end(JSON.stringify({ result: resolvedReleases }));
          } else {
            res.end(JSON.stringify({ result: fallbackReleases }));
          }
        } else {
          res.end(JSON.stringify({ result: fallbackReleases }));
        }
      } catch (e) {
        res.statusCode = 200;
        res.end(JSON.stringify({ result: fallbackReleases }));
      }
      return;
    }

    // 2.5.8 Yandex Artist Brief Info
    if (path.startsWith('/api/yandex/artist-info')) {
      const artistId = urlObj.searchParams.get('artistId') || '';
      if (!artistId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'artistId parameter is required' }));
        return;
      }
      try {
        const response = await customFetch(`https://api.music.yandex.net/artists/${encodeURIComponent(artistId)}/brief-info`, { headers });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify({ error: 'Failed to fetch artist brief info' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.9 Yandex Album Tracks
    if (path.startsWith('/api/yandex/album-tracks')) {
      const albumId = urlObj.searchParams.get('albumId') || '';
      if (!albumId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'albumId parameter is required' }));
        return;
      }
      try {
        const response = await customFetch(`https://api.music.yandex.net/albums/${encodeURIComponent(albumId)}/with-tracks`, { headers });
        if (response.ok) {
          const data = await response.json();
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = response.status;
          res.end(JSON.stringify({ error: 'Failed to fetch album tracks' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.5.10 Yandex Track Supplement (Lyrics)
    if (path.startsWith('/api/yandex/lyrics')) {
      const trackId = urlObj.searchParams.get('trackId') || '';
      const title = urlObj.searchParams.get('title') || '';
      const artist = urlObj.searchParams.get('artist') || '';
      const duration = parseFloat(urlObj.searchParams.get('duration') || '0');

      console.log(`[Lyrics API] Fetching lyrics. trackId: ${trackId}, title: ${title}, artist: ${artist}, duration: ${duration}`);

      const clientAbortController = new AbortController();
      req.on('close', () => {
        console.log(`[Lyrics API] Client connection closed. Aborting pending requests for: ${title}`);
        clientAbortController.abort();
      });

      const fetchWithTimeout = async (url, options = {}, timeoutMs = 2000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        const onAbort = () => controller.abort();
        clientAbortController.signal.addEventListener('abort', onAbort);

        try {
          const response = await customFetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(id);
          clientAbortController.signal.removeEventListener('abort', onAbort);
          return response;
        } catch (error) {
          clearTimeout(id);
          clientAbortController.signal.removeEventListener('abort', onAbort);
          throw error;
        }
      };

      const fetchFromLrclib = async (url, timeoutMs = 2500) => {
        if (clientAbortController.signal.aborted) return null;
        try {
          const fetchRes = await fetchWithTimeout(url, {
            headers: { 'User-Agent': 'MusicPlayer/1.0.0 (https://github.com/user/repo)' }
          }, timeoutMs);
          if (fetchRes.ok) {
            return await fetchRes.text();
          }
        } catch (e) {
          console.warn(`[Lrclib Fetch] Native fetch failed for ${url}:`, e.message);
        }
        if (clientAbortController.signal.aborted) return null;
        try {
          const timeoutSec = Math.max(1, Math.round(timeoutMs / 1000));
          const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
          const stdout = await new Promise((resolve, reject) => {
            const child = exec(`${curlCommand} -s -S -m ${timeoutSec} -H "User-Agent: MusicPlayer/1.0.0" "${url}"`, {
              encoding: 'utf-8'
            }, (error, stdout, stderr) => {
              if (error) {
                reject(error);
              } else {
                resolve(stdout);
              }
            });

            const onAbort = () => {
              try { child.kill(); } catch (e) {}
              reject(new Error('Aborted by client'));
            };
            clientAbortController.signal.addEventListener('abort', onAbort);
            child.on('close', () => {
              clientAbortController.signal.removeEventListener('abort', onAbort);
            });
          });
          return stdout;
        } catch (e) {
          console.warn(`[Lrclib Fetch] curl fallback failed:`, e.message);
          return null;
        }
      };

      const getCleanTitle = (t) => {
        if (!t) return '';
        let clean = t.replace(/\([^)]*\)/g, '');
        clean = clean.replace(/\[[^\]]*\]/g, '');
        clean = clean.replace(/[\!\@\$\%\^\&\*\(\)\_\+\-\=\{\}\[\]\|\\\:\;\"\'\<\>\?\,\.\/\~\`\«\»\“\”\„\‘\’\‹\›\⩊]/g, ' ');
        return clean.replace(/\s+/g, ' ').trim();
      };

      const timestamp = Math.floor(Date.now() / 1000);
      let lyrics = null;

      try {
        if (trackId && trackId !== 'empty') {
          const cleanTrackId = parseInt(trackId.split(':')[0], 10);
          if (!isNaN(cleanTrackId)) {
            const message = `${cleanTrackId}${timestamp}`;
            const signKey = 'p93jhgh689SBReK6ghtw62';
            const sign = crypto.createHmac('sha256', signKey).update(message).digest('base64');

            const yandexPromises = [
              (async () => {
                try {
                  console.log(`[Lyrics API] Querying Yandex TEXT...`);
                  const urlText = `https://api.music.yandex.net/tracks/${trackId}/lyrics?format=TEXT&timeStamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
                  const res = await fetchWithTimeout(urlText, { headers }, 1500);
                  if (res.ok) {
                    const data = await res.json();
                    let text = data.result?.fullLyrics || data.result?.lyricsText;
                    if (!text && data.result?.downloadUrl) {
                      console.log(`[Lyrics API] Downloading Yandex TEXT from S3 downloadUrl...`);
                      const dlRes = await fetchWithTimeout(data.result.downloadUrl, {}, 2000);
                      if (dlRes.ok) {
                        text = await dlRes.text();
                      }
                    }
                    if (text) {
                      return { text, synced: false };
                    }
                  }
                } catch (e) {
                  console.error(`[Lyrics API] Yandex TEXT fetch failed:`, e.message);
                }
                return null;
              })(),
              (async () => {
                try {
                  console.log(`[Lyrics API] Querying Yandex LRC...`);
                  const urlLrc = `https://api.music.yandex.net/tracks/${trackId}/lyrics?format=LRC&timeStamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
                  const res = await fetchWithTimeout(urlLrc, { headers }, 1500);
                  if (res.ok) {
                    const data = await res.json();
                    let text = data.result?.fullLyrics || data.result?.lyricsText;
                    if (!text && data.result?.downloadUrl) {
                      console.log(`[Lyrics API] Downloading Yandex LRC from S3 downloadUrl...`);
                      const dlRes = await fetchWithTimeout(data.result.downloadUrl, {}, 2000);
                      if (dlRes.ok) {
                        text = await dlRes.text();
                      }
                    }
                    if (text) {
                      const isSynced = text.includes('[00:') || text.includes('[01:') || text.includes('[02:');
                      return { text, synced: isSynced };
                    }
                  }
                } catch (e) {
                  console.error(`[Lyrics API] Yandex LRC fetch failed:`, e.message);
                }
                return null;
              })(),
              (async () => {
                try {
                  console.log(`[Lyrics API] Querying Yandex Supplement...`);
                  const urlSupp = `https://api.music.yandex.net/tracks/${trackId}/supplement`;
                  const res = await fetchWithTimeout(urlSupp, { headers }, 1500);
                  if (res.ok) {
                    const data = await res.json();
                    const text = data.result?.lyrics?.fullLyrics || data.result?.lyrics?.lyricsText;
                    if (text) {
                      const isSynced = text.includes('[00:') || text.includes('[01:') || text.includes('[02:');
                      return { text, synced: isSynced };
                    }
                  }
                } catch (e) {
                  console.error(`[Lyrics API] Yandex Supplement fetch failed:`, e.message);
                }
                return null;
              })()
            ];

            const yandexResults = (await Promise.all(yandexPromises)).filter(Boolean);
            const bestYandex = yandexResults.find(r => r.synced) || yandexResults[0];
            if (bestYandex && bestYandex.text) {
              lyrics = bestYandex.text;
              console.log(`[Lyrics API] Resolved from Yandex Music! Synced: ${bestYandex.synced}`);
            }
          }
        }

        if (!lyrics && title && artist) {
          const cleanArtist = artist.split(',')[0].trim().replace(/[\!\@\$\%\^\&\*\(\)\_\+\-\=\{\}\[\]\|\\\:\;\"\'\<\>\?\,\.\/\~\`\«\»\“\”\„\‘\’\‹\›\⩊]/g, ' ').replace(/\s+/g, ' ').trim();
          const cleanTitle = getCleanTitle(title);
          console.log(`[Lyrics API] Yandex returned nothing. Falling back to LRCLIB and Lyrics.ovh for: "${cleanArtist} - ${cleanTitle}"`);

          const fallbackPromises = [];
          if (duration > 0) {
            fallbackPromises.push((async () => {
              try {
                console.log(`[Lyrics API] Querying LRCLIB GET (with duration)...`);
                const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}&duration=${Math.round(duration)}`;
                const raw = await fetchFromLrclib(url, 8000);
                if (raw) {
                  const data = JSON.parse(raw);
                  const text = data.syncedLyrics || data.plainLyrics;
                  if (text) {
                    return { synced: !!data.syncedLyrics, text, source: 'LRCLIB GET (with duration)' };
                  }
                }
              } catch (e) {}
              return null;
            })());
          }

          fallbackPromises.push((async () => {
            try {
              console.log(`[Lyrics API] Querying LRCLIB GET (no duration)...`);
              const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
              const raw = await fetchFromLrclib(url, 8000);
              if (raw) {
                const data = JSON.parse(raw);
                const text = data.syncedLyrics || data.plainLyrics;
                if (text) {
                  return { synced: !!data.syncedLyrics, text, source: 'LRCLIB GET (no duration)' };
                }
              }
            } catch (e) {}
            return null;
          })());

          fallbackPromises.push((async () => {
            try {
              console.log(`[Lyrics API] Querying LRCLIB SEARCH...`);
              const titleWords = cleanTitle.split(/\s+/).filter(Boolean);
              let usefulTitleWords = titleWords.filter(w => w.length > 1);
              if (usefulTitleWords.length === 0) {
                usefulTitleWords = titleWords;
              }
              const cleanQuery = `${cleanArtist} ${usefulTitleWords.join(' ')}`.trim();
              const url = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`;
              const raw = await fetchFromLrclib(url, 8000);
              if (raw) {
                const results = JSON.parse(raw);
                if (Array.isArray(results) && results.length > 0) {
                  const bestMatch = results.find(item => item.syncedLyrics || item.plainLyrics);
                  if (bestMatch) {
                    return { synced: !!bestMatch.syncedLyrics, text: bestMatch.syncedLyrics || bestMatch.plainLyrics, source: 'LRCLIB SEARCH' };
                  }
                }
              }
            } catch (e) {}
            return null;
          })());

          fallbackPromises.push((async () => {
            try {
              console.log(`[Lyrics API] Querying Lyrics.ovh...`);
              const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
              const res = await fetchWithTimeout(url, {}, 8000);
              if (res.ok) {
                const data = await res.json();
                if (data && data.lyrics) {
                  return { synced: false, text: data.lyrics, source: 'Lyrics.ovh' };
                }
              }
            } catch (e) {}
            return null;
          })());

          const finalResult = await new Promise((resolve) => {
            let resolved = false;
            let fallbackResult = null;
            let pendingCount = fallbackPromises.length;

            if (pendingCount === 0) {
              resolve(null);
              return;
            }

            let currentTimeoutId = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(fallbackResult);
              }
            }, 9000);

            const checkResolve = () => {
              if (pendingCount === 0 && !resolved) {
                resolved = true;
                clearTimeout(currentTimeoutId);
                resolve(fallbackResult);
              }
            };

            fallbackPromises.forEach(async (p) => {
              try {
                const result = await p;
                if (result && result.text) {
                  if (result.synced) {
                    if (!resolved) {
                      resolved = true;
                      clearTimeout(currentTimeoutId);
                      resolve(result);
                    }
                  } else {
                    if (!fallbackResult) {
                      fallbackResult = result;
                    }
                    if (currentTimeoutId) clearTimeout(currentTimeoutId);
                    currentTimeoutId = setTimeout(() => {
                      if (!resolved) {
                        resolved = true;
                        resolve(fallbackResult);
                      }
                    }, 2500);
                  }
                }
              } catch (err) {
              } finally {
                pendingCount--;
                checkResolve();
              }
            });
          });

          if (finalResult && finalResult.text) {
            lyrics = finalResult.text;
            console.log(`[Lyrics API] Resolved from fallback database: ${finalResult.source}`);
          }
        }

        console.log(`[Lyrics API] Final lyrics resolved: ${!!lyrics}`);
        res.end(JSON.stringify({ lyrics }));
      } catch (e) {
        console.error(`[Lyrics API] Exception:`, e.message);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 2.6 Yandex Stream Link Signing
    if (path.startsWith('/api/yandex/stream')) {
      const trackId = urlObj.searchParams.get('trackId') || '';
      if (!trackId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'trackId is required' }));
        return;
      }
      try {
        const infoRes = await customFetch(`https://api.music.yandex.net/tracks/${trackId}/download-info`, { headers });
        if (!infoRes.ok) {
          res.statusCode = infoRes.status;
          res.end(JSON.stringify({ error: 'Failed to fetch download info' }));
          return;
        }
        const infoData = await infoRes.json();
        const downloadInfos = infoData.result || [];
        
        let selectedInfo = downloadInfos
          .filter(info => info.codec === 'mp3' && !info.preview)
          .sort((a, b) => (b.bitrateInKbps || 0) - (a.bitrateInKbps || 0))[0];
          
        if (!selectedInfo) {
          selectedInfo = downloadInfos
            .filter(info => info.codec === 'mp3')
            .sort((a, b) => (b.bitrateInKbps || 0) - (a.bitrateInKbps || 0))[0];
        }
        if (!selectedInfo && downloadInfos.length > 0) {
          selectedInfo = downloadInfos.sort((a, b) => (b.bitrateInKbps || 0) - (a.bitrateInKbps || 0))[0];
        }

        if (!selectedInfo) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'No suitable MP3 stream info found' }));
          return;
        }

        const downloadUrl = selectedInfo.downloadInfoUrl;
        
        const xmlRes = await customFetch(downloadUrl, { headers });
        if (!xmlRes.ok) {
          res.statusCode = xmlRes.status;
          res.end(JSON.stringify({ error: 'Failed to fetch download XML' }));
          return;
        }
        const xmlText = await xmlRes.text();
        
        const hostMatch = xmlText.match(/<host>([^<]+)<\/host>/);
        const pathMatch = xmlText.match(/<path>([^<]+)<\/path>/);
        const tsMatch = xmlText.match(/<ts>([^<]+)<\/ts>/);
        const sMatch = xmlText.match(/<s>([^<]+)<\/s>/);

        if (!hostMatch || !pathMatch || !tsMatch || !sMatch) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to parse stream XML parameters' }));
          return;
        }

        const host = hostMatch[1];
        const path = pathMatch[1];
        const ts = tsMatch[1];
        const s = sMatch[1];

        const salt = 'XGRK7nZ1hsBig7aJZg';
        const signature = crypto.createHash('md5').update(salt + path.substring(1) + s).digest('hex');
        const streamUrl = `https://${host}/get-mp3/${signature}/${ts}${path}`;

        res.end(JSON.stringify({ url: streamUrl }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // Route not found
  res.statusCode = 404;
  res.end(JSON.stringify({ error: `Not found: ${path}` }));
}
