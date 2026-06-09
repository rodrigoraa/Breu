const tamanhosMapa = {
  pequeno: { largura: 850, altura: 550 },
  medio: { largura: 1000, altura: 650 },
  grande: { largura: 1200, altura: 760 }
};

const configuracoesPadrao = {
  rodadasParaVencer: 3,
  quantidadeNpcs: 5,
  tamanhoMapa: 'medio',
  tipoMapa: 'classico'
};

const tiposMapa = ['classico', 'corredores', 'ilhas'];

function normalizarConfiguracoes(novasConfiguracoes = {}, configuracoesAtuais = configuracoesPadrao, limitar) {
  const tamanhoMapa = tamanhosMapa[novasConfiguracoes.tamanhoMapa] ? novasConfiguracoes.tamanhoMapa : configuracoesAtuais.tamanhoMapa;
  const tipoMapa = tiposMapa.includes(novasConfiguracoes.tipoMapa) ? novasConfiguracoes.tipoMapa : configuracoesAtuais.tipoMapa;
  const rodadasRecebidas = Number(novasConfiguracoes.rodadasParaVencer);
  const npcsRecebidos = Number(novasConfiguracoes.quantidadeNpcs);

  return {
    rodadasParaVencer: Math.round(limitar(Number.isFinite(rodadasRecebidas) ? rodadasRecebidas : configuracoesAtuais.rodadasParaVencer, 1, 9)),
    quantidadeNpcs: Math.round(limitar(Number.isFinite(npcsRecebidos) ? npcsRecebidos : configuracoesAtuais.quantidadeNpcs, 0, 12)),
    tamanhoMapa,
    tipoMapa
  };
}

module.exports = {
  configuracoesPadrao,
  normalizarConfiguracoes,
  tamanhosMapa,
  tiposMapa
};
