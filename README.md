# BF Studio

**Editor, compilador e depurador visual de Brainfuck — roda inteiro no seu navegador.**

Escreva um programa, mova o cursor pelo código e veja a fita de memória mudando **ao vivo**.
Execute passo a passo, marque breakpoints, volte no tempo e aprenda com as lições em português.

![CI](https://github.com/panda12332145/Brainfuck/actions/workflows/ci.yml/badge.svg)
![Licença MIT](https://img.shields.io/badge/licença-MIT-emerald)
![Node](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)
![React 19 + Vite 7](https://img.shields.io/badge/React_19-Vite_7-646cff)

---

## ▶ Como executar

### Windows — dois cliques

```
iniciar.bat
```

É só dar dois cliques. O script:

1. verifica se o **Node.js** está instalado — e, se não estiver, **instala sozinho** pelo `winget`;
2. instala as dependências do projeto (só na primeira vez);
3. sobe o servidor em <http://localhost:5173> e **abre o navegador automaticamente**.

Para usar outra porta:

```bat
iniciar.bat 3000
```

> Se a porta 5173 estiver ocupada, o Vite escolhe a próxima livre e abre o navegador no endereço certo.
> Para encerrar o servidor, feche a janela do `iniciar.bat` ou aperte `Ctrl+C`.

### Linux e macOS

```bash
chmod +x iniciar.sh      # só na primeira vez
./iniciar.sh             # ou ./iniciar.sh 3000
```

No macOS também dá para dar dois cliques em **`iniciar.command`**.
O script instala o Node.js usando o gerenciador disponível (`brew`, `apt`, `dnf`, `pacman`, `zypper`).

### Na mão (qualquer sistema)

```bash
npm install     # instala as dependências
npm run dev     # servidor de desenvolvimento em http://localhost:5173
```

### Versão offline (1 arquivo só)

```
gerar-offline.bat        # Windows
npm run build            # qualquer sistema
```

Isso cria **`dist/index.html`** — o BF Studio inteiro (HTML + CSS + JS) num arquivo só, que abre
com dois cliques, sem servidor e sem internet. Dá para levar num pen drive.

### Requisitos

| O que          | Versão mínima | Observação                                            |
| -------------- | ------------- | ----------------------------------------------------- |
| Node.js        | 20.19         | os scripts instalam automaticamente se estiver faltando |
| Navegador      | qualquer um moderno | Chrome, Edge, Firefox, Safari                     |
| Espaço em disco| ~110 MB       | quase tudo é a pasta `node_modules`                    |

---

## ✨ O que tem dentro

### Editor
- Realce de sintaxe dos 8 comandos, com números de linha.
- O contêiner do editor agora usa até 60% da altura da tela (antes eram 440px fixos) e o cursor
  entra em cena sozinho quando você digita ou navega para fora da área visível.
- **Modo ao vivo**: a fita mostra o estado na primeira vez em que a execução chega ao cursor — sem precisar rodar nada.
- A instrução em execução fica destacada, e o **colchete parceiro** acende junto.
- Erros de sintaxe e de execução apontam a linha e a coluna exatas.
- Paleta de botões para inserir os comandos sem procurar no teclado.
- **Abrir / salvar arquivos `.bf`** (ou arrastar e soltar o arquivo em cima do editor).
- O código fica salvo no navegador: pode fechar a aba sem medo.

### Depurador
- **Executar**, **Passo** (1 instrução), **Linha** (até a próxima linha) e **Auto** (passo a passo com velocidade ajustável).
- **Voltar**: desfaz a última instrução — até 65.536 passos para trás.
- **Breakpoints**: clique no número da linha (ou aperte `F9`) e o “Executar” para ali.
- Contador de passos, posição do ponteiro e estatísticas de quantas vezes cada comando aparece.
- Proteções contra programa que não termina: limite de instruções e de bytes impressos, com aviso claro.
- “Executar” continua parando em breakpoint; “Passo” e “Linha” ignoram breakpoints, como num depurador de verdade.

### Fita de memória
- Células desenhadas com brilho proporcional ao valor.
- A célula tocada por último pisca; o ponteiro é seguido automaticamente.
- Clique numa célula para inspecioná-la sem perder o ponteiro de vista.

### Inspetor e tabela ASCII
- Valor em decimal, hexadecimal, octal, binário (bit a bit) e caractere.
- Explicação do que aquele byte significa (dígito, letra, controle…).
- **“Como gerar este valor”**: sugere o trecho de Brainfuck mais curto para produzir o número, direto ou com loop.
- Tabela ASCII completa, interativa.

### Aprender
- **Lições** organizadas por categoria e nível, do comentário até o Hello World, cada uma com código comentado, explicação e botão “carregar no editor”.
- **Referência** com os 8 comandos e os truques (idiomas) mais usados.
- **Gerador**: digite um texto e ele monta o programa que imprime aquele texto, sempre pelo caminho mais curto.
- **Compartilhar**: gera um link com o código e a entrada, para mandar para outra pessoa.

---

## ⌨ Atalhos

| Atalho          | Ação                                    |
| --------------- | --------------------------------------- |
| `Ctrl` + `Enter`| Executar tudo (ou parar, se estiver rodando) |
| `F10`           | Executar uma instrução                  |
| `Shift` + `F10` | Executar até a próxima linha            |
| `Alt` + `←`     | Voltar uma instrução                    |
| `F9`            | Breakpoint na linha do cursor           |

---

## 🧠 Brainfuck em 30 segundos

A linguagem tem **8 comandos** e uma fita de células zeradas, com um ponteiro:

| Comando | O que faz                            | Em C                  |
| :-----: | ------------------------------------ | --------------------- |
| `>`     | move o ponteiro para a direita       | `ptr++;`              |
| `<`     | move o ponteiro para a esquerda      | `ptr--;`              |
| `+`     | soma 1 na célula atual               | `(*ptr)++;`           |
| `-`     | tira 1 da célula atual               | `(*ptr)--;`           |
| `.`     | imprime o caractere da célula        | `putchar(*ptr);`      |
| `,`     | lê um byte da entrada                | `*ptr = getchar();`   |
| `[`     | se a célula for 0, pula o loop       | `while (*ptr) {`      |
| `]`     | se a célula não for 0, volta         | `}`                   |

Qualquer outro caractere é **comentário** — mas cuidado: `+`, `-`, `.`, `,` e colchetes
dentro de um comentário **viram comando**.

### Regras desta implementação

- Fita de **30.000 células**, todas começando em 0.
- Células de **8 bits**: `255 + 1 = 0` e `0 − 1 = 255`.
- Sair da fita pela esquerda ou pela direita gera **erro de execução**.
- `,` sem entrada disponível grava **0** na célula.
- Saída limitada a 100.000 bytes para travar programas infinitos.
- Entrada e saída são tratadas como **UTF-8** (acentos funcionam).

---

## 📁 Estrutura do projeto

```
Brainfuck/
├── iniciar.bat            # Windows: instala tudo e abre em localhost
├── iniciar.sh             # Linux: idem
├── iniciar.command        # macOS: dois cliques
├── gerar-offline.bat      # gera dist/index.html (arquivo único, sem servidor)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .github/workflows/ci.yml
└── src/
    ├── main.tsx
    ├── App.tsx            # tela principal e toda a lógica de controles
    ├── index.css
    ├── bf/
    │   ├── interpreter.ts # compilador + máquina virtual (o coração do projeto)
    │   ├── ascii.ts       # tabela ASCII e sugestões de código
    │   ├── generator.ts   # texto -> Brainfuck
    │   └── lessons.ts     # catálogo de lições, comandos e truques
    ├── components/
    │   ├── CodeEditor.tsx # editor com realce, régua de linhas e breakpoints
    │   ├── TapeView.tsx   # fita de memória
    │   ├── Inspector.tsx  # inspetor de célula e tabela ASCII
    │   └── Lessons.tsx    # lições, referência e gerador
    └── utils/
        └── share.ts       # link de compartilhamento e download de arquivos
```

O núcleo (`src/bf/`) é **puro TypeScript, sem nenhuma dependência do React** — por isso dá para
testar o interpretador inteiro fora do navegador.

---

## 🧪 Scripts

```bash
npm run dev         # servidor de desenvolvimento
npm run build       # gera dist/index.html (arquivo único)
npm run preview     # serve o build de produção
npm run typecheck   # confere os tipos com o tsc
npm test            # roda os testes uma vez
npm run test:watch  # testes em modo contínuo
npm run check       # typecheck + testes + build (o mesmo que a CI faz)
```

São **111 testes** cobrindo o compilador, a máquina virtual, o desfazer/passos, o modo ao vivo,
o gerador de código, o catálogo de lições (cada lição é compilada e executada) e a renderização
de todos os componentes.

A [CI no GitHub Actions](.github/workflows/ci.yml) roda typecheck, testes e build em todo push,
e ainda publica o `dist/index.html` como artefato.

---

## 🐞 O que foi corrigido e melhorado nesta versão

**Bugs corrigidos**

- **O editor desalinhava com muitas linhas** (o mais grave): o `<textarea>` invisível ficava
  limitado à altura visível do contêiner e passava a rolar *por dentro* — até ~43 linhas de desvio —
  enquanto o `<pre>` colorido ficava parado. Você via uma linha e digitava/apagava em outra. Agora o
  textarea tem sempre a altura do conteúdo inteiro, nunca rola sozinho, e é o contêiner externo que
  rola junto com o `<pre>`, seguindo o cursor na vertical e na horizontal.
- Erros de execução no **modo ao vivo** não apareciam na barra de status (o texto saía vazio) e não
  destacavam a instrução no editor — agora o `pc` do erro é gravado na máquina.
- **`Passo a linha` travava a interface**: girava até 1.000.000 de instruções sem devolver o controle
  ao navegador. Agora usa o mapa de início de linha do compilador e executa em pedaços.
- `Executar` redesenhava a tela a cada lote de 400 mil passos, copiando a fita e a saída inteira;
  agora as atualizações são limitadas a ~16 por segundo.
- A fita re-renderizava as ~1000 células a cada passo. Cada célula virou um componente `memo`:
  num passo só as 2 ou 3 que mudaram são redesenhadas.
- Os `ref`s das células eram recriados a cada render, limpando e remontando o mapa inteiro.
- O limite de saída estourava em 1 byte (`>` em vez de `>=`) e a saída era um array de números
  comum; agora é um buffer que cresce e a checagem é exata.
- O `\r` dos arquivos salvos no Windows (`\r\n`) agora é ignorado de forma explícita, o que mantém
  a coluna de cada comando exata ao abrir um `.bf` criado em outro editor.
- `Limpar` e `Copiar` continuavam ativos com o editor vazio.
- A página pedia um `favicon.ico` inexistente (erro 404 no console).

**Recursos novos**

- **Breakpoints** clicando na régua de linhas (ou `F9`).
- **Voltar**: desfaz a última instrução (`Alt + ←`), com histórico circular de 65.536 passos.
- **Abrir / salvar** arquivos `.bf`, inclusive por **arrastar e soltar**.
- **Baixar a saída** do programa em `.txt`.
- **Compartilhar**: um link (`#c=…`) com o código e a entrada.
- **Gerador de texto → Brainfuck**, com quebra de linha ajustável.
- Painel de **análise do programa** com a contagem de cada comando e o número de loops.
- Par de colchetes destacado durante a execução.
- A entrada também fica salva no navegador.
- `iniciar.bat` / `iniciar.sh` / `iniciar.command` / `gerar-offline.bat`.
- Suite de testes com Vitest, CI no GitHub Actions, `.gitignore`, `.gitattributes` e licença MIT.
- Removidas as dependências `clsx` e `tailwind-merge`, que não eram usadas.

---

## 🗺 Ideias para depois

- [ ] Compilador para C ou WebAssembly
- [ ] Células de 16 e 32 bits (variantes `b16`/`b32`)
- [ ] Comparar duas versões do mesmo programa lado a lado
- [ ] Desafios com verificação automática de saída
- [ ] Tema claro

---

## 📄 Licença

[MIT](LICENSE) — use, modifique e distribua à vontade.
