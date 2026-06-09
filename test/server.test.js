const assert = require('node:assert/strict');
const test = require('node:test');

const { _teste } = require('../server');

test('normaliza configurações fora do limite', () => {
  const resultado = _teste.normalizarConfiguracoes({
    rodadasParaVencer: 20,
    quantidadeNpcs: -3,
    tamanhoMapa: 'inexistente',
    tipoMapa: 'desconhecido'
  });

  assert.equal(resultado.rodadasParaVencer, 9);
  assert.equal(resultado.quantidadeNpcs, 0);
  assert.equal(resultado.tamanhoMapa, 'medio');
  assert.equal(resultado.tipoMapa, 'classico');
});

test('limita valores numéricos entre mínimo e máximo', () => {
  assert.equal(_teste.limitar(12, 0, 10), 10);
  assert.equal(_teste.limitar(-4, 0, 10), 0);
  assert.equal(_teste.limitar(7, 0, 10), 7);
});

test('detecta colisão entre círculo e retângulo', () => {
  const retangulo = { x: 20, y: 20, largura: 80, altura: 40 };

  assert.equal(_teste.colisaoCirculoRetangulo(30, 30, 10, retangulo), true);
  assert.equal(_teste.colisaoCirculoRetangulo(5, 5, 5, retangulo), false);
});

test('aplica mapa grande de ilhas com buracos fora da área de nascimento', () => {
  _teste.aplicarConfiguracoes({
    rodadasParaVencer: 3,
    quantidadeNpcs: 10,
    tamanhoMapa: 'grande',
    tipoMapa: 'ilhas'
  });

  const estado = _teste.estadoPublico(null);

  assert.equal(estado.mundo.largura, _teste.tamanhosMapa.grande.largura);
  assert.equal(estado.mundo.altura, _teste.tamanhosMapa.grande.altura);
  assert.equal(estado.monstros.length, 10);
  assert.ok(estado.buracos.length > 0);

  estado.buracos.forEach((buraco) => {
    assert.equal(_teste.buracoAtrapalhaNascimento(buraco, true), false);
  });
});

test('buracos não nascem dentro de obstáculos', () => {
  _teste.aplicarConfiguracoes({
    rodadasParaVencer: 3,
    quantidadeNpcs: 5,
    tamanhoMapa: 'medio',
    tipoMapa: 'classico'
  });

  const estado = _teste.estadoPublico(null);

  estado.buracos.forEach((buraco) => {
    const colide = estado.obstaculos.some((obstaculo) =>
      _teste.colisaoCirculoRetangulo(buraco.x, buraco.y, buraco.raio + 18, obstaculo)
    );

    assert.equal(colide, false);
  });
});

test('jogador nasce invulnerável e renasce na própria base', () => {
  _teste.aplicarConfiguracoes({
    rodadasParaVencer: 3,
    quantidadeNpcs: 5,
    tamanhoMapa: 'medio',
    tipoMapa: 'classico'
  });

  const jogador = _teste.criarJogador('teste', 1);
  jogador.x = 500;
  jogador.y = 500;

  assert.equal(_teste.jogadorEstaInvulneravel(jogador), true);

  jogador.invulneravelAte = 0;
  _teste.renascerJogador(jogador, 'teste');

  assert.equal(jogador.x, _teste.times[1].base.x);
  assert.equal(jogador.y, _teste.times[1].base.y);
  assert.equal(_teste.jogadorEstaInvulneravel(jogador), true);
});

test('mapa grande com ilhas respeita quantidade configurada de NPCs', () => {
  _teste.aplicarConfiguracoes({
    rodadasParaVencer: 3,
    quantidadeNpcs: 12,
    tamanhoMapa: 'grande',
    tipoMapa: 'ilhas'
  });

  const estado = _teste.estadoPublico(null);

  assert.equal(estado.configuracoes.quantidadeNpcs, 12);
  assert.equal(estado.monstros.length, 12);
  assert.equal(estado.configuracoes.tamanhoMapa, 'grande');
  assert.equal(estado.configuracoes.tipoMapa, 'ilhas');
});
