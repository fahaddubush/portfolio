/* 4. Layout — Batch measurements and redraw text immediately when dirty. */
function invalidateLayout() {
  layoutDirty = true;
  textDirty = true;
  wake();
}

function measure() {
  viewportWidth = innerWidth;
  viewportHeight = innerHeight;
  const nextDpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(viewportWidth * nextDpr));
  const height = Math.max(1, Math.round(viewportHeight * nextDpr));
  dpr = nextDpr;
  if (ok && (cv.width !== width || cv.height !== height)) {
    cv.width = width;
    cv.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(U.r, width, height);
    textDirty = true;
  }
  if (ok) {
    gl.viewport(0, 0, width, height);
    gl.uniform2f(U.r, width, height);
  }
  const scrollOffset = sm ? cur : scrollY;
  docH = W.scrollHeight;
  const aboutRect = $('#ab').getBoundingClientRect();
  abT = aboutRect.top + scrollOffset;
  abH = aboutRect.height;
  rows.forEach(function (row) {
    row.width = Math.max(1, row.el.scrollWidth / 2);
    row.x %= row.width;
    if (row.x > 0) row.x -= row.width;
    row.dirty = true;
  });
  cards.forEach(function (card) {
    const rect = card.el.getBoundingClientRect();
    card.x = rect.left;
    card.y = rect.top + scrollOffset;
    card.width = rect.width;
    card.height = rect.height;
  });
  magnets.forEach(function (magnet) {
    const rect = magnet.el.getBoundingClientRect();
    magnet.cx = rect.left + rect.width / 2 - magnet.x;
    magnet.cy = rect.top + scrollOffset + rect.height / 2 - magnet.y;
  });
  if (sm && document.body.style.height !== docH + 'px') document.body.style.height = docH + 'px';
  layoutDirty = false;
}

const resizeObserver = new ResizeObserver(invalidateLayout);
resizeObserver.observe(W);
resizeObserver.observe($('#h1'));
addEventListener('resize', invalidateLayout, { passive: true });
if (document.fonts) {
  document.fonts.ready.then(invalidateLayout);
  document.fonts.addEventListener('loadingdone', invalidateLayout);
  if (typeof document.fonts.load === 'function') {
    Promise.all([
      document.fonts.load('800 96px "Bricolage Grotesque"'),
      document.fonts.load('800 64px "Bricolage Grotesque"')
    ]).then(function () {
      invalidateLayout();
      setTimeout(invalidateLayout, 150);
    }).catch(function () {});
  }
}

/* 5. Visibility — Preserve animation phase while skipping invisible DOM writes. */
function pauseArtwork(root, pause) {
  if (!root || !root.getAnimations || typeof CSSAnimation === 'undefined') return;
  const now = document.timeline.currentTime;
  if (now === null) return;
  if (pause) {
    if (pausedGroups.has(root)) return;
    const animations = root.getAnimations({ subtree: true }).filter(function (animation) { return animation instanceof CSSAnimation; });
    pausedGroups.set(root, animations);
    animations.forEach(function (animation) {
      let state = pausedArtwork.get(animation);
      if (!state) {
        if (animation.playState !== 'running' || animation.currentTime === null) return;
        state = { time: animation.currentTime, at: now, rate: animation.playbackRate, owners: new Set() };
        pausedArtwork.set(animation, state);
        animation.pause();
      }
      state.owners.add(root);
    });
  } else {
    const animations = pausedGroups.get(root) || [];
    pausedGroups.delete(root);
    animations.forEach(function (animation) {
      const state = pausedArtwork.get(animation);
      if (!state) return;
      state.owners.delete(root);
      if (state.owners.size) return;
      pausedArtwork.delete(animation);
      if (animation.playState !== 'idle') {
        animation.currentTime = state.time + (now - state.at) * state.rate;
        animation.play();
      }
    });
  }
}

const revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
$$('.rv,.tt,#so').forEach(function (el) { revealObserver.observe(el); });

const visibilityObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    const card = cards.find(function (item) { return item.el === entry.target; });
    if (card) {
      card.visible = entry.isIntersecting;
      card.el.classList.toggle('live', card.visible);
      pauseArtwork(card.el, !card.visible);
    }
  });
  wake();
}, { rootMargin: '35% 0px' });
cards.forEach(function (card) { visibilityObserver.observe(card.el); });

