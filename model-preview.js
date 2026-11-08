const stages = [...document.querySelectorAll('[data-model-stage]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let viewerModule;

const loadViewerModule = () => {
  if (!viewerModule) {
    viewerModule = import('./assets/vendor/model-viewer-4.4.0.min.js').catch((error) => {
      viewerModule = null;
      throw error;
    });
  }
  return viewerModule;
};

const syncViewers = () => {
  const turning = document.documentElement.classList.contains('is-page-turning');
  stages.forEach((stage) => {
    const viewer = stage.querySelector('model-viewer');
    if (!viewer) return;
    const active = stage.closest('[data-book-page]')?.classList.contains('is-active');
    viewer.toggleAttribute('auto-rotate', active && stage.classList.contains('is-3d') && !turning && !document.hidden && !reducedMotion.matches);
  });
};

stages.forEach((stage, index) => {
  const button = stage.querySelector('[data-model-open]');
  const reset = stage.querySelector('[data-model-reset]');
  const status = stage.querySelector('[data-model-status]');
  const originalButton = button.innerHTML;
  let pending = false;

  const close = () => {
    const viewer = stage.querySelector('model-viewer');
    viewer?.removeAttribute('auto-rotate');
    stage.classList.remove('is-3d', 'is-model-loading');
    button.innerHTML = originalButton;
    button.setAttribute('aria-pressed', 'false');
    reset.hidden = true;
    status.textContent = '';
    syncViewers();
  };

  const showReady = () => {
    if (!stage.classList.contains('is-3d')) return;
    stage.classList.remove('is-model-loading');
    const note = stage.dataset.modelNote;
    status.textContent = note ? `${note} · Trascina per ruotare` : 'Trascina per ruotare · scorri per lo zoom';
    reset.hidden = false;
    syncViewers();
  };

  button.addEventListener('click', async () => {
    if (pending) return;
    if (stage.classList.contains('is-3d')) {
      close();
      return;
    }

    pending = true;
    button.setAttribute('aria-busy', 'true');
    status.textContent = 'Caricamento del modello 3D…';
    stage.classList.add('is-model-loading');
    try {
      await loadViewerModule();
      let viewer = stage.querySelector('model-viewer');
      if (!viewer) {
        viewer = document.createElement('model-viewer');
        viewer.id = `project-model-${index}`;
        viewer.className = 'model-canvas';
        viewer.setAttribute('alt', stage.dataset.modelAlt);
        viewer.setAttribute('camera-controls', '');
        viewer.setAttribute('touch-action', 'pan-y');
        viewer.setAttribute('disable-pan', '');
        viewer.setAttribute('interaction-prompt', 'none');
        viewer.setAttribute('loading', 'eager');
        viewer.setAttribute('environment-image', 'neutral');
        viewer.setAttribute('shadow-intensity', '.8');
        viewer.setAttribute('shadow-softness', '.8');
        viewer.setAttribute('exposure', '1.1');
        viewer.setAttribute('camera-orbit', stage.dataset.cameraOrbit);
        viewer.setAttribute('min-camera-orbit', 'auto 12deg 35%');
        viewer.setAttribute('max-camera-orbit', 'auto 95deg 220%');
        viewer.setAttribute('field-of-view', '30deg');
        viewer.setAttribute('rotation-per-second', '12deg');
        viewer.setAttribute('auto-rotate-delay', '2400');
        const progress = document.createElement('div');
        progress.slot = 'progress-bar';
        const panTarget = document.createElement('span');
        panTarget.slot = 'pan-target';
        panTarget.setAttribute('aria-hidden', 'true');
        viewer.append(progress, panTarget);
        viewer.addEventListener('load', showReady);
        viewer.addEventListener('error', () => {
          close();
          viewer.remove();
          status.textContent = 'Il 3D non è disponibile su questo dispositivo. La presentazione resta visibile.';
        });
        button.setAttribute('aria-controls', viewer.id);
        stage.append(viewer);
        viewer.setAttribute('src', stage.dataset.modelSrc);
      }
      stage.querySelector('video')?.pause();
      stage.classList.add('is-3d');
      button.textContent = stage.dataset.modelReturn;
      button.setAttribute('aria-pressed', 'true');
      if (viewer.loaded) showReady();
      syncViewers();
    } catch {
      close();
      status.textContent = 'Connessione al 3D non riuscita. Premi di nuovo per riprovare.';
    } finally {
      pending = false;
      button.removeAttribute('aria-busy');
    }
  });

  reset.addEventListener('click', () => {
    const viewer = stage.querySelector('model-viewer');
    if (!viewer) return;
    viewer.cameraOrbit = stage.dataset.cameraOrbit;
    viewer.fieldOfView = '30deg';
    viewer.resetTurntableRotation();
    if (reducedMotion.matches) viewer.jumpCameraToGoal();
  });
});

document.addEventListener('portfolio:pagechange', syncViewers);
document.addEventListener('portfolio:turnstart', syncViewers);
document.addEventListener('visibilitychange', syncViewers);
reducedMotion.addEventListener('change', syncViewers);
