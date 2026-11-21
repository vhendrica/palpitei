/**
 * Nome do time como é conhecido no Brasil (não é tradução literal:
 * só muda onde o brasileiro realmente chama diferente).
 * Chave = nome como a API manda (minúsculo, sem acento, trimado).
 */
const TIMES_BR: Record<string, string> = {
  'bayern munich': 'Bayern de Munique',
  'bayern munchen': 'Bayern de Munique',
  'fc bayern munchen': 'Bayern de Munique',
  'fc bayern munich': 'Bayern de Munique',
  'borussia monchengladbach': "Borussia M'Gladbach",
  'borussia m gladbach': "Borussia M'Gladbach",
  'inter milan': 'Inter de Milão',
  'internazionale': 'Inter de Milão',
  'ac milan': 'Milan',
  'sparta prague': 'Sparta Praga',
  'sparta praha': 'Sparta Praga',
  'slavia prague': 'Slavia Praga',
  'slavia praha': 'Slavia Praga',
  'viktoria plzen': 'Viktoria Plzen',
  'hamburger sv': 'Hamburgo',
  'hertha berlin': 'Hertha Berlim',
  'union berlin': 'Union Berlim',
  'celta vigo': 'Celta de Vigo',
  'celta de vigo': 'Celta de Vigo',
  'dynamo kyiv': 'Dínamo de Kiev',
  'dynamo kiev': 'Dínamo de Kiev',
  'dinamo kiev': 'Dínamo de Kiev',
  'legia warszawa': 'Legia Varsóvia',
  'legia warsaw': 'Legia Varsóvia',
  'dinamo zagreb': 'Dínamo Zagreb',
  'sporting cp': 'Sporting de Lisboa',
  'sporting lisbon': 'Sporting de Lisboa',
  'fc porto': 'Porto',
  'sl benfica': 'Benfica',
  'sc braga': 'Braga',
  'as roma': 'Roma',
  'roma': 'Roma',
  'as monaco': 'Monaco',
  'olympique marseille': 'Olympique de Marseille',
  'olympique lyonnais': 'Lyon',
  'athletic bilbao': 'Athletic Bilbao',
  'athletic club': 'Athletic Bilbao',
  'real betis': 'Real Betis',
  'shakhtar donetsk': 'Shakhtar',
  'olympiacos': 'Olympiacos',
  'olympiacos piraeus': 'Olympiacos',
  'ferencvaros': 'Ferencváros',
  'fc copenhagen': 'Copenhagen',
  'maccabi tel aviv': 'Maccabi Tel Aviv',
  'hapoel beer sheva': 'Hapoel Beer Sheva',
  'qarabag': 'Qarabağ',
  'red bull salzburg': 'RB Salzburg',
  'rb salzburg': 'RB Salzburg',
  'psv eindhoven': 'PSV',
  'az alkmaar': 'AZ Alkmaar',
  'feyenoord rotterdam': 'Feyenoord',
  'fcsb': 'FCSB',
  'rapid wien': 'Rapid Viena',
  'austria wien': 'Áustria Viena',
  'djurgarden': 'Djurgården',
  'malmo ff': 'Malmö',
  'young boys': 'Young Boys',
  'fc basel': 'Basel',
  'fc zurich': 'Zurique',
  'club brugge': 'Club Brugge',
  'royal antwerp': 'Royal Antuérpia',
  'galatasaray sk': 'Galatasaray',
  'fenerbahce sk': 'Fenerbahçe',
  'besiktas jk': 'Besiktas',
  'sc freiburg': 'Freiburg',
  'vfl wolfsburg': 'Wolfsburg',
  'borussia dortmund': 'Borussia Dortmund',
  'bayer 04 leverkusen': 'Bayer Leverkusen',
  'vfb stuttgart': 'Stuttgart',
  'fsv mainz 05': 'Mainz',
  '1. fc koln': 'Köln',
  'fc koln': 'Köln',
  'koln': 'Köln',
  'cologne': 'Köln',
  '1. fc cologne': 'Köln',
  'fc cologne': 'Köln',
  '1. fc union berlin': 'Union Berlim',
  '1. fc heidenheim': 'Heidenheim',
  'fc heidenheim': 'Heidenheim',
  'heidenheim': 'Heidenheim',
  '1. fc nurnberg': 'Nuremberga',
  '1. fc magdeburg': 'Magdeburg',
  'fc magdeburg': 'Magdeburg',
  '1. fc kaiserslautern': 'Kaiserslautern',
  'fc kaiserslautern': 'Kaiserslautern',
  'eintracht frankfurt': 'Eintracht Frankfurt',
  'fc augsburg': 'Augsburg',
  'hannover 96': 'Hannover 96',
  'schalke 04': 'Schalke 04',
  'fc nurnberg': 'Nuremberga',
  'fc nuremberg': 'Nuremberga',
  'werder bremen': 'Werder Bremen',
  'union saint-gilloise': 'Union Saint-Gilloise',
  'krc genk': 'Genk',
  'kaa gent': 'Gent',
  'fc midtjylland': 'Midtjylland',
  'fc nordsjaelland': 'Nordsjælland',
  'bodo glimt': 'Bodø/Glimt',
  'rosenborg bk': 'Rosenborg',
  'k airpo orebro': 'Örebro',
  'ifk goteborg': 'IFK Göteborg',
  'aik solna': 'AIK',
  'apollon limassol': 'Apollon Limassol',
  'omonia nicosia': 'Omonia Nicósia',
  'sheriff tiraspol': 'Sheriff',
  // Brasileiros — o feed manda "Sigla Nome UF" ("EC Vitoria BA", "CA Paranaense PR").
  // Vai antes do cleanup genérico porque alguns clubes fogem do padrão (CA Paranaense, Clube do Remo).
  'ec vitoria ba': 'Vitória',
  'ec bahia ba': 'Bahia',
  'sc corinthians sp': 'Corinthians',
  'sc internacional rs': 'Internacional',
  'cr flamengo rj': 'Flamengo',
  'cr vasco da gama rj': 'Vasco',
  'se palmeiras sp': 'Palmeiras',
  'sao paulo fc sp': 'São Paulo',
  'santos fc sp': 'Santos',
  'fluminense fc rj': 'Fluminense',
  'botafogo fr rj': 'Botafogo',
  'gremio fb porto alegrense rs': 'Grêmio',
  'cruzeiro ec mg': 'Cruzeiro',
  'atletico mineiro mg': 'Atlético-MG',
  'ca paranaense pr': 'Athletico-PR',
  'chapecoense sc': 'Chapecoense',
  'clube do remo pa': 'Remo',
  'coritiba fc pr': 'Coritiba',
  'red bull bragantino sp': 'RB Bragantino',
  'mirassol fc sp': 'Mirassol',
};

