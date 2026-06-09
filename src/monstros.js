function criarMonstro(id, x, y, raio) {
  return {
    id,
    x,
    y,
    casaX: x,
    casaY: y,
    raio,
    idRuidoAlvo: null,
    alvoMemoria: null,
    ticksMemoria: 0,
    anguloVagar: Math.random() * Math.PI * 2,
    ticksVagar: 40 + Math.floor(Math.random() * 80),
    ultimoRuidoEm: 0
  };
}

module.exports = {
  criarMonstro
};
