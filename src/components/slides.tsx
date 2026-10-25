export type Slide = {
  tag: string;
  title: string;
  subtitle?: string;
  titleSize?: number;
  bullets: string[];
  /** Rota do app que aparece no celular neste slide. */
  route?: string;
  kind?: "monetizacao" | "demo";
};

export const SLIDES: Slide[] = [
  {
    tag: "SLIDE 1 / 7 - CAPA",
    title: "PALPITEI",
    titleSize: 112,
    subtitle: "A emoção da BET sem o risco da BET",
    bullets: [
      "100% grátis: ninguém perde dinheiro",
      "Sem dinheiro real = sem regulação",
      "Prêmios locais reais",
    ],
    route: "/ligas",
  },
  {
    tag: "SLIDE 2 / 7 - PONTOS",
    title: "SISTEMA DE PONTOS",
    subtitle: "PONTOS fora, FICHAS dentro.",
    bullets: [
      "PONTOS = saldo, FICHAS = uso na disputa",
      "Pontuação simples e descomplicada",
      "Login diário, streak, convite = mais pontos",
    ],
    route: "/",
  },
  {
    tag: "SLIDE 3 / 7 - APOSTANDO",
    title: "FLUXO DE APOSTA",
    subtitle: "com cara de BET",
    bullets: [
      "Odds reais",
      "Vários mercados: vencedor, gols, escanteios, pênalti",
      "Acertou? FICHAS × odd viram pontos no ranking",
    ],
    route: "/liga/l_classico",
  },
  {
    tag: "SLIDE 4 / 7 - RANKING",
    title: "RANKING AO VIVO",
    subtitle: "Gamificação que prende",
    bullets: [
      "Ranking de cada jogo, com pontos calculados",
      "Nome + bairro de cada palpiteiro",
      "Clique no jogador e veja os palpites dele",
      "Campeão leva o prêmio da loja parceira",
    ],
    route: "/ranking?ligaId=l_flo_for",
  },
  {
    tag: "SLIDE 5 / 7 - MONETIZAÇÃO",
    title: "MONETIZAÇÃO",
    titleSize: 58,
    subtitle: "Como ganha dinheiro",
    bullets: [
      "Banner fixo no rodapé",
      "Anúncio de tela cheia ao abrir o app",
      "Anúncio segmentado por bairro",
      "Clique abre WhatsApp direto -> cliente quente",
      "Assinatura Premium: mais pontos, mais palpites e sem anúncios",
    ],
    route: "/",
    kind: "monetizacao",
  },
  {
    tag: "SLIDE 6 / 7 - FECHAMENTO",
    title: "POR QUE VALE?",
    subtitle: "Mesmo com regulação",
    bullets: [
      "Ajuda viciado a jogar sem perder dinheiro (pitch social)",
      "Comércio local ganha cliente real",
      "Sem ser casa de aposta = sem licença",
      "Escala Fortaleza -> Nordeste -> Brasil",
    ],
    route: "/perfil",
  },
  {
    tag: "SLIDE 7 / 7 - DEMO",
    title: "DEMO AO VIVO",
    subtitle: "O app de verdade. Mexa com o mouse.",
    bullets: [
      "Cadastro: nome, WhatsApp e bairro",
      "Anúncio de tela cheia ao abrir",
      "PALPITAR AGORA: 100 PONTOS viram 200 FICHAS",
      "Distribua as FICHAS e confirme o palpite",
    ],
    kind: "demo",
  },
];
