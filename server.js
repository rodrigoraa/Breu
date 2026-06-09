const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { configuracoesPadrao, normalizarConfiguracoes: normalizarConfiguracoesBase, tamanhosMapa } = require('./src/configuracoes');
const { colisaoCirculoRetangulo, distancia, limitar } = require('./src/fisica');
const { criarJogador: criarJogadorBase } = require('./src/jogadores');
const { criarObstaculos, criarPosicoesBases } = require('./src/mapas');
const { criarMonstro } = require('./src/monstros');
const { criarTiro } = require('./src/tiros');

const PORTA = process.env.PORT || 3000;
const TAXA_TICK = 1000 / 60;
const TAXA_RETRATO_ESTADO = 1000 / 30;

const MUNDO = { largura: 1000, altura: 650 };
const RAIO_JOGADOR = 16;
const VELOCIDADE_JOGADOR = 3.1;
const MULTIPLICADOR_VELOCIDADE_LENTA = 0.45;
const RAIO_VISAO = 170;
const ANGULO_VISAO = Math.PI * 0.72;
const RAIO_BASE = 62;
const TAMANHO_BANDEIRA = 16;
const VELOCIDADE_TIRO = 9;
const RAIO_TIRO = 4;
const VIDA_TIRO = 80;
const MUNICAO_MAXIMA = 6;
const RECARGA_MS = 1400;
const TICKS_SEGURAR_CAPTURA = 60 * 3;
const VIDA_RUIDO = 170;
const TICKS_MUDANCA_BASE = 60 * 25;
const TICKS_PROXIMA_RODADA = 60 * 3;
const LIMIAR_AUDICAO_MONSTRO = 0.055;
const INTERVALO_RUIDO_CAPTURA = 18;
const INTERVALO_PASSO_MS = 210;
const INTERVALO_RUIDO_MONSTRO_MS = 1300;
const FORCA_RUIDO_PASSO = 36;
const VIDA_RUIDO_PASSO = 95;
const TICKS_MEMORIA_MONSTRO = 105;
const VELOCIDADE_MONSTRO_ALERTA = 2.05;
const VELOCIDADE_MONSTRO_VAGANDO = 0.45;
const DURACAO_INVULNERAVEL_MS = 1500;
const FOLGA_NASCIMENTO_BURACO = 34;

const aplicativo = express();
const servidorHttp = http.createServer(aplicativo);
const servidorWebSocket = new WebSocket.Server({ server: servidorHttp });

aplicativo.use(express.static(path.join(__dirname, 'public')));

const configuracoes = { ...configuracoesPadrao };

const times = {
  1: {
    id: 1,
    nome: 'Azul',
    cor: '#3b82f6',
    base: { x: 95, y: MUNDO.altura / 2 },
    casaBandeira: { x: 95, y: MUNDO.altura / 2 }
  },
  2: {
    id: 2,
    nome: 'Vermelho',
    cor: '#ef4444',
    base: { x: MUNDO.largura - 95, y: MUNDO.altura / 2 },
    casaBandeira: { x: MUNDO.largura - 95, y: MUNDO.altura / 2 }
  }
};

let obstaculos = [];
let buracos = [];
let posicoesBases = [];

const clientes = new Map();
let proximoIdCliente = 1;
let tiros = [];
let ruidos = [];
let ultimoRetratoEstado = 0;
let posicaoBaseAtual = 0;
let idAnfitriao = null;
let segundoJogadorPronto = false;

const estado = {
  iniciado: false,
  vencedor: null,
  vencedorRodada: null,
  ticksProximaRodada: 0,
  ticksMudancaBase: TICKS_MUDANCA_BASE,
  placar: { 1: 0, 2: 0 },
  jogadores: {},
  bandeiras: {
    1: criarBandeira(1),
    2: criarBandeira(2)
  },
  monstros: []
};

aplicarMapaAtual();