const norm = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const UFS =
  'AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO';
// Siglas de entidade que não carregam o nome do time (Esporte Clube, Sport Club,
// Clube de Regatas, Sociedade Esportiva, Futebol Clube...). CA/AA/AC ficam — Atlético faz parte do nome.
const SIGLA = 'EC|SC|CR|SE|FC|CF|FB|FR|CD|GE|IF|RC|XV';

/** Limpa "EC Vitoria BA" → "Vitoria": UF no fim, sigla de clube nas pontas e no meio.
 * Times numerados ("1. FC Cologne"): tira o "1." antes das siglas pra sobrar a cidade. */
const limpaClube = (nome: string) =>
  nome
    .trim()
    .replace(/^\d+\.\s*/, '')
    .replace(new RegExp(`\\s+(?:${UFS})$`, 'i'), '')
    .replace(new RegExp(`^(?:${SIGLA})\\s+`, 'i'), '')
    .replace(new RegExp(`\\s+(?:${SIGLA})$`, 'i'), '')
    .replace(new RegExp(`\\s+(?:${SIGLA})\\s+`, 'gi'), ' ')
    .replace(/^Clube (?:do|da|de) /i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Devolve o nome como o Brasil conhece — o feed traz sigla de clube e UF
 * ("EC Vitoria BA"), que a gente não exibe. Sem versão BR, aplica a limpeza genérica.
 */
export const nomeBR = (nome: string): string => {
  const br = TIMES_BR[norm(nome)];
  if (br) return br;
  const limpo = limpaClube(nome);
  return TIMES_BR[norm(limpo)] ?? limpo;
};
