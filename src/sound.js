
/* 0. Pastel soundscape — Inlined from soundscape.js, enabled by default. */
(function (global) {
  'use strict';

  global.createPastelSoundscape = function createPastelSoundscape(options = {}) {
    const notify = typeof options.onStateChange === 'function' ? options.onStateChange : () => {};
    const timers = new Set();
    const voices = new Set();
    const graph = [];
    const events = [];
    let context = null;
    let master = null;
    let ambient = null;
    let cues = null;
    let reverbSend = null;
    let noiseBuffer = null;
    let enabled = true;
    let active = false;
    let needsGesture = false;
    let away = !!document.hidden;
    let destroyed = false;
    let volume = 0.58;
    let world = 'lavender';
    let revision = 0;
    let chordIndex = 0;
    let blurTimer = null;
    let suspendTimer = null;
    let lastAccent = -Infinity;
    let activationPromise = null;

    function getState() {
      return {
        enabled,
        active: !!(active && context && context.state === 'running' && !away),
        needsGesture,
        contextState: context ? context.state : 'uninitialized',
        away,
        volume,
      };
    }

    function emit() {
      try { notify(getState()); } catch (error) { console.warn('Sound control update failed:', error); }
    }

    function later(callback, delay) {
      const timer = global.setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
      return timer;
    }

    function clearTimer(timer) {
      if (timer !== null) { global.clearTimeout(timer); timers.delete(timer); }
    }

    function clearTimers() {
      timers.forEach(timer => global.clearTimeout(timer));
      timers.clear();
      blurTimer = null;
      suspendTimer = null;
    }

    function ramp(parameter, value, duration = 0.18) {
      if (!context) return;
      const now = context.currentTime;
      if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
      else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
      parameter.linearRampToValueAtTime(value, now + duration);
    }

    function keep(node) { graph.push(node); return node; }

    function createRoom() {
      const length = Math.floor(context.sampleRate * 2.4);
      const impulse = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        let smooth = 0;
        for (let i = 0; i < length; i++) {
          smooth = smooth * 0.72 + (Math.random() * 2 - 1) * 0.28;
          data[i] = smooth * Math.pow(1 - i / length, 2.7);
        }
      }
      const room = keep(context.createConvolver());
      const roomFilter = keep(context.createBiquadFilter());
      const roomGain = keep(context.createGain());
      room.buffer = impulse;
      roomFilter.type = 'lowpass';
      roomFilter.frequency.value = 4200;
      roomGain.gain.value = 0.27;
      reverbSend = keep(context.createGain());
      reverbSend.gain.value = 0.4;
      reverbSend.connect(room).connect(roomFilter).connect(roomGain).connect(master);

      const delay = keep(context.createDelay(1));
      const feedback = keep(context.createGain());
      const delayFilter = keep(context.createBiquadFilter());
      const delayGain = keep(context.createGain());
      const delaySend = keep(context.createGain());
      delay.delayTime.value = 0.43;
      feedback.gain.value = 0.19;
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 1800;
      delayGain.gain.value = 0.2;
      delaySend.gain.value = 0.18;
      ambient.connect(delaySend).connect(delay);
      delay.connect(delayFilter).connect(feedback).connect(delay);
      delay.connect(delayGain).connect(master);
    }

    function createContext() {
      if (context && context.state !== 'closed') return true;
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) { needsGesture = false; return false; }
      try { context = new AudioContextClass({ latencyHint: 'interactive' }); }
      catch (_) { needsGesture = true; return false; }
      master = keep(context.createGain());
      ambient = keep(context.createGain());
      cues = keep(context.createGain());
      const compressor = keep(context.createDynamicsCompressor());
      master.gain.value = 0;
      ambient.gain.value = 0;
      cues.gain.value = 1;
      compressor.threshold.value = -17;
      compressor.knee.value = 22;
      compressor.ratio.value = 2.4;
      compressor.attack.value = 0.02;
      compressor.release.value = 0.3;
      ambient.connect(master);
      cues.connect(master);
      master.connect(compressor).connect(context.destination);
      createRoom();
      ambient.connect(reverbSend);
      cues.connect(reverbSend);
      const length = Math.floor(context.sampleRate * 4);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      context.onstatechange = () => {
        if (destroyed) return;
        if (context.state !== 'running' && enabled && active && !away) {
          active = false;
          needsGesture = true;
          clearTimers();
          stopVoices('ambient');
        }
        emit();
      };
      return true;
    }

    function track(source, nodes, group, startTime, endTime) {
      const voice = { source, nodes, group };
      voices.add(voice);
      source.onended = () => {
        voices.delete(voice);
        [source, ...nodes].forEach(node => { try { node.disconnect(); } catch (_) {} });
      };
      source.start(startTime);
      if (Number.isFinite(endTime)) source.stop(endTime);
      return voice;
    }

    function stopVoices(group, after = 0) {
      if (!context) return;
      const when = context.currentTime + after;
      voices.forEach(voice => {
        if (!group || voice.group === group) {
          try { voice.source.stop(when); } catch (_) {}
        }
      });
    }

    function route(gain, bus, pan = 0) {
      const nodes = [gain];
      if (typeof context.createStereoPanner === 'function') {
        const panner = context.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner).connect(bus);
        nodes.push(panner);
      } else gain.connect(bus);
      return nodes;
    }

    function bubble(kind) {
      if (!context || context.state !== 'running') return;
      const departing = kind === 'leave';
      const returning = kind === 'return';
      const length = departing ? 0.3 : returning ? 0.55 : kind === 'portal' ? 0.5 : 0.22;
      const now = context.currentTime + 0.008;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      const low = departing ? 270 : returning ? 180 : 350 + Math.random() * 170;
      const high = departing ? 82 : returning ? 850 : kind === 'bloom' ? 970 : 630;
      oscillator.frequency.setValueAtTime(low, now);
      oscillator.frequency.exponentialRampToValueAtTime(high, now + length * 0.72);
      oscillator.frequency.exponentialRampToValueAtTime(high * 0.82, now + length);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + length * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
      oscillator.connect(gain);
      const nodes = route(gain, cues, departing ? -0.15 : returning ? 0.15 : Math.random() * 0.7 - 0.35);
      track(oscillator, nodes, 'cue', now, now + length + 0.04);
    }

    function rootFrequency() {
      const roots = { lavender: 130.8128, lilac: 130.8128, peach: 174.6141, mint: 146.8324, aqua: 146.8324, pearl: 130.8128 };
      return roots[world] || 130.8128;
    }

    function pad() {
      if (!active || away) return;
      const now = context.currentTime + 0.03;
      const voicings = [[0, 7, 11, 14], [0, 4, 9, 14], [0, 5, 7, 14], [0, 4, 7, 11]];
      const chord = voicings[chordIndex++ % voicings.length];
      chord.forEach((semitones, index) => {
        for (const detune of [-3, 3]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = rootFrequency() * Math.pow(2, semitones / 12);
          oscillator.detune.value = detune;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.034, now + 2.4 + index * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.016, now + 5.5);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 9.3);
          oscillator.connect(gain);
          const nodes = route(gain, ambient, (index - 1.5) * 0.25);
          track(oscillator, nodes, 'ambient', now, now + 9.5);
        }
      });
      later(pad, 6400);
    }

    function air() {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = noiseBuffer;
      source.loop = true;
      filter.type = 'bandpass';
      filter.frequency.value = 480;
      filter.Q.value = 0.55;
      gain.gain.value = 0.012;
      source.connect(filter).connect(gain).connect(ambient);
      track(source, [filter, gain], 'ambient', context.currentTime);
    }

    function sparkle() {
      if (!active || away) return;
      const scale = [0, 4, 7, 11, 14, 19];
      const now = context.currentTime + 0.02;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = rootFrequency() * 2 * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      oscillator.connect(gain);
      const nodes = route(gain, ambient, Math.random() * 1.2 - 0.6);
      track(oscillator, nodes, 'ambient', now, now + 1.9);
      later(sparkle, 2000 + Math.random() * 3800);
    }

    async function resumeBounded() {
      if (context.state === 'running') return true;
      let timeout;
      try {
        const resumed = Promise.resolve(context.resume()).then(() => context.state === 'running', () => false);
        return await Promise.race([resumed, new Promise(resolve => { timeout = global.setTimeout(() => resolve(false), 1100); })]);
      } catch (_) { return false; }
      finally { if (timeout) global.clearTimeout(timeout); }
    }

    function suspendQuietly() {
      if (context && context.state !== 'closed') {
        try { Promise.resolve(context.suspend()).catch(() => {}); } catch (_) {}
      }
    }

    async function activate(returning) {
      const operation = ++revision;
      clearTimers();
      if (!createContext()) { enabled = false; active = false; emit(); return getState(); }
      const running = await resumeBounded();
      if (destroyed || operation !== revision || !enabled || away || document.hidden) {
        if (!enabled || away || destroyed) suspendQuietly();
        return getState();
      }
      if (!running) {
        active = false;
        needsGesture = true;
        suspendQuietly();
        emit();
        return getState();
      }
      stopVoices();
      active = true;
      needsGesture = false;
      ramp(master.gain, volume * 0.34, 0.35);
      ramp(ambient.gain, 0.82, returning ? 1.6 : 2.8);
      if (returning) bubble('return');
      air();
      pad();
      later(sparkle, 1700);
      emit();
      return getState();
    }

    function beginActivation(returning) {
      let pending;
      pending = activate(returning).catch(() => {
        if (activationPromise !== pending) return getState();
        active = false;
        needsGesture = enabled;
        clearTimers();
        stopVoices();
        suspendQuietly();
        emit();
        return getState();
      });
      activationPromise = pending;
      pending.then(() => { if (activationPromise === pending) activationPromise = null; });
      return pending;
    }

    async function start() {
      if (destroyed) return getState();
      if (active && !away && context && context.state === 'running') return getState();
      enabled = true;
      away = !!document.hidden;
      if (away) { needsGesture = true; emit(); return getState(); }
      if (activationPromise && !needsGesture) return activationPromise;
      return beginActivation(false);
    }

    async function stop() {
      ++revision;
      activationPromise = null;
      enabled = false;
      active = false;
      needsGesture = false;
      clearTimers();
      if (context && context.state !== 'closed') {
        ramp(master.gain, 0, 0.16);
        stopVoices(null, context.state === 'running' ? 0.19 : 0);
        suspendTimer = later(() => { suspendTimer = null; suspendQuietly(); }, 220);
      }
      emit();
      return getState();
    }

    function leave() {
      if (destroyed || away) return getState();
      away = true;
      ++revision;
      activationPromise = null;
      active = false;
      clearTimers();
      if (enabled && context && context.state === 'running') {
        bubble('leave');
        ramp(ambient.gain, 0, 0.2);
        stopVoices('ambient', 0.23);
        suspendTimer = later(() => {
          suspendTimer = null;
          if (away || !enabled) { stopVoices(); suspendQuietly(); }
        }, 520);
      } else if (context && context.state === 'running') {
        stopVoices();
        suspendQuietly();
      }
      emit();
      return getState();
    }

    async function returnToPage() {
      clearTimer(blurTimer);
      blurTimer = null;
      if (destroyed || document.hidden) return getState();
      const wasAway = away;
      away = false;
      if (!enabled) { emit(); return getState(); }
      if (!wasAway && active) return getState();
      if (!wasAway && activationPromise) return activationPromise;
      return beginActivation(wasAway);
    }

    function accent(kind = 'select') {
      if (!enabled || !active || away || !context || context.state !== 'running') return;
      const now = context.currentTime;
      const interval = kind === 'hover' ? 0.22 : 0.09;
      if (now - lastAccent < interval) return;
      lastAccent = now;
      bubble(kind);
    }

    function setWorld(name) { world = String(name || 'lavender').toLowerCase(); }

    function setVolume(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return getState();
      volume = Math.max(0, Math.min(1, numeric));
      if (context && master && enabled) ramp(master.gain, volume * 0.34, 0.18);
      emit();
      return getState();
    }

    function listen(target, name, callback) {
      target.addEventListener(name, callback);
      events.push([target, name, callback]);
    }
    listen(document, 'visibilitychange', () => {
      if (document.hidden) leave();
      else void returnToPage();
    });
    listen(global, 'blur', () => {
      clearTimer(blurTimer);
      blurTimer = later(() => { blurTimer = null; leave(); }, 120);
    });
    listen(global, 'focus', () => {
      clearTimer(blurTimer);
      blurTimer = null;
      if (!document.hidden) void returnToPage();
    });
    listen(global, 'pagehide', () => {
      leave();
      clearTimers();
      stopVoices();
      suspendQuietly();
    });
    listen(global, 'pageshow', () => { if (!document.hidden && away) void returnToPage(); });

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      ++revision;
      enabled = active = needsGesture = false;
      clearTimers();
      stopVoices();
      voices.forEach(voice => {
        voice.source.onended = null;
        [voice.source, ...voice.nodes].forEach(node => { try { node.disconnect(); } catch (_) {} });
      });
      voices.clear();
      events.forEach(([target, name, callback]) => target.removeEventListener(name, callback));
      graph.forEach(node => { try { node.disconnect(); } catch (_) {} });
      if (context) {
        context.onstatechange = null;
        try { Promise.resolve(context.close()).catch(() => {}); } catch (_) {}
      }
      noiseBuffer = null;
      emit();
    }

    return { start, stop, toggle: () => enabled && !needsGesture ? stop() : start(), setWorld, accent, leave, returnToPage, setVolume, getState, destroy };
  };
})(window);