function criarBuracos(tipoMapa, largura, altura) {
  const quantidade = tipoMapa === 'corredores' ? 4 : tipoMapa === 'ilhas' ? 7 : 5;
  const buracosCriados = [];
  let tentativas = 0;

  while (buracosCriados.length < quantidade && tentativas < 260) {
    tentativas += 1;
    const raio = 28 + Math.random() * 18;
    const candidato = {
      id: buracosCriados.length + 1,
      x: raio + 50 + Math.random() * (largura - raio * 2 - 100),
      y: raio + 50 + Math.random() * (altura - raio * 2 - 100),
      raio
    };

    if (buracoPodeFicarAqui(candidato, buracosCriados)) {
      buracosCriados.push(candidato);
    }
  }

  return buracosCriados;
}

function buracoPodeFicarAqui(buraco, buracosCriados) {
  const margem = 18;
  const colideObstaculo = obstaculos.some((obstaculo) =>
    colisaoCirculoRetangulo(buraco.x, buraco.y, buraco.raio + margem, obstaculo)
  );
  const colideOutroBuraco = buracosCriados.some(
    (outroBuraco) => Math.hypot(buraco.x - outroBuraco.x, buraco.y - outroBuraco.y) < buraco.raio + outroBuraco.raio + 45
  );
  const atrapalhaNascimento = buracoAtrapalhaNascimento(buraco, true);

  return !colideObstaculo && !colideOutroBuraco && !atrapalhaNascimento;
}

function criarMonstrosDaConfiguracao() {
  const monstros = [];
  const quantidade = configuracoes.quantidadeNpcs;
  if (quantidade <= 0) return monstros;

  for (let i = 0; i < quantidade; i += 1) {
    const raio = i % 3 === 0 ? 20 : 18;
    const ponto = encontrarPontoLivreParaMonstro(i, quantidade, raio);
    monstros.push(criarMonstro(i + 1, ponto.x, ponto.y, raio));
  }

  return monstros;
}

function encontrarPontoLivreParaMonstro(indice, total, raio) {
  const colunas = Math.ceil(Math.sqrt(total));
  const linhas = Math.ceil(total / colunas);
  const coluna = indice % colunas;
  const linha = Math.floor(indice / colunas);
  const baseX = MUNDO.largura * (0.28 + 0.44 * (coluna / Math.max(1, colunas - 1)));
  const baseY = MUNDO.altura * (0.24 + 0.52 * (linha / Math.max(1, linhas - 1)));

  const candidatos = [{ x: baseX, y: baseY }];
  for (let anel = 1; anel <= 10; anel += 1) {
    const distanciaBusca = anel * 34;
    for (let passo = 0; passo < 12; passo += 1) {
      const angulo = (Math.PI * 2 * passo) / 12 + indice * 0.37;
      candidatos.push({
        x: baseX + Math.cos(angulo) * distanciaBusca,
        y: baseY + Math.sin(angulo) * distanciaBusca
      });
    }
  }

  for (const candidato of candidatos) {
    const x = limitar(candidato.x, raio + 8, MUNDO.largura - raio - 8);
    const y = limitar(candidato.y, raio + 8, MUNDO.altura - raio - 8);
    if (!circuloEstaBloqueado(x, y, raio + 8) && !pontoPertoDasBases(x, y, RAIO_BASE + 45)) {
      return { x, y };
    }
  }

  return { x: MUNDO.largura / 2, y: MUNDO.altura / 2 };
}

function pontoPertoDasBases(x, y, margem) {
  return Object.values(times).some((time) => Math.hypot(x - time.base.x, y - time.base.y) < margem);
}

function listarBasesParaNascimento(incluirTodasAsPosicoes = false) {
  if (!incluirTodasAsPosicoes) {
    return Object.values(times).map((time) => time.base);
  }

  return posicoesBases.flatMap((posicao) => Object.values(posicao));
}

function buracoAtrapalhaNascimento(buraco, incluirTodasAsPosicoes = false) {
  const margem = buraco.raio + RAIO_JOGADOR + FOLGA_NASCIMENTO_BURACO;
  return listarBasesParaNascimento(incluirTodasAsPosicoes).some((base) => Math.hypot(buraco.x - base.x, buraco.y - base.y) < margem);
}

function removerBuracosNaAreaDeNascimento() {
  buracos = buracos.filter((buraco) => !buracoAtrapalhaNascimento(buraco));
}

