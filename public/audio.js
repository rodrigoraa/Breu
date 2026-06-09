function criarGerenciadorAudio(obterJogadorAtual) {
  let contextoAudio = null;
  let somLiberado = false;
  const ruidosJaTocados = new Set();

  function iniciarAudio() {
    if (somLiberado) return;
    const ConstrutorAudio = window.AudioContext || window.webkitAudioContext;
    if (!ConstrutorAudio) return;

    contextoAudio = contextoAudio || new ConstrutorAudio();
    contextoAudio.resume?.();
    somLiberado = true;
  }

  function processarSonsDoEstado(estadoAtual) {
    if (!somLiberado || !contextoAudio || !estadoAtual?.ruidos) return;

    estadoAtual.ruidos.forEach((ruido) => {
      if (!ruido.id || ruidosJaTocados.has(ruido.id)) return;

      const intensidade = calcularIntensidadeRuido(estadoAtual, ruido);
      if (intensidade > 0.01) {
        ruidosJaTocados.add(ruido.id);
        tocarSomPorRuido(ruido.tipo, intensidade);
      }
    });

    while (ruidosJaTocados.size > 120) {
      ruidosJaTocados.delete(ruidosJaTocados.values().next().value);
    }
  }

  function calcularIntensidadeRuido(estadoAtual, ruido) {
    if (ruido.tipo === 'fim-rodada') return 1;

    const jogador = obterJogadorAtual(estadoAtual);
    if (!jogador || !Number.isFinite(ruido.x) || !Number.isFinite(ruido.y)) return 1;

    const alcances = {
      passo: 520,
      tiro: 780,
      impacto: 540,
      monstro: 470,
      'monstro-atingido': 650,
      morte: 620,
      atingido: 620,
      'queda-buraco': 620,
      bandeira: 560,
      'captura-bandeira': 760,
      'mudanca-base': 900,
      'recarga-municao': 460
    };
    const alcance = alcances[ruido.tipo] || 560;
    const distancia = Math.hypot(jogador.x - ruido.x, jogador.y - ruido.y);
    const proximidade = Math.max(0, 1 - distancia / alcance);
    return Math.pow(proximidade, 1.35);
  }

  function tocarSomPorRuido(tipo, intensidade = 1) {
    const sons = {
      passo: () => tocarTom(115, 0.045, 'sine', 0.075 * intensidade, 80),
      tiro: () => tocarTom(180, 0.06, 'square', 0.24 * intensidade, 70),
      impacto: () => tocarRuidoCurto(0.08, 0.15 * intensidade),
      monstro: () => tocarTom(58, 0.28, 'sawtooth', 0.045 * intensidade, 42),
      'monstro-atingido': () => tocarTom(90, 0.18, 'sawtooth', 0.2 * intensidade, 35),
      morte: () => tocarSequencia([150, 95, 55], 0.09, 'sawtooth', 0.19 * intensidade),
      atingido: () => tocarTom(130, 0.2, 'sawtooth', 0.2 * intensidade, 45),
      'queda-buraco': () => tocarTom(70, 0.28, 'sine', 0.24 * intensidade, 28),
      bandeira: () => tocarSequencia([520, 760], 0.08, 'triangle', 0.16 * intensidade),
      'captura-bandeira': () => tocarTom(420, 0.08, 'triangle', 0.11 * intensidade, 500),
      'fim-rodada': () => tocarSequencia([440, 620, 840], 0.12, 'triangle', 0.18),
      'mudanca-base': () => tocarSequencia([260, 220], 0.12, 'sawtooth', 0.13 * intensidade),
      'recarga-municao': () => tocarSequencia([360, 520], 0.07, 'sine', 0.11 * intensidade)
    };

    sons[tipo]?.();
  }

  function tocarTom(frequencia, duracao, tipo = 'sine', volume = 0.15, frequenciaFinal = frequencia) {
    if (!contextoAudio) return;

    const agora = contextoAudio.currentTime;
    const oscilador = contextoAudio.createOscillator();
    const ganho = contextoAudio.createGain();

    oscilador.type = tipo;
    oscilador.frequency.setValueAtTime(frequencia, agora);
    oscilador.frequency.exponentialRampToValueAtTime(Math.max(20, frequenciaFinal), agora + duracao);
    ganho.gain.setValueAtTime(0.0001, agora);
    ganho.gain.exponentialRampToValueAtTime(volume, agora + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);

    oscilador.connect(ganho);
    ganho.connect(contextoAudio.destination);
    oscilador.start(agora);
    oscilador.stop(agora + duracao + 0.02);
  }

  function tocarSequencia(frequencias, duracao, tipo, volume) {
    frequencias.forEach((frequencia, indice) => {
      setTimeout(() => tocarTom(frequencia, duracao, tipo, volume), indice * duracao * 1000);
    });
  }

  function tocarRuidoCurto(duracao, volume) {
    if (!contextoAudio) return;

    const quantidadeAmostras = Math.max(1, Math.floor(contextoAudio.sampleRate * duracao));
    const buffer = contextoAudio.createBuffer(1, quantidadeAmostras, contextoAudio.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < quantidadeAmostras; i += 1) {
      dados[i] = (Math.random() * 2 - 1) * (1 - i / quantidadeAmostras);
    }

    const fonte = contextoAudio.createBufferSource();
    const ganho = contextoAudio.createGain();
    ganho.gain.value = volume;
    fonte.buffer = buffer;
    fonte.connect(ganho);
    ganho.connect(contextoAudio.destination);
    fonte.start();
  }

  return {
    iniciarAudio,
    processarSonsDoEstado
  };
}
