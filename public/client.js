const tela = document.getElementById('jogo');
const contexto = tela.getContext('2d');

const elementoConexao = document.getElementById('conexao');
const elementoInfoJogador = document.getElementById('infoJogador');
const elementoInfoMunicao = document.getElementById('infoMunicao');
const elementoInfoBandeira = document.getElementById('infoBandeira');
const elementoInfoPartida = document.getElementById('infoPartida');
const elementoInfoPlacar = document.getElementById('infoPlacar');
const elementoTituloLobby = document.getElementById('tituloLobby');
const elementoInfoLobby = document.getElementById('infoLobby');
const campoRodadas = document.getElementById('configRodadas');
const campoNpcs = document.getElementById('configNpcs');
const campoTamanho = document.getElementById('configTamanho');
const campoMapa = document.getElementById('configMapa');
const botaoAplicar = document.getElementById('botaoAplicar');
const botaoReiniciar = document.getElementById('botaoReiniciar');
const botaoPronto = document.getElementById('botaoPronto');
const botaoTelaCheia = document.getElementById('botaoTelaCheia');
const controleMovimento = document.getElementById('controleMovimento');
const controleMovimentoPino = document.getElementById('controleMovimentoPino');
const botaoDevagar = document.getElementById('botaoDevagar');
const botaoAtirar = document.getElementById('botaoAtirar');
const botaoAtirarPino = document.getElementById('botaoAtirarPino');
const elementoJogo = document.querySelector('.shell');

let soquete;
let estado = null;
let estadoMaisRecente = null;
let meuId = null;
let ponteiroNoMundo = { x: tela.width / 2, y: tela.height / 2 };
let souAnfitriaoAtual = false;
let temporizadorConfiguracoes = null;
let disparoPendente = false;
const RAIO_VISAO_PROXIMA = 46;
const FOLGA_VISIBILIDADE_BANDEIRA = 12;
const INTERPOLACAO = 0.28;
const ALCANCE_AUTO_MIRA_TOQUE = 760;
const ANGULO_ASSISTENCIA_MIRA = Math.PI / 5;

const entrada = {
  cima: false,
  baixo: false,
  esquerda: false,
  direita: false,
  devagar: false,
  atirando: false,
  miraX: ponteiroNoMundo.x,
  miraY: ponteiroNoMundo.y
};

const toqueMovimento = {
  ativo: false,
  idPonteiro: null,
  centroX: 0,
  centroY: 0,
  raio: 48
};

const toqueTiro = {
  ativo: false,
  idPonteiro: null,
  centroX: 0,
  centroY: 0,
  raio: 42,
  distancia: 0,
  zonaMorta: 0
};

const gerenciadorAudio = criarGerenciadorAudio((estadoAtual) =>
  estadoAtual.jogadores?.find((jogadorAtual) => jogadorAtual.id === estadoAtual.meuId)
);
const iniciarAudio = gerenciadorAudio.iniciarAudio;
const processarSonsDoEstado = gerenciadorAudio.processarSonsDoEstado;

function conectar() {
  const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  soquete = new WebSocket(`${protocolo}//${window.location.host}`);

  soquete.addEventListener('open', () => {
    elementoConexao.textContent = 'Conectado ao servidor.';
  });

  soquete.addEventListener('message', (evento) => {
    const mensagem = JSON.parse(evento.data);

    if (mensagem.tipo === 'boasVindas') {
      meuId = mensagem.idJogador;
      elementoConexao.textContent = `Conectado como Jogador ${mensagem.idTime}.`;
    }

    if (mensagem.tipo === 'lotado') {
      elementoConexao.textContent = mensagem.mensagem;
    }

    if (mensagem.tipo === 'retrato') {
      estadoMaisRecente = mensagem.estado;
      processarSonsDoEstado(estadoMaisRecente);
      if (!estado) {
        estado = clonarEstado(estadoMaisRecente);
      }
      sincronizarTelaComMundo(estadoMaisRecente.mundo);
      sincronizarFormularioConfiguracoes(estadoMaisRecente.configuracoes);
      atualizarInterfaceLobby(estadoMaisRecente);
      atualizarHud();
    }
  });

  soquete.addEventListener('close', () => {
    elementoConexao.textContent = 'Conexão encerrada.';
  });
}

function atualizarHud() {
  const estadoHud = estadoMaisRecente || estado;
  if (!estadoHud || !estadoHud.visualizador) return;
  document.body.classList.toggle('partida-iniciada', estadoHud.iniciado);

  if (estadoHud.iniciado) {
    return;
  }

  const time = estadoHud.times[estadoHud.visualizador.idTime];
  elementoInfoJogador.textContent = `Jogador: ${time.nome}`;
  elementoInfoMunicao.textContent = `Munição: ${estadoHud.visualizador.municao}/${estadoHud.municaoMaxima}`;
  elementoInfoBandeira.textContent = estadoHud.visualizador.carregandoBandeiraDoTime ? 'Bandeira: carregando' : 'Bandeira: nenhuma';
  elementoInfoPlacar.textContent = `Placar: ${estadoHud.placar[1]} x ${estadoHud.placar[2]} | Melhor de ${estadoHud.configuracoes.rodadasParaVencer}`;
}