function aplicarMapaAtual() {
  const tamanho = tamanhosMapa[configuracoes.tamanhoMapa] || tamanhosMapa.medio;
  MUNDO.largura = tamanho.largura;
  MUNDO.altura = tamanho.altura;
  obstaculos = criarObstaculos(configuracoes.tipoMapa, MUNDO.largura, MUNDO.altura);
  posicoesBases = criarPosicoesBases(MUNDO.largura, MUNDO.altura);
  posicaoBaseAtual = 0;

  for (const idTime of [1, 2]) {
    const base = posicoesBases[0][idTime];
    times[idTime].base = { x: base.x, y: base.y };
    times[idTime].casaBandeira = { x: base.x, y: base.y };
  }

  buracos = criarBuracos(configuracoes.tipoMapa, MUNDO.largura, MUNDO.altura);
  removerBuracosNaAreaDeNascimento();
  estado.monstros = criarMonstrosDaConfiguracao();
}

function normalizarConfiguracoes(novasConfiguracoes = {}) {
  return normalizarConfiguracoesBase(novasConfiguracoes, configuracoes, limitar);
}

function aplicarConfiguracoes(novasConfiguracoes) {
  Object.assign(configuracoes, normalizarConfiguracoes(novasConfiguracoes));
  aplicarMapaAtual();
  reiniciarPartida(true, false);
}

function criarBandeira(idTime) {
  return {
    idTime,
    x: times[idTime].casaBandeira.x,
    y: times[idTime].casaBandeira.y,
    idCarregador: null,
    solta: false
  };
}

function criarJogador(id, idTime) {
  const base = times[idTime].base;
  return criarJogadorBase({
    id,
    idTime,
    cor: times[idTime].cor,
    base,
    raioJogador: RAIO_JOGADOR,
    municaoMaxima: MUNICAO_MAXIMA,
    duracaoInvulneravelMs: DURACAO_INVULNERAVEL_MS
  });
}

function reiniciarPartida(zerarPlacar = false, iniciarAgora = false) {
  estado.iniciado = iniciarAgora && Object.keys(estado.jogadores).length === 2;
  estado.vencedor = null;
  estado.vencedorRodada = null;
  estado.ticksProximaRodada = 0;
  estado.ticksMudancaBase = TICKS_MUDANCA_BASE;
  if (zerarPlacar) {
    estado.placar = { 1: 0, 2: 0 };
  }
  tiros = [];
  ruidos = [];
  estado.bandeiras[1] = criarBandeira(1);
  estado.bandeiras[2] = criarBandeira(2);

  Object.values(estado.jogadores).forEach((jogador) => {
    const base = times[jogador.idTime].base;
    jogador.x = base.x;
    jogador.y = base.y;
    jogador.municao = MUNICAO_MAXIMA;
    jogador.ultimoTiroEm = 0;
    jogador.ultimoRuidoPassoEm = 0;
    jogador.invulneravelAte = Date.now() + DURACAO_INVULNERAVEL_MS;
    jogador.carregandoBandeiraDoTime = null;
    jogador.ticksCaptura = 0;
  });

  estado.monstros.forEach((monstro) => {
    monstro.x = monstro.casaX;
    monstro.y = monstro.casaY;
    monstro.idRuidoAlvo = null;
    monstro.alvoMemoria = null;
    monstro.ticksMemoria = 0;
    monstro.ultimoRuidoEm = 0;
  });
}

function voltarParaLobby(zerarPlacar = true) {
  segundoJogadorPronto = false;
  reiniciarPartida(zerarPlacar, false);
}

function iniciarPartidaPeloLobby() {
  segundoJogadorPronto = true;
  reiniciarPartida(true, true);
}

function finalizarRodada(idTimeVencedor) {
  estado.placar[idTimeVencedor] += 1;
  estado.vencedorRodada = idTimeVencedor;
  estado.ticksProximaRodada = TICKS_PROXIMA_RODADA;
  adicionarRuido(MUNDO.largura / 2, MUNDO.altura / 2, 200, 'fim-rodada');

  if (estado.placar[idTimeVencedor] >= configuracoes.rodadasParaVencer) {
    estado.vencedor = idTimeVencedor;
    estado.ticksProximaRodada = TICKS_PROXIMA_RODADA;
  }
}

