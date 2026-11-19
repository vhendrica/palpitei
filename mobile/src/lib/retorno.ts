/** Para onde voltar depois do login (ex.: o convite que a pessoa abriu sem conta). */
let destino: string | null = null;

export const guardarRetorno = (rota: string) => {
  destino = rota;
};

export function pegarRetorno() {
  const r = destino;
  destino = null;
  return r;
}
