/**
 * Music manager for park background music.
 * Plays songs from /music/ during SETUP, OPERATION, and TEARDOWN phases.
 * Songs are shuffled and loop continuously while in the park.
 */

const PARK_PHASES = new Set(['SETUP', 'OPERATION', 'TEARDOWN']);

class MusicManager {
  private audio: HTMLAudioElement | null = null;
  private playlist: string[] = [];
  private currentIndex = 0;
  private isPlaying = false;
  private volume = 0.4;
  private manifestLoaded = false;

  async loadPlaylist() {
    if (this.manifestLoaded) return;
    try {
      const resp = await fetch('/music/playlist.json');
      if (!resp.ok) return;
      const files: string[] = await resp.json();
      this.playlist = shuffle(files.map(f => `/music/${f}`));
      this.manifestLoaded = true;
    } catch {
      // No playlist available — that's fine, user hasn't added songs yet
    }
  }

  onPhaseChange(phase: string) {
    if (PARK_PHASES.has(phase)) {
      this.play();
    } else {
      this.pause();
    }
  }

  private async play() {
    if (this.playlist.length === 0) {
      await this.loadPlaylist();
    }
    if (this.playlist.length === 0 || this.isPlaying) return;

    this.isPlaying = true;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.volume = this.volume;
      this.audio.addEventListener('ended', () => this.next());
    }
    this.loadCurrentTrack();
    // Browser may block autoplay until user interaction — silently catch
    this.audio.play().catch(() => {});
  }

  private pause() {
    if (!this.audio || !this.isPlaying) return;
    this.isPlaying = false;
    this.audio.pause();
  }

  private next() {
    if (this.playlist.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.loadCurrentTrack();
    if (this.isPlaying) {
      this.audio?.play().catch(() => {});
    }
  }

  private loadCurrentTrack() {
    if (!this.audio || this.playlist.length === 0) return;
    this.audio.src = this.playlist[this.currentIndex];
    this.audio.load();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  getVolume() {
    return this.volume;
  }

  skipTrack() {
    this.next();
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const musicManager = new MusicManager();
