(function () {
  'use strict';
  var scene = document.getElementById('heritageScene');
  var button = document.getElementById('heritageMotion');
  if (!scene || !button) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var paused = false, frame = 0;
  function reset() { scene.style.removeProperty('--tilt-x'); scene.style.removeProperty('--tilt-y'); }
  function sync() {
    scene.classList.toggle('is-paused', paused || reduce.matches);
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? '播放動態' : '暫停動態';
    if (paused || reduce.matches) reset();
  }
  button.addEventListener('click', function () { paused = !paused; sync(); });
  scene.addEventListener('pointermove', function (event) {
    if (paused || reduce.matches || !fine.matches || event.pointerType === 'touch') return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(function () {
      var r = scene.getBoundingClientRect();
      scene.style.setProperty('--tilt-x', ((event.clientX-r.left)/r.width-.5)*1.6+'deg');
      scene.style.setProperty('--tilt-y', -((event.clientY-r.top)/r.height-.5)*1.2+'deg');
    });
  });
  scene.addEventListener('pointerleave', function () { cancelAnimationFrame(frame); reset(); });
  if (reduce.addEventListener) reduce.addEventListener('change', sync);
  sync();
})();
