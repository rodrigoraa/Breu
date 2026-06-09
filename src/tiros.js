function criarTiro({ idDono, x, y, angulo, raioJogador, velocidadeTiro, vidaTiro }) {
  return {
    id: Date.now() + Math.random(),
    idDono,
    x: x + Math.cos(angulo) * (raioJogador + 6),
    y: y + Math.sin(angulo) * (raioJogador + 6),
    vx: Math.cos(angulo) * velocidadeTiro,
    vy: Math.sin(angulo) * velocidadeTiro,
    vida: vidaTiro
  };
}

module.exports = {
  criarTiro
};