function atribuirTime() {
  const ocupados = new Set(Object.values(estado.jogadores).map((p) => p.idTime));
  if (!ocupados.has(1)) return 1;
  if (!ocupados.has(2)) return 2;
  return null;
}

function circuloBateEmParedeOuObstaculo(x, y, raio) {
  if (x - raio < 0 || y - raio < 0 || x + raio > MUNDO.largura || y + raio > MUNDO.altura) {
    return true;
  }
  return obstaculos.some((obstaculo) => colisaoCirculoRetangulo(x, y, raio, obstaculo));
}

function circuloEstaBloqueado(x, y, raio) {
  return (
    circuloBateEmParedeOuObstaculo(x, y, raio) ||
    buracos.some((buraco) => Math.hypot(x - buraco.x, y - buraco.y) < raio + buraco.raio)
  );
}

function tiroEstaBloqueado(x, y, raio) {
  if (x - raio < 0 || y - raio < 0 || x + raio > MUNDO.largura || y + raio > MUNDO.altura) {
    return true;
  }
  return obstaculos.some((obstaculo) => colisaoCirculoRetangulo(x, y, raio, obstaculo));
}

function moverCirculo(entidade, dx, dy, raio) {
  if (!circuloEstaBloqueado(entidade.x + dx, entidade.y, raio)) {
    entidade.x += dx;
  }
  if (!circuloEstaBloqueado(entidade.x, entidade.y + dy, raio)) {
    entidade.y += dy;
  }
}

function moverJogador(jogador, dx, dy) {
  if (!circuloBateEmParedeOuObstaculo(jogador.x + dx, jogador.y, RAIO_JOGADOR)) {
    jogador.x += dx;
  }
  if (!circuloBateEmParedeOuObstaculo(jogador.x, jogador.y + dy, RAIO_JOGADOR)) {
    jogador.y += dy;
  }
}

function jogadorCaiuEmBuraco(jogador) {
  return buracos.some((buraco) => Math.hypot(jogador.x - buraco.x, jogador.y - buraco.y) < buraco.raio + jogador.raio * 0.45);
}

function adicionarRuido(x, y, forca, tipo, vida = VIDA_RUIDO) {
  ruidos.push({
    id: Date.now() + Math.random(),
    x,
    y,
    forca,
    tipo,
    vida
  });
}

function jogadorEstaInvulneravel(jogador, agora = Date.now()) {
  return jogador.invulneravelAte && agora < jogador.invulneravelAte;
}

function renascerJogador(jogador, tipoRuido = 'morte') {
  if (jogador.carregandoBandeiraDoTime) {
    const bandeira = estado.bandeiras[jogador.carregandoBandeiraDoTime];
    bandeira.idCarregador = null;
    bandeira.solta = true;
    bandeira.x = jogador.x;
    bandeira.y = jogador.y;
  }

  const base = times[jogador.idTime].base;
  removerBuracosNaAreaDeNascimento();
  jogador.x = base.x;
  jogador.y = base.y;
  jogador.carregandoBandeiraDoTime = null;
  jogador.ticksCaptura = 0;
  jogador.invulneravelAte = Date.now() + DURACAO_INVULNERAVEL_MS;
  adicionarRuido(jogador.x, jogador.y, 65, tipoRuido);
}

function mudarBasesDeLugar() {
  posicaoBaseAtual = (posicaoBaseAtual + 1) % posicoesBases.length;
  const posicao = posicoesBases[posicaoBaseAtual];

  for (const idTime of [1, 2]) {
    const base = posicao[idTime];
    const time = times[idTime];
    time.base = { x: base.x, y: base.y };
    time.casaBandeira = { x: base.x, y: base.y };

    const bandeira = estado.bandeiras[idTime];
    if (!bandeira.idCarregador && !bandeira.solta) {
      bandeira.x = base.x;
      bandeira.y = base.y;
    }
  }

  Object.values(estado.jogadores).forEach((jogador) => {
    jogador.ticksCaptura = 0;
  });
  removerBuracosNaAreaDeNascimento();
  adicionarRuido(MUNDO.largura / 2, MUNDO.altura / 2, 160, 'mudanca-base');
}

