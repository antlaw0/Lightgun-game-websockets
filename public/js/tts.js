// Simple global Text-To-Speech helper
// Usage: window.speak(text, { lang, rate, pitch, volume, interrupt })
// Example: window.speak('Editor mode on');
(function(){
  if (window.tts) return; // already defined

  const queue = [];
  let speaking = false;

  function _speakNow(text, opts={}){
    try {
      const ut = new SpeechSynthesisUtterance(String(text));
      ut.lang = opts.lang || navigator.language || 'en-US';
      ut.rate = typeof opts.rate === 'number' ? opts.rate : 1.0;
      ut.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1.0;
      ut.volume = typeof opts.volume === 'number' ? opts.volume : 1.0;
      ut.onend = () => {
        speaking = false;
        // next in queue
        if (queue.length) {
          const next = queue.shift();
          _speakNow(next.text, next.opts);
        }
      };
      ut.onerror = () => {
        speaking = false;
        if (queue.length) {
          const next = queue.shift();
          _speakNow(next.text, next.opts);
        }
      };
      speaking = true;
      window.speechSynthesis.speak(ut);
    } catch (e) {
      console.warn('TTS speak failed', e);
    }
  }

  const tts = {
    enabled: true,
    speak(text, opts={}){
      if (!tts.enabled) return;
      if (!text) return;
      if (opts.interrupt) {
        try { window.speechSynthesis.cancel(); } catch(e){}
        // clear queue
        queue.length = 0;
        _speakNow(text, opts);
        return;
      }
      // queueable
      if (!speaking && queue.length === 0) {
        _speakNow(text, opts);
      } else {
        queue.push({ text, opts });
      }
    },
    cancel(){ try { window.speechSynthesis.cancel(); } catch(e){}; queue.length = 0; speaking = false; }
  };

  window.tts = tts;
  window.speak = function(text, opts){ return window.tts.speak(text, opts); };
})();