function atualizarInterfaceLobby(estadoAtual) {
  if (!estadoAtual || !estadoAtual.lobby || !estadoAtual.configuracoes) return;

  const souAnfitriao = meuId === estadoAtual.lobby.idAnfitriao;
  souAnfitriaoAtual = souAnfitriao;
  const jogadores = estadoAtual.lobby.quantidadeJogadores;
  const configuracoes = estadoAtual.configuracoes;
  const tamanho = estadoAtual.mundo;

  elementoTituloLobby.textContent = souAnfitriao ? 'Lobby - você configura a partida' : 'Lobby - aguarde e confirme pronto';
  elementoInfoLobby.textContent =
    `Jogadores: ${jogadores}/2 | Rodadas: ${configuracoes.rodadasParaVencer} | NPCs: ${configuracoes.quantidadeNpcs} | ` +
    `Mapa: ${formatarOpcao(configuracoes.tipoMapa)} | Tamanho: ${formatarOpcao(configuracoes.tamanhoMapa)} (${tamanho.largura}x${tamanho.altura})`;

  campoRodadas.disabled = !souAnfitriao;
  campoNpcs.disabled = !souAnfitriao;
  campoTamanho.disabled = !souAnfitriao;
  campoMapa.disabled = !souAnfitriao;
  botaoAplicar.disabled = !souAnfitriao;
  botaoReiniciar.disabled = !souAnfitriao;
  botaoPronto.disabled = souAnfitriao || jogadores < 2 || estadoAtual.lobby.prontoSegundoJogador;
  botaoAplicar.style.display = souAnfitriao ? '' : 'none';
  botaoReiniciar.style.display = souAnfitriao ? '' : 'none';
  botaoPronto.style.display = souAnfitriao ? 'none' : '';
  botaoPronto.textContent = estadoAtual.lobby.prontoSegundoJogador ? 'Pronto enviado' : 'Pronto';

  if (souAnfitriao) {
    elementoInfoPartida.textContent = jogadores < 2 ? 'Aguardando o segundo jogador.' : 'Quando o segundo jogador clicar em pronto, a partida começa.';
  } else {
    elementoInfoPartida.textContent = jogadores < 2 ? 'Aguardando outro jogador.' : 'Confira as informações da partida e clique em pronto.';
  }
}

function formatarOpcao(valor) {
  const nomes = {
    pequeno: 'Pequeno',
    medio: 'Médio',
    grande: 'Grande',
    classico: 'Clássico',
    corredores: 'Corredores',
    ilhas: 'Ilhas'
  };
  return nomes[valor] || valor;
}

function sincronizarTelaComMundo(mundo) {
  if (!mundo) return;
  if (tela.width !== mundo.largura) tela.width = mundo.largura;
  if (tela.height !== mundo.altura) tela.height = mundo.altura;
  tela.style.aspectRatio = `${mundo.largura} / ${mundo.altura}`;
  tela.style.maxWidth = `${mundo.largura}px`;
}

function sincronizarFormularioConfiguracoes(configuracoes) {
  if (!configuracoes) return;
  const editandoConfiguracao = [campoRodadas, campoNpcs, campoTamanho, campoMapa].includes(document.activeElement);
  if (editandoConfiguracao) return;

  campoRodadas.value = configuracoes.rodadasParaVencer;
  campoNpcs.value = configuracoes.quantidadeNpcs;
  campoTamanho.value = configuracoes.tamanhoMapa;
  campoMapa.value = configuracoes.tipoMapa;
}

function enviarConfiguracoes() {
  const estadoAtual = estadoMaisRecente || estado;
  if (!souAnfitriaoAtual || estadoAtual?.iniciado || !soquete || soquete.readyState !== WebSocket.OPEN) return;

  soquete.send(
    JSON.stringify({
      tipo: 'configuracoes',
      configuracoes: {
        rodadasParaVencer: Number(campoRodadas.value),
        quantidadeNpcs: Number(campoNpcs.value),
        tamanhoMapa: campoTamanho.value,
        tipoMapa: campoMapa.value
      }
    })
  );
}

function agendarEnvioConfiguracoes() {
  clearTimeout(temporizadorConfiguracoes);
  temporizadorConfiguracoes = setTimeout(enviarConfiguracoes, 180);
}

function enviarReinicio() {
  if (!soquete || soquete.readyState !== WebSocket.OPEN) return;
  soquete.send(JSON.stringify({ tipo: 'reiniciar' }));
}

function enviarPronto() {
  if (!soquete || soquete.readyState !== WebSocket.OPEN) return;
  soquete.send(JSON.stringify({ tipo: 'pronto' }));
}

