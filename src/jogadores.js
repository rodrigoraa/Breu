function criarJogador({ id, idTime, base, cor, raioJogador, municaoMaxima, duracaoInvulneravelMs, agora = Date.now() }) {
  return {
    id,
    idTime,
    x: base.x,
    y: base.y,
    raio: raioJogador,
    cor,
    municao: municaoMaxima,
    ultimoTiroEm: 0,
    ultimoRuidoPassoEm: 0,
    invulneravelAte: agora + duracaoInvulneravelMs,
    carregandoBandeiraDoTime: null,
    ticksCaptura: 0,
    entrada: {
      cima: false,
      baixo: false,
      esquerda: false,
      direita: false,
      devagar: false,
      miraX: base.x + 1,
      miraY: base.y,
      atirando: false
    }
  };
}

module.exports = {
  criarJogador
};