function atualizarTemporizadorBase() {
  estado.ticksMudancaBase -= 1;
  if (estado.ticksMudancaBase <= 0) {
    mudarBasesDeLugar();
    estado.ticksMudancaBase = TICKS_MUDANCA_BASE;
  }
}

function atualizarJogadores(agora) {
  Object.values(estado.jogadores).forEach((jogador) => {
    const entrada = jogador.entrada;
    let dx = Number(entrada.direita) - Number(entrada.esquerda);
    let dy = Number(entrada.baixo) - Number(entrada.cima);
    const comprimento = Math.hypot(dx, dy);

    if (comprimento > 0 && estado.iniciado && !estado.vencedor) {
      const estaDevagar = entrada.devagar;
      const velocidade = VELOCIDADE_JOGADOR * (estaDevagar ? MULTIPLICADOR_VELOCIDADE_LENTA : 1);
      dx = (dx / comprimento) * velocidade;
      dy = (dy / comprimento) * velocidade;
      moverJogador(jogador, dx, dy);

      if (jogadorCaiuEmBuraco(jogador)) {
        renascerJogador(jogador, 'queda-buraco');
        return;
      }

      if (!estaDevagar && agora - jogador.ultimoRuidoPassoEm >= INTERVALO_PASSO_MS) {
        adicionarRuido(jogador.x, jogador.y, FORCA_RUIDO_PASSO, 'passo', VIDA_RUIDO_PASSO);
        jogador.ultimoRuidoPassoEm = agora;
      }
    }

    if (entrada.atirando && estado.iniciado && !estado.vencedor) {
      tentarAtirar(jogador, agora);
    }

    atualizarRecargaMunicao(jogador);
    atualizarColetaBandeira(jogador);
    atualizarCaptura(jogador);
  });
}

function atualizarRecargaMunicao(jogador) {
  if (!estado.iniciado || estado.vencedor || jogador.municao >= MUNICAO_MAXIMA) return;

  const idTimeInimigo = jogador.idTime === 1 ? 2 : 1;
  if (distancia(jogador, times[idTimeInimigo].base) <= RAIO_BASE) {
    jogador.municao = MUNICAO_MAXIMA;
    adicionarRuido(jogador.x, jogador.y, 45, 'recarga-municao');
  }
}

function tentarAtirar(jogador, agora) {
  if (jogador.municao <= 0 || agora - jogador.ultimoTiroEm < RECARGA_MS) return;

  const angulo = Math.atan2(jogador.entrada.miraY - jogador.y, jogador.entrada.miraX - jogador.x);
  tiros.push(
    criarTiro({
      idDono: jogador.id,
      x: jogador.x,
      y: jogador.y,
      angulo,
      raioJogador: RAIO_JOGADOR,
      velocidadeTiro: VELOCIDADE_TIRO,
      vidaTiro: VIDA_TIRO
    })
  );
  jogador.municao -= 1;
  jogador.ultimoTiroEm = agora;
  adicionarRuido(jogador.x, jogador.y, 115, 'tiro');
}

function atualizarColetaBandeira(jogador) {
  if (!estado.iniciado || estado.vencedor || jogador.carregandoBandeiraDoTime) return;

  const timeInimigo = jogador.idTime === 1 ? 2 : 1;
  const bandeira = estado.bandeiras[timeInimigo];
  if (!bandeira.idCarregador && distancia(jogador, bandeira) < RAIO_JOGADOR + TAMANHO_BANDEIRA) {
    bandeira.idCarregador = jogador.id;
    bandeira.solta = false;
    jogador.carregandoBandeiraDoTime = timeInimigo;
    adicionarRuido(jogador.x, jogador.y, 80, 'bandeira');
  }

  const propriaBandeira = estado.bandeiras[jogador.idTime];
  if (propriaBandeira.solta && distancia(jogador, propriaBandeira) < RAIO_JOGADOR + TAMANHO_BANDEIRA) {
    propriaBandeira.x = times[jogador.idTime].casaBandeira.x;
    propriaBandeira.y = times[jogador.idTime].casaBandeira.y;
    propriaBandeira.solta = false;
  }
}

