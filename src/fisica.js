function limitar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function colisaoCirculoRetangulo(cx, cy, raio, retangulo) {
  const xMaisProximo = limitar(cx, retangulo.x, retangulo.x + retangulo.largura);
  const yMaisProximo = limitar(cy, retangulo.y, retangulo.y + retangulo.altura);
  return Math.hypot(cx - xMaisProximo, cy - yMaisProximo) < raio;
}

module.exports = {
  colisaoCirculoRetangulo,
  distancia,
  limitar
};