function enviarEntrada() {
  if (!soquete || soquete.readyState !== WebSocket.OPEN) return;

  entrada.miraX = ponteiroNoMundo.x;
  entrada.miraY = ponteiroNoMundo.y;
  const entradaEnviada = {
    ...entrada,
    atirando: entrada.atirando || disparoPendente
  };
  disparoPendente = false;
  soquete.send(JSON.stringify({ tipo: 'entrada', entrada: entradaEnviada }));
}

function telaParaMundo(evento) {
  const retangulo = tela.getBoundingClientRect();
  const escalaX = tela.width / retangulo.width;
  const escalaY = tela.height / retangulo.height;
  return {
    x: (evento.clientX - retangulo.left) * escalaX,
    y: (evento.clientY - retangulo.top) * escalaY
  };
}

window.addEventListener('keydown', (evento) => {
  iniciarAudio();
  if (evento.repeat) return;
  definirTecla(evento.key, evento.code, true);
});

window.addEventListener('keyup', (evento) => {
  definirTecla(evento.key, evento.code, false);
});

tela.addEventListener('mousemove', (evento) => {
  ponteiroNoMundo = telaParaMundo(evento);
});

tela.addEventListener('pointerdown', (evento) => {
  if (evento.pointerType === 'mouse') return;
  iniciarAudio();
  ponteiroNoMundo = telaParaMundo(evento);
  evento.preventDefault();
});

tela.addEventListener('pointermove', (evento) => {
  if (evento.pointerType === 'mouse') return;
  ponteiroNoMundo = telaParaMundo(evento);
  evento.preventDefault();
});

tela.addEventListener('mousedown', (evento) => {
  iniciarAudio();
  if (evento.button === 0) entrada.atirando = true;
});

window.addEventListener('mouseup', (evento) => {
  if (evento.button === 0) entrada.atirando = false;
});

tela.addEventListener('contextmenu', (evento) => evento.preventDefault());
botaoAplicar.addEventListener('click', enviarConfiguracoes);
botaoReiniciar.addEventListener('click', enviarReinicio);
botaoPronto.addEventListener('click', enviarPronto);
botaoTelaCheia.addEventListener('click', alternarTelaCheia);
document.addEventListener('fullscreenchange', atualizarBotaoTelaCheia);
controleMovimento.addEventListener('pointerdown', iniciarMovimentoPorToque);
controleMovimento.addEventListener('pointermove', atualizarMovimentoPorToque);
controleMovimento.addEventListener('pointerup', finalizarMovimentoPorToque);
controleMovimento.addEventListener('pointercancel', finalizarMovimentoPorToque);
botaoAtirar.addEventListener('pointerdown', iniciarTiroPorToque);
botaoAtirar.addEventListener('pointermove', atualizarTiroPorToque);
botaoAtirar.addEventListener('pointerup', finalizarTiroPorToque);
botaoAtirar.addEventListener('pointercancel', finalizarTiroPorToque);
botaoDevagar.addEventListener('pointerdown', (evento) => {
  iniciarAudio();
  entrada.devagar = !entrada.devagar;
  botaoDevagar.classList.toggle('ativo', entrada.devagar);
  evento.preventDefault();
});
[campoRodadas, campoNpcs, campoTamanho, campoMapa].forEach((campo) => {
  campo.addEventListener('change', agendarEnvioConfiguracoes);
  campo.addEventListener('input', agendarEnvioConfiguracoes);
});

function iniciarMovimentoPorToque(evento) {
  iniciarAudio();
  controleMovimento.setPointerCapture(evento.pointerId);
  const retangulo = controleMovimento.getBoundingClientRect();
  toqueMovimento.ativo = true;
  toqueMovimento.idPonteiro = evento.pointerId;
  toqueMovimento.centroX = retangulo.left + retangulo.width / 2;
  toqueMovimento.centroY = retangulo.top + retangulo.height / 2;
  toqueMovimento.raio = retangulo.width * 0.38;
  atualizarMovimentoPorToque(evento);
  evento.preventDefault();
}

function atualizarMovimentoPorToque(evento) {
  if (!toqueMovimento.ativo || evento.pointerId !== toqueMovimento.idPonteiro) return;

  const dx = evento.clientX - toqueMovimento.centroX;
  const dy = evento.clientY - toqueMovimento.centroY;
  const distancia = Math.hypot(dx, dy);
  const limite = toqueMovimento.raio;
  const proporcao = distancia > limite ? limite / distancia : 1;
  const xLimitado = dx * proporcao;
  const yLimitado = dy * proporcao;
  const zonaMorta = limite * 0.24;

  entrada.esquerda = xLimitado < -zonaMorta;
  entrada.direita = xLimitado > zonaMorta;
  entrada.cima = yLimitado < -zonaMorta;
  entrada.baixo = yLimitado > zonaMorta;

  controleMovimentoPino.style.transform = `translate(calc(-50% + ${xLimitado}px), calc(-50% + ${yLimitado}px))`;

  evento.preventDefault();
}

