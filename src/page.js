/* 2. Page helpers — Build the editable content and keep links safe. */
const $ = function (selector) { return document.querySelector(selector); };
const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
const H = document.documentElement;
const W = $('#w');
const P = SITE.projects;
const clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };
const escapeHTML = function (value) { return String(value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
const slug = function (value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
const projectHash = function (index) { return '#project-' + slug(P[index].n); };
const pointerPreference = matchMedia('(pointer: fine)');
let rm = false;
let fine = pointerPreference.matches;
let sm = fine;
let started = false;
let disposed = false;
let dialogOpen = false;
let cvOpen = false;
let sceneCovered = false;
let hiddenAt = 0;
let last = performance.now();
let timelineStart = last;
let frameRequest = 0;
let layoutDirty = true;
let textDirty = true;
let lastScroll = -1;
let lastProgress = '';
let cur = scrollY;
let tgt = cur;
let marqueeScroll = cur;
let vel = 0;
let itr = 0;
let go = false;
let mx = 0;
let my = 0;
let px = innerWidth / 2;
let py = innerHeight / 2;
let rx = px;
let ry = py;
let hoverTarget = null;
let hoverCard = null;
let lastHover = null;
let lastMove = -1e9;
let pointerDirty = true;
let upOn = false;
let abT = 0;
let abH = 1;
let docH = 1;
let viewportWidth = innerWidth;
let viewportHeight = innerHeight;
let from = null;
let activeProject = -1;
let routedHash = '';
let coveredTimer = 0;
const backgroundState = new Map();
const pausedArtwork = new Map();
const pausedGroups = new Map();
const cs = $('#cs');
const cvModal = $('#cv-modal');
const up = $('#up');
const rg = $('#rg');
const sndBtn = $('#snd');
const sndLbl = $('#snd-lbl');
const cd = $('.cd');
const cr = $('.cr');
const cv = $('#gl');
const U = {};
const spheres = new Float32Array(16);
let gl = null;
let ok = false;
let program = null;
let buffer = null;
let texture = null;
let dpr = Math.min(devicePixelRatio || 1, 2);
let textureWidth = 0;
let rows = [];
let cards = [];
let magnets = [];
let words = [];

/* Phone Tilt state — Gyroscope deviceorientation + touch/scroll fallback on phones */
let hasGyro = false;
let gyroPermitted = false;
const showMobileWelcome = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth <= 820);
let motionEnabled = !showMobileWelcome;
let baseBeta = null;
let baseGamma = null;
let rawTiltX = 0;
let rawTiltY = 0;
let tiltX = 0;
let tiltY = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchTiltX = 0;
let touchTiltY = 0;

/* Safe History helpers so sandboxed iframes never throw SecurityError */
function safePushState(state, url) {
  try { history.pushState(state, '', url); } catch (_) {}
}
function safeReplaceState(state, url) {
  try { history.replaceState(state, '', url); } catch (_) {}
}

/* Social icons — Vector paths for Email, GitHub, and LinkedIn (X removed). */
const IC = {
  "email": "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4.2-8 5-8-5V6l8 5 8-5v2.2z",
  "github": "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  "linkedin": "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
};

// safeURL: Reject executable URL schemes in editable destinations.
function safeURL(value) {
  if (typeof value === 'string' && value.startsWith('#')) return value;
  try {
    const url = new URL(value, location.href);
    return /^(https?:|mailto:|file:)$/.test(url.protocol) ? value : '#contact';
  } catch (_) { return '#contact'; }
}

// artwork: Reuse the original gradients, blurred shapes and rotating rings.
function artwork(colors) {
  return '<div class="viz" style="--a:' + colors[0] + ';--b:' + colors[1] + ';--c:' + colors[2] + '" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b><b></b></div>';
}

// buildContent: Synchronize the static fallback with the editable SITE settings.
function buildContent() {
  document.title = SITE.name + ' Portfolio';
  $('#h1').innerHTML = SITE.lines.map(function (line) { return '<span class="ln">' + escapeHTML(line) + '</span>'; }).join(' ');
  $('#intro').innerHTML = SITE.intro;
  $('#st').textContent = SITE.status;
  const initials = SITE.name.split(' ').map(function (word) { return word[0] || ''; }).join('');
  $('.nav').innerHTML = '<a class="lg" href="#top" aria-label="' + escapeHTML(SITE.name) + ', home"><i aria-hidden="true"></i>' + escapeHTML(initials) + '</a><a href="#work">Work</a><a class="about-link" href="#about">About</a><a class="cta" href="#contact">Contact</a>';
  const marquee = SITE.skills.map(function (skill) { return '<span>' + escapeHTML(skill) + '</span><i></i>'; }).join('');
  $('#m1').innerHTML = $('#m2').innerHTML = marquee + marquee;
  $('#cards').innerHTML = P.map(function (project, index) {
    return '<a class="card glass rv" data-i="' + index + '" href="' + projectHash(index) + '" data-cur="View" aria-haspopup="dialog" aria-label="Open case study: ' + escapeHTML(project.n) + '">' + artwork(project.c) + '<div class="meta"><div><h3>' + escapeHTML(project.n) + '</h3><p>' + escapeHTML(project.t) + '</p></div><ul class="tags"><li>' + escapeHTML(project.y) + '</li>' + project.s.map(function (skill) { return '<li>' + escapeHTML(skill) + '</li>'; }).join('') + '</ul></div></a>';
  }).join('');
  $('#ab').innerHTML = SITE.about.split(' ').map(function (word) { return '<span>' + escapeHTML(word) + '</span>'; }).join(' ');
  $('#em').href = 'mailto:' + SITE.email;
  $('#em').textContent = SITE.email;
  $('#ft').textContent = '© ' + new Date().getFullYear() + ' ' + SITE.name;
  $('#so').innerHTML = SITE.socials.map(function (social, index) {
    const href = safeURL(social[2] === 'email' ? 'mailto:' + SITE.email : social[1]);
    const isExt = /^https?:/i.test(href);
    const extAttrs = isExt ? ' target="_blank" rel="noopener noreferrer"' : '';
    const iconKey = social[2] || social[0].toLowerCase();
    return '<a class="soc glass mag" style="--i:' + index + '" href="' + escapeHTML(href) + '"' + extAttrs + ' aria-label="' + escapeHTML(social[0]) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (IC[iconKey] || '') + '"/></svg><span>' + escapeHTML(social[0]) + '</span></a>';
  }).join('');
  $('#end span').textContent = SITE.outro || '';
  rows = [['#m1', -1], ['#m2', 1]].map(function (item) { return { el: $(item[0]), direction: item[1], x: 0, width: 1, dirty: true }; });
  cards = $$('.card').map(function (el) { return { el: el, x: 0, y: 0, width: 1, height: 1, rx: 0, ry: 0, visible: false }; });
  magnets = $$('.mag').map(function (el) { return { el: el, cx: 0, cy: 0, x: 0, y: 0, isBig: el.classList.contains('big') }; });
  words = $$('#ab span');
}
buildContent();

/* 2b. Sound is enabled only when it is actually playing. */
let userMutedSound = showMobileWelcome;
const soundscape = window.createPastelSoundscape({
  onStateChange: function (state) {
    const isOn = !userMutedSound && state.active;
    sndBtn.setAttribute('aria-pressed', String(isOn));
    sndLbl.textContent = isOn ? 'Sound on' : 'Sound off';
  }
});

if (showMobileWelcome) soundscape.stop();
else soundscape.start();

sndBtn.addEventListener('click', function (event) {
  event.stopPropagation();
  const st = soundscape.getState();
  if (!userMutedSound && st.enabled && st.active) {
    userMutedSound = true;
    soundscape.stop();
  } else {
    userMutedSound = false;
    soundscape.start().then(function () { soundscape.accent('return'); });
  }
});
sndBtn.addEventListener('pointerenter', function () {
  soundscape.accent('hover');
});

/* 2c. Phone Tilt & Gyroscope Controller — Card tilt + whole-webpage tilt on phones. */
function requestPhoneTiltPermission() {
  if (gyroPermitted) { motionEnabled = true; return Promise.resolve(true); }
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      return Promise.resolve(DeviceOrientationEvent.requestPermission()).then(function (status) {
        gyroPermitted = motionEnabled = status === 'granted';
        return gyroPermitted;
      }).catch(function () { motionEnabled = false; return false; });
    } catch (_) { motionEnabled = false; return Promise.resolve(false); }
  } else {
    gyroPermitted = motionEnabled = true;
    return Promise.resolve(true);
  }
}

