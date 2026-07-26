/* THE DOSSIER // clearance capture.
   Drives every [data-signup] block on a page. A success in one flips them
   all, so a reader is never asked twice further down the same page. All
   pages share one Formspree form and one localStorage key, so clearance
   granted anywhere is recognised everywhere.

   Configured from <body>:
     data-signup-redirect="guide.html"  gate mode: grant, then send the
                                        reader on. Recording is fire and
                                        forget, since the navigation would
                                        otherwise cancel it in flight.
     data-signup-success="..."          list mode: the line shown once the
                                        endpoint has actually accepted it.
     data-signup-endpoint="..."         overrides the endpoint below. */
(function(){
  var KEY = 'dossier_clearance';
  var DEFAULT_ENDPOINT = 'https://formspree.io/f/xjgnplqz';

  var body     = document.body;
  var endpoint = body.getAttribute('data-signup-endpoint') || DEFAULT_ENDPOINT;
  var redirect = body.getAttribute('data-signup-redirect');
  var success  = body.getAttribute('data-signup-success') || 'On the list. The next file will find you.';

  var blocks = [].slice.call(document.querySelectorAll('[data-signup]'));
  if (!blocks.length) return;

  function payload(email, source){
    return JSON.stringify({
      email: email,
      source: source || 'dossier',
      ref: document.referrer || ''
    });
  }

  function showOnFile(email){
    blocks.forEach(function(block){
      block.querySelector('[data-signup-box]').style.display = 'none';
      var onFile = block.querySelector('[data-signup-onfile]');
      onFile.style.display = 'flex';
      onFile.querySelector('[data-signup-onfile-email]').textContent = email;
    });
  }

  function remember(email){
    try { localStorage.setItem(KEY, JSON.stringify({ email: email, grantedAt: Date.now() })); } catch(e){}
  }

  var existing = null;
  try { existing = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
  if (existing && existing.email) showOnFile(existing.email);

  blocks.forEach(function(block){
    var form   = block.querySelector('[data-signup-form]');
    var input  = block.querySelector('[data-signup-input]');
    var btn    = block.querySelector('[data-signup-btn]');
    var status = block.querySelector('[data-signup-status]');
    var idle   = btn.textContent;
    var source = block.getAttribute('data-signup');

    function setStatus(msg, kind){
      status.textContent = msg;
      status.className = 'status micro' + (kind ? ' ' + kind : '');
    }

    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var email = input.value.trim();
      if (!email || email.indexOf('@') < 1 || email.lastIndexOf('.') < email.indexOf('@')) {
        setStatus('Invalid channel. Check the address.', 'err');
        input.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = '[ Transmitting… ]';

      if (redirect) {
        // The reader is never made to wait on the network to reach a file
        // they have already earned. keepalive lets the post outlive the
        // navigation that follows it.
        setStatus('Verifying clearance…');
        try {
          fetch(endpoint, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: payload(email, source)
          }).catch(function(){});
        } catch(e){}

        remember(email);
        setStatus('Clearance granted. Opening file…', 'ok');
        setTimeout(function(){ window.location.href = redirect; }, 700);
        return;
      }

      // Nothing to navigate to here, so wait for the real answer and report
      // a real failure rather than a comfortable lie.
      setStatus('Adding to the list…');
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: payload(email, source)
      })
      .then(function(r){
        if (!r.ok) throw new Error('rejected');
        remember(email);
        setStatus(success, 'ok');
        setTimeout(function(){ showOnFile(email); }, 1400);
      })
      .catch(function(){
        btn.disabled = false;
        btn.textContent = idle;
        setStatus('Transmission failed. Try again in a moment.', 'err');
      });
    });
  });
})();