function finalizarMovimentoPorToque(evento) {
  if (evento.pointerId !== toqueMovimento.idPonteiro) return;

  toqueMovimento.ativo = false;
  toqueMovimento.idPonteiro = null;
  entrada.esquerda = false;
  entrada.direita = false;
  entrada.cima = false;
  entrada.baixo = false;
  controleMovimentoPino.style.transform = 'translate(-50%, -50%)';
  evento.preventDefault();
}

function iniciarTiroPorToque(evento) {
  iniciarAudio();
  botaoAtirar.setPointerCapture(evento.pointerId);
  const retangulo = botaoAtirar.getBoundingClientRect();
  toqueTiro.ativo = true;
  toqueTiro.idPonteiro = evento.pointerId;
  toqueTiro.centroX = retangulo.left + retangulo.width / 2;
  toqueTiro.centroY = retangulo.top + retangulo.height / 2;
  toqueTiro.raio = retangulo.width * 0.38;
  entrada.atirando = false;
  botaoAtirar.classList.add('ativo');
  atualizarTiroPorToque(evento);
  evento.preventDefault();
}

function atualizarTiroPorToque(evento) {
  if (!toqueTiro.ativo || evento.pointerId !== toqueTiro.idPonteiro) return;

  const dx = evento.clientX - toqueTiro.centroX;
  const dy = evento.clientY - toqueTiro.centroY;
  const distancia = Math.hypot(dx, dy);
  const limite = toqueTiro.raio;
  const proporcao = distancia > limite ? limite / distancia : 1;
  const xLimitado = dx * proporcao;
  const yLimitado = dy * proporcao;
  const zonaMorta = limite * 0.18;
  toqueTiro.distancia = distancia;
  toqueTiro.zonaMorta = zonaMorta;

  botaoAtirarPino.style.transform = `translate(calc(-50% + ${xLimitado}px), calc(-50% + ${yLimitado}px))`;

  const jogador = obterMeuJogador();
  if (jogador && distancia > zonaMorta) {
    ponteiroNoMundo = {
      x: jogador.x + dx * 8,
      y: jogador.y + dy * 8
    };
  }

  evento.preventDefault();
}

function finalizarTiroPorToque(evento) {
  if (evento.pointerId !== toqueTiro.idPonteiro) return;

  if (toqueTiro.distancia <= toqueTiro.zonaMorta) {
    mirarNoAlvoMaisPerto();
  } else {
    ajustarMiraParaAlvoNaDirecao();
  }

  toqueTiro.ativo = false;
  toqueTiro.idPonteiro = null;
  toqueTiro.distancia = 0;
  disparoPendente = true;
  enviarEntrada();
  entrada.atirando = false;
  botaoAtirar.classList.remove('ativo');
  botaoAtirarPino.style.transform = 'translate(-50%, -50%)';
  evento.preventDefault();
}

function obterAlvosParaMira() {
  if (!estado) return [];
  return [...estado.jogadores.filter((outroJogador) => outroJogador.id !== meuId), ...estado.monstros];
}

function mirarNoAlvoMaisPerto() {
  if (!estado) return;

  const jogador = obterMeuJogador();
  if (!jogador) return;

  let alvoMaisPerto = null;
  let menorDistancia = Infinity;

  obterAlvosParaMira().forEach((alvo) => {
    const distanciaAteAlvo = Math.hypot(alvo.x - jogador.x, alvo.y - jogador.y);
    if (distanciaAteAlvo < menorDistancia && distanciaAteAlvo <= ALCANCE_AUTO_MIRA_TOQUE) {
      menorDistancia = distanciaAteAlvo;
      alvoMaisPerto = alvo;
    }
  });

  if (alvoMaisPerto) {
    ponteiroNoMundo = { x: alvoMaisPerto.x, y: alvoMaisPerto.y };
  }
}

function ajustarMiraParaAlvoNaDirecao() {
  if (!estado) return;

  const jogador = obterMeuJogador();
  if (!jogador) return;

  const anguloMira = Math.atan2(ponteiroNoMundo.y - jogador.y, ponteiroNoMundo.x - jogador.x);
  let melhorAlvo = null;
  let melhorPontuacao = Infinity;

  obterAlvosParaMira().forEach((alvo) => {
    const dx = alvo.x - jogador.x;
    const dy = alvo.y - jogador.y;
    const distanciaAteAlvo = Math.hypot(dx, dy);
    if (distanciaAteAlvo > ALCANCE_AUTO_MIRA_TOQUE) return;

    const diferenca = diferencaAngulo(anguloMira, Math.atan2(dy, dx));
    if (diferenca > ANGULO_ASSISTENCIA_MIRA) return;

    const pontuacao = diferenca * 280 + distanciaAteAlvo;
    if (pontuacao < melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhorAlvo = alvo;
    }
  });

  if (melhorAlvo) {
    ponteiroNoMundo = { x: melhorAlvo.x, y: melhorAlvo.y };
  }
}