/* 6. Navigation, Case studies & CV modal — Real hashes, safe history and focus containment. */
function scrollSection(hash, immediate) {
  const target = document.getElementById(hash.slice(1) || 'top');
  if (!target) return;
  const top = target.getBoundingClientRect().top + (sm ? cur : scrollY);
  scrollTo({ top: Math.max(0, top - (hash === '#top' ? 0 : 90)), behavior: sm || immediate ? 'auto' : 'smooth' });
  wake();
}

function inertBackground(inert) {
  if (inert) {
    [W, $('.nav'), up, sndBtn, $('.skip')].forEach(function (el) { if (el) { backgroundState.set(el, el.inert); el.inert = true; } });
  } else {
    backgroundState.forEach(function (previous, el) { el.inert = previous; });
    backgroundState.clear();
  }
}

function openCS(index, x, y, trigger) {
  if (index < 0 || index >= P.length) return;
  if (cvOpen) closeCV();
  if (dialogOpen && activeProject === index) return;
  const project = P[index];
  if (!dialogOpen) { from = trigger || cards[index].el; inertBackground(true); }
  activeProject = index;
  dialogOpen = true;
  sceneCovered = false;
  clearTimeout(coveredTimer);
  cs.inert = false;
  cs.setAttribute('aria-hidden', 'false');
  cs.style.setProperty('--cx', x + 'px');
  cs.style.setProperty('--cy', y + 'px');
  ['--a', '--b', '--c'].forEach(function (key, i) { cs.style.setProperty(key, project.c[i]); });
  cs.querySelector('.viz').setAttribute('style', '--a:' + project.c[0] + ';--b:' + project.c[1] + ';--c:' + project.c[2]);
  $('#cst').textContent = project.n;
  cs.querySelector('.lead').textContent = project.t + '. ' + project.d;
  const fallbackCase = document.getElementById('project-' + slug(project.n));
  const evidence = fallbackCase && fallbackCase.querySelector('.project-evidence');
  $('#project-evidence').innerHTML = evidence ? evidence.innerHTML : '';
  cs.querySelector('.res').innerHTML = project.r.map(function (result) { return '<li>' + escapeHTML(result) + '</li>'; }).join('');
  cs.querySelector('.tags').innerHTML = project.s.map(function (skill) { return '<li>' + escapeHTML(skill) + '</li>'; }).join('');
  $('#lk').innerHTML = project.l.map(function (link) {
    const href = safeURL(link[1]);
    const isExt = /^https?:/i.test(href);
    const attrs = isExt ? ' target="_blank" rel="noopener noreferrer"' : '';
    return '<a class="btn glass" href="' + escapeHTML(href) + '"' + attrs + '>' + escapeHTML(link[0]) + '</a>';
  }).join('');
  cs.scrollTop = 0;
  cs.classList.add('open');
  H.classList.add('lock');
  soundscape.setWorld(project.w || 'lavender');
  soundscape.accent('portal');
  cs.querySelector('.x').focus({ preventScroll: true });
  coveredTimer = setTimeout(function () {
    if (!dialogOpen) return;
    sceneCovered = true;
    pauseArtwork(W, true);
    pauseArtwork($('.nav'), true);
  }, 1050);
  wake();
}

function closeCS() {
  if (!dialogOpen) return;
  clearTimeout(coveredTimer);
  sceneCovered = false;
  pauseArtwork(W, false);
  pauseArtwork($('.nav'), false);
  last = performance.now();
  if (ok && !layoutDirty && !textDirty) renderGraphics((last - timelineStart) / 1000, currentAmount(), entranceAmount());
  dialogOpen = false;
  activeProject = -1;
  cs.classList.remove('open');
  cs.setAttribute('aria-hidden', 'true');
  cs.inert = true;
  H.classList.remove('lock');
  inertBackground(false);
  soundscape.setWorld('lavender');
  soundscape.accent('select');
  if (from && from.isConnected) {
    const rect = from.getBoundingClientRect();
    cs.style.setProperty('--cx', rect.left + rect.width / 2 + 'px');
    cs.style.setProperty('--cy', rect.top + rect.height / 2 + 'px');
    from.focus({ preventScroll: true });
    const target = from;
    requestAnimationFrame(function () {
      if (!dialogOpen && target.isConnected) target.focus({ preventScroll: true });
    });
  }
  wake();
}

