# BREU

A ideia do jogo é juntar um pouco de esconde-esconde com pique-bandeira. Dois jogadores entram na mesma partida, cada um tem sua base e sua bandeira, e o objetivo é invadir o lado adversário, pegar a bandeira inimiga e voltar para a própria base para completar a captura.

O projeto foi feito com Node.js no servidor, WebSocket para comunicação em tempo real e Canvas no navegador para desenhar o jogo.

## Tecnologias que usei

- Node.js
- Express
- WebSocket com `ws`
- HTML
- CSS
- JavaScript
- Canvas

## Como funciona

A partida foi pensada para exatamente 2 jogadores.

O primeiro jogador que entra vira o anfitrião. Ele consegue configurar a partida no lobby, escolhendo coisas como quantidade de rodadas, NPCs, tamanho do mapa e tipo de mapa.

O segundo jogador entra depois, confere as configurações e clica em `Pronto`. Quando isso acontece, a partida começa.

Durante o jogo:

- cada jogador fica em um time;
- cada time tem uma base e uma bandeira;
- o jogador precisa pegar a bandeira inimiga;
- depois precisa voltar para a própria base;
- ao chegar na base com a bandeira, precisa esperar a barra de captura completar;
- quem completar a captura vence a rodada;
- vence o jogo quem ganhar a quantidade de rodadas definida no lobby.

## Controles

No computador:

- `W`, `A`, `S`, `D`: movimentam o jogador;
- `Shift`: faz o jogador andar devagar e fazer menos barulho;
- mouse: controla a mira;
- clique esquerdo: atira;
- botão `Tela cheia`: alterna o modo de tela cheia.

No celular:

- joystick da esquerda: movimenta o jogador;
- botão `Lento`: anda devagar e faz menos barulho;
- joystick `Atirar`: puxa para mirar e solta para disparar;
- toque ou arraste no mapa: ajusta a mira;
- o ideal é jogar com o celular na horizontal.

## Mecânicas principais

Algumas mecânicas que implementei no jogo:

- visão limitada em formato de cone;
- obstáculos que bloqueiam movimento e tiros;
- buracos espalhados pelo mapa;
- se o jogador cair em um buraco, ele volta para a própria base;
- munição limitada;
- recarga de munição ao entrar na base inimiga;
- tiros que fazem o jogador voltar para a base;
- NPCs que também podem atingir os jogadores;
- bandeira solta quando o jogador que está carregando ela é atingido;
- bases mudando de lugar depois de um tempo.

## NPCs e som

Os NPCs não perseguem o jogador diretamente o tempo todo. Eles reagem aos sons do mapa.

Corrida, tiros, captura de bandeira e outros eventos geram ruído. Quando um NPC escuta alguma coisa, ele vai até o local do barulho e procura por alguns segundos.

Por isso o `Shift` tem importância no jogo: ao andar devagar, o jogador faz menos barulho e consegue se movimentar com mais cuidado.

## Áudio

Os sons do jogo são gerados pelo próprio navegador, sem arquivos de áudio externos.

Usei sons para eventos como:

- passos;
- tiros;
- impactos;
- NPCs;
- queda em buraco;
- bandeira;
- captura;
- morte;
- recarga de munição;
- fim de rodada.

Como os navegadores bloqueiam áudio automático, os sons só começam depois da primeira interação do jogador com a página. Então, ao abrir o jogo, basta clicar na tela ou apertar uma tecla.

## Como rodar o projeto

Primeiro, instale as dependências:

```bash
npm install
```

Depois, inicie o servidor:

```bash
npm start
```

Com o servidor rodando, abra no navegador:

```text
http://localhost:3000
```

Para testar a partida, abra duas abas nesse mesmo endereço. Uma aba será o primeiro jogador e a outra será o segundo.

## Testes

Também deixei alguns testes automatizados para validar partes importantes da lógica do servidor.

Para rodar:

```bash
npm test
```

## Estrutura do projeto

```text
BREU/
|-- package.json
|-- server.js
|-- README.md
|-- src/
|   |-- configuracoes.js
|   |-- fisica.js
|   |-- jogadores.js
|   |-- mapas.js
|   |-- monstros.js
|   `-- tiros.js
|-- test/
|   `-- server.test.js
`-- public/
    |-- audio.js
    |-- index.html
    |-- style.css
    `-- client.js
```

## Observação

Esse projeto é um protótipo acadêmico. Ele não tem login, banco de dados ou várias salas ao mesmo tempo.

O foco foi praticar comunicação em tempo real, controle de estado no servidor, renderização 2D no navegador e algumas mecânicas de jogo funcionando juntas.