function atualizarCaptura(jogador) {
  if (!jogador.carregandoBandeiraDoTime || estado.vencedor) {
    jogador.ticksCaptura = 0;
    return;
  }

  const base = times[jogador.idTime].base;
  if (distancia(jogador, base) <= RAIO_BASE) {
    jogador.ticksCaptura += 1;
    if (jogador.ticksCaptura % INTERVALO_RUIDO_CAPTURA === 1) {
      adicionarRuido(jogador.x, jogador.y, 95, 'captura-bandeira', 70);
    }
    if (jogador.ticksCaptura >= TICKS_SEGURAR_CAPTURA) {
      finalizarRodada(jogador.idTime);
    }
  } else {
    jogador.ticksCaptura = 0;
  }
}

function atualizarBandeiras() {
  Object.values(estado.bandeiras).forEach((bandeira) => {
    if (bandeira.idCarregador && estado.jogadores[bandeira.idCarregador]) {
      const carregador = estado.jogadores[bandeira.idCarregador];
      bandeira.x = carregador.x;
      bandeira.y = carregador.y - 25;
    }
  });
}

function atualizarTiros() {
  tiros = tiros.filter((tiro) => {
    tiro.x += tiro.vx;
    tiro.y += tiro.vy;
    tiro.vida -= 1;

    if (tiro.vida <= 0 || tiroEstaBloqueado(tiro.x, tiro.y, RAIO_TIRO)) {
      adicionarRuido(tiro.x, tiro.y, 50, 'impacto');
      return false;
    }

    for (const monstro of estado.monstros) {
      if (Math.hypot(tiro.x - monstro.x, tiro.y - monstro.y) < monstro.raio + RAIO_TIRO) {
        monstro.x = monstro.casaX;
        monstro.y = monstro.casaY;
        adicionarRuido(tiro.x, tiro.y, 90, 'monstro-atingido');
        return false;
      }
    }

    for (const jogador of Object.values(estado.jogadores)) {
      if (
        jogador.id !== tiro.idDono &&
        !jogadorEstaInvulneravel(jogador) &&
        Math.hypot(tiro.x - jogador.x, tiro.y - jogador.y) < jogador.raio + RAIO_TIRO
      ) {
        renascerJogador(jogador);
        return false;
      }
    }

    return true;
  });
}

function atualizarMonstros(agora) {
  const ruidosAtivos = ruidos.filter((ruido) => ruido.vida > 0 && ruido.tipo !== 'monstro');

  estado.monstros.forEach((monstro) => {
    let alvo = null;
    let melhorPontuacao = 0;

    for (const ruido of ruidosAtivos) {
      const d = Math.max(1, distancia(monstro, ruido));
      const pontuacao = ruido.forca / Math.max(1, d * d * 0.01);
      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        alvo = ruido;
      }
    }

    if (alvo && melhorPontuacao >= LIMIAR_AUDICAO_MONSTRO) {
      monstro.alvoMemoria = { x: alvo.x, y: alvo.y };
      monstro.ticksMemoria = TICKS_MEMORIA_MONSTRO;
      const angulo = Math.atan2(alvo.y - monstro.y, alvo.x - monstro.x);
      moverCirculo(monstro, Math.cos(angulo) * VELOCIDADE_MONSTRO_ALERTA, Math.sin(angulo) * VELOCIDADE_MONSTRO_ALERTA, monstro.raio);
      monstro.idRuidoAlvo = alvo.id;
    } else if (monstro.alvoMemoria && monstro.ticksMemoria > 0) {
      monstro.ticksMemoria -= 1;
      const angulo = Math.atan2(monstro.alvoMemoria.y - monstro.y, monstro.alvoMemoria.x - monstro.x);
      moverCirculo(monstro, Math.cos(angulo) * VELOCIDADE_MONSTRO_ALERTA, Math.sin(angulo) * VELOCIDADE_MONSTRO_ALERTA, monstro.raio);
      monstro.idRuidoAlvo = null;

      if (Math.hypot(monstro.x - monstro.alvoMemoria.x, monstro.y - monstro.alvoMemoria.y) < monstro.raio + 10) {
        monstro.ticksMemoria = 0;
        monstro.alvoMemoria = null;
      }
    } else {
      monstro.ticksVagar -= 1;
      if (monstro.ticksVagar <= 0) {
        monstro.anguloVagar += -0.9 + Math.random() * 1.8;
        monstro.ticksVagar = 45 + Math.floor(Math.random() * 95);
      }
      moverCirculo(monstro, Math.cos(monstro.anguloVagar) * VELOCIDADE_MONSTRO_VAGANDO, Math.sin(monstro.anguloVagar) * VELOCIDADE_MONSTRO_VAGANDO, monstro.raio);
      monstro.idRuidoAlvo = null;
    }

    Object.values(estado.jogadores).forEach((jogador) => {
      if (!jogadorEstaInvulneravel(jogador, agora) && Math.hypot(monstro.x - jogador.x, monstro.y - jogador.y) < monstro.raio + jogador.raio) {
        renascerJogador(jogador);
      }
    });

    if (agora - monstro.ultimoRuidoEm >= INTERVALO_RUIDO_MONSTRO_MS + monstro.id * 37) {
      adicionarRuido(monstro.x, monstro.y, 38, 'monstro', 75);
      monstro.ultimoRuidoEm = agora;
    }
  });
}

