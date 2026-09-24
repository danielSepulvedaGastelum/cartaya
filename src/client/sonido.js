export async function avisarPedido() {
  let audio;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio = new Audio();
    if (audio.state === 'suspended') await audio.resume();
    const tono = audio.createOscillator();
    const volumen = audio.createGain();
    tono.frequency.value = 880;
    volumen.gain.setValueAtTime(0.12, audio.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
    tono.connect(volumen); volumen.connect(audio.destination);
    tono.onended = () => { void audio.close().catch(() => {}); };
    tono.start(); tono.stop(audio.currentTime + 0.2);
  } catch {
    // El bloqueo del navegador no impide mostrar ni operar el pedido.
    try { await audio?.close(); } catch { /* El contexto ya puede estar cerrado. */ }
  }
}
