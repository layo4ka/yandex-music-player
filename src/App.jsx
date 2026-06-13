import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, SpeakerHigh, SpeakerX, 
  Heart, Plus, PlusCircle, Trash, MagnifyingGlass, Link as LinkIcon, MusicNote, List, 
  User, Gear, Key, Playlist, BookOpen, House, Monitor, DotsThreeVertical, TextT, Equalizer,
  Shuffle, Repeat, PlayCircle, PauseCircle, Microphone, ArrowsOutSimple, HeartBreak,
  Radio, ShareNetwork, Disc, ArrowLineDown, ArrowLineUp, ArrowsCounterClockwise, SlidersHorizontal
} from '@phosphor-icons/react';

// Placeholder track when nothing is playing
const DEFAULT_TRACK = {
  id: 'empty',
  title: 'Нет трека',
  artist: 'Выберите трек для воспроизведения',
  cover: '',
  url: '',
  type: 'yandex',
  duration: 0
};

const RADIO_STATIONS = [
  { id: 'genre:pop', name: 'Поп', desc: 'Популярная музыка', color: '#f59e0b' },
  { id: 'genre:rock', name: 'Рок', desc: 'Гитарный драйв', color: '#ef4444' },
  { id: 'epoch:eighties', name: '80-е', desc: 'Ретро хиты 80-х', color: '#3b82f6' },
  { id: 'epoch:nineties', name: '90-е', desc: 'Золотая эпоха 90-х', color: '#10b981' },
  { id: 'genre:electronics', name: 'Электроника', desc: 'Клубный бит', color: '#8b5cf6' },
  { id: 'genre:metal', name: 'Метал', desc: 'Тяжелый рок', color: '#374151' },
  { id: 'genre:jazz', name: 'Джаз', desc: 'Свинг и импровизация', color: '#ec4899' },
  { id: 'genre:classical', name: 'Классика', desc: 'Вечные шедевры', color: '#6b7280' },
  { id: 'genre:rap', name: 'Рэп и Хип-Хоп', desc: 'Современный бит', color: '#10b981' },
  { id: 'genre:soundtrack', name: 'Саундтреки', desc: 'Музыка из фильмов', color: '#f59e0b' },
];

const parseLrc = (lrcText) => {
  if (!lrcText) return null;
  const lines = lrcText.split('\n');
  const parsed = [];
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/;
  const metadataRegex = /^\[(ti|ar|al|by|length|re|ve|offset):/i;
  
  let hasTimecodes = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (metadataRegex.test(trimmed)) continue;
    
    const match = timeRegex.exec(trimmed);
    if (match) {
      hasTimecodes = true;
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const ms = parseFloat(`0.${msStr}`) * 1000;
      const timeInSeconds = min * 60 + sec + ms / 1000;
      const text = trimmed.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();
      parsed.push({ time: timeInSeconds, text });
    }
  }
  
  if (!hasTimecodes) return null; // Not an LRC file
  return parsed.sort((a, b) => a.time - b.time);
};