function alternarTelaCheia() {
  const elementoTelaCheia = elementoJogo || document.documentElement;
  const elementoAtual = document.fullscreenElement || document.webkitFullscreenElement;
  const dispositivoToque = window.matchMedia('(pointer: coarse)').matches;

  if (dispositivoToque) {
    elementoJogo.classList.toggle('modo-tela-cheia');
    atualizarBotaoTelaCheia();
    return;
  }

  if (!elementoAtual && elementoJogo.classList.contains('modo-tela-cheia')) {
    elementoJogo.classList.remove('modo-tela-cheia');
    atualizarBotaoTelaCheia();
    return;
  }

  if (!elementoAtual) {
    const solicitarTelaCheia = elementoTelaCheia.requestFullscreen || elementoTelaCheia.webkitRequestFullscreen;
    if (!solicitarTelaCheia) {
      elementoJogo.classList.toggle('modo-tela-cheia');
      atualizarBotaoTelaCheia();
      return;
    }

    const resultado = solicitarTelaCheia.call(elementoTelaCheia);
    Promise.resolve(resultado)
      .then(() => {
        elementoJogo.classList.remove('modo-tela-cheia');
        screen.orientation?.lock?.('landscape');
      })
      .catch(() => {
        elementoJogo.classList.add('modo-tela-cheia');
        atualizarBotaoTelaCheia();
      });
    return;
  }

  const sairTelaCheia = document.exitFullscreen || document.webkitExitFullscreen;
  sairTelaCheia?.call(document);
}

function atualizarBotaoTelaCheia() {
  const estaEmTelaCheia = document.fullscreenElement || document.webkitFullscreenElement || elementoJogo.classList.contains('modo-tela-cheia');
  botaoTelaCheia.textContent = estaEmTelaCheia ? 'Sair da tela cheia' : 'Tela cheia';
}

function definirTecla(chave, codigo, pressionado) {
  const minuscula = chave.toLowerCase();
  if (minuscula === 'w') entrada.cima = pressionado;
  if (minuscula === 's') entrada.baixo = pressionado;
  if (minuscula === 'a') entrada.esquerda = pressionado;
  if (minuscula === 'd') entrada.direita = pressionado;
  if (chave === 'Shift' || codigo === 'ShiftLeft' || codigo === 'ShiftRight') entrada.devagar = pressionado;
}

function desenhar() {
  contexto.clearRect(0, 0, tela.width, tela.height);
  suavizarEstadoRenderizado();

  if (!estado) {
    desenharTextoCentralizado('Conectando ao servidor...');
    requestAnimationFrame(desenhar);
    return;
  }

  const meuJogador = obterMeuJogador();
  if (!meuJogador) {
    desenharMapa();
    requestAnimationFrame(desenhar);
    return;
  }

  desenharAreaNaoVista();

  contexto.save();
  aplicarRecorteVisao(meuJogador);
  desenharMapa();
  desenharBases();
  desenharBandeiras();
  desenharRuidos();
  desenharMonstros();
  desenharTiros();
  desenharJogadores();
  desenharLinhaMira();
  contexto.restore();

  desenharContornoVisao(meuJogador);

  if (estado.vencedor) {
    desenharFaixa(`Time ${estado.times[estado.vencedor].nome} venceu a partida`);
  } else if (estado.vencedorRodada) {
    desenharFaixa(`Time ${estado.times[estado.vencedorRodada].nome} venceu a rodada`);
  } else if (!estado.iniciado) {
    desenharFaixa('Lobby');
  }

  requestAnimationFrame(desenhar);
}

function suavizarEstadoRenderizado() {
  if (!estadoMaisRecente) return;
  if (!estado) {
    estado = clonarEstado(estadoMaisRecente);
    return;
  }

  estado.mundo = estadoMaisRecente.mundo;
  estado.iniciado = estadoMaisRecente.iniciado;
  estado.vencedor = estadoMaisRecente.vencedor;
  estado.vencedorRodada = estadoMaisRecente.vencedorRodada;
  estado.placar = estadoMaisRecente.placar;
  estado.configuracoes = estadoMaisRecente.configuracoes;
  estado.municaoMaxima = estadoMaisRecente.municaoMaxima;
  estado.raioVisao = estadoMaisRecente.raioVisao;
  estado.anguloVisao = estadoMaisRecente.anguloVisao;
  estado.visualizador = estadoMaisRecente.visualizador;
  estado.obstaculos = estadoMaisRecente.obstaculos;
  estado.buracos = estadoMaisRecente.buracos;
  estado.ruidos = estadoMaisRecente.ruidos;
  estado.times = interpolarTimes(estado.times, estadoMaisRecente.times);
  estado.jogadores = interpolarListaEntidades(estado.jogadores, estadoMaisRecente.jogadores, 'id', ['x', 'y', 'progressoCaptura']);
  estado.bandeiras = interpolarListaEntidades(estado.bandeiras, estadoMaisRecente.bandeiras, 'idTime', ['x', 'y']);
  estado.monstros = interpolarListaEntidades(estado.monstros, estadoMaisRecente.monstros, 'id', ['x', 'y']);
  estado.tiros = interpolarListaEntidades(estado.tiros, estadoMaisRecente.tiros, 'id', ['x', 'y']);
}

