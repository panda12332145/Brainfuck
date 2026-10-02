export type Category =
  | "Fundamentos"
  | "Variáveis"
  | "Operações"
  | "Controle de fluxo"
  | "Funções e padrões"
  | "Exemplos";

export const CATEGORIES: Category[] = [
  "Fundamentos",
  "Variáveis",
  "Operações",
  "Controle de fluxo",
  "Funções e padrões",
  "Exemplos",
];

export interface Lesson {
  id: string;
  category: Category;
  level: "Iniciante" | "Intermediário" | "Avançado";
  title: string;
  summary: string;
  /** [código brainfuck, comentário] */
  lines: [string, string][];
  explain: string[];
  tip?: string;
  input?: string;
}

const strip = (s: string) => s.replace(/[-+<>[\].,]/g, "").trim();

/** Monta o código com comentários alinhados (removendo símbolos que seriam comandos). */
export function buildCode(l: Lesson): string {
  const width = Math.max(0, ...l.lines.filter(([bf, c]) => bf && c).map(([bf]) => bf.length));
  return l.lines
    .map(([bf, c]) => {
      const comment = strip(c);
      if (!bf) return comment;
      if (!comment) return bf;
      return bf.padEnd(width + 3) + comment;
    })
    .join("\n");
}

export const LESSONS: Lesson[] = [
  {
    id: "comentarios",
    category: "Fundamentos",
    level: "Iniciante",
    title: "Comentários e os 8 comandos",
    summary: "Tudo que não é comando é ignorado — então você pode escrever texto livre.",
    lines: [
      ["", "Tudo que não for um dos 8 símbolos é ignorado"],
      ["", "Então posso escrever texto livremente aqui"],
      ["+++", "soma 3 na célula 0"],
      [">", "move o ponteiro para a célula 1"],
      ["++", "soma 2 na célula 1"],
    ],
    explain: [
      "Brainfuck só tem 8 comandos: `> < + - . , [ ]`. Qualquer outro caractere (letras, números, espaços) é tratado como comentário.",
      "⚠️ Cuidado: ponto, vírgula, sinal de mais, menos e colchetes dentro de um comentário VIRAM comandos! Evite pontuação nos seus textos. (Nos exemplos daqui eu removo esses símbolos automaticamente.)",
    ],
    tip: "Use o botão “Passo” para ver o ponteiro andar a cada comando.",
  },
  {
    id: "celulas",
    category: "Fundamentos",
    level: "Iniciante",
    title: "Fita, células e ponteiro",
    summary: "A memória é uma fita de células. O ponteiro aponta para uma de cada vez.",
    lines: [
      ["+++", "célula 0 vira 3"],
      [">++++++", "vai para a célula 1 e ela vira 6"],
      [">+", "vai para a célula 2 e ela vira 1"],
      ["<<-", "volta duas casas e tira 1 da célula 0"],
    ],
    explain: [
      "A fita tem 30.000 células, todas começando em 0. Cada célula guarda um número de 0 a 255 (8 bits).",
      "`>` e `<` movem o ponteiro. `+` e `-` mudam o valor da célula onde o ponteiro está. Se passar de 255 volta para 0 (e de 0 para baixo vai a 255).",
      "Clique em qualquer célula na fita para ver o valor dela na tabela ASCII.",
    ],
  },
  {
    id: "variaveis",
    category: "Variáveis",
    level: "Iniciante",
    title: "Variáveis = células",
    summary: "Cada célula é uma variável. Você decide qual célula guarda o quê.",
    lines: [
      ["", "idade = célula 0 / altura = célula 1 / nota = célula 2"],
      ["+++++++", "idade = 7"],
      [">++++++++++", "altura = 10"],
      [">+++", "nota = 3"],
      ["<<+", "volta para idade e soma 1 (agora é 8)"],
    ],
    explain: [
      "Não existem nomes de variáveis. Você escolhe uma convenção (ex.: célula 0 = idade) e anota em comentários.",
      "Dica de organização: planeje o “mapa de memória” antes de programar e sempre saiba em qual célula o ponteiro está.",
    ],
  },
  {
    id: "zerar",
    category: "Variáveis",
    level: "Iniciante",
    title: "Zerar uma célula",
    summary: "O idioma mais usado de todos: `[-]`.",
    lines: [
      ["+++++++++", "célula 0 = 9"],
      ["[-]", "enquanto não for zero tira 1 — termina zerada"],
    ],
    explain: [
      "`[-]` repete “diminua 1” até a célula chegar a 0. Funciona para qualquer valor inicial (no pior caso dá 255 voltas).",
      "Use para limpar células de rascunho antes de reaproveitá-las.",
    ],
  },
  {
    id: "numeros-grandes",
    category: "Variáveis",
    level: "Iniciante",
    title: "Números grandes com loop (a letra A)",
    summary: "Em vez de 65 vezes `+`, multiplique: 8 × 8 + 1.",
    lines: [
      ["++++++++", "contador = 8 na célula 0"],
      ["[>++++++++<-]", "a cada volta soma 8 na célula 1 (8 vezes = 64)"],
      [">+", "vai para a célula 1 e soma 1 (65)"],
      [".", "imprime o caractere de código 65 que é A"],
    ],
    explain: [
      "Loops servem como multiplicação: o contador (célula 0) diz quantas vezes somar o valor na célula 1.",
      "Para imprimir letras você precisa do código ASCII delas. Clique numa célula com valor 65 e veja na tabela: é o “A”.",
    ],
    tip: "Selecione a célula 1 e use a sugestão “Como gerar este valor” no inspetor para outros números.",
  },
  {
    id: "mover",
    category: "Variáveis",
    level: "Intermediário",
    title: "Mover um valor",
    summary: "Passa o conteúdo de uma célula para outra: `[->+<]`.",
    lines: [
      ["+++++", "célula 0 = 5"],
      ["[", "enquanto a célula 0 não for zero"],
      ["->+<", "tira 1 daqui e põe 1 na célula 1"],
      ["]", "fim — célula 0 = 0 e célula 1 = 5"],
    ],
    explain: [
      "Esse é o bloco de construção mais importante. O valor é movido, não copiado: a origem fica zerada.",
      "Em C seria: `b += a; a = 0;`",
    ],
  },
  {
    id: "copiar",
    category: "Variáveis",
    level: "Intermediário",
    title: "Copiar um valor (com rascunho)",
    summary: "Para copiar sem perder o original você precisa de uma célula temporária.",
    lines: [
      ["+++++", "a = 5 na célula 0"],
      ["[->+>+<<]", "move a para as células 1 e 2 ao mesmo tempo"],
      [">>", "vai para a célula 2 (a temporária)"],
      ["[-<<+>>]", "devolve o valor da temporária para a célula 0"],
    ],
    explain: [
      "Primeiro movemos `a` para DUAS células (b e temp). Depois devolvemos temp para `a`. Resultado: a = 5 e b = 5.",
      "Em C seria: `b = a;` — mas aqui o computador não tem essa instrução pronta.",
    ],
  },
  {
    id: "soma",
    category: "Operações",
    level: "Intermediário",
    title: "Somar dois números",
    summary: "2 + 3 = 5, e depois imprimimos o dígito.",
    lines: [
      ["++>+++", "célula 0 = 2 e célula 1 = 3"],
      ["[<+>-]", "move a célula 1 para a 0 (soma) — célula 0 = 5"],
      ["++++++[<++++++++>-]", "célula 1 = 6 vezes 8 = 48 somados na célula 0"],
      ["<.", "célula 0 = 53 que é o caractere 5 — imprime"],
    ],
    explain: [
      "Somar é mover: `[<+>-]` joga tudo da célula atual na anterior.",
      "Para mostrar o resultado como dígito, some 48 (código ASCII de '0'). Por isso 5 vira o caractere '5' (código 53).",
    ],
  },
  {
    id: "subtracao",
    category: "Operações",
    level: "Intermediário",
    title: "Subtrair dois números",
    summary: "5 − 3 = 2",
    lines: [
      ["+++++>+++", "célula 0 = 5 e célula 1 = 3"],
      ["[<->-]", "tira 1 de cada até a célula 1 zerar — célula 0 = 2"],
      ["++++++[<++++++++>-]", "soma 48 na célula 0"],
      ["<.", "imprime o dígito 2"],
    ],
    explain: [
      "Mesma ideia da soma, só que a cada volta fazemos `-` na célula anterior em vez de `+`.",
      "Se o resultado ficar negativo, o valor “dá a volta” (0 − 1 = 255).",
    ],
  },
  {
    id: "multiplicacao",
    category: "Operações",
    level: "Avançado",
    title: "Multiplicar duas células (loops aninhados)",
    summary: "2 × 4 = 8 usando um loop dentro de outro.",
    lines: [
      ["", "mapa: c0 = a / c1 = b / c2 = resultado / c3 = rascunho"],
      ["++>++++<", "a = 2 e b = 4"],
      ["[", "REPETE a vezes"],
      [">[->+>+<<]", "copia b para o resultado e para o rascunho"],
      [">>[-<<+>>]", "devolve o rascunho para b"],
      ["<<<-", "volta para a e tira 1"],
      ["]", ""],
      [">>>++++++[<++++++++>-]", "soma 48 no resultado para virar dígito"],
      ["<.", "imprime 8"],
    ],
    explain: [
      "A cada volta do loop externo somamos `b` no resultado. Como somar copiando precisa de rascunho, usamos a célula 3.",
      "Em C: `for (i = 0; i < a; i++) resultado += b;`",
    ],
    tip: "Use o modo “Linha” para pular de linha em linha e observar cada célula mudando.",
  },
  {
    id: "if",
    category: "Controle de fluxo",
    level: "Intermediário",
    title: "IF (se)",
    summary: "`[` … `]` só executa se a célula for diferente de zero.",
    lines: [
      ["+", "x = 1 (apague o símbolo de soma para testar o falso)"],
      ["[", "SE x for diferente de zero entra"],
      [">++++++++[>++++++++++<-]", "calcula 8 vezes 10 = 80"],
      [">+++.", "vira 83 e imprime S"],
      ["<<[-]", "volta para x e zera para sair do SE"],
      ["]", "FIM do SE"],
    ],
    explain: [
      "O loop `[ ... ]` é um “enquanto”. Para virar um “se”, garantimos que ele rode no máximo uma vez zerando a condição (`[-]`) no final.",
      "Em C: `if (x) { printf(\"S\"); }`",
      "Experimente apagar o `+` da primeira linha: x = 0 e nada é impresso.",
    ],
  },
  {
    id: "if-else",
    category: "Controle de fluxo",
    level: "Avançado",
    title: "IF / ELSE (se / senão)",
    summary: "Usa uma célula “flag” para saber se o SE já foi executado.",
    lines: [
      ["", "mapa: c0 = x / c1 = flag / c2 e c3 = rascunho"],
      ["+", "x = 1 (apague para testar o SENÃO)"],
      [">+<", "flag = 1 (ainda não executei o ENTÃO)"],
      ["[", "SE x for diferente de zero"],
      [">-<", "desliga a flag"],
      [">>++++++++[>++++++++++<-]>+++.[-]<<<", "ENTÃO imprime S"],
      ["[-]", "zera x para sair"],
      ["]", ""],
      [">[", "SENÃO se a flag ainda está ligada"],
      [">+++++++[>++++++++++<-]>++++++++.[-]", "imprime N"],
      ["<<-", "desliga a flag"],
      ["]", "FIM"],
    ],
    explain: [
      "Um `else` precisa saber se o `if` rodou. A flag começa em 1; se o bloco ENTÃO executar, ele zera a flag. Depois o bloco SENÃO só roda se a flag ainda for 1.",
      "Em C: `if (x) putchar('S'); else putchar('N');`",
    ],
  },
  {
    id: "for",
    category: "Controle de fluxo",
    level: "Iniciante",
    title: "FOR (repetir N vezes)",
    summary: "Um contador na célula 0 controla quantas voltas o loop dá.",
    lines: [
      [">++++++[>+++++++<-]", "célula 2 = 6 vezes 7 = 42 que é o asterisco"],
      ["<+++++", "contador i = 5 na célula 0"],
      ["[", "ENQUANTO o contador não for zero"],
      [">>.<<", "imprime o asterisco"],
      ["-", "contador menos 1"],
      ["]", ""],
    ],
    explain: [
      "Carregue o contador, execute o corpo e diminua o contador no final. Quando chegar a 0 o loop termina.",
      "Em C: `for (i = 5; i > 0; i--) putchar('*');`",
    ],
  },
  {
    id: "for-contagem",
    category: "Controle de fluxo",
    level: "Intermediário",
    title: "FOR com variável (contar de 0 a 9)",
    summary: "O loop usa um contador e outra célula guarda o valor que muda.",
    lines: [
      ["++++++[>++++++++<-]", "célula 1 = 48 que é o caractere 0"],
      [">>++++++++++", "célula 2 = 10 (contador de voltas)"],
      ["[", "REPETE 10 vezes"],
      ["<.+>-", "imprime o dígito soma 1 nele e desconta uma volta"],
      ["]", ""],
    ],
    explain: [
      "Aqui temos duas variáveis: o dígito (célula 1) e o contador (célula 2). O corpo imprime, incrementa o dígito e decrementa o contador.",
      "Em C: `for (c = '0', i = 10; i; i--) putchar(c++);`",
    ],
  },
  {
    id: "while",
    category: "Controle de fluxo",
    level: "Iniciante",
    title: "WHILE (ecoar o que você digitar)",
    summary: "Lê caracteres da entrada até acabar (valor 0).",
    input: "Olá, Brainfuck!",
    lines: [
      [",", "lê um caractere da entrada"],
      ["[", "ENQUANTO o caractere lido não for zero"],
      [".", "imprime"],
      [",", "lê o próximo"],
      ["]", "FIM"],
    ],
    explain: [
      "`,` lê um byte do campo “Entrada”. Quando a entrada acaba, a célula recebe 0 e o `while` termina.",
      "Em C: `while ((c = getchar()) != 0) putchar(c);`",
      "Mude o texto no campo de entrada e execute de novo.",
    ],
  },
  {
    id: "inverter",
    category: "Controle de fluxo",
    level: "Avançado",
    title: "Dois WHILEs: inverter um texto",
    summary: "Um loop vai guardando as letras, o outro volta imprimindo.",
    input: "Brainfuck",
    lines: [
      [">", "deixa a célula 0 como marca de início (zero)"],
      [",[>,]", "lê e guarda cada letra numa célula nova até o fim"],
      ["<", "volta para a última letra"],
      ["[.<]", "imprime andando para trás até achar a marca"],
    ],
    explain: [
      "A fita funciona como uma pilha: guardamos de frente para trás e imprimimos de trás para frente.",
      "O zero na célula 0 é a “sentinela” que faz o segundo loop parar.",
    ],
  },
  {
    id: "funcao",
    category: "Funções e padrões",
    level: "Avançado",
    title: "“Funções” em Brainfuck",
    summary: "Não há funções, mas há blocos reutilizáveis com um contrato claro.",
    lines: [
      ["", "FUNÇÃO dobrar: pega a célula atual e dobra usando a da direita como rascunho"],
      ["", "contrato: começa e termina na mesma célula e deixa o rascunho zerado"],
      ["++", "x = 2"],
      ["[->++<]>[-<+>]<", "chamada 1 (x vira 4)"],
      ["[->++<]>[-<+>]<", "chamada 2 (x vira 8)"],
      [">++++++[<++++++++>-]<.", "soma 48 e imprime o dígito 8"],
    ],
    explain: [
      "Uma “função” em Brainfuck é um trecho de código que você copia e cola sempre que precisa. O segredo é o contrato: onde o ponteiro começa, onde termina e quais células ele pode sujar.",
      "Se todo bloco começa e termina na mesma célula, você pode empilhar blocos como se fossem chamadas de função.",
      "Em C: `x = dobrar(dobrar(2));`",
    ],
  },
  {
    id: "string",
    category: "Funções e padrões",
    level: "Intermediário",
    title: "Strings e arrays",
    summary: "Células vizinhas funcionam como um vetor — ideal para textos.",
    lines: [
      ["+++++++[>++++++++++>+++++++++++++++<<-]", "c1 = 70 e c2 = 105 ao mesmo tempo"],
      [">++.", "c1 vira 72 que é H e imprime"],
      [">.", "c2 vale 105 que é i e imprime"],
      [">++++++++++.", "c3 = 10 que é nova linha"],
    ],
    explain: [
      "Um vetor é só uma sequência de células lado a lado: `v[0]`, `v[1]`, `v[2]`… Você anda por ele com `>` e `<`.",
      "O truque do primeiro loop é preencher duas células de uma vez (7 × 10 e 7 × 15), economizando comandos.",
    ],
  },
  {
    id: "entrada",
    category: "Funções e padrões",
    level: "Iniciante",
    title: "Transformar a entrada (cifra simples)",
    summary: "Soma 1 em cada letra: HAL vira IBM.",
    input: "HAL",
    lines: [
      [",", "lê o primeiro caractere"],
      ["[", "ENQUANTO houver caractere"],
      ["+.", "soma 1 e imprime"],
      [",", "lê o próximo"],
      ["]", ""],
    ],
    explain: [
      "Como letras são números, você pode fazer contas com elas. Somar 1 move para a próxima letra do alfabeto.",
      "Troque `+` por `-` e veja a cifra ao contrário. Teste com a entrada IBM.",
    ],
  },
  {
    id: "alfabeto",
    category: "Exemplos",
    level: "Intermediário",
    title: "Alfabeto de A a Z",
    summary: "Loop que imprime e incrementa uma letra 26 vezes.",
    lines: [
      ["++++++++[>++++++++<-]>+", "célula 1 = 65 que é A"],
      [">" + "+".repeat(26), "célula 2 = 26 (contador)"],
      ["[<.+>-]", "imprime a letra soma 1 nela e desconta uma volta"],
    ],
    explain: [
      "Combina tudo: multiplicação para gerar 65, um contador e um loop que usa duas variáveis.",
    ],
  },
  {
    id: "hello",
    category: "Exemplos",
    level: "Avançado",
    title: "Hello World clássico",
    summary: "O famoso programa — use o modo passo para estudar cada pedaço.",
    lines: [
      ["++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]", "prepara os códigos das letras nas células"],
      [">>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.", "imprime Hello World com ajustes finos"],
    ],
    explain: [
      "A primeira linha usa loops aninhados para criar valores próximos aos códigos ASCII de “Hello World!”. A segunda linha ajusta cada célula com `+` e `-` e imprime.",
      "Rode em modo “Auto” com velocidade baixa e observe a fita se preenchendo.",
    ],
  },
];