const PRESET_WALLPAPERS = [
  { id: 'deep-space', name: 'Космос', url: '#000000' },
  { id: 'dark-waves', name: 'Магия волн', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=90' },
  { id: 'glass-shapes', name: 'Абстракция', url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1920&q=90' },
  { id: 'purple-nebula', name: 'Цветочный арт', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1920&q=90' },
  { id: 'cosmic-pink', name: 'Розовый неон', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=90' },
];

export default function App() {
  // Navigation tabs: 'home' | 'search' | 'collection' | 'settings' | 'queue'
  const [activeTab, setActiveTab] = useState('home');
  const [collectionSubTab, setCollectionSubTab] = useState('likes'); // 'likes' | 'playlists'
  const [showQueueSidebar, setShowQueueSidebar] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('yandex_music_theme') || 'light');
  const [homeSubTab, setHomeSubTab] = useState('overview'); // 'overview' | 'novices' | 'chart' | 'genres'
  const [artistBackTab, setArtistBackTab] = useState('home');
  const [albumBackTab, setAlbumBackTab] = useState('home');
  const [showWaveSettings, setShowWaveSettings] = useState(false);
  const [waveStation, setWaveStation] = useState('user:onyourwave');
  const [waveDiversity, setWaveDiversity] = useState('default');
  const [waveLanguage, setWaveLanguage] = useState('any');
  const [waveMood, setWaveMood] = useState('all');
  const [yandexChartTracks, setYandexChartTracks] = useState([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [yandexTrendsTracks, setYandexTrendsTracks] = useState([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  const [activeRadioStation, setActiveRadioStation] = useState(null);
  const [waveSourceTrack, setWaveSourceTrack] = useState(null);
  const [playedRadioTrackIds, setPlayedRadioTrackIds] = useState([]);

  const [artistInfo, setArtistInfo] = useState(null);
  const [isLoadingArtist, setIsLoadingArtist] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [albumTracks, setAlbumTracks] = useState([]);
  const [isLoadingAlbumTracks, setIsLoadingAlbumTracks] = useState(false);
  
  // App Music state
  const [activeTrack, setActiveTrack] = useState(DEFAULT_TRACK);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [playerColor, setPlayerColor] = useState('rgba(45, 36, 30, 0.82)');
  const [playerGlowColor, setPlayerGlowColor] = useState('rgba(168, 85, 247, 0.4)');
  const [isFullscreenPlayer, setIsFullscreenPlayer] = useState(false);
  const [fullscreenBgColor, setFullscreenBgColor] = useState('rgb(45, 36, 30)');
  const [showFullscreenQueue, setShowFullscreenQueue] = useState(false);
  const [showFullscreenLyrics, setShowFullscreenLyrics] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
  };
  
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage('');
    }, 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const playNextInQueue = (track) => {
    if (!track) return;
    const currentIndex = queue.findIndex(t => t.id === activeTrack.id);
    const cleanQueue = queue.filter(t => t.id !== track.id || t.id === activeTrack.id);
    const newIndex = currentIndex !== -1 ? currentIndex + 1 : 0;
    
    const newQueue = [...cleanQueue];
    newQueue.splice(newIndex, 0, track);
    setQueue(newQueue);
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setMenuOpenTrackId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const getQueueSourceName = () => {
    if (activeRadioStation) {
      if (activeRadioStation === 'user:onyourwave') return 'Моя волна';
      if (activeRadioStation.startsWith('track:')) return 'Моя волна по треку';
      const station = RADIO_STATIONS.find(s => s.id === activeRadioStation);
      return station ? `Радио ${station.name}` : 'Радиостанция';
    }
    if (activeYandexPlaylist) return activeYandexPlaylist.title;
    return 'Очередь воспроизведения';
  };

  // Extract average color from track cover
  useEffect(() => {
    if (!activeTrack || !activeTrack.cover) {
      setPlayerColor('rgba(45, 36, 30, 0.82)');
      setPlayerGlowColor('rgba(168, 85, 247, 0.4)');
      setFullscreenBgColor('rgb(14, 16, 22)');
      return;
    }
    
    // Create an image to load the cover
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = activeTrack.cover.replace('%%', '100x100');
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        // Darken for background (0.8 opacity)
        setPlayerColor(`rgba(${Math.max(0, r - 65)}, ${Math.max(0, g - 65)}, ${Math.max(0, b - 65)}, 0.8)`);
        // Brighter version for the left-side animated glow
        setPlayerGlowColor(`rgba(${r}, ${g}, ${b}, 0.45)`);
        // Warm solid color for fullscreen player background (scaled down to be dark and eye-friendly)
        setFullscreenBgColor(`rgb(${Math.max(12, Math.round(r * 0.28))}, ${Math.max(12, Math.round(g * 0.28))}, ${Math.max(12, Math.round(b * 0.28))})`);
      } catch (e) {
        setPlayerColor('rgba(45, 36, 30, 0.82)');
        setPlayerGlowColor('rgba(168, 85, 247, 0.4)');
        setFullscreenBgColor('rgb(14, 16, 22)');
      }
    };
    img.onerror = () => {
      setPlayerColor('rgba(45, 36, 30, 0.82)');
      setPlayerGlowColor('rgba(168, 85, 247, 0.4)');
      setFullscreenBgColor('rgb(14, 16, 22)');
    };
  }, [activeTrack.cover]);
  // Search query & results
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  // Yandex Music state
  const [yandexToken, setYandexToken] = useState(localStorage.getItem('yandex_token') || '');
  const [yandexUser, setYandexUser] = useState(null);
  const [yandexPlaylists, setYandexPlaylists] = useState([]);
  const [yandexLikes, setYandexLikes] = useState([]);
  const [yandexLikedIds, setYandexLikedIds] = useState([]);
  const [activeYandexPlaylist, setActiveYandexPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  // Device Flow Authentication state
  const [authState, setAuthState] = useState('idle'); // 'idle' | 'requesting' | 'pending' | 'success' | 'error'
  const [deviceCodeInfo, setDeviceCodeInfo] = useState(null);
  const pollingIntervalRef = useRef(null);

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('yandex_music_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isRepeating, setIsRepeating] = useState(false);
  const [menuOpenTrackId, setMenuOpenTrackId] = useState(null);
  const [isProgressHovered, setIsProgressHovered] = useState(false);
  const [isPlayerProgressHovered, setIsPlayerProgressHovered] = useState(false);
  const [currentArtistName, setCurrentArtistName] = useState('');
  const [albumLoadError, setAlbumLoadError] = useState(false);
  const [lyricsText, setLyricsText] = useState(null);
  const [parsedLyrics, setParsedLyrics] = useState(null);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  // Apply volume changes with quadratic scaling for better low-volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume * volume;
    }
    try {
      localStorage.setItem('yandex_music_volume', volume.toString());
    } catch (e) {}
  }, [volume, isMuted]);

  // References
  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytPlayerContainerId = 'yt-player-element';
  const progressIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const visualizerAnimationRef = useRef(null);
  const isLoadingRadioRef = useRef(false);
  const playedRadioTrackIdsRef = useRef([]);
  const loadedLyricsTrackIdRef = useRef(null);
  const loadingTrackIdRef = useRef(null);
  const playAbortControllerRef = useRef(null);
  const lyricsAbortControllerRef = useRef(null);

  const playerProgressRef = useRef(null);
  const fullscreenProgressRef = useRef(null);
  const splitProgressRef = useRef(null);
  const playerTimeLabelRef = useRef(null);
  const fullscreenTimeLabelRef = useRef(null);
  const playerSeekbarSliderRef = useRef(null);
  const fullscreenSeekbarSliderRef = useRef(null);
  const splitSeekbarSliderRef = useRef(null);
  const playerLeftGlowRef = useRef(null);
  const lastActiveLineIndexRef = useRef(-1);
  const currentTimeRef = useRef(0);
  const progressRafRef = useRef(null);
  const isSeekingRef = useRef(false);
  const activeTrackRef = useRef(activeTrack);
  const durationRef = useRef(duration);
  const parsedLyricsRef = useRef(parsedLyrics);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { activeTrackRef.current = activeTrack; }, [activeTrack]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { parsedLyricsRef.current = parsedLyrics; }, [parsedLyrics]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const [lyricsActiveIndex, setLyricsActiveIndex] = useState(-1);
  const activeLineRef = useRef(null);
  const activeLineIndex = lyricsActiveIndex;

  useEffect(() => {
    if (activeLineRef.current) {
      const activeLine = activeLineRef.current;
      const container = activeLine.closest('.lyrics-modal-body') || activeLine.closest('.split-right-pane');
      if (container) {
        const targetTop = activeLine.offsetTop - (container.clientHeight / 2) + (activeLine.clientHeight / 2);
        container.scrollTo({
          top: targetTop,
          behavior: 'smooth'
        });
      }
    }
  }, [lyricsActiveIndex]);

  const [customWallpaper, setCustomWallpaper] = useState(localStorage.getItem('yandex_music_custom_wallpaper') || '');
  const [presetWallpaper, setPresetWallpaper] = useState(localStorage.getItem('yandex_music_preset_wallpaper') || '');

  // Apply custom wallpaper if set
  useEffect(() => {
    // Wallpaper is applied to .ambient-bg in JSX for performance, clean up body background
    document.body.style.background = '';
    document.body.style.backgroundSize = '';
  }, [customWallpaper, presetWallpaper]);

  // Update body theme class
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  const handleWallpaperChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        try {
          localStorage.setItem('yandex_music_custom_wallpaper', compressedBase64);
          setCustomWallpaper(compressedBase64);
          localStorage.removeItem('yandex_music_preset_wallpaper');
          setPresetWallpaper('');
        } catch (err) {
          alert('Файл обоев слишком большой. Пожалуйста, выберите другое изображение.');
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handlePresetSelect = (url) => {
    localStorage.setItem('yandex_music_preset_wallpaper', url);
    setPresetWallpaper(url);
    localStorage.removeItem('yandex_music_custom_wallpaper');
    setCustomWallpaper('');
  };

  const handleResetWallpaper = () => {
    localStorage.removeItem('yandex_music_custom_wallpaper');
    localStorage.removeItem('yandex_music_preset_wallpaper');
    setCustomWallpaper('');
    setPresetWallpaper('');
  };

  // 1. Initial Load: favorites, load Yandex profile if token exists
  useEffect(() => {
    // Load favorites from local storage
    const savedFavs = localStorage.getItem('liquid_player_favs');
    if (savedFavs) {
      try {
        setLikedTracks(JSON.parse(savedFavs));
      } catch (e) {
        console.error(e);
      }
    }

    // Load played track history from local storage
    const savedHistory = localStorage.getItem('yandex_played_tracks_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        playedRadioTrackIdsRef.current = parsed;
        setPlayedRadioTrackIds(parsed);
      } catch (e) {
        console.error(e);
      }
    }

    // Load YouTube script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        initYoutubePlayer();
      };
    } else {
      initYoutubePlayer();
    }

    if (yandexToken) {
      loadYandexAccount(yandexToken);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (visualizerAnimationRef.current) cancelAnimationFrame(visualizerAnimationRef.current);
      stopPolling();
    };
  }, []);

  // 2. Automated Yandex Device Flow Authentication
  const startDeviceAuth = async () => {
    setAuthState('requesting');
    try {
      const res = await fetch('/api/yandex/auth/device-code');
      if (res.ok) {
        const data = await res.json();
        setDeviceCodeInfo(data);
        setAuthState('pending');
        startPolling(data.device_code, data.interval || 5);
      } else {
        setAuthState('error');
      }
    } catch (e) {
      console.error(e);
      setAuthState('error');
    }
  };

  const startPolling = (deviceCode, interval) => {
    stopPolling();
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/yandex/auth/token?device_code=${encodeURIComponent(deviceCode)}`);
        const data = await res.json();
        
        if (res.ok && data.access_token) {
          stopPolling();
          setAuthState('success');
          loadYandexAccount(data.access_token);
        } else if (data.error && data.error !== 'authorization_pending') {
          // If expired or other error
          stopPolling();
          setAuthState('error');
        }
      } catch (e) {
        console.error(e);
      }
    }, interval * 1000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const cancelDeviceAuth = () => {
    stopPolling();
    setAuthState('idle');
    setDeviceCodeInfo(null);
  };

  // 3. Fetch Yandex user profile, playlists, and liked tracks
  const loadYandexAccount = async (token) => {
    try {
      const res = await fetch('/api/yandex/account', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const uid = data.result?.account?.uid;
        const login = data.result?.account?.login || 'Пользователь';
        const hasPlus = data.result?.plus?.hasPlus || false;

        setYandexUser({ uid, login, hasPlus });
        localStorage.setItem('yandex_token', token);
        setYandexToken(token);
        setActiveTab('home');

        // Fetch playlists & liked tracks metadata
        fetchYandexPlaylists(token, uid);
        fetchYandexLikes(token, uid);
        fetchWaveSettings(token, uid);
      } else {
        localStorage.removeItem('yandex_token');
        setYandexToken('');
        setYandexUser(null);
        setAuthState('idle');
      }
    } catch (e) {
      console.error('Error loading Yandex Account info:', e);
    }
  };

  const fetchYandexPlaylists = async (token, uid) => {
    try {
      const res = await fetch(`/api/yandex/playlists?uid=${uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setYandexPlaylists(data.result || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchYandexLikes = async (token, uid) => {
    try {
      const res = await fetch(`/api/yandex/likes?uid=${uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const allIds = data.allIds || (data.result || []).map(t => String(t.id));
        setYandexLikedIds(allIds.map(String));
        const mapped = (data.result || []).map(mapYandexTrack);
        setYandexLikes(mapped);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWaveSettings = async (token, uid) => {
    if (!token || !uid) return;
    try {
      const res = await fetch(`/api/yandex/my-wave/info?station=user:onyourwave&t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const settings = data.result?.[0]?.settings;
        if (settings) {
          if (settings.diversity) setWaveDiversity(settings.diversity);
          if (settings.language) setWaveLanguage(settings.language);
          if (settings.mood_energy) setWaveMood(settings.mood_energy);
        }
      }
    } catch (e) {
      console.error('Failed to fetch wave settings:', e);
    }
  };

  const updateWaveSettings = async (diversityVal, languageVal, moodVal) => {
    if (!yandexToken || !yandexUser) return;
    
    // Optimistically update local state
    setWaveDiversity(diversityVal);
    setWaveLanguage(languageVal);
    setWaveMood(moodVal);

    try {
      const res = await fetch(`/api/yandex/my-wave/settings?station=user:onyourwave&diversity=${diversityVal}&language=${languageVal}&mood_energy=${moodVal}&t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${yandexToken}` }
      });
      if (res.ok) {
        showToast('Настройки Моей волны обновлены!');
        // If My Wave is currently playing, reload tracks
        if (activeRadioStation === 'user:onyourwave') {
          await fetchMoreRadioTracks(true);
        }
      } else {
        showToast('Не удалось обновить настройки Моей волны');
      }
    } catch (e) {
      console.error('Failed to update wave settings:', e);
      showToast('Ошибка при обновлении настроек');
    }
  };

  const fetchYandexChart = async () => {
    setIsLoadingChart(true);
    try {
      const headers = {};
      if (yandexToken) {
        headers['Authorization'] = `Bearer ${yandexToken}`;
      }
      const res = await fetch('/api/yandex/chart', { headers });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.result || []).map(mapYandexTrack);
        setYandexChartTracks(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const fetchYandexTrends = async () => {
    setIsLoadingTrends(true);
    try {
      const headers = {};
      if (yandexToken) {
        headers['Authorization'] = `Bearer ${yandexToken}`;
      }
      const res = await fetch('/api/yandex/trends', { headers });
      if (res.ok) {
        const data = await res.json();
        setYandexTrendsTracks(data.result || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTrends(false);
    }
  };

  useEffect(() => {
    if (homeSubTab === 'chart' && yandexChartTracks.length === 0) {
      fetchYandexChart();
    }
  }, [homeSubTab, yandexToken]);

  useEffect(() => {
    if (homeSubTab === 'novices' && yandexTrendsTracks.length === 0) {
      fetchYandexTrends();
    }
  }, [homeSubTab, yandexToken]);

  const fetchMoreRadioTracks = async (force = false) => {
    if (!yandexToken || !yandexUser || !activeRadioStation) return;
    if (isLoadingRadioRef.current) return;
    isLoadingRadioRef.current = true;
    
    let attempts = 0;
    let accumulatedTracks = [];
    let success = false;
    
    const recentPlayedIds = playedRadioTrackIdsRef.current.slice(-20);
    const immediatePlayedIds = playedRadioTrackIdsRef.current.slice(-5);
    
    while (attempts < 3 && accumulatedTracks.length < 5) {
      attempts++;
      try {
        const res = await fetch(`/api/yandex/my-wave?uid=${yandexUser.uid}&station=${encodeURIComponent(activeRadioStation)}&t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${yandexToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.result || []).map(mapYandexTrack);
          if (mapped.length > 0) {
            success = true;
            
            const uniqueIncoming = [];
            const seenIds = new Set();
            for (const track of mapped) {
              if (track.yandexId && !seenIds.has(track.yandexId)) {
                seenIds.add(track.yandexId);
                uniqueIncoming.push(track);
              }
            }
            
            // 1. Try completely unplayed tracks (not in last 300 history)
            const filteredAll = uniqueIncoming.filter(t => 
              !playedRadioTrackIdsRef.current.includes(t.yandexId)
            );
            
            for (const t of filteredAll) {
              if (!accumulatedTracks.some(a => a.yandexId === t.yandexId)) {
                accumulatedTracks.push(t);
              }
            }
            
            // 2. If less than 5, allow tracks not played in the last 20 plays
            if (accumulatedTracks.length < 5) {
              const filteredRecent = uniqueIncoming.filter(t => 
                !recentPlayedIds.includes(t.yandexId)
              );
              for (const t of filteredRecent) {
                if (!accumulatedTracks.some(a => a.yandexId === t.yandexId)) {
                  accumulatedTracks.push(t);
                }
              }
            }

            // 3. If still less than 5, allow tracks not played in the last 5 plays (strict exclusion of active track)
            if (accumulatedTracks.length < 5) {
              const activeYandexId = activeTrackRef.current?.yandexId;
              const filteredImmediate = uniqueIncoming.filter(t => 
                !immediatePlayedIds.includes(t.yandexId) && t.yandexId !== activeYandexId
              );
              for (const t of filteredImmediate) {
                if (!accumulatedTracks.some(a => a.yandexId === t.yandexId)) {
                  accumulatedTracks.push(t);
                }
              }
            }

            // 4. Absolute fallback: allow anything except active track and the immediate last played track to avoid silence
            if (accumulatedTracks.length < 5) {
              const activeYandexId = activeTrackRef.current?.yandexId;
              const lastPlayedId = playedRadioTrackIdsRef.current[playedRadioTrackIdsRef.current.length - 1];
              for (const t of uniqueIncoming) {
                if (t.yandexId !== activeYandexId && t.yandexId !== lastPlayedId) {
                  if (!accumulatedTracks.some(a => a.yandexId === t.yandexId)) {
                    accumulatedTracks.push(t);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed fetch attempt:', e);
      }
    }
    
    isLoadingRadioRef.current = false;
    
    if (accumulatedTracks.length > 0) {
      setQueue(prevQueue => {
        let baseQueue = prevQueue;
        if (force) {
          const currentIndex = prevQueue.findIndex(t => t.id === activeTrackRef.current.id);
          if (currentIndex !== -1) {
            baseQueue = prevQueue.slice(0, currentIndex + 1);
          } else {
            baseQueue = [];
          }
        }
        
        const currentIndex = baseQueue.findIndex(t => t.id === activeTrackRef.current.id);
        const upcomingQueue = currentIndex !== -1 ? baseQueue.slice(currentIndex + 1) : baseQueue;
        const finalTracks = accumulatedTracks.filter(t => !baseQueue.some(q => q.yandexId === t.yandexId));
        
        if (finalTracks.length > 0) {
          return [...baseQueue, ...finalTracks];
        } else if (upcomingQueue.length === 0) {
          // Exclude the currently playing track to avoid back-to-back replication when adding repeated recommendations
          const nonActiveAccumulated = accumulatedTracks.filter(t => t.yandexId !== activeTrackRef.current?.yandexId);
          if (nonActiveAccumulated.length > 0) {
            return [...baseQueue, ...nonActiveAccumulated];
          }
          return [...baseQueue, ...accumulatedTracks];
        } else {
          return baseQueue;
        }
      });
    } else if (success && force) {
      console.warn('Fallback to standard track recommendation after 3 attempts');
      try {
        const res = await fetch(`/api/yandex/my-wave?uid=${yandexUser.uid}&station=${encodeURIComponent(activeRadioStation)}&t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${yandexToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.result || []).map(mapYandexTrack);
          if (mapped.length > 0) {
            setQueue(prevQueue => {
              let baseQueue = prevQueue;
              if (force) {
                const currentIndex = prevQueue.findIndex(t => t.id === activeTrackRef.current.id);
                if (currentIndex !== -1) {
                  baseQueue = prevQueue.slice(0, currentIndex + 1);
                } else {
                  baseQueue = [];
                }
              }
              const finalTracks = mapped.filter(t => !baseQueue.some(q => q.yandexId === t.yandexId));
              if (finalTracks.length > 0) {
                return [...baseQueue, ...finalTracks];
              } else {
                const nonActiveMapped = mapped.filter(t => t.yandexId !== activeTrackRef.current?.yandexId);
                return [...baseQueue, ...(nonActiveMapped.length > 0 ? nonActiveMapped : mapped)];
              }
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const resetMyWave = async () => {
    if (!activeRadioStation) {
      alert("Сначала включите Мою волну!");
      return;
    }
    await fetchMoreRadioTracks(true);
  };

  useEffect(() => {
    if (activeRadioStation && queue.length > 0 && activeTrack.id !== 'empty') {
      const currentIndex = queue.findIndex(t => t.id === activeTrack.id);
      if (currentIndex !== -1 && currentIndex >= queue.length - 3) {
        fetchMoreRadioTracks();
      }
    }
  }, [activeTrack, activeRadioStation, queue.length]);

  const loadYandexPlaylistTracks = async (playlist) => {
    setActiveRadioStation(null); // Clear active radio station on manual playlist load
    setActiveYandexPlaylist(playlist);
    setPlaylistTracks([]);
    setIsLoadingTracks(true);
    try {
      const res = await fetch(`/api/yandex/playlist-tracks?uid=${playlist.uid}&kind=${playlist.kind}`, {
        headers: { 'Authorization': `Bearer ${yandexToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.result || []).map(mapYandexTrack);
        setPlaylistTracks(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  // Play Yandex "Моя волна" (personal recommended radio)
  const playMyWave = async (stationId = 'user:onyourwave', sourceTrack = null) => {
    if (!yandexToken || !yandexUser) {
      setActiveTab('settings');
      return;
    }
    setIsSearching(true);
    
    let attempts = 0;
    let accumulatedTracks = [];
    let success = false;
    let lastFetchedMapped = [];
    
    const isTrackWave = stationId.startsWith('track:');
    const targetTrackId = isTrackWave ? stationId.split(':')[1] : null;

    while (attempts < 3 && accumulatedTracks.length < 5) {
      attempts++;
      try {
        const res = await fetch(`/api/yandex/my-wave?uid=${yandexUser.uid}&station=${encodeURIComponent(stationId)}&t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${yandexToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.result || []).map(mapYandexTrack);
          if (mapped.length > 0) {
            success = true;
            lastFetchedMapped = mapped;
            
            // Remove duplicates within the incoming sequence itself
            const uniqueIncoming = [];
            const seenIds = new Set();
            for (const track of mapped) {
              if (track.yandexId && !seenIds.has(track.yandexId)) {
                seenIds.add(track.yandexId);
                uniqueIncoming.push(track);
              }
            }

            const filtered = uniqueIncoming.filter(t => {
              // Keep the seed track for a track wave, but filter out the currently playing track in all other cases
              const isSeedTrack = targetTrackId && String(t.yandexId) === String(targetTrackId);
              const isCurrentTrack = activeTrack && activeTrack.yandexId && String(t.yandexId) === String(activeTrack.yandexId);
              
              if (isCurrentTrack && !isSeedTrack) {
                return false;
              }

              return !playedRadioTrackIdsRef.current.includes(t.yandexId) || isSeedTrack;
            });

            for (const t of filtered) {
              if (!accumulatedTracks.some(a => a.yandexId === t.yandexId)) {
                accumulatedTracks.push(t);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed fetch attempt in playMyWave:', e);
      }
    }

    try {
      if (success) {
        setActiveRadioStation(stationId);
        if (stationId.startsWith('track:')) {
          if (sourceTrack) {
            setWaveSourceTrack(sourceTrack);
          }
        } else {
          setWaveSourceTrack(null);
        }

        let newTracks = accumulatedTracks;
        if (newTracks.length === 0) {
          newTracks = lastFetchedMapped;
        }

        if (isTrackWave && targetTrackId) {
          // Ensure the seed track is at index 0 of newTracks
          const seedIndex = newTracks.findIndex(t => String(t.yandexId) === String(targetTrackId));
          if (seedIndex !== -1) {
            if (seedIndex > 0) {
              const [seed] = newTracks.splice(seedIndex, 1);
              newTracks.unshift(seed);
            }
          } else if (sourceTrack) {
            newTracks.unshift(sourceTrack);
          }
        }

        const isCurrentlyPlayingSeed = isTrackWave && targetTrackId && activeTrack && String(activeTrack.yandexId) === String(targetTrackId);
        
        if (isTrackWave && targetTrackId && newTracks[0] && String(newTracks[0].yandexId) === String(targetTrackId)) {
          if (isCurrentlyPlayingSeed) {
            newTracks[0] = activeTrack;
          }
        }

        setQueue(newTracks);

        if (isCurrentlyPlayingSeed) {
          if (!isPlaying) {
            setIsPlaying(true);
            if (activeTrack.type === 'youtube') {
              if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
                ytPlayerRef.current.playVideo();
              }
            } else if (audioRef.current) {
              audioRef.current.play().catch(e => console.warn(e));
            }
          }
        } else if (newTracks.length > 0) {
          playTrack(newTracks[0], true);
        } else {
          alert('Не удалось загрузить рекомендации для Моей волны');
        }
      } else {
        alert('Не удалось загрузить рекомендации для Моей волны');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleYandexLogout = () => {
    localStorage.removeItem('yandex_token');
    setYandexToken('');
    setYandexUser(null);
    setYandexPlaylists([]);
    setYandexLikes([]);
    setYandexLikedIds([]);
    setActiveYandexPlaylist(null);
    setPlaylistTracks([]);
    setAuthState('idle');
    setActiveTab('settings');
  };

  const mapYandexTrack = (item) => {
    const track = item.track || item;
    const artistName = track.artists?.map(a => a.name).join(', ') || 'Неизвестный исполнитель';
    const coverUri = track.albums?.[0]?.coverUri;
    const coverUrl = coverUri ? 'https://' + coverUri.replace('%%', '400x400') : '';
    
    return {
      id: `yandex-${track.id}-${Math.random().toString(36).substring(2, 9)}`,
      yandexId: track.id ? String(track.id) : '',
      title: track.title,
      artist: artistName,
      artists: track.artists || [], // preserve raw artists list!
      album: track.albums?.[0] ? {
        id: track.albums[0].id,
        title: track.albums[0].title,
        year: track.albums[0].year,
        coverUri: track.albums[0].coverUri,
        cover: track.albums[0].coverUri ? 'https://' + track.albums[0].coverUri.replace('%%', '200x200') : '',
        artists: track.albums[0].artists || track.artists || [],
        artist: track.albums[0].artists?.map(a => a.name).join(', ') || artistName
      } : null,
      explicit: track.explicit || false,
      cover: coverUrl || '',
      url: '', // Resolved dynamically when played
      type: 'yandex',
      duration: Math.round((track.durationMs || 180000) / 1000),
      playIdentifier: item.playIdentifier || null
    };
  };

  // 4. Initialize YouTube Player
  const initYoutubePlayer = () => {
    try {
      ytPlayerRef.current = new window.YT.Player(ytPlayerContainerId, {
        height: '100%',
        width: '100%',
        videoId: activeTrack.type === 'youtube' ? activeTrack.url : '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(isMuted ? 0 : volume * 100);
            if (activeTrack.type === 'youtube' && isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(ytPlayerRef.current.getDuration() || activeTrack.duration);
              startProgressPolling();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              stopProgressPolling();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              handleTrackEnded();
            }
          }
        }
      });
    } catch (e) {
      console.error('Failed to init YouTube player iframe:', e);
    }
  };



  // 6. Active Track changes logic
  useEffect(() => {
    if (!isPlaying) {
      setCurrentTime(0);
      setDuration(activeTrack.duration || 180);
      if (playerSeekbarSliderRef.current) playerSeekbarSliderRef.current.value = 0;
      if (fullscreenSeekbarSliderRef.current) fullscreenSeekbarSliderRef.current.value = 0;
      if (splitSeekbarSliderRef.current) splitSeekbarSliderRef.current.value = 0;
      if (playerProgressRef.current) playerProgressRef.current.style.width = '0%';
      if (fullscreenProgressRef.current) fullscreenProgressRef.current.style.width = '0%';
      if (splitProgressRef.current) splitProgressRef.current.style.width = '0%';
      if (playerTimeLabelRef.current) playerTimeLabelRef.current.textContent = '0:00';
      if (fullscreenTimeLabelRef.current) fullscreenTimeLabelRef.current.textContent = '0:00';

      if (activeTrack.type === 'local') {
        if (audioRef.current) {
          audioRef.current.src = activeTrack.url;
          audioRef.current.load();
        }
      } else if (activeTrack.type === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.cueVideoById === 'function') {
        try {
          ytPlayerRef.current.cueVideoById({ videoId: activeTrack.url });
        } catch (e) {}
      }
    }
  }, [activeTrack]);

  // 7. Render Visualizer inside Content Panel background
  const renderVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const draw = () => {
      visualizerAnimationRef.current = requestAnimationFrame(draw);
      
      const bufferLength = 64;
      const dataArray = new Uint8Array(bufferLength);
      
      if (isPlaying) {
        // Simulated frequency movement to bypass Web Audio API CORS silencing
        const time = Date.now() * 0.003;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 30 + Math.sin(i * 0.2 + time) * 35 + Math.cos(i * 0.08 - time * 1.5) * 20;
        }
      } else {
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 0;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#22c55e'); // Green
      gradient.addColorStop(1, '#0ea5e9'); // Sky Blue
      
      ctx.strokeStyle = gradient;
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(34, 197, 94, 0.2)';
      
      ctx.beginPath();
      const sliceWidth = canvas.width / (bufferLength * 0.7);
      let x = 0;
      
      for (let i = 0; i < bufferLength * 0.7; i++) {
        const v = dataArray[i] / 255.0;
        const y = canvas.height / 2 + (v * canvas.height * 0.45 * (i % 2 === 0 ? 1 : -1));
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const nextX = x + sliceWidth;
          const nextV = (dataArray[i + 1] || 0) / 255.0;
          const nextY = canvas.height / 2 + (nextV * canvas.height * 0.45 * ((i + 1) % 2 === 0 ? 1 : -1));
          
          const xc = (x + nextX) / 2;
          const yc = (y + nextY) / 2;
          ctx.quadraticCurveTo(x, y, xc, yc);
        }
        x += sliceWidth;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();
  };

  // 8. Progress polling
  const updateProgressRaf = () => {
    if (!isPlayingRef.current) return;

    let time = 0;
    let durationVal = durationRef.current;
    const track = activeTrackRef.current;

    if (track && track.type === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      try {
        time = ytPlayerRef.current.getCurrentTime() || 0;
        durationVal = ytPlayerRef.current.getDuration() || durationVal;
      } catch (e) {}
    } else if (track && (track.type === 'local' || track.type === 'yandex') && audioRef.current) {
      time = audioRef.current.currentTime || 0;
      const audioDuration = audioRef.current.duration;
      if (audioDuration && !isNaN(audioDuration) && isFinite(audioDuration)) {
        durationVal = audioDuration;
      }
    }

    currentTimeRef.current = time;

    const pct = durationVal > 0 ? (time / durationVal) * 100 : 0;
    const timeStr = formatTime(time);

    if (playerProgressRef.current) playerProgressRef.current.style.width = `${pct}%`;
    if (fullscreenProgressRef.current) fullscreenProgressRef.current.style.width = `${pct}%`;
    if (splitProgressRef.current) splitProgressRef.current.style.width = `${pct}%`;

    if (playerTimeLabelRef.current && playerTimeLabelRef.current.textContent !== timeStr) {
      playerTimeLabelRef.current.textContent = timeStr;
    }
    if (fullscreenTimeLabelRef.current && fullscreenTimeLabelRef.current.textContent !== timeStr) {
      fullscreenTimeLabelRef.current.textContent = timeStr;
    }

    if (!isSeekingRef.current) {
      if (playerSeekbarSliderRef.current) playerSeekbarSliderRef.current.value = time;
      if (fullscreenSeekbarSliderRef.current) fullscreenSeekbarSliderRef.current.value = time;
      if (splitSeekbarSliderRef.current) splitSeekbarSliderRef.current.value = time;
    }

    if (playerLeftGlowRef.current) {
      playerLeftGlowRef.current.style.setProperty('--progress', pct);
    }

    const lyrics = parsedLyricsRef.current;
    if (lyrics) {
      let activeIdx = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (time >= lyrics[i].time) {
          activeIdx = i;
        } else {
          break;
        }
      }
      if (activeIdx !== lastActiveLineIndexRef.current) {
        lastActiveLineIndexRef.current = activeIdx;
        setLyricsActiveIndex(activeIdx);
      }
    }

    setCurrentTime(prev => {
      if (Math.floor(prev) !== Math.floor(time)) {
        return time;
      }
      return prev;
    });

    if (durationVal !== durationRef.current) {
      setDuration(durationVal);
    }

    if (document.hidden) {
      progressRafRef.current = setTimeout(updateProgressRaf, 1000);
    } else {
      progressRafRef.current = requestAnimationFrame(updateProgressRaf);
    }
  };

  const startProgressPolling = () => {
    stopProgressPolling();
    if (document.hidden) {
      progressRafRef.current = setTimeout(updateProgressRaf, 1000);
    } else {
      progressRafRef.current = requestAnimationFrame(updateProgressRaf);
    }
  };

  const stopProgressPolling = () => {
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      clearTimeout(progressRafRef.current);
      progressRafRef.current = null;
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (isPlayingRef.current) {
        startProgressPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleLocalPlay = () => {
    setIsPlaying(true);
    setDuration(audioRef.current.duration || activeTrack.duration);
    startProgressPolling();
    if (!visualizerAnimationRef.current) {
      renderVisualizer();
    }
  };

  const handleLocalPause = () => {
    setIsPlaying(false);
    stopProgressPolling();
  };

  const handleTrackEnded = () => {
    setIsPlaying(false);
    stopProgressPolling();
    if (activeTrack.type === 'yandex' && activeTrack.yandexId && activeRadioStation) {
      sendRadioFeedback('trackFinished', activeTrack.yandexId, activeTrack.playIdentifier);
    }
    if (isRepeating) {
      playTrack(activeTrack, !!activeRadioStation);
    } else {
      handleNext();
    }
  };

  // Playback Control triggers
  const playTrack = async (track, keepRadio = false) => {
    if (!track || track.id === 'empty') return;

    if (!keepRadio) {
      setActiveRadioStation(null);
      setWaveSourceTrack(null);
    }

    if (playAbortControllerRef.current) {
      playAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    playAbortControllerRef.current = controller;

    if (loadingTrackIdRef.current === track.id) {
      console.log('[playTrack] Already loading/playing track:', track.id);
      return;
    }
    loadingTrackIdRef.current = track.id;

    // Optimistically update active track and reset progress so UI responds immediately
    setActiveTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    lastActiveLineIndexRef.current = -1;
    setLyricsActiveIndex(-1);
    if (playerSeekbarSliderRef.current) playerSeekbarSliderRef.current.value = 0;
    if (fullscreenSeekbarSliderRef.current) fullscreenSeekbarSliderRef.current.value = 0;
    if (splitSeekbarSliderRef.current) splitSeekbarSliderRef.current.value = 0;
    if (playerProgressRef.current) playerProgressRef.current.style.width = '0%';
    if (fullscreenProgressRef.current) fullscreenProgressRef.current.style.width = '0%';
    if (splitProgressRef.current) splitProgressRef.current.style.width = '0%';
    if (playerTimeLabelRef.current) playerTimeLabelRef.current.textContent = '0:00';
    if (fullscreenTimeLabelRef.current) fullscreenTimeLabelRef.current.textContent = '0:00';

    // Stop current track immediately so it doesn't leak audio while loading the new track
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch (e) {}
    }

    try {
      // Send skip feedback for the previous track if it was skipped
      if (activeTrack && activeTrack.type === 'yandex' && activeTrack.yandexId && activeRadioStation) {
        if (activeTrack.yandexId !== track.yandexId && currentTime < duration - 5) {
          sendRadioFeedback('skip', activeTrack.yandexId, activeTrack.playIdentifier);
        }
      }

      let resolvedUrl = track.url;

      // Resolve Yandex Music direct signed stream URL if needed
      if (track.type === 'yandex' && !track.url) {
        let yandexId = track.yandexId;
        if (!yandexId && track.id) {
          const match = track.id.match(/yandex-(\d+)/);
          if (match) {
            yandexId = match[1];
          } else if (/^\d+$/.test(track.id)) {
            yandexId = track.id;
          }
        }

        if (!yandexId || yandexId === 'undefined') {
          alert('Не удалось определить ID трека Яндекс.Музыки.');
          return;
        }

        try {
          const res = await fetch(`/api/yandex/stream?trackId=${yandexId}`, {
            headers: {
              'Authorization': `Bearer ${yandexToken}`
            },
            signal: controller.signal
          });
          if (controller.signal.aborted) return;
          if (res.ok) {
            const data = await res.json();
            if (controller.signal.aborted) return;
            if (data.url) {
              resolvedUrl = data.url;
            } else {
              alert('Не удалось получить поток для трека. Проверьте подписку.');
              return;
            }
          } else {
            alert('Ошибка при авторизации запроса в Яндекс.Музыку.');
            return;
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            console.log('[playTrack] Stream fetch aborted for:', track.title);
            return;
          }
          console.error(err);
          return;
        }
      }

      if (controller.signal.aborted) return;

      const updatedTrack = (track.url !== resolvedUrl) ? { ...track, url: resolvedUrl } : track;
      setActiveTrack(updatedTrack);
      setIsPlaying(true);

      if (updatedTrack.type === 'yandex' && updatedTrack.yandexId && activeRadioStation) {
        sendRadioFeedback('trackStarted', updatedTrack.yandexId, updatedTrack.playIdentifier);
        
        // Update ref synchronously for immediate fetch filtering
        if (!playedRadioTrackIdsRef.current.includes(updatedTrack.yandexId)) {
          playedRadioTrackIdsRef.current.push(updatedTrack.yandexId);
          if (playedRadioTrackIdsRef.current.length > 300) {
            playedRadioTrackIdsRef.current.shift();
          }
          try {
            localStorage.setItem('yandex_played_tracks_history', JSON.stringify(playedRadioTrackIdsRef.current));
          } catch (e) {
            console.error(e);
          }
        }

        setPlayedRadioTrackIds(prev => {
          const updated = [...prev.filter(id => id !== updatedTrack.yandexId), updatedTrack.yandexId];
          if (updated.length > 300) {
            updated.shift();
          }
          return updated;
        });
      }

      if (updatedTrack.type === 'local' || updatedTrack.type === 'yandex') {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch (e) {}
        }
        
        if (audioRef.current) {
          audioRef.current.src = resolvedUrl;
          audioRef.current.load();
          audioRef.current.play().catch(e => {
            console.warn("Failed to play audio element:", e);
          });
        }
      } else if (updatedTrack.type === 'youtube') {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
          try {
            ytPlayerRef.current.loadVideoById({
              videoId: updatedTrack.url,
              startSeconds: 0
            });
          } catch (e) {
            console.error('Error loading video:', e);
          }
        }
      }
    } finally {
      if (playAbortControllerRef.current === controller) {
        playAbortControllerRef.current = null;
      }
      if (loadingTrackIdRef.current === track.id) {
        loadingTrackIdRef.current = null;
      }
    }
  };

  const preloadLyricsForTrack = async (track, signal) => {
    if (!track || track.id === 'empty') return;
    if (loadedLyricsTrackIdRef.current === track.id) return;

    console.log('[Lyrics Preload] Preloading lyrics in background for:', track.title);
    try {
      const headers = {};
      if (yandexToken) {
        headers['Authorization'] = `Bearer ${yandexToken}`;
      }
      
      const yParam = (track.type === 'yandex' && track.yandexId) ? track.yandexId : '';
      const url = `/api/yandex/lyrics?trackId=${yParam}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&duration=${track.duration || 0}`;
      
      const res = await fetch(url, { headers, signal });
      if (res.ok) {
        const data = await res.json();
        if (signal && signal.aborted) return;
        if (data.lyrics) {
          setLyricsText(data.lyrics);
          const parsed = parseLrc(data.lyrics);
          setParsedLyrics(parsed);
          loadedLyricsTrackIdRef.current = track.id;
          console.log('[Lyrics Preload] Preload successful for:', track.title);
          return;
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('[Lyrics Preload] Aborted for:', track.title);
        return;
      }
      console.error('[Lyrics Preload] Error:', e);
    }
    
    if (signal && signal.aborted) return;
    setLyricsText('Текст песни не найден.');
    setParsedLyrics(null);
    loadedLyricsTrackIdRef.current = track.id;
  };

  const fetchLyrics = async (track, signal) => {
    if (!track || track.id === 'empty') return;

    if (loadedLyricsTrackIdRef.current === track.id) {
      console.log('[Lyrics] Using preloaded lyrics for:', track.title);
      setIsLoadingLyrics(false);
      return;
    }
    
    setLyricsText(null);
    setParsedLyrics(null);
    setIsLoadingLyrics(true);
    
    let foundLyrics = null;
    
    try {
      const headers = {};
      if (yandexToken) {
        headers['Authorization'] = `Bearer ${yandexToken}`;
      }
      
      const yParam = (track.type === 'yandex' && track.yandexId) ? track.yandexId : '';
      const url = `/api/yandex/lyrics?trackId=${yParam}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&duration=${track.duration || 0}`;
      
      const res = await fetch(url, { headers, signal });
      if (res.ok) {
        const data = await res.json();
        if (signal && signal.aborted) {
          setIsLoadingLyrics(false);
          return;
        }
        if (data.lyrics) {
          foundLyrics = data.lyrics;
        }
      }
    } catch (e) {
      setIsLoadingLyrics(false);
      if (e.name === 'AbortError') {
        console.log('[Lyrics Fetch] Aborted for:', track.title);
        return;
      }
      console.error('Lyrics fetch error:', e);
    }
    
    if (signal && signal.aborted) {
      setIsLoadingLyrics(false);
      return;
    }
    
    if (foundLyrics) {
      setLyricsText(foundLyrics);
      const parsed = parseLrc(foundLyrics);
      setParsedLyrics(parsed);
    } else {
      setLyricsText('Текст песни не найден.');
      setParsedLyrics(null);
    }
    loadedLyricsTrackIdRef.current = track.id;
    setIsLoadingLyrics(false);
  };

  // Preload lyrics when active track changes or when modal is opened
  useEffect(() => {
    if (!activeTrack || activeTrack.id === 'empty') return;
    
    if (lyricsAbortControllerRef.current) {
      lyricsAbortControllerRef.current.abort();
      lyricsAbortControllerRef.current = null;
    }

    const controller = new AbortController();
    lyricsAbortControllerRef.current = controller;

    if (showLyricsModal || showFullscreenLyrics) {
      fetchLyrics(activeTrack, controller.signal);
    } else {
      const timer = setTimeout(() => {
        preloadLyricsForTrack(activeTrack, controller.signal);
      }, 800);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }

    return () => {
      controller.abort();
    };
  }, [activeTrack?.id, showLyricsModal, showFullscreenLyrics]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (activeTrack.type === 'local' || activeTrack.type === 'yandex') {
        audioRef.current.pause();
      } else {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch (e) {}
        }
      }
    } else {
      setIsPlaying(true);
      if (activeTrack.type === 'local' || activeTrack.type === 'yandex') {
        audioRef.current.play().catch(e => console.warn(e));
      } else {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
          try {
            ytPlayerRef.current.playVideo();
          } catch (e) {}
        }
      }
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    currentTimeRef.current = time;

    // Update DOM directly for instant response
    const pct = duration > 0 ? (time / duration) * 100 : 0;
    const timeStr = formatTime(time);

    if (playerProgressRef.current) playerProgressRef.current.style.width = `${pct}%`;
    if (fullscreenProgressRef.current) fullscreenProgressRef.current.style.width = `${pct}%`;
    if (splitProgressRef.current) splitProgressRef.current.style.width = `${pct}%`;
    
    if (playerTimeLabelRef.current) playerTimeLabelRef.current.textContent = timeStr;
    if (fullscreenTimeLabelRef.current) fullscreenTimeLabelRef.current.textContent = timeStr;

    if (playerSeekbarSliderRef.current) playerSeekbarSliderRef.current.value = time;
    if (fullscreenSeekbarSliderRef.current) fullscreenSeekbarSliderRef.current.value = time;
    if (splitSeekbarSliderRef.current) splitSeekbarSliderRef.current.value = time;

    if (playerLeftGlowRef.current) {
      playerLeftGlowRef.current.style.setProperty('--progress', pct);
    }
    
    if (activeTrack.type === 'local' || activeTrack.type === 'yandex') {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    } else {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          ytPlayerRef.current.seekTo(time, true);
        } catch (e) {}
      }
    }
  };

  const handleLineClick = (time) => {
    setCurrentTime(time);
    currentTimeRef.current = time;

    const pct = duration > 0 ? (time / duration) * 100 : 0;
    const timeStr = formatTime(time);

    if (playerProgressRef.current) playerProgressRef.current.style.width = `${pct}%`;
    if (fullscreenProgressRef.current) fullscreenProgressRef.current.style.width = `${pct}%`;
    if (splitProgressRef.current) splitProgressRef.current.style.width = `${pct}%`;
    
    if (playerTimeLabelRef.current) playerTimeLabelRef.current.textContent = timeStr;
    if (fullscreenTimeLabelRef.current) fullscreenTimeLabelRef.current.textContent = timeStr;

    if (playerSeekbarSliderRef.current) playerSeekbarSliderRef.current.value = time;
    if (fullscreenSeekbarSliderRef.current) fullscreenSeekbarSliderRef.current.value = time;
    if (splitSeekbarSliderRef.current) splitSeekbarSliderRef.current.value = time;

    if (playerLeftGlowRef.current) {
      playerLeftGlowRef.current.style.setProperty('--progress', pct);
    }

    if (activeTrack.type === 'local' || activeTrack.type === 'yandex') {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    } else {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          ytPlayerRef.current.seekTo(time, true);
        } catch (e) {}
      }
    }
  };

  const handleNext = () => {
    const currentIndex = queue.findIndex(t => t.id === activeTrack.id);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1], !!activeRadioStation);
    } else if (queue.length > 0) {
      playTrack(queue[0], !!activeRadioStation);
    }
  };

  const handlePrev = () => {
    const currentIndex = queue.findIndex(t => t.id === activeTrack.id);
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1], !!activeRadioStation);
    } else if (queue.length > 0) {
      playTrack(queue[queue.length - 1], !!activeRadioStation);
    }
  };

  // Queue Operations
  const addToQueue = (track) => {
    if (!queue.some(t => t.id === track.id)) {
      setQueue([...queue, track]);
    }
  };

  const addAllToQueueAndPlay = (tracks) => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    playTrack(tracks[0]);
  };

  const removeFromQueue = (trackId, e) => {
    e.stopPropagation();
    setQueue(queue.filter(t => t.id !== trackId));
  };

  const isTrackLiked = (track) => {
    if (!track) return false;
    if (yandexToken && track.yandexId) {
      return yandexLikedIds.includes(String(track.yandexId));
    }
    return likedTracks.some(t => t.id === track.id || (track.yandexId && t.yandexId === track.yandexId));
  };

  const sendRadioFeedback = async (event, trackId, playIdentifier = null) => {
    if (!activeRadioStation || !yandexToken || !trackId) return;
    try {
      let url = `/api/yandex/radio-feedback?stationId=${encodeURIComponent(activeRadioStation)}&trackId=${trackId}&event=${event}&t=${Date.now()}`;
      if (playIdentifier) {
        url += `&playIdentifier=${encodeURIComponent(playIdentifier)}`;
      }
      await fetch(url, {
        headers: { 'Authorization': `Bearer ${yandexToken}` }
      });
    } catch (e) {
      console.warn('Failed to send radio feedback:', e);
    }
  };

  // Favorites (Local & Yandex Likes)
  const toggleLike = async (track, e) => {
    if (e) e.stopPropagation();
    if (!track || track.id === 'empty') return;

    const liked = isTrackLiked(track);
    
    // 1. Update local likes state & localStorage
    let newLikedTracks;
    if (likedTracks.some(t => t.id === track.id || (track.yandexId && t.yandexId === track.yandexId))) {
      newLikedTracks = likedTracks.filter(t => t.id !== track.id && (!track.yandexId || t.yandexId !== track.yandexId));
    } else {
      newLikedTracks = [...likedTracks, track];
    }
    setLikedTracks(newLikedTracks);
    localStorage.setItem('liquid_player_favs', JSON.stringify(newLikedTracks));

    // 2. If logged in and track has Yandex ID, sync with Yandex Music API
    if (yandexToken && yandexUser && track.yandexId) {
      // Optimistically update yandexLikes and yandexLikedIds state
      let newYandexLikes;
      if (liked) {
        newYandexLikes = yandexLikes.filter(t => t.yandexId !== track.yandexId);
        setYandexLikedIds(prev => prev.filter(id => id !== String(track.yandexId)));
      } else {
        if (!yandexLikes.some(t => t.yandexId === track.yandexId)) {
          newYandexLikes = [...yandexLikes, track];
        } else {
          newYandexLikes = yandexLikes;
        }
        setYandexLikedIds(prev => [...prev.filter(id => id !== String(track.yandexId)), String(track.yandexId)]);
      }
      setYandexLikes(newYandexLikes);

      try {
        const action = liked ? 'remove' : 'add';
        const response = await fetch(`/api/yandex/likes/${action}?uid=${yandexUser.uid}&trackId=${track.yandexId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${yandexToken}`
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to ${action} Yandex liked track`);
          // Revert on error
          fetchYandexLikes(yandexToken, yandexUser.uid);
        } else {
          if (activeRadioStation && !liked) {
            sendRadioFeedback('like', track.yandexId, track.playIdentifier);
          }
        }
      } catch (err) {
        console.error('Error synchronizing Yandex like:', err);
        // Revert on error
        fetchYandexLikes(yandexToken, yandexUser.uid);
      }
    }
  };

  // Search Yandex Music API
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults(null);

    if (!yandexToken) {
      setSearchResults({ tracks: [], artists: [], albums: [] });
      setIsSearching(false);
      return;
    }

    try {
      const response = await fetch(`/api/yandex/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${yandexToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const rawTracks = data.result?.tracks?.results || [];
        const tracks = rawTracks.map(mapYandexTrack);
        
        const rawArtists = data.result?.artists?.results || [];
        const artists = rawArtists.map(artist => ({
          id: artist.id,
          name: artist.name,
          cover: artist.cover?.uri ? 'https://' + artist.cover.uri.replace('%%', '200x200') : '',
          genres: artist.genres || []
        }));

        const rawAlbums = data.result?.albums?.results || [];
        const albums = rawAlbums.map(album => ({
          id: album.id,
          title: album.title,
          coverUri: album.coverUri,
          cover: album.coverUri ? 'https://' + album.coverUri.replace('%%', '200x200') : '',
          year: album.year
        }));

        setSearchResults({ tracks, artists, albums });
      }
    } catch (err) {
      console.warn(err);
      setSearchResults({ tracks: [], artists: [], albums: [] });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim() && activeTab === 'search') {
        handleSearch();
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  // Adding Custom Direct Link (.mp3 or YouTube Video ID)
  const handleAddCustomTrack = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    let newTrack = null;
    
    if (customUrl.endsWith('.mp3') || customUrl.includes('.mp3?')) {
      const title = customTitle.trim() || 'Custom MP3 Stream';
      newTrack = {
        id: `custom-mp3-${Date.now()}`,
        title: title,
        artist: 'Внешний аудио-адрес',
        cover: '',
        url: customUrl,
        type: 'local',
        duration: 240
      };
    } else {
      let videoId = customUrl.trim();
      const ytMatch = customUrl.match(/(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w-]{11})/);
      if (ytMatch && ytMatch[1]) {
        videoId = ytMatch[1];
      }
      
      if (videoId.length === 11) {
        newTrack = {
          id: `custom-yt-${Date.now()}`,
          title: customTitle.trim() || `YouTube Track (${videoId})`,
          artist: 'Ссылка YouTube',
          cover: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          url: videoId,
          type: 'youtube',
          duration: 180
        };
      }
    }

    if (newTrack) {
      addToQueue(newTrack);
      playTrack(newTrack);
      setCustomUrl('');
      setCustomTitle('');
      setActiveTab('queue');
    } else {
      alert('Введите прямую ссылку на .mp3 файл или 11-значный ID видео YouTube.');
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const openArtistProfile = async (artistId, artistName = '') => {
    setArtistBackTab(activeTab);
    setActiveTab('artist');
    setIsLoadingArtist(true);
    setArtistInfo(null);
    setActiveAlbum(null);
    setAlbumTracks([]);
    setCurrentArtistName(artistName);
    try {
      const headers = {};
      if (yandexToken) {
        headers['Authorization'] = `Bearer ${yandexToken}`;
      }
      const res = await fetch(`/api/yandex/artist-info?artistId=${artistId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.result && data.result.artist) {
          setArtistInfo(data.result);
        } else {
          setArtistInfo({
            artist: { name: artistName || 'Исполнитель', genres: [], cover: null },
            popularTracks: [],
            albums: [],
            alsoAlbums: [],
            error: true
          });
        }
      } else {
        setArtistInfo({
          artist: { name: artistName || 'Исполнитель', genres: [], cover: null },
          popularTracks: [],
          albums: [],
          alsoAlbums: [],
          error: true
        });
      }
    } catch (e) {
      console.error(e);
      setArtistInfo({
        artist: { name: artistName || 'Исполнитель', genres: [], cover: null },
        popularTracks: [],
        albums: [],
        alsoAlbums: [],
        error: true
      });
    } finally {
      setIsLoadingArtist(false);
    }
  };

  const loadAlbumTracks = async (album) => {
    setAlbumBackTab(activeTab);
    if (activeTab !== 'artist') {
      setArtistInfo(null);
    }
    setActiveTab('artist');
    setActiveAlbum(album);
    setAlbumTracks([]);
    setIsLoadingAlbumTracks(true);
    setAlbumLoadError(false);
    try {
      const headers = {};
      if (yandexToken) {
        headers['Authorization'] = `Bearer ${yandexToken}`;
      }
      const res = await fetch(`/api/yandex/album-tracks?albumId=${album.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          setActiveAlbum(prev => ({
            ...prev,
            ...data.result,
            cover: prev?.cover || (data.result.coverUri ? 'https://' + data.result.coverUri.replace('%%', '200x200') : '')
          }));
        }
        const volumes = data.result?.volumes || [];
        const tracks = [];
        for (const volume of volumes) {
          for (const track of volume) {
            if (track) {
              tracks.push(mapYandexTrack(track));
            }
          }
        }
        setAlbumTracks(tracks);
      } else {
        setAlbumLoadError(true);
      }
    } catch (e) {
      console.error(e);
      setAlbumLoadError(true);
    } finally {
      setIsLoadingAlbumTracks(false);
    }
  };

  const renderTrackMenu = (track = activeTrack, align = 'up') => {
    if (!track || track.id === 'empty') return null;

    const primaryArtist = track.artists?.[0];

    return (
      <div className={`player-context-menu ${align === 'down' ? 'align-down' : ''} ${align === 'left' ? 'align-left' : ''}`} onClick={(e) => e.stopPropagation()}>

        <button 
          className={`player-context-menu-item ${(!track.yandexId || track.type !== 'yandex') ? 'disabled' : ''}`}
          onClick={() => {
            if (track.yandexId && track.type === 'yandex') {
              playMyWave(`track:${track.yandexId}`, track);
              setMenuOpenTrackId(null);
            }
          }}
        >
          <Radio size={16} />
          <span>Моя волна по треку</span>
        </button>

        <button 
          className="player-context-menu-item" 
          onClick={() => {
            playNextInQueue(track);
            showToast('Трек будет сыгран следующим');
            setMenuOpenTrackId(null);
          }}
        >
          <ArrowLineDown size={16} />
          <span>Играть следующим</span>
        </button>

        <button 
          className={`player-context-menu-item ${(!track.yandexId || track.type !== 'yandex') ? 'disabled' : ''}`}
          onClick={() => {
            if (track.yandexId) {
              sendRadioFeedback('dislike', track.yandexId, track.playIdentifier);
            }
            // If disliking the currently playing track, skip it
            if (track.id === activeTrack.id) {
              handleNext();
            }
            setMenuOpenTrackId(null);
          }}
        >
          <HeartBreak size={16} />
          <span>Не нравится</span>
        </button>

        <button 
          className="player-context-menu-item" 
          onClick={() => {
            if (isFullscreenPlayer) {
              setShowFullscreenLyrics(true);
              setShowFullscreenQueue(false);
            } else {
              setShowLyricsModal(true);
            }
            fetchLyrics(track);
            setMenuOpenTrackId(null);
          }}
        >
          <TextT size={16} />
          <span>Показать текст песни</span>
        </button>

        <button 
          className="player-context-menu-item" 
          onClick={() => {
            const shareUrl = track.yandexId 
              ? `https://music.yandex.ru/track/${track.yandexId}` 
              : track.url || '';
            if (shareUrl) {
              navigator.clipboard.writeText(shareUrl)
                .then(() => showToast('Ссылка скопирована в буфер обмена!'))
                .catch(() => showToast('Не удалось скопировать ссылку'));
            } else {
              showToast('Ссылка недоступна для этого трека');
            }
            setMenuOpenTrackId(null);
          }}
        >
          <ShareNetwork size={16} />
          <span>Поделиться</span>
        </button>

        <button 
          className={`player-context-menu-item ${!track.album ? 'disabled' : ''}`}
          onClick={() => {
            if (track.album) {
              loadAlbumTracks(track.album);
              setIsFullscreenPlayer(false);
              setMenuOpenTrackId(null);
            }
          }}
        >
          <Disc size={16} />
          <span>Перейти к альбому</span>
        </button>

        <button 
          className={`player-context-menu-item ${(!primaryArtist || !primaryArtist.id) ? 'disabled' : ''}`}
          onClick={() => {
            if (primaryArtist && primaryArtist.id) {
              openArtistProfile(primaryArtist.id, primaryArtist.name);
              setIsFullscreenPlayer(false);
              setMenuOpenTrackId(null);
            }
          }}
        >
          <User size={16} />
          <span>Перейти к исполнителю</span>
        </button>
      </div>
    );
  };

  const renderTrackTable = (tracks) => {
    if (!tracks || tracks.length === 0) {
      return (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Нет треков
        </div>
      );
    }

    return (
      <div className="track-table-glass-container">
        <table className="retro-track-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-cover"></th>
              <th className="col-title">Название</th>
              <th className="col-artist">Исполнитель</th>
              <th className="col-album">Альбом</th>
              <th className="col-duration">Длительность</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, idx) => {
              const isCurrent = (activeTrack.yandexId && track.yandexId) ? activeTrack.yandexId === track.yandexId : activeTrack.id === track.id;
              return (
                <tr 
                  key={`${track.id}-${idx}`}
                  className={`retro-track-row ${isCurrent ? 'active-row' : ''}`}
                  onClick={() => {
                    addToQueue(track);
                    playTrack(track);
                  }}
                >
                  <td className="col-num">
                    {isCurrent && isPlaying ? "▶" : idx + 1}
                  </td>
                  <td className="col-cover">
                    {track.cover ? (
                      <img src={track.cover} alt="" className="retro-table-cover" loading="lazy" />
                    ) : (
                      <div className="retro-table-no-cover"><MusicNote size={14} /></div>
                    )}
                  </td>
                  <td className="col-title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span className="track-title-text" style={{ color: isCurrent ? 'var(--accent)' : 'inherit', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{track.title}</span>
                      {track.explicit && (
                        <span className="explicit-badge-small" title="Возрастное ограничение 18+">18+</span>
                      )}
                    </div>
                  </td>
                  <td className="col-artist">
                    <span className="track-artist-text">
                      {track.artists && track.artists.length > 0 ? (
                        track.artists.map((artist, artistIdx) => (
                          <span key={artist.id || artistIdx}>
                            <span 
                              className="clickable-artist-name" 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (artist.id) {
                                  openArtistProfile(artist.id, artist.name);
                                }
                              }}
                            >
                              {artist.name}
                            </span>
                            {artistIdx < track.artists.length - 1 ? ', ' : ''}
                          </span>
                        ))
                      ) : (
                        track.artist
                      )}
                    </span>
                  </td>
                  <td className="col-album">
                    {track.album ? (
                      <span 
                        className="clickable-album-name"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadAlbumTracks(track.album);
                        }}
                      >
                        {track.album.title}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="col-duration">
                    {formatTime(track.duration)}
                  </td>
                  <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => toggleLike(track, e)} className="retro-row-action-btn">
                      <Heart size={14} weight={isTrackLiked(track) ? 'fill' : 'regular'} color={isTrackLiked(track) ? '#f83e3e' : 'var(--text-muted)'} />
                    </button>
                    <button onClick={() => addToQueue(track)} className="retro-row-action-btn" title="Добавить в очередь">
                      <Plus size={14} />
                    </button>
                    <div className="table-track-menu-container" style={{ position: 'relative', display: 'inline-flex' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenTrackId(menuOpenTrackId === track.id ? null : track.id);
                        }} 
                        className={`retro-row-action-btn ${menuOpenTrackId === track.id ? 'active' : ''}`}
                        title="Опции трека"
                      >
                        <DotsThreeVertical size={14} weight="bold" />
                      </button>
                      {menuOpenTrackId === track.id && renderTrackMenu(track, 'down')}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const isCardPlaying = activeTrack && activeTrack.id !== 'empty' && isPlaying;

  return (
    <>
      <div 
        className="ambient-bg"
        style={
          customWallpaper ? {
            background: `linear-gradient(rgba(0, 0, 0, 0.38), rgba(0, 0, 0, 0.38)), url(${customWallpaper}) no-repeat center center`,
            backgroundSize: 'cover'
          } : presetWallpaper ? {
            background: presetWallpaper === '#000000'
              ? '#000000'
              : `linear-gradient(rgba(0, 0, 0, 0.38), rgba(0, 0, 0, 0.38)), url(${presetWallpaper}) no-repeat center center`,
            backgroundSize: presetWallpaper === '#000000' ? 'auto' : 'cover'
          } : {}
        }
      >
        {presetWallpaper !== '#000000' && (
          <>
            <div className="ambient-sphere-1"></div>
            <div className="ambient-sphere-2"></div>
          </>
        )}
      </div>

      <audio
        ref={audioRef}
        onPlay={handleLocalPlay}
        onPause={handleLocalPause}
        onEnded={handleTrackEnded}
        onLoadedMetadata={() => {
          if (audioRef.current && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onError={(e) => console.warn('Audio tag node error:', e)}
      />

      <div className={`app-container theme-${theme}`}>
        <div className="app-layout-main">
          {/* Left Vertical Sidebar */}
          <aside className="app-sidebar-vertical">
            <div className="sidebar-logo" onClick={() => { setActiveTab('home'); setHomeSubTab('overview'); }}>
              <div className="logo-sphere">
                <MusicNote size={20} weight="bold" />
              </div>
            </div>
            
            <nav className="sidebar-nav-links">
              <button 
                className={`sidebar-nav-btn ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
                title="Главная"
              >
                <House size={22} weight={activeTab === 'home' ? 'fill' : 'regular'} />
              </button>
              
              <button 
                className={`sidebar-nav-btn ${activeRadioStation ? 'active-wave' : ''}`}
                onClick={() => playMyWave('user:onyourwave')}
                title={activeRadioStation ? "Сбросить в Мою волну" : "Моя волна"}
              >
                {activeRadioStation ? (
                  <ArrowsCounterClockwise size={22} className="wave-reload-icon" />
                ) : (
                  <MusicNote size={22} />
                )}
              </button>
              
              <button 
                className={`sidebar-nav-btn ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
                title="Поиск"
              >
                <MagnifyingGlass size={22} weight={activeTab === 'search' ? 'fill' : 'regular'} />
              </button>
              
              <button 
                className={`sidebar-nav-btn ${activeTab === 'collection' ? 'active' : ''}`}
                onClick={() => setActiveTab('collection')}
                title="Коллекция"
              >
                <Heart size={22} weight={activeTab === 'collection' ? 'fill' : 'regular'} />
              </button>

              <button 
                className={`sidebar-nav-btn ${activeTab === 'queue' ? 'active' : ''}`}
                onClick={() => setActiveTab('queue')}
                title="Очередь"
              >
                <List size={22} weight={activeTab === 'queue' ? 'fill' : 'regular'} />
              </button>
            </nav>
            
            <div className="sidebar-bottom-actions">
              <button 
                className={`sidebar-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
                title="Настройки"
              >
                <Gear size={22} weight={activeTab === 'settings' ? 'fill' : 'regular'} />
              </button>
            </div>
          </aside>

          {/* Right Content Area */}
          <div className="app-content-wrapper">
            <header className="app-header-compact">
              <div className="header-left">
                <h1 className="header-title-text" onClick={() => { setActiveTab('home'); setHomeSubTab('overview'); }} style={{ cursor: 'pointer' }}>Яндекс Музыка</h1>
              </div>
              
              <div className="header-right">
                {/* Header Search Input */}
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="header-search-form">
                  <MagnifyingGlass size={15} style={{ marginRight: '8px', color: 'rgba(255, 255, 255, 0.4)' }} />
                  <input 
                    type="text" 
                    placeholder="Что ищем?" 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (activeTab !== 'search') {
                        setActiveTab('search');
                      }
                    }}
                    className="header-search-input"
                  />
                </form>
                <div className="notification-bell" title="Уведомления">
                  <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M221.8,175.9A12,12,0,0,1,212,184H44a12,12,0,0,1-9.8-19.7C42,153.7,56,123.6,56,88a72,72,0,0,1,144,0c0,35.6,14,65.7,21.8,76.3A11.91,11.91,0,0,1,221.8,175.9ZM128,224a32,32,0,0,0,32-32H96A32,32,0,0,0,128,224Z" />
                  </svg>
                </div>
                <div className="avatar-circle" onClick={() => setActiveTab('settings')} title="Профиль">
                  <User size={18} />
                </div>
              </div>
            </header>

            <div className="main-layout-horizontal">
          
          {/* Left Main Content Column */}
          <div className="main-left-column">
            
            {/* TAB: Home */}
            {activeTab === 'home' && (
              <div className="home-view">
                <h1 className="home-title">Главное</h1>
                
                <div className="home-subnav">
                  <button className={`subnav-link ${homeSubTab === 'overview' ? 'active' : ''}`} onClick={() => setHomeSubTab('overview')}>ОБЗОР</button>
                  <button className={`subnav-link ${homeSubTab === 'novices' ? 'active' : ''}`} onClick={() => setHomeSubTab('novices')}>НОВИНКИ</button>
                  <button className={`subnav-link ${homeSubTab === 'chart' ? 'active' : ''}`} onClick={() => { setHomeSubTab('chart'); fetchYandexChart(); }}>ЧАРТЫ</button>
                  <button className={`subnav-link ${homeSubTab === 'genres' ? 'active' : ''}`} onClick={() => setHomeSubTab('genres')}>ЖАНРЫ</button>
                </div>

                {homeSubTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {/* Liquid Glass My Wave Card */}
                    <div className="retro-wave-section" style={{ position: 'relative' }}>
                      <div className="retro-wave-card liquid-glass-card">
                        <div className="wave-card-body-glass">
                          <h1 className={`wave-card-main-title ${activeRadioStation && activeRadioStation.startsWith('track:') ? 'track-wave' : ''}`}>
                            {activeRadioStation && activeRadioStation.startsWith('track:') && waveSourceTrack ? (
                              `Моя волна: ${waveSourceTrack.artist} — ${waveSourceTrack.title}`
                            ) : (
                              'Моя волна'
                            )}
                          </h1>
                          
                          <div className="wave-card-info-glass">
                            {activeTrack && activeTrack.id !== 'empty' ? (
                              <>
                                <span className="wave-card-artist">{activeTrack.artist}</span>
                                <span className="wave-card-track-title">{activeTrack.title}</span>
                              </>
                            ) : (
                              <>
                                <span className="wave-card-artist">Бесконечный поток музыки</span>
                                <span className="wave-card-track-title">подобранный специально для вас</span>
                              </>
                            )}
                          </div>
                          
                          {/* Row for Play/Pause and Settings Gear */}
                          <div className="wave-controls-row">
                            <button 
                              className="wave-play-btn-minimal" 
                              onClick={() => {
                                if (activeTrack && activeTrack.id !== 'empty') {
                                  togglePlay();
                                } else {
                                  playMyWave(waveStation);
                                }
                              }}
                              title={isPlaying ? "Пауза" : "Воспроизвести"}
                            >
                              {isPlaying ? (
                                <Pause size={22} weight="bold" />
                              ) : (
                                <Play size={22} weight="bold" />
                              )}
                            </button>

                            {yandexToken && yandexUser && (
                              <button 
                                className={`wave-settings-btn-minimal ${showWaveSettings ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowWaveSettings(!showWaveSettings);
                                }}
                                title="Настройки Моей волны"
                              >
                                <SlidersHorizontal size={22} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Wave Settings Popup rendered inside the relative section wrapper (outside of overflow:hidden card) */}
                      {showWaveSettings && (
                        <div className="wave-settings-popup card-mode" onClick={(e) => e.stopPropagation()}>
                          <div className="wave-settings-header">
                            <h3>Настройки Моей волны</h3>
                            <button className="close-btn" onClick={() => setShowWaveSettings(false)}>&times;</button>
                          </div>
                          
                          <div className="wave-settings-section">
                            <span className="section-label">Характер волны</span>
                            <div className="settings-options-grid">
                              <button 
                                className={`option-btn ${waveDiversity === 'default' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings('default', waveLanguage, waveMood)}
                              >
                                <span className="option-title">Разнообразно</span>
                                <span className="option-desc">Сбалансированный микс</span>
                              </button>
                              <button 
                                className={`option-btn ${waveDiversity === 'discover' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings('discover', waveLanguage, waveMood)}
                              >
                                <span className="option-title">Незнакомое</span>
                                <span className="option-desc">Новые исполнители и треки</span>
                              </button>
                              <button 
                                className={`option-btn ${waveDiversity === 'favorite' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings('favorite', waveLanguage, waveMood)}
                              >
                                <span className="option-title">Любимое</span>
                                <span className="option-desc">Только знакомые и любимые</span>
                              </button>
                              <button 
                                className={`option-btn ${waveDiversity === 'popular' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings('popular', waveLanguage, waveMood)}
                              >
                                <span className="option-title">Популярное</span>
                                <span className="option-desc">Хиты и тренды жанра</span>
                              </button>
                            </div>
                          </div>

                          <div className="wave-settings-section">
                            <span className="section-label">Язык треков</span>
                            <div className="settings-chips-row">
                              <button 
                                className={`chip-btn ${waveLanguage === 'any' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, 'any', waveMood)}
                              >
                                Любой
                              </button>
                              <button 
                                className={`chip-btn ${waveLanguage === 'russian' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, 'russian', waveMood)}
                              >
                                Русский
                              </button>
                              <button 
                                className={`chip-btn ${waveLanguage === 'not-russian' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, 'not-russian', waveMood)}
                              >
                                Иностранный
                              </button>
                            </div>
                          </div>

                          <div className="wave-settings-section">
                            <span className="section-label">Настроение</span>
                            <div className="settings-chips-row flex-wrap">
                              <button 
                                className={`chip-btn ${waveMood === 'all' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, waveLanguage, 'all')}
                              >
                                Любое
                              </button>
                              <button 
                                className={`chip-btn ${waveMood === 'fun' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, waveLanguage, 'fun')}
                              >
                                Весёлое
                              </button>
                              <button 
                                className={`chip-btn ${waveMood === 'active' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, waveLanguage, 'active')}
                              >
                                Бодрое
                              </button>
                              <button 
                                className={`chip-btn ${waveMood === 'calm' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, waveLanguage, 'calm')}
                              >
                                Спокойное
                              </button>
                              <button 
                                className={`chip-btn ${waveMood === 'sad' ? 'active' : ''}`}
                                onClick={() => updateWaveSettings(waveDiversity, waveLanguage, 'sad')}
                              >
                                Грустное
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mini classic Radio Section */}
                    <div className="classic-radio-section-glass">
                      <h2 className="section-title-glass">Классическое Радио</h2>
                      <div className="radio-glass-grid">
                        {RADIO_STATIONS.slice(0, 4).map((station) => (
                          <div 
                            key={station.id} 
                            className="radio-glass-card"
                            onClick={() => playMyWave(station.id)}
                          >
                            <span className="radio-card-label">Классическое Радио</span>
                            <span className="radio-card-title">{station.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Playlists Grid */}
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '14px' }}>Рекомендации</h2>
                      <div className="playlists-grid-three">
                        {/* Премьера */}
                        <div className="rec-card" onClick={() => playMyWave('user:onyourwave')}>
                          <div className="rec-card-cover card-orange">
                            <span className="rec-card-cover-title">Премьера</span>
                            <svg className="rec-card-cover-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0l1.2 8.4 7.2-5.4-5.4 7.2 8.4 1.2-8.4 1.2 5.4 7.2-7.2-5.4-1.2 8.4-1.2-8.4-7.2 5.4 5.4-7.2-8.4-1.2 8.4-1.2-5.4-7.2 7.2 5.4z"/>
                            </svg>
                            <div className="rec-card-graphic premiere-graphic">
                              <div className="premiere-flower">
                                <div className="premiere-petal petal-1"></div>
                                <div className="premiere-petal petal-2"></div>
                                <div className="premiere-petal petal-3"></div>
                                <div className="premiere-petal petal-4"></div>
                              </div>
                            </div>
                          </div>
                          <div className="rec-card-info">
                            <span className="rec-title">Премьера</span>
                            <span className="rec-desc">Открывает вам главные новинки</span>
                          </div>
                        </div>

                        {/* Дежавю */}
                        <div className="rec-card" onClick={() => playMyWave('user:onyourwave')}>
                          <div className="rec-card-cover card-purple">
                            <span className="rec-card-cover-title">Дежавю</span>
                            <svg className="rec-card-cover-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0l1.2 8.4 7.2-5.4-5.4 7.2 8.4 1.2-8.4 1.2 5.4 7.2-7.2-5.4-1.2 8.4-1.2-8.4-7.2 5.4 5.4-7.2-8.4-1.2 8.4-1.2-5.4-7.2 7.2 5.4z"/>
                            </svg>
                            <div className="rec-card-graphic dejavu-graphic">
                              <div className="dejavu-eye">
                                <div className="dejavu-eye-inner">
                                  <div className="dejavu-eye-pupil"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="rec-card-info">
                            <span className="rec-title">Дежавю</span>
                            <span className="rec-desc">Знакомит с тем, что вы ещё не слушали</span>
                          </div>
                        </div>

                        {/* Плейлист дня */}
                        <div className="rec-card" onClick={() => playMyWave('user:onyourwave')}>
                          <div className="rec-card-cover card-green">
                            <span className="rec-card-cover-title">Плейлист дня</span>
                            <svg className="rec-card-cover-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0l1.2 8.4 7.2-5.4-5.4 7.2 8.4 1.2-8.4 1.2 5.4 7.2-7.2-5.4-1.2 8.4-1.2-8.4-7.2 5.4 5.4-7.2-8.4-1.2 8.4-1.2-5.4-7.2 7.2 5.4z"/>
                            </svg>
                            <div className="rec-card-graphic daily-graphic">
                              <svg className="daily-star" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 0L13.1 8.9L20.5 3.5L14.7 10.3L24 12L14.7 13.7L20.5 20.5L13.1 15.1L12 24L10.9 15.1L3.5 20.5L9.3 13.7L0 12L9.3 10.3L3.5 3.5L10.9 8.9Z" fill="rgba(255,255,255,0.75)" />
                              </svg>
                            </div>
                          </div>
                          <div className="rec-card-info">
                            <span className="rec-title">Плейлист дня</span>
                            <span className="rec-desc">Звучит по-вашему каждый день</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {homeSubTab === 'novices' && (
                  <div className="home-section">
                    <h2 className="section-title" style={{ fontSize: '20px', fontWeight: '800' }}>Новинки музыки</h2>
                    <span className="section-subtitle">Последние интересные релизы и тренды</span>
                    
                    <div style={{ marginTop: '16px' }}>
                      {isLoadingTrends ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Загрузка новинок...
                        </div>
                      ) : yandexTrendsTracks.length > 0 ? (
                        <div className="albums-grid-retro">
                          {yandexTrendsTracks.map(album => {
                            let typeText = 'Альбом';
                            if (album.type === 'single') typeText = 'Сингл';
                            else if (album.type === 'ep') typeText = 'EP';
                            
                            const coverUrl = album.coverUri 
                              ? 'https://' + album.coverUri.replace('%%', '150x150')
                              : null;

                            const artistName = album.artists?.map(a => a.name).join(', ') || '';

                            return (
                              <div 
                                key={album.id} 
                                className="album-card-retro" 
                                onClick={() => loadAlbumTracks(album)}
                              >
                                {coverUrl ? (
                                  <img src={coverUrl} alt="" className="album-cover-retro" loading="lazy" />
                                ) : (
                                  <div className="album-no-cover-retro"><MusicNote size={24} /></div>
                                )}
                                <span className="album-title-retro" title={album.title}>{album.title}</span>
                                <span className="album-year-retro" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={artistName}>
                                    {artistName}
                                  </span>
                                  <span>{typeText} {album.year ? `• ${album.year}` : ''}</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Не удалось загрузить новинки
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {homeSubTab === 'chart' && (
                  <div className="home-section">
                    <h2 className="section-title" style={{ fontSize: '20px', fontWeight: '800' }}>Популярно сейчас</h2>
                    <span className="section-subtitle">Главный чарт Яндекс.Музыки</span>
                    
                    <div style={{ marginTop: '16px' }}>
                      {isLoadingChart ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Загрузка чарта...
                        </div>
                      ) : yandexChartTracks.length > 0 ? (
                        renderTrackTable(yandexChartTracks)
                      ) : (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Не удалось загрузить чарт
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {homeSubTab === 'genres' && (
                  <div className="home-section">
                    <h2 className="section-title" style={{ fontSize: '20px', fontWeight: '800' }}>Жанры и Эпохи</h2>
                    <span className="section-subtitle">Выбор радиостанции для бесконечного воспроизведения</span>
                    
                    <div className="retro-radio-grid" style={{ marginTop: '20px' }}>
                      {RADIO_STATIONS.map((station) => (
                        <div 
                          key={station.id} 
                          className="retro-radio-card"
                          style={{ '--accent-color': station.color }}
                          onClick={() => playMyWave(station.id)}
                        >
                          <div className="radio-card-accent-line"></div>
                          <div className="radio-card-body">
                            <span className="radio-play-icon">▶</span>
                            <div className="radio-text-info">
                              <h3 className="radio-station-title">{station.name}</h3>
                              <p className="radio-station-desc">{station.desc}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB: Search */}
            {activeTab === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Результаты поиска</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {isSearching ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Поиск...
                    </div>
                  ) : searchResults === null ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Введите запрос в поле поиска выше
                    </div>
                  ) : (
                    <>
                      {/* Section: Artists */}
                      {searchResults.artists && searchResults.artists.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Исполнители</h3>
                          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
                            {searchResults.artists.map(artist => (
                              <div 
                                key={artist.id} 
                                className="search-artist-card"
                                onClick={() => openArtistProfile(artist.id, artist.name)}
                              >
                                {artist.cover ? (
                                  <img src={artist.cover} alt="" className="search-artist-img" loading="lazy" />
                                ) : (
                                  <div className="search-artist-noimg"><User size={20} /></div>
                                )}
                                <span className="search-artist-name">{artist.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section: Tracks */}
                      {searchResults.tracks && searchResults.tracks.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Треки</h3>
                          {renderTrackTable(searchResults.tracks)}
                        </div>
                      )}

                      {/* Section: Albums */}
                      {searchResults.albums && searchResults.albums.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Альбомы</h3>
                          <div className="albums-grid-retro">
                            {searchResults.albums.map(album => (
                              <div key={album.id} className="album-card-retro" onClick={() => loadAlbumTracks(album)}>
                                {album.cover ? (
                                  <img src={album.cover} alt="" className="album-cover-retro" loading="lazy" />
                                ) : (
                                  <div className="album-no-cover-retro"><MusicNote size={20} /></div>
                                )}
                                <span className="album-title-retro" title={album.title}>{album.title}</span>
                                <span className="album-year-retro">{album.year}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {searchResults.tracks.length === 0 && searchResults.artists.length === 0 && searchResults.albums.length === 0 && (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Ничего не найдено
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB: Artist Profile */}
            {activeTab === 'artist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Back button */}
                <div style={{ marginBottom: '16px' }}>
                  <button 
                    onClick={() => {
                      if (activeAlbum && artistInfo) {
                        setActiveAlbum(null);
                        setAlbumTracks([]);
                      } else if (activeAlbum) {
                        setActiveTab(albumBackTab || 'home');
                        setActiveAlbum(null);
                        setAlbumTracks([]);
                      } else {
                        setActiveTab(artistBackTab || 'search');
                      }
                    }} 
                    className="glass-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                  >
                    ← Назад {activeAlbum ? (artistInfo ? 'к профилю' : 'назад') : 'назад'}
                  </button>
                </div>

                {isLoadingArtist ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Загрузка профиля исполнителя...
                  </div>
                ) : (activeAlbum || artistInfo) ? (
                  activeAlbum ? (
                    /* Album tracks detail view */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {activeAlbum.cover ? (
                          <img src={activeAlbum.cover} alt="" style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px solid var(--border-color)' }} loading="lazy" />
                        ) : activeAlbum.coverUri ? (
                          <img src={'https://' + activeAlbum.coverUri.replace('%%', '150x150')} alt="" style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px solid var(--border-color)' }} loading="lazy" />
                        ) : (
                          <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: 'var(--menu-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><MusicNote size={28} /></div>
                        )}
                        <div>
                          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>{activeAlbum.title}</h2>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Альбом {activeAlbum.year ? `• ${activeAlbum.year}` : ''}</p>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Исполнитель:{' '}
                            {activeAlbum.artists && activeAlbum.artists.length > 0 ? (
                              activeAlbum.artists.map((artist, idx) => (
                                <span key={artist.id || idx}>
                                  {idx > 0 && ', '}
                                  <span 
                                    className="clickable-artist-name"
                                    onClick={() => {
                                      if (artist.id) {
                                        openArtistProfile(artist.id, artist.name);
                                      }
                                    }}
                                    style={{ fontWeight: '700', color: 'var(--accent)', cursor: 'pointer' }}
                                  >
                                    {artist.name}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span 
                                className="clickable-artist-name"
                                onClick={() => {
                                  const singleArtist = activeAlbum.artists?.[0] || { id: null, name: activeAlbum.artist };
                                  if (singleArtist.id) {
                                    openArtistProfile(singleArtist.id, singleArtist.name);
                                  } else {
                                    // Fallback to text search
                                    setSearchQuery(activeAlbum.artist || '');
                                    setActiveTab('search');
                                    const searchFn = async () => {
                                      setIsSearching(true);
                                      try {
                                        const res = await fetch(`/api/search?q=${encodeURIComponent(activeAlbum.artist || '')}`);
                                        if (res.ok) {
                                          const data = await res.json();
                                          setSearchResults({ tracks: data.items.map(item => ({
                                            id: `yt-${item.videoId}`,
                                            title: item.title,
                                            artist: item.author,
                                            cover: item.thumbnail,
                                            url: `https://www.youtube.com/watch?v=${item.videoId}`,
                                            type: 'youtube',
                                            duration: item.duration
                                          })), artists: [], albums: [] });
                                        }
                                      } catch (err) {
                                        console.error(err);
                                      } finally {
                                        setIsSearching(false);
                                      }
                                    };
                                    searchFn();
                                  }
                                }}
                                style={{ fontWeight: '700', color: 'var(--accent)', cursor: 'pointer' }}
                              >
                                {activeAlbum.artist || 'Неизвестный исполнитель'}
                              </span>
                            )}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                            <button 
                              className="glass-btn accent" 
                              style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px' }}
                              onClick={() => addAllToQueueAndPlay(albumTracks)}
                              disabled={albumTracks.length === 0}
                            >
                              <Play size={14} weight="fill" /> Слушать
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        {isLoadingAlbumTracks ? (
                          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка треков альбома...</div>
                        ) : albumLoadError ? (
                          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
                            <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Не удалось загрузить треки альбома</p>
                            <p style={{ fontSize: '13px' }}>Яндекс.Музыка заблокировала этот запрос. Пожалуйста, убедитесь, что вы авторизовались в Яндекс.Музыке в настройках.</p>
                          </div>
                        ) : (
                          renderTrackTable(albumTracks)
                        )}
                      </div>
                    </div>
                  ) : artistInfo.error ? (
                    /* Fallback message for error profiles */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div className="artist-header-retro">
                        <div className="artist-no-cover-large"><User size={48} /></div>
                        <div className="artist-details-text">
                          <h1 className="artist-name-title">{artistInfo.artist?.name || currentArtistName || 'Исполнитель'}</h1>
                          <p className="artist-meta-info" style={{ color: '#ff8a8a', fontWeight: 'bold' }}>
                            Информация об исполнителе недоступна без авторизации Яндекс.Музыки.
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ padding: '32px', textAlign: 'center', background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '450px' }}>
                          Яндекс.Музыка ограничивает доступ к профилям исполнителей для неавторизованных пользователей.
                          Вы можете попробовать найти его треки напрямую через поиск.
                        </p>
                        <button 
                          className="glass-btn accent"
                          onClick={() => {
                            const query = artistInfo.artist?.name || currentArtistName;
                            setSearchQuery(query);
                            setActiveTab('search');
                            const runSearch = async () => {
                              setIsSearching(true);
                              try {
                                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                                if (res.ok) {
                                  const data = await res.json();
                                  setSearchResults({ tracks: data.items.map(item => ({
                                    id: `yt-${item.videoId}`,
                                    title: item.title,
                                    artist: item.author,
                                    cover: item.thumbnail,
                                    url: `https://www.youtube.com/watch?v=${item.videoId}`,
                                    type: 'youtube',
                                    duration: item.duration
                                  })), artists: [], albums: [] });
                                }
                              } catch(err) {
                                console.error(err);
                              } finally {
                                setIsSearching(false);
                              }
                            };
                            runSearch();
                          }}
                          style={{ padding: '8px 20px', borderRadius: '20px' }}
                        >
                          Искать треки {artistInfo.artist?.name || currentArtistName}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Main artist profile content */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div className="artist-header-retro">
                        {artistInfo.artist?.cover?.uri ? (
                          <img 
                            src={'https://' + artistInfo.artist.cover.uri.replace('%%', '400x400')} 
                            alt="" 
                            className="artist-cover-large" 
                            loading="lazy"
                          />
                        ) : (
                          <div className="artist-no-cover-large"><User size={48} /></div>
                        )}
                        <div className="artist-details-text">
                          <h1 className="artist-name-title">{artistInfo.artist?.name}</h1>
                          <p className="artist-meta-info">
                            {artistInfo.artist?.genres?.join(', ')}
                            {artistInfo.stats?.likesCount ? ` • ${artistInfo.stats.likesCount.toLocaleString()} лайков` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Section: Popular Tracks */}
                      {artistInfo.popularTracks && artistInfo.popularTracks.length > 0 && (
                        <div>
                          <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Популярные треки</h2>
                          {renderTrackTable(artistInfo.popularTracks.map(mapYandexTrack))}
                        </div>
                      )}

                      {/* Section: Main Releases (Albums) */}
                      {artistInfo.albums && artistInfo.albums.length > 0 && (
                        <div>
                          <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Релизы и Альбомы</h2>
                          <div className="albums-grid-retro">
                            {artistInfo.albums.map(album => (
                              <div key={album.id} className="album-card-retro" onClick={() => loadAlbumTracks(album)}>
                                {album.coverUri ? (
                                  <img src={'https://' + album.coverUri.replace('%%', '400x400')} alt="" className="album-cover-retro" loading="lazy" />
                                ) : (
                                  <div className="album-no-cover-retro"><MusicNote size={24} /></div>
                                )}
                                <span className="album-title-retro" title={album.title}>{album.title}</span>
                                <span className="album-year-retro">{album.year}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section: Feats & Collaborations (alsoAlbums) */}
                      {artistInfo.alsoAlbums && artistInfo.alsoAlbums.length > 0 && (
                        <div>
                          <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Совместные треки и сборники (Фиты)</h2>
                          <div className="albums-grid-retro">
                            {artistInfo.alsoAlbums.map(album => (
                              <div key={album.id} className="album-card-retro" onClick={() => loadAlbumTracks(album)}>
                                {album.coverUri ? (
                                  <img src={'https://' + album.coverUri.replace('%%', '400x400')} alt="" className="album-cover-retro" loading="lazy" />
                                ) : (
                                  <div className="album-no-cover-retro"><MusicNote size={24} /></div>
                                )}
                                <span className="album-title-retro" title={album.title}>{album.title}</span>
                                <span className="album-year-retro">{album.year}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Не удалось загрузить информацию об исполнителе
                  </div>
                )}
              </div>
            )}

            {/* TAB: Podcasts & Books */}
            {activeTab === 'podcasts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                <BookOpen size={48} color="var(--accent)" />
                <h3 style={{ color: 'var(--text-main)', marginTop: '16px', fontSize: '18px' }}>Подкасты и книги</h3>
                <p style={{ fontSize: '14px', maxWidth: '300px', lineHeight: '1.5', marginTop: '8px' }}>
                  Здесь будут собираться ваши любимые подкасты, аудиошоу и книги. Раздел находится в разработке.
                </p>
              </div>
            )}

            {/* TAB: Queue */}
            {activeTab === 'queue' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span className="text-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Очередь воспроизведения
                </span>
                
                <div>
                  {queue.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Очередь пуста.
                    </div>
                  ) : (
                    renderTrackTable(queue)
                  )}
                </div>
              </div>
            )}

            {/* TAB: Collection */}
            {activeTab === 'collection' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <span 
                    onClick={() => {
                      setCollectionSubTab('likes');
                      setActiveYandexPlaylist(null);
                    }}
                    style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: collectionSubTab === 'likes' && !activeYandexPlaylist ? 'var(--accent)' : 'var(--text-muted)', 
                      cursor: 'pointer' 
                    }}
                  >
                    Мои лайки
                  </span>
                  <span 
                    onClick={() => {
                      setCollectionSubTab('playlists');
                      setActiveYandexPlaylist(null);
                    }}
                    style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: collectionSubTab === 'playlists' || activeYandexPlaylist ? 'var(--accent)' : 'var(--text-muted)', 
                      cursor: 'pointer' 
                    }}
                  >
                    Плейлисты
                  </span>
                </div>

                {/* Sub Tab: Likes */}
                {collectionSubTab === 'likes' && !activeYandexPlaylist && (
                  <div>
                    {yandexToken ? (
                      yandexLikes.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                          Любимые треки в Яндекс.Музыке не найдены.
                        </div>
                      ) : (
                        renderTrackTable(yandexLikes)
                      )
                    ) : (
                      likedTracks.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                          У вас нет лайкнутых треков.
                        </div>
                      ) : (
                        renderTrackTable(likedTracks)
                      )
                    )}
                  </div>
                )}

                {/* Sub Tab: Playlists */}
                {(collectionSubTab === 'playlists' || activeYandexPlaylist) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeYandexPlaylist ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)' }}>{activeYandexPlaylist.title}</span>
                          <button 
                            onClick={() => setActiveYandexPlaylist(null)} 
                            className="glass-btn" 
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            Назад
                          </button>
                        </div>

                        {isLoadingTracks ? (
                          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Загрузка треков...
                          </div>
                        ) : (
                          <div>
                            {renderTrackTable(playlistTracks)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {yandexPlaylists.map((playlist) => (
                          <div 
                            key={playlist.playlistUuid}
                            onClick={() => loadYandexPlaylistTracks(playlist)}
                            className="track-item-card"
                          >
                            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Playlist size={20} color="var(--accent)" />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <h4 style={{ fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {playlist.title}
                              </h4>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Треков: {playlist.trackCount}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Settings & Appearance */}
            {activeTab === 'settings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <span className="text-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Настройки приложения
                </span>

                {/* Dynamic Theme Switcher */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>Тема оформления</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => {
                        setTheme('dark');
                        localStorage.setItem('yandex_music_theme', 'dark');
                      }} 
                      className={`glass-btn ${theme === 'dark' ? 'accent' : ''}`}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px' }}
                    >
                      Тёмная тема
                    </button>
                    <button 
                      onClick={() => {
                        setTheme('light');
                        localStorage.setItem('yandex_music_theme', 'light');
                      }} 
                      className={`glass-btn ${theme === 'light' ? 'accent' : ''}`}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px' }}
                    >
                      Светлая тема
                    </button>
                  </div>
                </div>
                {/* Background Wallpaper Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>Фоновые обои</span>
                  
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {/* Left Column: Custom Wallpaper Selection */}
                    <div style={{ flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Свои обои</span>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label 
                          className="glass-btn accent" 
                          style={{ flex: 1, padding: '10px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', fontSize: '13px' }}
                        >
                          Выбрать файл...
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleWallpaperChange} 
                            style={{ display: 'none' }} 
                          />
                        </label>
                        
                        {(customWallpaper || presetWallpaper) && (
                          <button 
                            onClick={handleResetWallpaper} 
                            className="glass-btn" 
                            style={{ padding: '10px 14px', borderRadius: '12px', borderColor: '#ef4444', color: '#f87171', fontSize: '13px' }}
                            title="Сбросить все обои"
                          >
                            Сбросить
                          </button>
                        )}
                      </div>

                      {customWallpaper && (
                        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', height: '90px' }}>
                          <img 
                            src={customWallpaper} 
                            alt="Предпросмотр обоев" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        </div>
                      )}
                    </div>

                    {/* Right Column: Preset Themes */}
                    <div style={{ flex: '1.5', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Предустановленные темы</span>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {PRESET_WALLPAPERS.map((wp) => {
                          const isActive = presetWallpaper === wp.url;
                          return (
                            <div 
                              key={wp.id}
                              onClick={() => handlePresetSelect(wp.url)}
                              style={{
                                aspectRatio: '16/10',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: isActive ? '2px solid #ffd700' : '1px solid var(--border-color)',
                                boxShadow: isActive ? '0 0 10px rgba(255, 215, 0, 0.4)' : 'none',
                                position: 'relative',
                                transition: 'transform 0.2s, border-color 0.2s',
                                background: wp.url === '#000000' ? '#000000' : 'none'
                              }}
                              title={wp.name}
                              className="preset-wp-card"
                            >
                              {wp.url !== '#000000' ? (
                                <img src={wp.url} alt={wp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000000' }}>
                                  <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase' }}>Black</span>
                                </div>
                              )}
                              <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'rgba(0,0,0,0.6)',
                                padding: '2px 4px',
                                fontSize: '9px',
                                color: '#fff',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {wp.name}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Standard Gradient Option */}
                        <div 
                          onClick={() => {
                            setPresetWallpaper('');
                            localStorage.removeItem('yandex_music_preset_wallpaper');
                          }}
                          style={{
                            aspectRatio: '16/10',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: (!customWallpaper && !presetWallpaper) ? '2px solid #ffd700' : '1px solid var(--border-color)',
                            boxShadow: (!customWallpaper && !presetWallpaper) ? '0 0 10px rgba(255, 215, 0, 0.4)' : 'none',
                            background: 'linear-gradient(135deg, #1e1e24 0%, #111115 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            transition: 'transform 0.2s'
                          }}
                          title="Стандартный градиент"
                          className="preset-wp-card"
                        >
                          <span style={{ fontSize: '9px', color: '#888', fontWeight: '600', textTransform: 'uppercase' }}>Стандарт</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>Авторизация Яндекс.Музыки</span>

                  {yandexUser ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="glass-panel" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: 'var(--text-main)' }}>
                          <User size={18} color="var(--accent)" /> {yandexUser.login}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          UID аккаунта: {yandexUser.uid}
                        </span>
                        <span style={{ 
                          fontSize: '12px', 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          background: yandexUser.hasPlus ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', 
                          color: yandexUser.hasPlus ? '#22c55e' : '#f87171',
                          alignSelf: 'flex-start',
                          fontWeight: '600'
                        }}>
                          {yandexUser.hasPlus ? 'Яндекс Плюс: Активен' : 'Яндекс Плюс: Не найден'}
                        </span>
                      </div>

                      <button onClick={handleYandexLogout} className="glass-btn" style={{ borderColor: '#ef4444', color: '#f87171' }}>
                        Выйти из аккаунта
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {authState === 'idle' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            Для безопасного и автоматического входа нажмите кнопку ниже. Плеер выдаст короткий код, который нужно подтвердить на сайте Яндекса.
                          </span>
                          <button onClick={startDeviceAuth} className="glass-btn accent" style={{ padding: '14px', borderRadius: '12px' }}>
                            Войти через Яндекс.ID
                          </button>
                        </div>
                      )}

                      {authState === 'requesting' && (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                          Получение подтверждения...
                        </div>
                      )}

                      {authState === 'pending' && deviceCodeInfo && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div className="glass-panel" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', textAlign: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                              Код подтверждения:
                            </span>
                            <span className="text-mono" style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '0.1em' }}>
                              {deviceCodeInfo.user_code}
                            </span>
                          </div>

                          <a 
                            href={deviceCodeInfo.verification_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="glass-btn accent"
                            style={{ textDecoration: 'none', padding: '12px', textAlign: 'center', borderRadius: '12px' }}
                          >
                            Открыть страницу ввода кода
                          </a>

                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
                            Перейдите по ссылке выше и введите код. Это окно обновится автоматически сразу после подтверждения.
                          </span>

                          <button onClick={cancelDeviceAuth} className="glass-btn" style={{ borderColor: 'var(--border-color)' }}>
                            Отмена
                          </button>
                        </div>
                      )}

                      {authState === 'error' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                          <span style={{ color: '#ef4444', fontSize: '13px' }}>
                            Время ожидания истекло или произошла ошибка.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Right Column (Queue area) */}
          {showQueueSidebar && (
            <div className="main-right-column">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                <h3 className="sidebar-section-title" style={{ margin: 0 }}>Очередь воспроизведения</h3>
                <button 
                  onClick={() => setShowQueueSidebar(false)} 
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    lineHeight: '1',
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => e.target.style.color = 'var(--text-main)'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                  title="Скрыть queue"
                >
                  &times;
                </button>
              </div>
              <div className="sidebar-queue-list">
                {queue.length === 0 ? (
                  <div className="sidebar-empty-queue">Очередь пуста</div>
                ) : (
                  queue.map((track, idx) => {
                    const isCurrent = activeTrack.id === track.id;
                    return (
                      <div 
                        key={`${track.id}-${idx}`}
                        onClick={() => playTrack(track, !!activeRadioStation)}
                        className={`sidebar-queue-item-glass ${isCurrent ? 'active' : ''}`}
                      >
                        {track.cover ? (
                          <img src={track.cover} alt="" className="queue-item-cover-glass" loading="lazy" />
                        ) : (
                          <div className="queue-item-no-cover-glass">
                            <MusicNote size={16} />
                          </div>
                        )}
                        
                        <div className="queue-item-meta-glass">
                          <span className="queue-item-title-glass" style={isCurrent ? { color: 'var(--accent)' } : undefined}>
                            {track.title}
                          </span>
                          <span className="queue-item-artist-glass">
                            {track.artist}
                          </span>
                        </div>
                        
                        <span className="queue-item-arrow-glass">
                          &gt;
                        </span>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(track.id, e);
                          }} 
                          className="queue-item-remove-glass"
                          title="Удалить"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>

        {/* FULL WIDTH BOTTOM PLAYER BAR GLOW (RENDERED BEHIND TO AVOID BACKDROP-FILTER PERFORMANCE LOSS) */}
        <div className="player-glow-wrapper">
          <div 
            ref={playerLeftGlowRef}
            className="player-left-glow" 
            style={{ 
              '--progress': duration > 0 ? (currentTime / duration) * 100 : 0, 
              '--player-glow-color': playerGlowColor 
            }} 
          />
        </div>

        {/* FULL WIDTH BOTTOM PLAYER BAR */}
        <div className="bottom-player-full" style={{ overflow: 'visible' }}>
          <div className="player-controls-container">
            
            {/* Left Column: Cover, Title, Artist, PlusCircle button */}
            <div className="player-left-group">
              {activeTrack.cover ? (
                <img 
                  onClick={() => {
                    if (activeTrack.id !== 'empty') {
                      if (activeTrack.album && activeTrack.album.id) {
                        loadAlbumTracks(activeTrack.album);
                      } else if (activeTrack.title) {
                        setSearchQuery(activeTrack.title);
                        setActiveTab('search');
                      }
                    }
                  }}
                  src={activeTrack.cover} 
                  alt="" 
                  className="player-track-img-classic clickable-player-cover" 
                />
              ) : (
                <div className="player-track-noimg-classic">
                  <MusicNote size={22} />
                </div>
              )}
              <div className="player-track-details-classic">
                <span 
                  onClick={() => {
                    if (activeTrack.id !== 'empty') {
                      if (activeTrack.album && activeTrack.album.id) {
                        loadAlbumTracks(activeTrack.album);
                      } else if (activeTrack.title) {
                        setSearchQuery(activeTrack.title);
                        setActiveTab('search');
                      }
                    }
                  }}
                  className="player-track-name-classic" 
                  title={activeTrack.title} 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {activeTrack.id === 'empty' ? '' : activeTrack.title}
                  {activeTrack.explicit && (
                    <span className="explicit-badge-small" title="Возрастное ограничение 18+">18+</span>
                  )}
                </span>
                <span className="player-track-artist-classic" title={activeTrack.artist}>
                  {activeTrack.id === 'empty' ? '' : (
                    activeTrack.artists && activeTrack.artists.length > 0 ? (
                      activeTrack.artists.map((artist, idx) => (
                        <span key={artist.id || idx}>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (artist.id) {
                                openArtistProfile(artist.id, artist.name);
                              } else {
                                setSearchQuery(artist.name);
                                setActiveTab('search');
                              }
                            }}
                            className="player-artist-link"
                          >
                            {artist.name}
                          </span>
                          {idx < activeTrack.artists.length - 1 ? ', ' : ''}
                        </span>
                      ))
                    ) : (
                      <span 
                        onClick={() => {
                          setSearchQuery(activeTrack.artist);
                          setActiveTab('search');
                        }}
                        className="player-track-artist-clickable"
                      >
                        {activeTrack.artist}
                      </span>
                    )
                  )}
                </span>
              </div>
              <button 
                onClick={(e) => toggleLike(activeTrack, e)} 
                className="player-action-btn-classic" 
                title={isTrackLiked(activeTrack) ? "Убрать из коллекции" : "Добавить в коллекцию"}
              >
                <PlusCircle size={20} weight={isTrackLiked(activeTrack) ? "fill" : "regular"} />
              </button>
              {activeTrack && activeTrack.type === 'yandex' && activeRadioStation && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTrack.yandexId) {
                      sendRadioFeedback('dislike', activeTrack.yandexId, activeTrack.playIdentifier);
                    }
                    handleNext();
                  }} 
                  className="player-action-btn-classic dislike-btn-bottom" 
                  title="Не рекомендовать (Дизлайк)"
                >
                  <HeartBreak size={20} />
                </button>
              )}
            </div>

            {/* Center Column: Playback Controls + Linear Seekbar */}
            <div className="player-center-group">
              {/* Playback Controls Row */}
              <div className="player-playback-controls-row">
                <button 
                  onClick={() => alert('Перемешивание в разработке')} 
                  className="player-control-icon-classic" 
                  title="Перемешать"
                >
                  <Shuffle size={18} />
                </button>

                <button onClick={handlePrev} className="player-control-icon-classic" title="Предыдущий трек">
                  <SkipBack size={20} weight="fill" />
                </button>
                
                <button 
                  onClick={togglePlay} 
                  className="player-play-pause-btn-circle" 
                  title={isPlaying ? "Пауза" : "Воспроизвести"}
                >
                  {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" style={{ marginLeft: '-2px' }} />}
                </button>

                <button onClick={handleNext} className="player-control-icon-classic" title="Следующий трек">
                  <SkipForward size={20} weight="fill" />
                </button>

                <button 
                  onClick={() => setIsRepeating(!isRepeating)} 
                  className={`player-control-icon-classic ${isRepeating ? 'active' : ''}`}
                  title={isRepeating ? "Повтор включен" : "Повторить"}
                >
                  <Repeat size={18} />
                </button>
              </div>

              {/* Linear Timeline Seekbar */}
              <div className="player-seekbar-container">
                <span ref={playerTimeLabelRef} className="player-time-label current-time">{formatTime(currentTime)}</span>
                <div className="player-seekbar-slider-wrapper">
                  <input 
                    ref={playerSeekbarSliderRef}
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="any"
                    defaultValue={0}
                    onChange={handleSeek}
                    onMouseDown={() => { isSeekingRef.current = true; }}
                    onMouseUp={() => { isSeekingRef.current = false; }}
                    onTouchStart={() => { isSeekingRef.current = true; }}
                    onTouchEnd={() => { isSeekingRef.current = false; }}
                    className="player-seekbar-slider"
                  />
                  <div 
                    ref={playerProgressRef}
                    className="player-seekbar-progress" 
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <span className="player-time-label total-duration">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right group: volume, queue list toggle, additional actions */}
            <div className="player-right-group-classic">
              <button 
                onClick={() => setShowLyricsModal(true)} 
                className="player-right-icon-btn" 
                title="Текст песни"
              >
                <Microphone size={18} />
              </button>

              <button 
                onClick={() => setShowQueueSidebar(!showQueueSidebar)}
                className={`player-right-icon-btn queue-toggle-btn ${showQueueSidebar ? 'active' : ''}`}
                title="Очередь воспроизведения"
              >
                <List size={18} />
              </button>

              <div className="player-track-menu-container">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenTrackId(menuOpenTrackId === 'player' ? null : 'player');
                  }} 
                  className={`player-right-icon-btn ${menuOpenTrackId === 'player' ? 'active' : ''}`}
                  title="Опции трека"
                >
                  <DotsThreeVertical size={18} weight="bold" />
                </button>
                {menuOpenTrackId === 'player' && renderTrackMenu(activeTrack, 'up')}
              </div>

              <div className="player-volume-container">
                <button 
                  onClick={() => setIsMuted(!isMuted)} 
                  className="player-volume-btn"
                  title="Громкость"
                >
                  {isMuted || volume === 0 ? <SpeakerX size={18} /> : <SpeakerHigh size={18} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01"
                  value={isMuted ? 0 : volume} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (isMuted) setIsMuted(false);
                  }} 
                  className="player-volume-slider"
                />
              </div>

              <button 
                onClick={() => setIsFullscreenPlayer(true)} 
                className="player-right-icon-btn" 
                title="Полноэкранный режим"
              >
                <ArrowsOutSimple size={18} />
              </button>
            </div>

          </div>
        </div>

        {/* LYRICS MODAL */}
        {showLyricsModal && (
          <div className="lyrics-modal-overlay" onClick={() => setShowLyricsModal(false)}>
            <div className="lyrics-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="lyrics-modal-header">
                <div className="lyrics-track-info">
                  <h3 className="lyrics-track-title">{activeTrack.title}</h3>
                  <p className="lyrics-track-artist">{activeTrack.artist}</p>
                </div>
                <button className="lyrics-modal-close" onClick={() => setShowLyricsModal(false)}>
                  &times;
                </button>
              </div>
              <div className="lyrics-modal-body">
                {isLoadingLyrics ? (
                  <div className="lyrics-loading">
                    <div className="lyrics-loading-spinner" />
                    <span>Загрузка текста песни...</span>
                  </div>
                ) : parsedLyrics ? (
                  <div className="lyrics-lines-container">
                    {parsedLyrics.map((line, idx) => {
                      const isActive = idx === activeLineIndex;
                      return (
                        <button
                          key={idx}
                          ref={isActive ? activeLineRef : null}
                          className={`lyrics-line-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleLineClick(line.time)}
                        >
                          {line.text}
                        </button>
                      );
                    })}
                  </div>
                ) : lyricsText ? (
                  <div className="lyrics-static-container">
                    {lyricsText.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <div key={idx} className="lyrics-static-spacer" />;
                      return (
                        <div key={idx} className="lyrics-static-line">
                          {trimmed}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Текст песни отсутствует
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* FULLSCREEN TRACK PLAYER OVERLAY */}
      {isFullscreenPlayer && (
        <div className="fullscreen-player-overlay" style={{ backgroundColor: fullscreenBgColor }}>
          {/* Ambient center glow to prevent gradient banding */}
          <div className="fullscreen-ambient-glow" style={{ background: playerGlowColor }} />
          {/* Close button at top right */}
          <button 
            className="fullscreen-close-btn" 
            onClick={() => {
              setIsFullscreenPlayer(false);
              setShowFullscreenQueue(false);
              setShowFullscreenLyrics(false);
            }} 
            title="Свернуть"
          >
            <svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor">
              <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80a8,8,0,0,1,11.32-11.32L128,164.69l74.34-74.34a8,8,0,0,1,11.32,11.32Z"/>
            </svg>
          </button>

          {(showFullscreenQueue || showFullscreenLyrics) ? (
            /* SPLIT LAYOUT MODE (Очередь или Текст песни в полноэкранном режиме) */
            <div className="fullscreen-split-layout">
              {/* Left Column: Minimised Player */}
              <div className="split-left-pane">
                <div className="split-cover-wrapper fullscreen-cover-wrapper">
                  {activeTrack.cover ? (
                    <img src={activeTrack.cover} alt="" className="split-cover-img fullscreen-cover-img" />
                  ) : (
                    <div className="split-cover-placeholder fullscreen-cover-placeholder">
                      <MusicNote size={64} />
                    </div>
                  )}
                  
                  {/* Hover overlay controls in split mode */}
                  <div className="fullscreen-cover-overlay">
                    {/* Top Left Volume Control inside cover */}
                    <div className="fullscreen-volume-container btn-top-left-volume">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} 
                        className="fullscreen-overlay-btn"
                        title="Громкость"
                      >
                        {isMuted || volume === 0 ? <SpeakerX size={22} /> : <SpeakerHigh size={22} />}
                      </button>
                      <div className="fullscreen-volume-slider-wrapper">
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.01"
                          value={isMuted ? 0 : volume} 
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVolume(val);
                            if (isMuted) setIsMuted(false);
                          }} 
                          onClick={(e) => e.stopPropagation()}
                          className="fullscreen-volume-slider"
                        />
                      </div>
                    </div>

                    {/* Top Right Buttons: Queue & Lyrics */}
                    <button 
                      className={`fullscreen-overlay-btn ${showFullscreenQueue ? 'active' : ''}`}
                      style={{ position: 'absolute', top: '20px', right: '20px' }}
                      onClick={() => {
                        setShowFullscreenQueue(!showFullscreenQueue);
                        setShowFullscreenLyrics(false);
                      }} 
                      title={showFullscreenQueue ? "Скрыть очередь" : "Очередь воспроизведения"}
                    >
                      <List size={22} />
                    </button>

                    <button 
                      className={`fullscreen-overlay-btn ${showFullscreenLyrics ? 'active' : ''}`}
                      style={{ position: 'absolute', top: '20px', right: '74px' }}
                      onClick={() => {
                        const newShow = !showFullscreenLyrics;
                        setShowFullscreenLyrics(newShow);
                        setShowFullscreenQueue(false);
                        if (newShow) {
                          fetchLyrics(activeTrack, false);
                        }
                      }} 
                      title={showFullscreenLyrics ? "Скрыть текст" : "Текст песни"}
                    >
                      <Microphone size={22} />
                    </button>

                    {/* Centered playback control buttons */}
                    <div className="fullscreen-center-row-wrapper">
                      <div className="fullscreen-center-row">
                        <button className="fullscreen-control-icon" onClick={handlePrev} title="Предыдущий трек">
                          <SkipBack size={24} weight="fill" />
                        </button>

                        <button 
                          onClick={togglePlay} 
                          className="fullscreen-play-btn split-play-btn" 
                          title={isPlaying ? "Пауза" : "Воспроизвести"}
                        >
                          {isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" style={{ marginLeft: '-2px' }} />}
                        </button>

                        <button className="fullscreen-control-icon" onClick={handleNext} title="Следующий трек">
                          <SkipForward size={24} weight="fill" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Left More Button */}
                    <div style={{ position: 'absolute', width: '44px', height: '44px' }} className="btn-bottom-left">
                      <button 
                        className="fullscreen-overlay-btn" 
                        style={{ position: 'static' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenTrackId(menuOpenTrackId === 'fullscreen-split' ? null : 'fullscreen-split');
                        }} 
                        title="Еще"
                      >
                        <DotsThreeVertical size={20} weight="bold" />
                      </button>
                      {menuOpenTrackId === 'fullscreen-split' && renderTrackMenu(activeTrack, 'left')}
                    </div>

                    {/* Bottom Right Like/Heart Button */}
                    <button 
                      className="fullscreen-overlay-btn btn-bottom-right" 
                      onClick={(e) => toggleLike(activeTrack, e)} 
                      title={isTrackLiked(activeTrack) ? "Убрать из коллекции" : "Добавить в коллекцию"}
                      style={{ right: activeTrack && activeTrack.type === 'yandex' && activeRadioStation ? '74px' : '20px' }}
                    >
                      <Heart size={20} weight={isTrackLiked(activeTrack) ? 'fill' : 'regular'} color={isTrackLiked(activeTrack) ? '#f83e3e' : '#ffffff'} />
                    </button>
                    {activeTrack && activeTrack.type === 'yandex' && activeRadioStation && (
                      <button 
                        className="fullscreen-overlay-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeTrack.yandexId) {
                            sendRadioFeedback('dislike', activeTrack.yandexId, activeTrack.playIdentifier);
                          }
                          handleNext();
                        }} 
                        title="Не рекомендовать (Дизлайк)"
                        style={{ position: 'absolute', bottom: '20px', right: '20px' }}
                      >
                        <HeartBreak size={20} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="split-track-info">
                  <h2 
                    className={`split-track-title ${activeTrack.album && activeTrack.album.id ? 'clickable-title' : ''}`}
                    onClick={() => {
                      if (activeTrack.album && activeTrack.album.id) {
                        loadAlbumTracks(activeTrack.album);
                        setIsFullscreenPlayer(false);
                        setShowFullscreenQueue(false);
                      }
                    }}
                  >
                    {activeTrack.id === 'empty' ? 'Нет трека' : activeTrack.title}
                  </h2>
                  <p className="split-track-artist">
                    {activeTrack.id === 'empty' ? (
                      'Выберите трек'
                    ) : activeTrack.artists && activeTrack.artists.length > 0 ? (
                      activeTrack.artists.map((artist, artistIdx) => (
                        <span key={artist.id || artistIdx}>
                          <span 
                            className={artist.id ? 'clickable-artist' : ''} 
                            onClick={() => {
                              if (artist.id) {
                                openArtistProfile(artist.id, artist.name);
                                setIsFullscreenPlayer(false);
                                setShowFullscreenQueue(false);
                              }
                            }}
                          >
                            {artist.name}
                          </span>
                          {artistIdx < activeTrack.artists.length - 1 ? ', ' : ''}
                        </span>
                      ))
                    ) : (
                      activeTrack.artist
                    )}
                  </p>
                </div>
                <div className="split-progress-container">
                  <div className="split-seekbar-slider-wrapper">
                    <input 
                      ref={splitSeekbarSliderRef}
                      type="range"
                      min="0"
                      max={duration || 0}
                      step="any"
                      defaultValue={0}
                      onChange={handleSeek}
                      onMouseDown={() => { isSeekingRef.current = true; }}
                      onMouseUp={() => { isSeekingRef.current = false; }}
                      onTouchStart={() => { isSeekingRef.current = true; }}
                      onTouchEnd={() => { isSeekingRef.current = false; }}
                      className="split-seekbar-slider"
                    />
                    <div 
                      ref={splitProgressRef}
                      className="split-seekbar-progress" 
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Queue list or Lyrics */}
              <div className="split-right-pane">
                {showFullscreenQueue ? (
                  <div className="split-queue-container">
                    {/* Previously played tracks */}
                    {(() => {
                      const currentIndex = queue.findIndex(t => t.id === activeTrack.id);
                      const playedTracks = currentIndex !== -1 ? queue.slice(0, currentIndex) : [];
                      const currentQueueTrack = currentIndex !== -1 ? queue[currentIndex] : activeTrack;
                      const upcomingTracks = currentIndex !== -1 ? queue.slice(currentIndex + 1) : queue;

                      return (
                        <>
                          {playedTracks.map((track, idx) => (
                            <div key={`played-${track.id}-${idx}`} className="split-queue-item played-track" onClick={() => playTrack(track, !!activeRadioStation)}>
                              <div className="split-queue-item-left">
                                {track.cover ? (
                                  <img src={track.cover} alt="" className="split-queue-track-img" />
                                ) : (
                                  <div className="split-queue-track-noimg"><MusicNote size={14} /></div>
                                )}
                                <div className="split-queue-track-details">
                                  <span className="split-queue-track-name">
                                    {track.title}
                                    {track.explicit && (
                                      <span className="split-info-icon explicit" title="Возрастное ограничение 18+" onClick={(e) => e.stopPropagation()}>!</span>
                                    )}
                                  </span>
                                  <span className="split-queue-track-artist">{track.artist}</span>
                                </div>
                              </div>
                              <div className="split-queue-item-right">
                                <button 
                                  className="split-queue-like-btn" 
                                  onClick={(e) => { e.stopPropagation(); toggleLike(track, e); }}
                                  title={isTrackLiked(track) ? "Убрать из коллекции" : "Добавить в коллекцию"}
                                >
                                  <Heart size={16} weight={isTrackLiked(track) ? 'fill' : 'regular'} color={isTrackLiked(track) ? '#f83e3e' : 'rgba(255,255,255,0.6)'} />
                                </button>
                                <span className="split-queue-track-duration">{formatTime(track.duration || 0)}</span>
                              </div>
                            </div>
                          ))}

                          {/* Currently playing header and track */}
                          <div className="split-queue-section-header">Сейчас играет</div>
                          <div className="split-queue-source-name">{getQueueSourceName()}</div>
                          
                          {currentQueueTrack && (
                            <div className="split-queue-item active-track" onClick={() => togglePlay()}>
                              <div className="split-queue-item-left">
                                <button className="split-queue-play-pause-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                                  {isPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" style={{ marginLeft: '-1px' }} />}
                                </button>
                                <div className="split-queue-track-details">
                                  <span className="split-queue-track-name">
                                    {currentQueueTrack.title}
                                    {currentQueueTrack.explicit && (
                                      <span className="split-info-icon explicit" title="Возрастное ограничение 18+" onClick={(e) => e.stopPropagation()}>!</span>
                                    )}
                                  </span>
                                  <span className="split-queue-track-artist">{currentQueueTrack.artist}</span>
                                </div>
                              </div>
                              <div className="split-queue-item-right">
                                <button 
                                  className="split-queue-like-btn" 
                                  onClick={(e) => { e.stopPropagation(); toggleLike(currentQueueTrack, e); }}
                                  title={isTrackLiked(currentQueueTrack) ? "Убрать из коллекции" : "Добавить в коллекцию"}
                                >
                                  <Heart size={16} weight={isTrackLiked(currentQueueTrack) ? 'fill' : 'regular'} color={isTrackLiked(currentQueueTrack) ? '#f83e3e' : 'rgba(255,255,255,0.6)'} />
                                </button>
                                <span className="split-queue-track-duration">{formatTime(currentQueueTrack.duration || 0)}</span>
                              </div>
                            </div>
                          )}

                          {/* Upcoming tracks */}
                          {upcomingTracks.length > 0 && (
                            <>
                              <div className="split-queue-section-header">Далее в очереди</div>
                              {upcomingTracks.map((track, idx) => (
                                <div key={`upcoming-${track.id}-${idx}`} className="split-queue-item" onClick={() => playTrack(track, !!activeRadioStation)}>
                                  <div className="split-queue-item-left">
                                    {track.cover ? (
                                      <img src={track.cover} alt="" className="split-queue-track-img" />
                                    ) : (
                                      <div className="split-queue-track-noimg"><MusicNote size={14} /></div>
                                    )}
                                    <div className="split-queue-track-details">
                                      <span className="split-queue-track-name">
                                        {track.title}
                                        {track.explicit && (
                                          <span className="split-info-icon explicit" title="Возрастное ограничение 18+" onClick={(e) => e.stopPropagation()}>!</span>
                                        )}
                                      </span>
                                      <span className="split-queue-track-artist">{track.artist}</span>
                                    </div>
                                  </div>
                                  <div className="split-queue-item-right">
                                    <button 
                                      className="split-queue-like-btn" 
                                      onClick={(e) => { e.stopPropagation(); toggleLike(track, e); }}
                                      title={isTrackLiked(track) ? "Убрать из коллекции" : "Добавить в коллекцию"}
                                    >
                                      <Heart size={16} weight={isTrackLiked(track) ? 'fill' : 'regular'} color={isTrackLiked(track) ? '#f83e3e' : 'rgba(255,255,255,0.6)'} />
                                    </button>
                                    <span className="split-queue-track-duration">{formatTime(track.duration || 0)}</span>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="fullscreen-split-lyrics-wrapper">
                    
                    {isLoadingLyrics ? (
                      <div className="lyrics-loading" style={{ margin: '80px 0' }}>
                        <div className="lyrics-loading-spinner" />
                        <span>Загрузка текста песни...</span>
                      </div>
                    ) : parsedLyrics ? (
                      <div className="lyrics-lines-container" style={{ paddingBottom: '120px' }}>
                        {parsedLyrics.map((line, idx) => {
                          const isActive = idx === activeLineIndex;
                          return (
                            <button
                              key={idx}
                              ref={isActive ? activeLineRef : null}
                              className={`lyrics-line-item ${isActive ? 'active' : ''}`}
                              onClick={() => handleLineClick(line.time)}
                            >
                              {line.text}
                            </button>
                          );
                        })}
                      </div>
                    ) : lyricsText ? (
                      <div className="lyrics-static-container" style={{ paddingBottom: '120px' }}>
                        {lyricsText.split('\n').map((line, idx) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div key={idx} className="lyrics-static-spacer" />;
                          return (
                            <div key={idx} className="lyrics-static-line">
                              {trimmed}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Текст песни отсутствует
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* REGULAR FULLSCREEN PLAYBACK MODE */
            <div className="fullscreen-player-content">
              {/* Cover wrapper with overlay controls on hover */}
              <div className="fullscreen-cover-wrapper">
                {activeTrack.cover ? (
                  <img src={activeTrack.cover} alt="" className="fullscreen-cover-img" />
                ) : (
                  <div className="fullscreen-cover-placeholder">
                    <MusicNote size={120} />
                  </div>
                )}
                
                {/* Hover overlay controls */}
                <div className="fullscreen-cover-overlay">
                  {/* Top Left Volume Control inside cover */}
                  <div className="fullscreen-volume-container btn-top-left-volume">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} 
                      className="fullscreen-overlay-btn"
                      title="Громкость"
                    >
                      {isMuted || volume === 0 ? <SpeakerX size={24} /> : <SpeakerHigh size={24} />}
                    </button>
                    <div className="fullscreen-volume-slider-wrapper">
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01"
                        value={isMuted ? 0 : volume} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setVolume(val);
                          if (isMuted) setIsMuted(false);
                        }} 
                        onClick={(e) => e.stopPropagation()}
                        className="fullscreen-volume-slider"
                      />
                    </div>
                  </div>

                  {/* Top Right Buttons: Queue & Lyrics */}
                  <button 
                    className={`fullscreen-overlay-btn ${showFullscreenQueue ? 'active' : ''}`}
                    style={{ position: 'absolute', top: '20px', right: '20px' }}
                    onClick={() => {
                      setShowFullscreenQueue(!showFullscreenQueue);
                      setShowFullscreenLyrics(false);
                    }} 
                    title={showFullscreenQueue ? "Скрыть очередь" : "Очередь воспроизведения"}
                  >
                    <List size={24} />
                  </button>

                  <button 
                    className={`fullscreen-overlay-btn ${showFullscreenLyrics ? 'active' : ''}`}
                    style={{ position: 'absolute', top: '20px', right: '74px' }}
                    onClick={() => {
                      const newShow = !showFullscreenLyrics;
                      setShowFullscreenLyrics(newShow);
                      setShowFullscreenQueue(false);
                      if (newShow) {
                        fetchLyrics(activeTrack, false);
                      }
                    }} 
                    title={showFullscreenLyrics ? "Скрыть текст" : "Текст песни"}
                  >
                    <Microphone size={24} />
                  </button>

                  {/* Centered playback control buttons */}
                  <div className="fullscreen-center-row-wrapper">
                    <div className="fullscreen-center-row">
                      <button className="fullscreen-control-icon" onClick={handlePrev} title="Предыдущий трек">
                        <SkipBack size={28} weight="fill" />
                      </button>

                      <button 
                        onClick={togglePlay} 
                        className="fullscreen-play-btn" 
                        title={isPlaying ? "Пауза" : "Воспроизвести"}
                      >
                        {isPlaying ? <Pause size={28} weight="fill" /> : <Play size={28} weight="fill" style={{ marginLeft: '-2px' }} />}
                      </button>

                      <button className="fullscreen-control-icon" onClick={handleNext} title="Следующий трек">
                        <SkipForward size={28} weight="fill" />
                      </button>
                    </div>

                    {/* Repeat button positioned absolutely to the right inside controls */}
                    <button 
                      className={`fullscreen-control-icon repeat-btn repeat-btn-absolute ${isRepeating ? 'active' : ''}`} 
                      onClick={() => setIsRepeating(!isRepeating)} 
                      title={isRepeating ? "Повтор включен" : "Повторить"}
                    >
                      <Repeat size={24} />
                    </button>
                  </div>

                  {/* Bottom Left More Button */}
                  <div style={{ position: 'absolute', width: '44px', height: '44px' }} className="btn-bottom-left">
                    <button 
                      className="fullscreen-overlay-btn" 
                      style={{ position: 'static' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenTrackId(menuOpenTrackId === 'fullscreen-alt' ? null : 'fullscreen-alt');
                      }} 
                      title="Еще"
                    >
                      <DotsThreeVertical size={24} weight="bold" />
                    </button>
                    {menuOpenTrackId === 'fullscreen-alt' && renderTrackMenu(activeTrack, 'left')}
                  </div>

                  {/* Bottom Right Like/Heart Button */}
                  <button 
                    className="fullscreen-overlay-btn btn-bottom-right" 
                    onClick={(e) => toggleLike(activeTrack, e)} 
                    title={isTrackLiked(activeTrack) ? "Убрать из коллекции" : "Добавить в коллекцию"}
                    style={{ right: activeTrack && activeTrack.type === 'yandex' && activeRadioStation ? '74px' : '20px' }}
                  >
                    <Heart size={24} weight={isTrackLiked(activeTrack) ? 'fill' : 'regular'} color={isTrackLiked(activeTrack) ? '#f83e3e' : '#ffffff'} />
                  </button>
                  {activeTrack && activeTrack.type === 'yandex' && activeRadioStation && (
                    <button 
                      className="fullscreen-overlay-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTrack.yandexId) {
                          sendRadioFeedback('dislike', activeTrack.yandexId, activeTrack.playIdentifier);
                        }
                        handleNext();
                      }} 
                      title="Не рекомендовать (Дизлайк)"
                      style={{ position: 'absolute', bottom: '20px', right: '20px' }}
                    >
                      <HeartBreak size={24} />
                    </button>
                  )}
                </div>
              </div>

              {/* Track Info */}
              <div className="fullscreen-track-info">
                <h2 
                  className={`fullscreen-track-title ${activeTrack.album && activeTrack.album.id ? 'clickable-title' : ''}`}
                  onClick={() => {
                    if (activeTrack.album && activeTrack.album.id) {
                      loadAlbumTracks(activeTrack.album);
                      setIsFullscreenPlayer(false);
                      setShowFullscreenQueue(false);
                    }
                  }}
                >
                  {activeTrack.id === 'empty' ? 'Нет трека' : activeTrack.title}
                  {activeTrack.explicit && (
                    <span className="info-icon explicit" title="Возрастное ограничение 18+" onClick={(e) => e.stopPropagation()}>!</span>
                  )}
                </h2>
                <p className="fullscreen-track-artist">
                  {activeTrack.id === 'empty' ? (
                    'Выберите трек для воспроизведения'
                  ) : activeTrack.artists && activeTrack.artists.length > 0 ? (
                    activeTrack.artists.map((artist, artistIdx) => (
                      <span key={artist.id || artistIdx}>
                        <span 
                          className={artist.id ? 'clickable-artist' : ''} 
                          onClick={() => {
                            if (artist.id) {
                              openArtistProfile(artist.id, artist.name);
                              setIsFullscreenPlayer(false);
                              setShowFullscreenQueue(false);
                            }
                          }}
                        >
                          {artist.name}
                        </span>
                        {artistIdx < activeTrack.artists.length - 1 ? ', ' : ''}
                      </span>
                    ))
                  ) : (
                    activeTrack.artist
                  )}
                </p>
              </div>

              {/* Progress Bar (Timeline) */}
              <div className="fullscreen-progress-container">
                <div className="fullscreen-seekbar-slider-wrapper">
                  <input 
                    ref={fullscreenSeekbarSliderRef}
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="any"
                    defaultValue={0}
                    onChange={handleSeek}
                    onMouseDown={() => { isSeekingRef.current = true; }}
                    onMouseUp={() => { isSeekingRef.current = false; }}
                    onTouchStart={() => { isSeekingRef.current = true; }}
                    onTouchEnd={() => { isSeekingRef.current = false; }}
                    className="fullscreen-seekbar-slider"
                  />
                  <div 
                    ref={fullscreenProgressRef}
                    className="fullscreen-seekbar-progress" 
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <div className="fullscreen-time-labels">
                  <span ref={fullscreenTimeLabelRef}>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {toastMessage && (
        <div className="app-toast">
          {toastMessage}
        </div>
      )}

      </div>
    </>
  );
}