function atualizarRuidos() {
  ruidos.forEach((ruido) => {
    ruido.vida -= 1;
  });
  ruidos = ruidos.filter((ruido) => ruido.vida > 0).slice(-40);
}

function loopDoJogo() {
  const agora = Date.now();

  if (estado.vencedorRodada && !estado.vencedor) {
    estado.ticksProximaRodada -= 1;
    if (estado.ticksProximaRodada <= 0) {
      reiniciarPartida(false, true);
    }
  }

  if (estado.vencedor) {
    estado.ticksProximaRodada -= 1;
    if (estado.ticksProximaRodada <= 0) {
      voltarParaLobby(true);
    }
  }

  if (estado.iniciado && !estado.vencedor) {
    if (!estado.vencedorRodada) {
      atualizarTemporizadorBase();
      atualizarJogadores(agora);
      atualizarBandeiras();
      atualizarTiros();
      atualizarMonstros(agora);
      atualizarRuidos();
    }
  }

  if (agora - ultimoRetratoEstado >= TAXA_RETRATO_ESTADO) {
    transmitirRetratoEstado();
    ultimoRetratoEstado = agora;
  }
}

function estadoPublico(paraIdJogador) {
  const visualizador = estado.jogadores[paraIdJogador];

  return {
    mundo: MUNDO,
    times,
    meuId: paraIdJogador,
    iniciado: estado.iniciado,
    vencedor: estado.vencedor,
    vencedorRodada: estado.vencedorRodada,
    lobby: {
      idAnfitriao,
      prontoSegundoJogador: segundoJogadorPronto,
      quantidadeJogadores: Object.keys(estado.jogadores).length
    },
    placar: estado.placar,
    configuracoes,
    municaoMaxima: MUNICAO_MAXIMA,
    raioVisao: RAIO_VISAO,
    anguloVisao: ANGULO_VISAO,
    jogadores: Object.values(estado.jogadores).map((p) => ({
      id: p.id,
      idTime: p.idTime,
      x: p.x,
      y: p.y,
      raio: p.raio,
      cor: p.cor,
      municao: p.municao,
      carregandoBandeiraDoTime: p.carregandoBandeiraDoTime,
      invulneravel: jogadorEstaInvulneravel(p),
      progressoCaptura: p.ticksCaptura / TICKS_SEGURAR_CAPTURA
    })),
    bandeiras: Object.values(estado.bandeiras),
    monstros: estado.monstros.map((m) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      raio: m.raio,
      idRuidoAlvo: m.idRuidoAlvo
    })),
    tiros,
    obstaculos,
    buracos,
    ruidos: ruidos.map((n) => ({ id: n.id, x: n.x, y: n.y, forca: n.forca, vida: n.vida, tipo: n.tipo })),
    visualizador: visualizador
      ? {
          idTime: visualizador.idTime,
          municao: visualizador.municao,
          carregandoBandeiraDoTime: visualizador.carregandoBandeiraDoTime,
          progressoCaptura: visualizador.ticksCaptura / TICKS_SEGURAR_CAPTURA
        }
      : null
  };
}