function interpolarTimes(timesAtuais, proximosTimes) {
  const resultado = {};

  Object.entries(proximosTimes).forEach(([idTime, proximoTime]) => {
    const timeAtual = timesAtuais && timesAtuais[idTime] ? timesAtuais[idTime] : proximoTime;
    resultado[idTime] = {
      ...proximoTime,
      base: {
        x: interpolar(timeAtual.base.x, proximoTime.base.x, INTERPOLACAO),
        y: interpolar(timeAtual.base.y, proximoTime.base.y, INTERPOLACAO)
      },
      casaBandeira: {
        x: interpolar(timeAtual.casaBandeira.x, proximoTime.casaBandeira.x, INTERPOLACAO),
        y: interpolar(timeAtual.casaBandeira.y, proximoTime.casaBandeira.y, INTERPOLACAO)
      }
    };
  });

  return resultado;
}

function interpolarListaEntidades(listaAtual = [], proximaLista = [], chave, campos) {
  return proximaLista.map((proximoItem) => {
    const itemAtual = listaAtual.find((item) => item[chave] === proximoItem[chave]);
    if (!itemAtual) return { ...proximoItem };

    const item = { ...proximoItem };
    campos.forEach((campo) => {
      if (Number.isFinite(itemAtual[campo]) && Number.isFinite(proximoItem[campo])) {
        item[campo] = interpolar(itemAtual[campo], proximoItem[campo], INTERPOLACAO);
      }
    });
    return item;
  });
}

function interpolar(de, para, quantidade) {
  return de + (para - de) * quantidade;
}