function openCV(x, y, trigger) {
  if (dialogOpen) closeCS();
  if (cvOpen) return;
  from = trigger || $('#cv-btn');
  inertBackground(true);
  cvOpen = true;
  cvModal.inert = false;
  cvModal.setAttribute('aria-hidden', 'false');
  cvModal.style.setProperty('--cx', x + 'px');
  cvModal.style.setProperty('--cy', y + 'px');
  cvModal.scrollTop = 0;
  cvModal.classList.add('open');
  H.classList.add('lock');
  soundscape.setWorld('lilac');
  soundscape.accent('bloom');
  $('#cv-close').focus({ preventScroll: true });
  wake();
}

function closeCV() {
  if (!cvOpen) return;
  cvOpen = false;
  cvModal.classList.remove('open');
  cvModal.setAttribute('aria-hidden', 'true');
  cvModal.inert = true;
  H.classList.remove('lock');
  inertBackground(false);
  soundscape.setWorld('lavender');
  soundscape.accent('select');
  if (from && from.isConnected) {
    const rect = from.getBoundingClientRect();
    cvModal.style.setProperty('--cx', rect.left + rect.width / 2 + 'px');
    cvModal.style.setProperty('--cy', rect.top + rect.height / 2 + 'px');
    from.focus({ preventScroll: true });
  }
  wake();
}

function requestClose() {
  if (cvOpen) {
    safeReplaceState(null, '#top');
    routedHash = '#top';
    closeCV();
    return;
  }
  if (dialogOpen) {
    safeReplaceState(null, '#work');
    routedHash = '#work';
    closeCS();
  }
}

function route() {
  if (routedHash === location.hash) return;
  routedHash = location.hash;
  if (location.hash === '#cv') {
    openCV(viewportWidth / 2, viewportHeight / 2, $('#cv-btn'));
    return;
  }
  const index = P.findIndex(function (_, i) { return projectHash(i) === location.hash; });
  if (index >= 0) {
    if (activeProject !== index || !dialogOpen) openCS(index, viewportWidth / 2, viewportHeight / 2, cards[index].el);
  } else {
    const wasOpen = dialogOpen || cvOpen;
    if (dialogOpen) closeCS();
    if (cvOpen) closeCV();
    if (!wasOpen && location.hash) scrollSection(location.hash, true);
  }
}

document.addEventListener('click', function (event) {
  const cardLink = event.target.closest('.card[data-i]');
  if (cardLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    const index = Number(cardLink.dataset.i);
    const hash = projectHash(index);
    const rect = cardLink.getBoundingClientRect();
    const clickX = event.clientX || (rect.left + rect.width / 2);
    const clickY = event.clientY || (rect.top + rect.height / 2);
    routedHash = hash;
    safePushState({ portfolioCase: true, returnHash: '#work' }, hash);
    openCS(index, clickX, clickY, cardLink);
    return;
  }

  const cvLink = event.target.closest('#cv-btn');
  if (cvLink && cvLink.getAttribute('href') === '#cv' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    const rect = cvLink.getBoundingClientRect();
    const clickX = event.clientX || (rect.left + rect.width / 2);
    const clickY = event.clientY || (rect.top + rect.height / 2);
    routedHash = '#cv';
    safePushState({ portfolioCV: true }, '#cv');
    openCV(clickX, clickY, cvLink);
    return;
  }

  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
  const hash = link.getAttribute('href');
  if (hash.length < 2) return;
  const index = P.findIndex(function (_, i) { return projectHash(i) === hash; });
  if (index >= 0) {
    event.preventDefault();
    routedHash = hash;
    safePushState({ portfolioCase: true, returnHash: location.hash || '#work' }, hash);
    openCS(index, event.detail ? event.clientX : viewportWidth / 2, event.detail ? event.clientY : viewportHeight / 2, link);
  } else if (document.getElementById(hash.slice(1))) {
    event.preventDefault();
    if (dialogOpen) closeCS();
    if (cvOpen) closeCV();
    routedHash = hash;
    safePushState(null, hash);
    soundscape.accent('select');
    scrollSection(hash, false);
  }
});