function enviar(conexao, conteudo) {
  if (conexao.readyState === WebSocket.OPEN) {
    conexao.send(JSON.stringify(conteudo));
  }
}

function transmitirRetratoEstado() {
  for (const [conexao, cliente] of clientes) {
    enviar(conexao, { tipo: 'retrato', estado: estadoPublico(cliente.idJogador) });
  }
}

servidorWebSocket.on('connection', (conexao) => {
  const idTime = atribuirTime();

  if (!idTime) {
    enviar(conexao, { tipo: 'lotado', mensagem: 'A partida já possui 2 jogadores.' });
    conexao.close();
    return;
  }

  const idJogador = String(proximoIdCliente++);
  if (!idAnfitriao) {
    idAnfitriao = idJogador;
  }
  estado.jogadores[idJogador] = criarJogador(idJogador, idTime);
  clientes.set(conexao, { idJogador });
  enviar(conexao, { tipo: 'boasVindas', idJogador, idTime });

  if (Object.keys(estado.jogadores).length === 2) {
    voltarParaLobby(true);
  }

  conexao.on('message', (bruto) => {
    let mensagem;
    try {
      mensagem = JSON.parse(bruto);
    } catch {
      return;
    }

    if (mensagem.tipo === 'reiniciar' && idJogador === idAnfitriao) {
      aplicarMapaAtual();
      voltarParaLobby(true);
      transmitirRetratoEstado();
      return;
    }

    if (mensagem.tipo === 'configuracoes' && idJogador === idAnfitriao && !estado.iniciado) {
      aplicarConfiguracoes(mensagem.configuracoes);
      transmitirRetratoEstado();
      return;
    }

    if (mensagem.tipo === 'pronto' && idJogador !== idAnfitriao && !estado.iniciado) {
      if (Object.keys(estado.jogadores).length === 2) {
        iniciarPartidaPeloLobby();
        transmitirRetratoEstado();
      }
      return;
    }

    const jogador = estado.jogadores[idJogador];
    if (!jogador || mensagem.tipo !== 'entrada' || !mensagem.entrada) return;

    jogador.entrada = {
      cima: Boolean(mensagem.entrada.cima),
      baixo: Boolean(mensagem.entrada.baixo),
      esquerda: Boolean(mensagem.entrada.esquerda),
      direita: Boolean(mensagem.entrada.direita),
      devagar: Boolean(mensagem.entrada.devagar),
      atirando: Boolean(mensagem.entrada.atirando),
      miraX: Number.isFinite(mensagem.entrada.miraX) ? mensagem.entrada.miraX : jogador.entrada.miraX,
      miraY: Number.isFinite(mensagem.entrada.miraY) ? mensagem.entrada.miraY : jogador.entrada.miraY
    };
  });

  conexao.on('close', () => {
    clientes.delete(conexao);
    delete estado.jogadores[idJogador];
    if (idJogador === idAnfitriao) {
      const proximoAnfitriao = Object.keys(estado.jogadores)[0] || null;
      idAnfitriao = proximoAnfitriao;
    }
    voltarParaLobby(true);
    transmitirRetratoEstado();
  });
});

if (require.main === module) {
  setInterval(loopDoJogo, TAXA_TICK);

  servidorHttp.listen(PORTA, () => {
    console.log(`Servidor rodando em http://localhost:${PORTA}`);
  });
}

module.exports = {
  _teste: {
    aplicarConfiguracoes,
    aplicarMapaAtual,
    buracoAtrapalhaNascimento,
    colisaoCirculoRetangulo,
    criarJogador,
    estadoPublico,
    jogadorEstaInvulneravel,
    limitar,
    normalizarConfiguracoes,
    pontoPertoDasBases,
    renascerJogador,
    reiniciarPartida,
    tamanhosMapa,
    times
  }
};