function clonarEstado(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function desenharAreaNaoVista() {
  contexto.fillStyle = '#020617';
  contexto.fillRect(0, 0, tela.width, tela.height);
}

function aplicarRecorteVisao(meuJogador) {
  const visao = obterInfoVisao();
  const anguloInicial = visao.angulo - estado.anguloVisao / 2;
  const anguloFinal = visao.angulo + estado.anguloVisao / 2;

  contexto.beginPath();
  contexto.moveTo(meuJogador.x, meuJogador.y);
  contexto.arc(meuJogador.x, meuJogador.y, estado.raioVisao, anguloInicial, anguloFinal);
  contexto.closePath();
  contexto.moveTo(meuJogador.x + RAIO_VISAO_PROXIMA, meuJogador.y);
  contexto.arc(meuJogador.x, meuJogador.y, RAIO_VISAO_PROXIMA, 0, Math.PI * 2);
  contexto.clip();
}

function desenharMapa() {
  contexto.fillStyle = '#20252f';
  contexto.fillRect(0, 0, tela.width, tela.height);

  contexto.strokeStyle = '#2d3748';
  contexto.lineWidth = 1;
  for (let x = 0; x <= tela.width; x += 50) {
    contexto.beginPath();
    contexto.moveTo(x, 0);
    contexto.lineTo(x, tela.height);
    contexto.stroke();
  }
  for (let y = 0; y <= tela.height; y += 50) {
    contexto.beginPath();
    contexto.moveTo(0, y);
    contexto.lineTo(tela.width, y);
    contexto.stroke();
  }

  estado.obstaculos.forEach((obstaculo) => {
    contexto.fillStyle = '#78350f';
    contexto.fillRect(obstaculo.x, obstaculo.y, obstaculo.largura, obstaculo.altura);
    contexto.strokeStyle = '#f59e0b';
    contexto.lineWidth = 2;
    contexto.strokeRect(obstaculo.x, obstaculo.y, obstaculo.largura, obstaculo.altura);

    contexto.strokeStyle = 'rgba(254, 243, 199, 0.18)';
    contexto.lineWidth = 1;
    for (let x = obstaculo.x + 12; x < obstaculo.x + obstaculo.largura; x += 18) {
      contexto.beginPath();
      contexto.moveTo(x, obstaculo.y + 4);
      contexto.lineTo(x - 18, obstaculo.y + obstaculo.altura - 4);
      contexto.stroke();
    }
  });

  estado.buracos.forEach((buraco) => {
    const gradiente = contexto.createRadialGradient(buraco.x, buraco.y, buraco.raio * 0.2, buraco.x, buraco.y, buraco.raio);
    gradiente.addColorStop(0, '#000000');
    gradiente.addColorStop(0.58, '#030712');
    gradiente.addColorStop(1, '#111827');

    contexto.beginPath();
    contexto.arc(buraco.x, buraco.y, buraco.raio, 0, Math.PI * 2);
    contexto.fillStyle = gradiente;
    contexto.fill();
    contexto.strokeStyle = 'rgba(31, 41, 55, 0.75)';
    contexto.lineWidth = 2;
    contexto.stroke();

    contexto.beginPath();
    contexto.arc(buraco.x, buraco.y, buraco.raio * 0.62, 0, Math.PI * 2);
    contexto.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    contexto.lineWidth = 1;
    contexto.stroke();
  });
}

function desenharBases() {
  Object.values(estado.times).forEach((time) => {
    contexto.beginPath();
    contexto.arc(time.base.x, time.base.y, 62, 0, Math.PI * 2);
    contexto.fillStyle = hexParaRgba(time.cor, 0.18);
    contexto.fill();
    contexto.strokeStyle = time.cor;
    contexto.lineWidth = 3;
    contexto.stroke();
  });
}

function desenharBandeiras() {
  estado.bandeiras.forEach((bandeira) => {
    if (!pontoEstaVisivel(bandeira.x, bandeira.y, FOLGA_VISIBILIDADE_BANDEIRA)) return;

    const time = estado.times[bandeira.idTime];
    contexto.fillStyle = time.cor;
    contexto.fillRect(bandeira.x - 8, bandeira.y - 8, 16, 16);
    contexto.strokeStyle = '#f9fafb';
    contexto.strokeRect(bandeira.x - 8, bandeira.y - 8, 16, 16);
  });
}

function desenharJogadores() {
  estado.jogadores.forEach((jogador) => {
    if (jogador.id !== meuId && !pontoEstaVisivel(jogador.x, jogador.y, jogador.raio)) return;
    const souEu = jogador.id === meuId;

    contexto.beginPath();
    contexto.arc(jogador.x, jogador.y, jogador.raio, 0, Math.PI * 2);
    contexto.fillStyle = souEu ? jogador.cor : '#f97316';
    contexto.fill();
    contexto.strokeStyle = souEu ? '#fef3c7' : '#fff7ed';
    contexto.lineWidth = souEu ? 4 : 3;
    contexto.stroke();

    if (jogador.invulneravel) {
      contexto.beginPath();
      contexto.arc(jogador.x, jogador.y, jogador.raio + 8, 0, Math.PI * 2);
      contexto.strokeStyle = 'rgba(125, 211, 252, 0.85)';
      contexto.lineWidth = 3;
      contexto.stroke();
    }

    if (!souEu) {
      contexto.beginPath();
      contexto.moveTo(jogador.x - 8, jogador.y - 22);
      contexto.lineTo(jogador.x + 8, jogador.y - 22);
      contexto.lineTo(jogador.x, jogador.y - 34);
      contexto.closePath();
      contexto.fillStyle = '#f97316';
      contexto.fill();
      contexto.strokeStyle = '#fff7ed';
      contexto.stroke();
    }

    if (jogador.carregandoBandeiraDoTime) {
      contexto.fillStyle = '#fef3c7';
      contexto.fillRect(jogador.x - 6, jogador.y - 36, 12, 12);
    }

    if (souEu && jogador.progressoCaptura > 0) {
      desenharAnelProgresso(jogador.x, jogador.y, jogador.raio + 10, jogador.progressoCaptura);
    }
  });
}

function desenharMonstros() {
  estado.monstros.forEach((monstro) => {
    if (!pontoEstaVisivel(monstro.x, monstro.y, monstro.raio)) return;

    contexto.beginPath();
    contexto.arc(monstro.x, monstro.y, monstro.raio, 0, Math.PI * 2);
    contexto.fillStyle = '#991b1b';
    contexto.fill();
    contexto.strokeStyle = '#fecaca';
    contexto.lineWidth = 4;
    contexto.stroke();

    contexto.beginPath();
    contexto.moveTo(monstro.x - monstro.raio * 0.7, monstro.y - monstro.raio * 0.95);
    contexto.lineTo(monstro.x - monstro.raio * 0.25, monstro.y - monstro.raio * 0.25);
    contexto.lineTo(monstro.x - monstro.raio * 0.95, monstro.y - monstro.raio * 0.25);
    contexto.closePath();
    contexto.moveTo(monstro.x + monstro.raio * 0.7, monstro.y - monstro.raio * 0.95);
    contexto.lineTo(monstro.x + monstro.raio * 0.25, monstro.y - monstro.raio * 0.25);
    contexto.lineTo(monstro.x + monstro.raio * 0.95, monstro.y - monstro.raio * 0.25);
    contexto.closePath();
    contexto.fillStyle = '#f87171';
    contexto.fill();

    contexto.beginPath();
    contexto.arc(monstro.x - 6, monstro.y - 3, 3, 0, Math.PI * 2);
    contexto.arc(monstro.x + 6, monstro.y - 3, 3, 0, Math.PI * 2);
    contexto.fillStyle = '#fef2f2';
    contexto.fill();

    contexto.beginPath();
    contexto.moveTo(monstro.x - 10, monstro.y + 8);
    contexto.lineTo(monstro.x - 4, monstro.y + 14);
    contexto.lineTo(monstro.x, monstro.y + 8);
    contexto.lineTo(monstro.x + 4, monstro.y + 14);
    contexto.lineTo(monstro.x + 10, monstro.y + 8);
    contexto.strokeStyle = '#fef2f2';
    contexto.lineWidth = 3;
    contexto.stroke();
  });
}

function desenharTiros() {
  estado.tiros.forEach((tiro) => {
    if (tiro.idDono !== meuId && !pontoEstaVisivel(tiro.x, tiro.y, 8)) return;

    contexto.beginPath();
    contexto.arc(tiro.x, tiro.y, 4, 0, Math.PI * 2);
    contexto.fillStyle = '#facc15';
    contexto.fill();
  });
}

function desenharRuidos() {
  estado.ruidos.forEach((ruido) => {
    if (!pontoEstaVisivel(ruido.x, ruido.y, Math.min(80, ruido.forca))) return;

    const alfa = Math.max(0, ruido.vida / 170) * 0.18;
    contexto.beginPath();
    contexto.arc(ruido.x, ruido.y, Math.min(80, ruido.forca), 0, Math.PI * 2);
    contexto.strokeStyle = `rgba(250, 204, 21, ${alfa})`;
    contexto.lineWidth = 2;
    contexto.stroke();
  });
}

function desenharLinhaMira() {
  const meuJogador = obterMeuJogador();
  if (!meuJogador) return;

  contexto.beginPath();
  contexto.moveTo(meuJogador.x, meuJogador.y);
  contexto.lineTo(ponteiroNoMundo.x, ponteiroNoMundo.y);
  contexto.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  contexto.lineWidth = 2;
  contexto.stroke();
}

function desenharContornoVisao(meuJogador) {
  const visao = obterInfoVisao();
  const anguloInicial = visao.angulo - estado.anguloVisao / 2;
  const anguloFinal = visao.angulo + estado.anguloVisao / 2;

  contexto.save();
  contexto.beginPath();
  contexto.moveTo(meuJogador.x, meuJogador.y);
  contexto.arc(meuJogador.x, meuJogador.y, estado.raioVisao, anguloInicial, anguloFinal);
  contexto.closePath();
  contexto.strokeStyle = 'rgba(248, 250, 252, 0.22)';
  contexto.lineWidth = 2;
  contexto.stroke();

  contexto.beginPath();
  contexto.arc(meuJogador.x, meuJogador.y, RAIO_VISAO_PROXIMA, 0, Math.PI * 2);
  contexto.strokeStyle = 'rgba(248, 250, 252, 0.16)';
  contexto.lineWidth = 1;
  contexto.stroke();
  contexto.restore();
}

function desenharAnelProgresso(x, y, raio, progresso) {
  contexto.beginPath();
  contexto.arc(x, y, raio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progresso);
  contexto.strokeStyle = '#22c55e';
  contexto.lineWidth = 4;
  contexto.stroke();
}

function desenharFaixa(texto) {
  const largura = Math.min(520, tela.width - 80);
  const altura = 90;
  const x = (tela.width - largura) / 2;
  const y = (tela.height - altura) / 2;
  contexto.fillStyle = 'rgba(17, 24, 39, 0.82)';
  contexto.fillRect(x, y, largura, altura);
  contexto.strokeStyle = '#f9fafb';
  contexto.strokeRect(x, y, largura, altura);
  contexto.fillStyle = '#f9fafb';
  contexto.font = '700 26px Arial';
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  contexto.fillText(texto, tela.width / 2, y + altura / 2);
}

function desenharTextoCentralizado(texto) {
  contexto.fillStyle = '#f9fafb';
  contexto.font = '700 24px Arial';
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  contexto.fillText(texto, tela.width / 2, tela.height / 2);
}

function obterMeuJogador() {
  if (!estado) return null;
  return estado.jogadores.find((jogador) => jogador.id === meuId);
}

function obterInfoVisao() {
  const meuJogador = obterMeuJogador();
  if (!meuJogador) {
    return { x: 0, y: 0, angulo: 0 };
  }

  const dx = ponteiroNoMundo.x - meuJogador.x;
  const dy = ponteiroNoMundo.y - meuJogador.y;
  const angulo = Math.hypot(dx, dy) < 4 ? 0 : Math.atan2(dy, dx);
  return { x: meuJogador.x, y: meuJogador.y, angulo };
}

function pontoEstaVisivel(x, y, margem = 0) {
  const meuJogador = obterMeuJogador();
  if (!meuJogador || !estado) return true;
  if (Math.hypot(x - meuJogador.x, y - meuJogador.y) <= RAIO_VISAO_PROXIMA + margem) return true;

  const dx = x - meuJogador.x;
  const dy = y - meuJogador.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia > estado.raioVisao + margem) return false;

  const visao = obterInfoVisao();
  const anguloAlvo = Math.atan2(dy, dx);
  return diferencaAngulo(visao.angulo, anguloAlvo) <= estado.anguloVisao / 2;
}

function diferencaAngulo(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function hexParaRgba(hex, alfa) {
  const valor = hex.replace('#', '');
  const vermelho = parseInt(valor.slice(0, 2), 16);
  const verde = parseInt(valor.slice(2, 4), 16);
  const azul = parseInt(valor.slice(4, 6), 16);
  return `rgba(${vermelho}, ${verde}, ${azul}, ${alfa})`;
}

conectar();
setInterval(enviarEntrada, 1000 / 30);
requestAnimationFrame(desenhar);