addEventListener('popstate', route);
addEventListener('hashchange', route);
$('#cards').addEventListener('keydown', function (event) {
  if ((event.key === ' ' || event.key === 'Enter') && event.target.matches('.card')) { event.preventDefault(); event.target.click(); }
});
up.addEventListener('click', function () {
  safePushState(null, '#top');
  routedHash = '#top';
  soundscape.accent('select');
  scrollSection('#top', false);
});
cs.querySelector('.x').addEventListener('click', requestClose);
$('#cv-close').addEventListener('click', requestClose);
$('#cv-print').addEventListener('click', function () {
  soundscape.accent('bloom');
  try { window.print(); } catch (_) {}
});

function modalControls(modalEl) {
  return Array.from(modalEl.querySelectorAll('a[href],button,[tabindex="0"]')).filter(function (el) { return !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'; });
}

document.addEventListener('keydown', function (event) {
  const activeModal = dialogOpen ? cs : (cvOpen ? cvModal : null);
  if (!activeModal) return;
  if (event.key === 'Escape') { event.preventDefault(); requestClose(); }
  if (event.key === 'Tab') {
    const controls = modalControls(activeModal);
    const first = controls[0] || activeModal;
    const lastControl = controls[controls.length - 1] || activeModal;
    if (!activeModal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === lastControl)) {
      event.preventDefault();
      (event.shiftKey ? lastControl : first).focus();
    }
  }
}, true);
document.addEventListener('focusin', function (event) {
  if (dialogOpen && !cs.contains(event.target)) cs.querySelector('.x').focus({ preventScroll: true });
  else if (cvOpen && !cvModal.contains(event.target)) $('#cv-close').focus({ preventScroll: true });
});

/* 8. Input and preferences — Smooth desktop scroll, native touch scroll and phone tilt. */
function applyPreferences() {
  Array.from(pausedGroups.keys()).forEach(function (root) { pauseArtwork(root, false); });
  const oldSmooth = sm;
  fine = pointerPreference.matches;
  sm = fine;
  if (oldSmooth !== sm) {
    const position = oldSmooth ? cur : scrollY;
    H.classList.toggle('sm', sm);
    W.style.transform = '';
    document.body.style.height = '';
    cur = tgt = marqueeScroll = position;
    if (sm) document.body.style.height = W.scrollHeight + 'px';
    scrollTo({ top: position, behavior: 'auto' });
  }
  H.classList.toggle('jc', fine);
  rows.forEach(function (row) { row.dirty = true; });
  cards.forEach(function (card) { pauseArtwork(card.el, !card.visible); });
  if (sceneCovered && dialogOpen) { pauseArtwork(W, true); pauseArtwork($('.nav'), true); }
  last = performance.now();
  invalidateLayout();
}
pointerPreference.addEventListener('change', applyPreferences);
addEventListener('pointermove', function (event) {
  px = event.clientX;
  py = event.clientY;
  hoverTarget = event.target;
  lastMove = performance.now();
  pointerDirty = true;
  wake();
}, { passive: true });
addEventListener('scroll', wake, { passive: true });
addEventListener('pageshow', function (event) {
  if (event.persisted) { last = performance.now(); invalidateLayout(); }
});
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    hiddenAt = performance.now();
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  } else {
    if (hiddenAt) timelineStart += performance.now() - hiddenAt;
    hiddenAt = 0;
    last = performance.now();
    invalidateLayout();
  }
});

/* Copy email — Icon-only button that expands on hover and shows checkmark on copy. */
const copyIconSVG = '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
const checkIconSVG = '<path d="M20 6L9 17l-5-5"/>';
let copyTimer = 0;