function applyGyroAngles(g, b) {
  hasGyro = true;
  if (baseBeta === null || baseGamma === null) {
    baseBeta = b;
    baseGamma = g;
  } else {
    baseBeta += (b - baseBeta) * 0.015;
    baseGamma += (g - baseGamma) * 0.015;
  }
  rawTiltX = clamp(g - baseGamma, -28, 28) / 28;
  rawTiltY = clamp(b - baseBeta, -24, 24) / 24;
  lastMove = performance.now();
  pointerDirty = true;
  wake();
}

window.addEventListener('deviceorientation', function (event) {
  if (!motionEnabled) return;
  if (event.gamma === null && event.beta === null) return;
  applyGyroAngles(event.gamma || 0, event.beta || 0);
}, { passive: true });

window.addEventListener('devicemotion', function (event) {
  if (!motionEnabled) return;
  if (hasGyro) return;
  const acc = event.accelerationIncludingGravity;
  if (!acc || (acc.x === null && acc.y === null)) return;
  applyGyroAngles((acc.x || 0) * -4.5, (acc.y || 0) * 4.5);
}, { passive: true });

window.addEventListener('touchstart', function (event) {
  if (!event.touches || !event.touches[0]) return;
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
  px = touchStartX;
  py = touchStartY;
  lastMove = performance.now();
  wake();
}, { passive: true });

window.addEventListener('touchmove', function (event) {
  if (!event.touches || !event.touches[0]) return;
  const tx = event.touches[0].clientX;
  const ty = event.touches[0].clientY;
  px = tx;
  py = ty;
  const dx = clamp((tx - touchStartX) / Math.max(1, viewportWidth * 0.45), -1, 1);
  const dy = clamp((ty - touchStartY) / Math.max(1, viewportHeight * 0.45), -1, 1);
  touchTiltX = dx * 0.85;
  touchTiltY = dy * 0.85;
  lastMove = performance.now();
  pointerDirty = true;
  wake();
}, { passive: true });

window.addEventListener('touchend', function () {
  touchTiltX *= 0.35;
  touchTiltY *= 0.35;
  wake();
}, { passive: true });

