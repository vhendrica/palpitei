/** IDs da API-Football (Série A e B 2022–2024) por nome normalizado do time. */
const IDS: Record<string, number> = {
  abc: 754,
  amazonas: 10862,
  americamineiro: 125,
  athleticoparanaense: 134,
  athleticopr: 134,
  atleticogoianiense: 144,
  atleticomg: 1062,
  atleticomineiro: 1062,
  atleticoparanaense: 134,
  atleticopr: 134,
  avai: 145,
  bahia: 118,
  botafogo: 120,
  botafogosp: 2618,
  bragantino: 794,
  brusque: 1211,
  ceara: 129,
  chapecoense: 132,
  chapecoensesc: 132,
  corinthians: 131,
  coritiba: 147,
  crb: 146,
  criciuma: 140,
  cruzeiro: 135,
  csa: 150,
  cuiaba: 1193,
  flamengo: 127,
  fluminense: 124,
  fortaleza: 154,
  fortalezaec: 154,
  goias: 151,
  goiasec: 151,
  gremio: 130,
  guarani: 138,
  guaranicampinas: 138,
  internacional: 119,
  ituano: 7779,
  juventude: 152,
  londrina: 148,
  mirassol: 7848,
  nautico: 755,
  nauticorecife: 755,
  novorizontino: 7834,
  operario: 1223,
  operarioferroviario: 1223,
  operariopr: 1223,
  palmeiras: 121,
  paysandu: 149,
  pontepreta: 139,
  rbbragantino: 794,
  redbullbragantino: 794,
  sampaiocorrea: 155,
  santos: 128,
  saopaulo: 126,
  sport: 123,
  sportrecife: 123,
  tombense: 2227,
  vasco: 133,
  vascodagama: 133,
  vilanova: 142,
  vitoria: 136,
};

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function escudoUrl(time: string): string | null {
  const id = IDS[norm(time)];
  return id ? `https://media.api-sports.io/football/teams/${id}.png` : null;
}