$('#cp').addEventListener('click', async function () {
  const status = $('#copy-status');
  const cpBtn = $('#cp');
  const cpTx = $('#cp-tx');
  const cpIc = $('#cp-ic');
  clearTimeout(copyTimer);
  soundscape.accent('bloom');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(SITE.email);
    } else {
      const ta = document.createElement('textarea');
      ta.value = SITE.email;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    status.textContent = 'Email copied.';
    cpTx.textContent = 'Copied!';
    cpIc.innerHTML = checkIconSVG;
    cpBtn.classList.add('copied');
  } catch (_) {
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents($('#em'));
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = 'Email selected. Use your device’s Copy command.';
    cpTx.textContent = 'Selected';
    cpBtn.classList.add('copied');
  }
  copyTimer = setTimeout(function () {
    cpTx.textContent = 'Copy email';
    cpIc.innerHTML = copyIconSVG;
    cpBtn.classList.remove('copied');
  }, 2000);
});

/* 9. Animation loop — Original timing + phone tilt for cards & whole webpage on phones. */
function wake() {
  if (!started || disposed || document.hidden || frameRequest) return;
  frameRequest = requestAnimationFrame(frame);
}

function entranceAmount() { return 1 - Math.pow(1 - itr, 3); }

function currentAmount() {
  const maxScroll = Math.max(1, docH - viewportHeight);
  const hero = Math.max(0, 1 - cur / (viewportHeight * .9));
  const footer = clamp((cur - (maxScroll - viewportHeight * 1.1)) / (viewportHeight * .8), 0, 1);
  return Math.max(hero, footer) * entranceAmount();
}

const lastTiltStyle = Object.create(null);
function updateTiltStyle(name, value) {
  if (lastTiltStyle[name] === value) return;
  lastTiltStyle[name] = value;
  H.style.setProperty(name, value);
}

