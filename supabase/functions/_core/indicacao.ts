import { type Db, num } from './db.ts';

// Colunas de config usadas por cada marco da indicação.
const MARCO_CONFIG = {
  palpite: 'indicacao_palpite',
  login_d2: 'indicacao_login',
  login_d3: 'indicacao_login',
  login_d4: 'indicacao_login',
  bonus: 'indicacao_bonus',
} as const;

type Marco = keyof typeof MARCO_CONFIG;

/**
 * Paga um marco da indicação ao indicador, uma única vez por indicado/tipo.
 * Não faz nada se o usuário não foi indicado ou se o marco já foi pago.
 */
export async function marcarIndicacao(db: Db, indicadoId: string, tipo: Marco) {
  const [u] = await db`select indicado_por from users where id = ${indicadoId}`;
  if (!u?.indicado_por) return;
  const coluna = MARCO_CONFIG[tipo];
  const [r] = await db`
    insert into indicacao_recompensas (indicado_id, tipo, indicador_id, pontos)
    select ${indicadoId}, ${tipo}, ${u.indicado_por}, c.${db(coluna)}
    from config c where c.id = 1
    on conflict do nothing
    returning pontos`;
  if (r) {
    await db`update users set saldo_pontos = saldo_pontos + ${num(r.pontos)} where id = ${u.indicado_por}`;
  }
}
