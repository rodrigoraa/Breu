function criarObstaculos(tipoMapa, largura, altura) {
  const centroX = largura / 2;
  const centroY = altura / 2;

  if (tipoMapa === 'corredores') {
    return [
      { x: centroX - 40, y: 80, largura: 80, altura: altura - 160 },
      { x: 190, y: 95, largura: 70, altura: altura * 0.32 },
      { x: 190, y: altura - 95 - altura * 0.32, largura: 70, altura: altura * 0.32 },
      { x: largura - 260, y: 95, largura: 70, altura: altura * 0.32 },
      { x: largura - 260, y: altura - 95 - altura * 0.32, largura: 70, altura: altura * 0.32 },
      { x: centroX - 210, y: centroY - 24, largura: 150, altura: 48 },
      { x: centroX + 60, y: centroY - 24, largura: 150, altura: 48 }
    ];
  }

  if (tipoMapa === 'ilhas') {
    return [
      { x: centroX - 70, y: centroY - 70, largura: 140, altura: 140 },
      { x: 210, y: 95, largura: 120, altura: 80 },
      { x: 210, y: altura - 175, largura: 120, altura: 80 },
      { x: largura - 330, y: 95, largura: 120, altura: 80 },
      { x: largura - 330, y: altura - 175, largura: 120, altura: 80 },
      { x: centroX - 230, y: centroY - 165, largura: 110, altura: 65 },
      { x: centroX + 120, y: centroY + 100, largura: 110, altura: 65 }
    ];
  }

  return [
    { x: largura * 0.22, y: 70, largura: 90, altura: 170 },
    { x: largura * 0.22, y: altura - 240, largura: 90, altura: 170 },
    { x: centroX - 60, y: centroY - 80, largura: 120, altura: 160 },
    { x: largura * 0.68, y: 70, largura: 95, altura: 170 },
    { x: largura * 0.68, y: altura - 240, largura: 95, altura: 170 },
    { x: centroX - 125, y: 85, largura: 250, altura: 40 },
    { x: centroX - 125, y: altura - 125, largura: 250, altura: 40 }
  ];
}

function criarPosicoesBases(largura, altura) {
  return [
    {
      1: { x: 95, y: altura / 2 },
      2: { x: largura - 95, y: altura / 2 }
    },
    {
      1: { x: 105, y: 115 },
      2: { x: largura - 105, y: altura - 115 }
    },
    {
      1: { x: 105, y: altura - 115 },
      2: { x: largura - 105, y: 115 }
    },
    {
      1: { x: largura / 2, y: 65 },
      2: { x: largura / 2, y: altura - 65 }
    }
  ];
}

module.exports = {
  criarObstaculos,
  criarPosicoesBases
};