function frame(now) {
  frameRequest = 0;
  const dt = Math.max(0.001, Math.min((now - last) / 1000, .05));
  const damp = function (rate) { return 1 - Math.exp(-dt * rate); };
  const time = (now - timelineStart) / 1000;
  last = now;
  const measured = layoutDirty;
  if (measured) measure();
  if (textDirty && !sceneCovered) drawTex();

  const previous = cur;
  tgt = scrollY;
  if (!sceneCovered) {
    if (sm) {
      cur = cur + (tgt - cur) * damp(6.5);
      if (Math.abs(tgt - cur) < .02) cur = tgt;
      vel = tgt - cur;
    } else {
      const rawDelta = tgt - previous;
      cur = tgt;
      vel = vel * (1 - damp(10)) + rawDelta * 0.65;
      if (Math.abs(vel) < 0.05) vel = 0;
    }
  }
  if (sm && cur !== previous) W.style.transform = 'translate3d(0,' + (-cur).toFixed(2) + 'px,0)';
  if (go) itr = Math.min(1, itr + dt / 1.5);
  const maxScroll = Math.max(1, docH - viewportHeight);
  const scrolled = cur !== lastScroll;

  /* Phone tilt interpolation (gyroscope + touch/scroll velocity fallback on mobile) */
  const isPhoneMode = !fine || hasGyro || viewportWidth <= 820;
  const scrollTiltY = clamp(vel * 0.016, -0.4, 0.4);
  const targetTiltX = hasGyro ? rawTiltX : (isPhoneMode ? touchTiltX + Math.sin(time * 0.8) * 0.22 : 0);
  const targetTiltY = hasGyro ? rawTiltY : (isPhoneMode ? touchTiltY + scrollTiltY + Math.cos(time * 0.62) * 0.16 : 0);
  tiltX += (targetTiltX - tiltX) * damp(6);
  tiltY += (targetTiltY - tiltY) * damp(6);

  /* Whole-webpage phone tilt on phones (per-section local 3D perspective + parallax) */
  if (isPhoneMode && !sceneCovered) {
    updateTiltStyle('--wt-rx', clamp(-tiltY * 3.8, -4.5, 4.5).toFixed(2) + 'deg');
    updateTiltStyle('--wt-ry', clamp(tiltX * 4.6, -5.5, 5.5).toFixed(2) + 'deg');
    updateTiltStyle('--wt-tx', clamp(tiltX * 7.5, -9, 9).toFixed(1) + 'px');
    updateTiltStyle('--wt-ty', clamp(tiltY * 5.5, -7, 7).toFixed(1) + 'px');
  } else if (!isPhoneMode) {
    updateTiltStyle('--wt-rx', '0deg');
    updateTiltStyle('--wt-ry', '0deg');
    updateTiltStyle('--wt-tx', '0px');
    updateTiltStyle('--wt-ty', '0px');
  }

  /* WebGL 3D liquid glass spheres — driven by pointer on PC and phone tilt on phones */
  {
    const idle = now - lastMove > 2600 && !hasGyro;
    let gx, gy;
    if (isPhoneMode && (hasGyro || Math.abs(tiltX) + Math.abs(tiltY) > 0.02)) {
      gx = tiltX * 0.9 + Math.sin(time * 0.6) * 0.25;
      gy = -tiltY * 0.6 + Math.cos(time * 0.45) * 0.15;
    } else if (idle) {
      gx = Math.sin(time * .6) * .7;
      gy = Math.cos(time * .45) * .22;
    } else {
      gx = (px * 2 - viewportWidth) / viewportHeight;
      gy = -(py * 2 - viewportHeight) / viewportHeight;
    }
    mx += (gx - mx) * damp(4);
    my += (gy - my) * damp(4);
    if (ok && textureWidth && !sceneCovered) renderGraphics(time, currentAmount(), entranceAmount());
  }

  // Match desktop's eased scroll response while leaving native touch scrolling intact.
  marqueeScroll = sm ? cur : marqueeScroll + (tgt - marqueeScroll) * damp(6.5);
  const marqueeVelocity = sm ? vel : tgt - marqueeScroll;
  const marqueeSpeed = sm ? marqueeVelocity : marqueeVelocity * .85;
  rows.forEach(function (row) {
    row.x += row.direction * (36 + Math.abs(marqueeSpeed) * 7) * dt;
    if (row.x <= -row.width) row.x += row.width;
    if (row.x > 0) row.x -= row.width;
    if (!sceneCovered) {
      row.el.style.transform = 'translate3d(' + row.x.toFixed(2) + 'px,0,0) skewX(' + clamp(-marqueeVelocity * .12, -8, 8).toFixed(2) + 'deg)';
      row.dirty = false;
    }
  });

  if (!sceneCovered) {
    if (scrolled || measured) {
      const progress = clamp((viewportHeight * .85 - (abT - cur)) / (abH + viewportHeight * .35), 0, 1) * words.length * 1.1;
      words.forEach(function (word, index) {
        const opacity = Math.round(clamp(.16 + (progress - index) * .5, .16, 1) * 40) / 40;
        if (word._opacity !== opacity) { word._opacity = opacity; word.style.opacity = opacity; }
      });
    }

    /* 3D Card Tilt — Cursor perspective on PC, Phone Tilt perspective on phones */
    cards.forEach(function (card, idx) {
      let targetRx = 0;
      let targetRy = 0;
      let spotX = 50;
      let spotY = 0;
      let glow = 0;

      if (fine && !hasGyro) {
        const hovered = card.el === hoverCard;
        if (hovered) {
          const x = clamp((px - card.x) / Math.max(1, card.width), 0, 1);
          const y = clamp((py - (card.y - cur)) / Math.max(1, card.height), 0, 1);
          targetRx = (.5 - y) * 8;
          targetRy = (x - .5) * 10;
          spotX = x * 100;
          spotY = y * 100;
          glow = 1;
        }
      } else if (card.visible) {
        const cardScreenY = (card.y - cur + card.height * 0.5 - viewportHeight * 0.5) / Math.max(1, viewportHeight);
        const phase = idx * 0.7;
        const tx = clamp(tiltX + Math.sin(time * 0.85 + phase) * 0.12, -1, 1);
        const ty = clamp(tiltY - cardScreenY * 0.3, -1, 1);
        targetRx = -ty * 8.5;
        targetRy = tx * 10.5;
        spotX = clamp(50 + tx * 40, 5, 95);
        spotY = clamp(45 + ty * 40, 5, 95);
        glow = 0.72;
      }

      card.rx += (targetRx - card.rx) * damp(9);
      card.ry += (targetRy - card.ry) * damp(9);
      if (card.visible || Math.abs(card.rx) + Math.abs(card.ry) > .01) {
        card.el.style.setProperty('--rx', card.rx.toFixed(2) + 'deg');
        card.el.style.setProperty('--ry', card.ry.toFixed(2) + 'deg');
        card.el.style.setProperty('--mx', spotX.toFixed(1) + '%');
        card.el.style.setProperty('--my', spotY.toFixed(1) + '%');
        card.el.style.setProperty('--card-glow', glow.toFixed(2));
      }
    });

    /* Gentle, non-overlapping magnetic pull on hover buttons */
    if (fine) {
      const hoveredMag = hoverTarget && hoverTarget.closest ? hoverTarget.closest('.mag') : null;
      magnets.forEach(function (magnet) {
        let tx = 0;
        let ty = 0;
        if (magnet.el === hoveredMag) {
          const rect = magnet.el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2 - magnet.x;
          const cy = rect.top + rect.height / 2 - magnet.y;
          const dx = px - cx;
          const dy = py - cy;
          const maxPull = magnet.isBig ? 4 : 6;
          const factor = magnet.isBig ? 0.06 : 0.14;
          tx = clamp(dx * factor, -maxPull, maxPull);
          ty = clamp(dy * factor, -maxPull, maxPull);
        }
        magnet.x += (tx - magnet.x) * damp(10);
        magnet.y += (ty - magnet.y) * damp(10);
        if (Math.abs(magnet.x) + Math.abs(magnet.y) > .02) magnet.el.style.transform = 'translate3d(' + magnet.x.toFixed(2) + 'px,' + magnet.y.toFixed(2) + 'px,0)';
        else if (magnet.el.style.transform) magnet.el.style.transform = '';
      });
    }

    const progress = (132 * (1 - clamp(cur / maxScroll, 0, 1))).toFixed(1);
    if (progress !== lastProgress) { rg.style.strokeDashoffset = progress; lastProgress = progress; }
    const showUp = cur > viewportHeight * .6;
    if (showUp !== upOn) { upOn = showUp; up.classList.toggle('on', showUp); up.tabIndex = showUp ? 0 : -1; up.setAttribute('aria-hidden', String(!showUp)); }
  }

  let cursorMoving = false;
  if (fine) {
    if (hoverTarget !== lastHover) {
      lastHover = hoverTarget;
      const hovered = hoverTarget && hoverTarget.closest ? hoverTarget.closest('[data-cur],a,button') : null;
      if (hovered) soundscape.accent('hover');
      cr.classList.toggle('h', !!hovered);
      cr.textContent = hovered && hovered.dataset.cur || '';
      hoverCard = hoverTarget && hoverTarget.closest ? hoverTarget.closest('.card') : null;
    }
    cursorMoving = pointerDirty || Math.abs(px - rx) + Math.abs(py - ry) > .02;
    if (cursorMoving) {
      cd.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
      rx += (px - rx) * damp(14);
      ry += (py - ry) * damp(14);
      cr.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0)';
    }
  }
  pointerDirty = false;
  lastScroll = cur;
  if (!sceneCovered || layoutDirty || textDirty || cursorMoving || Math.abs(tgt - cur) > .02) wake();
}