export const COMMANDS: { sym: string; name: string; c: string; desc: string }[] = [
  { sym: ">", name: "Direita", c: "ptr++;", desc: "Move o ponteiro para a próxima célula." },
  { sym: "<", name: "Esquerda", c: "ptr--;", desc: "Move o ponteiro para a célula anterior." },
  { sym: "+", name: "Incrementar", c: "(*ptr)++;", desc: "Soma 1 na célula atual (255 + 1 = 0)." },
  { sym: "-", name: "Decrementar", c: "(*ptr)--;", desc: "Tira 1 da célula atual (0 − 1 = 255)." },
  { sym: ".", name: "Saída", c: "putchar(*ptr);", desc: "Imprime o caractere ASCII da célula." },
  { sym: ",", name: "Entrada", c: "*ptr = getchar();", desc: "Lê um byte da entrada (0 se acabou)." },
  { sym: "[", name: "Início do loop", c: "while (*ptr) {", desc: "Se a célula for 0, pula para depois do ] correspondente." },
  { sym: "]", name: "Fim do loop", c: "}", desc: "Se a célula não for 0, volta para depois do [ correspondente." },
];

export const IDIOMS: { code: string; title: string; desc: string }[] = [
  { code: "[-]", title: "Zerar célula", desc: "x = 0" },
  { code: "[->+<]", title: "Mover para a direita", desc: "b += a; a = 0" },
  { code: "[-<+>]", title: "Mover para a esquerda", desc: "a += b; b = 0" },
  { code: "[->+>+<<]", title: "Copiar para 2 células", desc: "b = a; t = a (a = 0)" },
  { code: "[>]", title: "Ir até a próxima célula zero", desc: "while (*ptr) ptr++;" },
  { code: "[<]", title: "Voltar até a célula zero anterior", desc: "while (*ptr) ptr--;" },
  { code: ",[.,]", title: "Ecoar a entrada (cat)", desc: "while ((c = getchar())) putchar(c);" },
  { code: "[>++++++++<-]>", title: "Multiplicar por constante", desc: "b = a * 8" },
];
