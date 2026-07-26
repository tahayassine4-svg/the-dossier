/* THE DOSSIER // runtime for built files.
   Wires the two interactive components a file can contain: copy buttons on
   prompt blocks, and click-to-play on video. Both are optional; a file
   without them loads this and does nothing. */
(function(){

  /* ---- prompt copy buttons ---- */
  [].slice.call(document.querySelectorAll('[data-copy]')).forEach(function(btn){
    var target = document.getElementById(btn.getAttribute('data-copy'));
    if (!target) return;
    var idle = btn.textContent;

    btn.addEventListener('click', function(){
      var text = target.textContent;

      function done(ok){
        btn.textContent = ok ? '[ Copied ]' : '[ Select and copy ]';
        setTimeout(function(){ btn.textContent = idle; }, 1600);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(false); });
        return;
      }
      // Older browsers, and any page not served over https.
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        done(document.execCommand('copy'));
        document.body.removeChild(ta);
      } catch(e){ done(false); }
    });
  });

  /* ---- video ---- */
  [].slice.call(document.querySelectorAll('[data-video]')).forEach(function(wrap){
    var video = wrap.querySelector('video');
    var btn   = wrap.querySelector('[data-video-btn]');
    if (!video || !btn) return;

    function sync(){ btn.textContent = video.paused ? '[ Play ]' : '[ Pause ]'; }

    function toggle(){
      if (video.paused) { video.play(); } else { video.pause(); }
    }

    btn.addEventListener('click', toggle);
    video.addEventListener('click', toggle);
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('ended', sync);
    sync();
  });

})();