/* 10. Entrance — Original rolling digits and liquid curtain. */
const reels = $$('#ld .od>div');
const curtains = [['#lp3', .16], ['#lp2', .08], ['#lp1', 0]].map(function (item) { return [$(item[0]), item[1]]; });
const digits = function (values) { return values.map(function (digit) { return '<span>' + digit + '</span>'; }).join(''); };
reels[0].innerHTML = digits([0, 1]);
reels[1].innerHTML = reels[2].innerHTML = digits([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
const curtainEase = function (p) { return p <= 0 ? 0 : p >= 1 ? 1 : p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2; };

function setCurtain(progress) {
  curtains.forEach(function (item) {
    const q = clamp((progress - item[1]) / .84, 0, 1);
    const y = 100 * (1 - curtainEase(q));
    const bend = 34 * Math.sin(Math.PI * q);
    item[0].setAttribute('d', 'M0 0H100V' + y.toFixed(2) + 'Q50 ' + (y + bend).toFixed(2) + ' 0 ' + y.toFixed(2) + 'Z');
  });
}

function setDigits(value) {
  if (value >= 100) { reels[2].style.transform = reels[1].style.transform = 'translate3d(0,-10em,0)'; reels[0].style.transform = 'translate3d(0,-1em,0)'; return; }
  const ones = value % 10;
  const c = clamp((ones - (value >= 90 ? 9 : 8)) / (value >= 90 ? 1 : 2), 0, 1);
  const carry = c * c * (3 - 2 * c);
  const c0 = clamp(value - 99, 0, 1);
  const finalCarry = c0 * c0 * (3 - 2 * c0);
  reels[2].style.transform = 'translate3d(0,' + (-(value >= 99 ? 9 + finalCarry : ones)).toFixed(3) + 'em,0)';
  reels[1].style.transform = 'translate3d(0,' + (-(Math.floor(value / 10) % 10 + carry)).toFixed(3) + 'em,0)';
  reels[0].style.transform = 'translate3d(0,' + (-finalCarry).toFixed(3) + 'em,0)';
}

let entranceFinished = false;
function setPortfolioTheme() {
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', '#e9e0f1');
}
function finishEntrance() {
  if (entranceFinished) return;
  entranceFinished = true;
  H.classList.remove('booting');
  if (!dialogOpen && !cvOpen) sceneCovered = false;
  $('#ld')?.remove();
  H.classList.add('ready', 'rd');
  setPortfolioTheme();
  document.body.classList.add('ready');
  go = true;
  invalidateLayout();
  if (location.hash) route();
}

async function beginEntrance() {
  sceneCovered = true;
  let fontsReady = false;
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(function (resolve) { setTimeout(resolve, 1000); })]).then(function () { fontsReady = true; });
  let value = 0, phase = 0, phaseStart = 0, previous = performance.now();
  const loader = function (now) {
    if (entranceFinished) return;
    const dt = Math.max(0, Math.min((now - previous) / 1000, .05));
    previous = now;
    if (phase === 0) {
      value = Math.min(100, value + ((fontsReady ? 100.6 : 92) - value) * (1 - Math.exp(-dt * 5.2)));
      setDigits(value);
      if (fontsReady && value >= 100) {
        phase = 1;
        phaseStart = now;
        $('#ld .c').classList.add('go');
        $('#ld').style.pointerEvents = 'none';
        H.classList.add('ready', 'rd');
        setPortfolioTheme();
        document.body.classList.add('ready');
        sceneCovered = false;
        go = true;
        invalidateLayout();
        wake();
      }
    } else {
      const progress = Math.min(1, (now - phaseStart) / 1500);
      setCurtain(progress);
      if (progress >= 1) { finishEntrance(); return; }
    }
    requestAnimationFrame(loader);
  };
  setCurtain(0);
  setDigits(0);
  requestAnimationFrame(loader);
  setTimeout(finishEntrance, 5000);
}

/* A reload restarts the entrance at the top. New deep links and history restores keep their routes. */
function prepareReloadStart() {
  const navigation = typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('navigation')[0] : null;
  if (!navigation || navigation.type !== 'reload') return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash && location.hash !== '#top') safeReplaceState(history.state, '#top');
  function resetReloadPosition() {
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
    cur = tgt = marqueeScroll = 0;
    vel = 0;
    lastScroll = -1;
    W.style.transform = '';
    invalidateLayout();
  }
  resetReloadPosition();
  addEventListener('pageshow', function (event) {
    if (event.persisted) return;
    resetReloadPosition();
    requestAnimationFrame(function () {
      resetReloadPosition();
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    });
  }, { once: true });
}

/* 11. Start — Enhance only after setup; plain HTML remains a complete fallback. */
prepareReloadStart();
H.classList.add('js');
H.classList.toggle('sm', sm);
H.classList.toggle('jc', fine);
up.hidden = false;
up.tabIndex = -1;
cs.inert = true;
cvModal.inert = true;
started = true;
applyPreferences();
initGraphics();
beginEntrance();
wake();
