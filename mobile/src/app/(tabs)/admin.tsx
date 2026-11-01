import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { Checkbox, ErrorBox, Field } from "../../components/Form";
import { fmtReais } from "../../components/PremioBar";
import {
  Button,
  Card,
  SectionTitle,
  StatusBadge,
  T,
} from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { fmtData, fmtOdd } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { agruparMercados } from "../../types";
import type {
  Config,
  Fixture,
  Jogo,
  LigaAdmin,
  LigaHistorico,
} from "../../types";

type Aba = "liga" | "pool" | "historico" | "config";

const hojeLocal = () =>
  new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export default function Admin() {
  const { user, refreshHome } = useApp();
  const [aba, setAba] = useState<Aba>("liga");
  const [data, setData] = useState(hojeLocal());
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!user?.is_admin) return <Redirect href="/" />;

  /** Executa uma ação admin mostrando erro/sucesso; atualiza a home do app depois. */
  const run = async (fn: () => Promise<string | void>) => {
    setErro(null);
    setOk(null);
    try {
      const msg = await fn();
      if (msg) setOk(msg);
      refreshHome();
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Admin" />
      <View className="flex-row border-b border-line bg-card">
        {(
          [
            ["liga", "Múltipla"],
            ["pool", "Pool"],
            ["historico", "Histórico"],
            ["config", "Config"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setAba(k)}
            className={`flex-1 items-center py-3 ${aba === k ? "border-b-2 border-primary" : ""}`}
          >
            <T
              className={`font-mont-b text-xs ${aba === k ? "text-primary" : "text-muted"}`}
            >
              {label}
            </T>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {aba === "liga" || aba === "pool" ? (
          <Field
            label="Data (AAAA-MM-DD)"
            icon="calendar-outline"
            value={data}
            onChangeText={setData}
          />
        ) : null}
        <ErrorBox erro={erro} />
        {ok ? (
          <T className="mt-3 font-mont-b text-sm text-primary">{ok}</T>
        ) : null}
        {aba === "liga" ? <AbaLiga data={data} run={run} /> : null}
        {aba === "pool" ? (
          <AbaPool data={data} run={run} onMontada={() => setAba("liga")} />
        ) : null}
        {aba === "historico" ? (
          <AbaHistorico
            run={run}
            onAbrir={(d) => {
              setData(d);
              setAba("liga");
            }}
          />
        ) : null}
        {aba === "config" ? <AbaConfig run={run} /> : null}
      </ScrollView>
    </View>
  );
}

type Run = (fn: () => Promise<string | void>) => Promise<void>;

function AbaLiga({ data, run }: { data: string; run: Run }) {
  const [la, setLa] = useState<LigaAdmin | null>(null);
  const [vencedores, setVencedores] = useState<Record<string, boolean>>({});
  const [premioDesc, setPremioDesc] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);

  const load = useCallback(
    () =>
      run(async () => {
        const r = await api.admin.liga(data);
        setLa(r);
        setPremioDesc(r.liga?.premio_desc ?? "");
        setVencedores({});
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) load();
  }, [data, load]);

  if (!la) return null;
  if (!la.liga) {
    return (
      <Card className="mt-4">
        <T className="font-mont-b text-sm">
          Nenhuma múltipla montada para {data}.
        </T>
        <T className="mt-1 text-xs text-muted">
          Vá em “Pool de jogos”, selecione os jogos e monte a múltipla.
        </T>
      </Card>
    );
  }
  const liga = la.liga;
  const fechada = liga.status === "finalizada";

  return (
    <>
      <Card className="mt-4">
        <View className="flex-row items-center justify-between">
          <T className="font-mont-xb text-base">Múltipla de {liga.data}</T>
          <StatusBadge status={liga.status} />
        </View>
        <T className="mt-1 text-sm text-muted">
          {la.palpiteiros} palpiteiros • entrada {liga.custo_entrada} PONTOS →{" "}
          {liga.fichas_por_entrada} FICHAS
          {liga.premio_final != null
            ? ` • prêmio final ${fmtReais(liga.premio_final)}`
            : ""}
        </T>
        {!fechada ? (
          <>
            <Field
              label="Descrição do prêmio"
              value={premioDesc}
              onChangeText={setPremioDesc}
              placeholder="Ex.: voucher no parceiro X"
            />
            <View className="flex-row">
              <Button
                title="Salvar"
                variant="ghost"
                className="mr-2 flex-1"
                onPress={() =>
                  run(async () => {
                    setLa(
                      await api.admin.atualizarLiga(liga.id, {
                        premio_desc: premioDesc || null,
                      }),
                    );
                    return "Prêmio atualizado.";
                  })
                }
              />
              <Button
                title={liga.status === "aberta" ? "Fechar apostas" : "Reabrir"}
                variant="outline"
                className="flex-1"
                onPress={() =>
                  run(async () => {
                    setLa(
                      await api.admin.atualizarLiga(liga.id, {
                        status:
                          liga.status === "aberta" ? "em_andamento" : "aberta",
                      }),
                    );
                  })
                }
              />
            </View>
          </>
        ) : null}
      </Card>

      <SectionTitle>Palpiteiros ({la.palpiteiros})</SectionTitle>
      <Card>
        {la.participantes.length === 0 ? (
          <T className="text-sm text-muted">Ninguém entrou ainda.</T>
        ) : (
          la.participantes.map((p) => (
            <View
              key={p.user_id}
              className="flex-row items-center border-b border-line py-2"
            >
              <View className="flex-1 pr-2">
                <T className="font-mont-b text-sm">{p.nome}</T>
                <T className="text-xs text-muted">
                  {p.bairro} • {p.fichas_apostadas} fichas apostadas
                </T>
              </View>
              {!fechada ? (
                <Button
                  title={removendo === p.user_id ? "Confirmar" : "Remover"}
                  variant={removendo === p.user_id ? "danger" : "outline"}
                  onPress={() => {
                    if (removendo !== p.user_id) return setRemovendo(p.user_id);
                    setRemovendo(null);
                    run(async () => {
                      setLa(await api.admin.removerPalpiteiro(liga.id, p.user_id));
                      return `${p.nome} removido: fichas apagadas e ${liga.custo_entrada} PONTOS devolvidos.`;
                    });
                  }}
                />
              ) : null}
            </View>
          ))
        )}
        {removendo ? (
          <T className="mt-2 text-xs text-muted">
            Toque em Confirmar pra remover. As fichas dele são apagadas e os
            PONTOS da entrada voltam pro saldo.
          </T>
        ) : null}
        {fechada && la.participantes.length > 0 ? (
          <T className="mt-2 text-xs text-muted">
            Pra remover palpiteiros, reative a múltipla no Histórico.
          </T>
        ) : null}
      </Card>

      <SectionTitle>Jogos</SectionTitle>
      {la.jogos.map((j) => (
        <JogoAdmin
          key={j.id}
          jogo={j}
          fechada={fechada}
          vencedores={vencedores}
          setVencedor={(id, v) => setVencedores((s) => ({ ...s, [id]: v }))}
          onDestaque={() =>
            run(async () => {
              setLa(await api.admin.destaque(j.id));
              return "Jogo do dia marcado.";
            })
          }
          onSalvarMercados={(ms) =>
            run(async () => {
              setLa(await api.admin.mercados(j.id, ms));
              return "Mercados salvos.";
            })
          }
        />
      ))}

      {!fechada ? (
        <Card className="mt-2">
          <T className="font-mont-b text-sm">Finalizar</T>
          <T className="mt-1 text-xs text-muted">
            Marque os mercados vencedores nos jogos acima. O prêmio final é
            gravado pela escada (limitado à meta) e o voucher vai pro 1º lugar.
          </T>
          <Button
            title="Finalizar múltipla"
            variant="danger"
            className="mt-3"
            onPress={() =>
              run(async () => {
                const ids = Object.entries(vencedores)
                  .filter(([, v]) => v)
                  .map(([id]) => id);
                const r = await api.admin.finalizar(liga.id, ids);
                setLa(await api.admin.liga(data));
                return r.voucher
                  ? `Finalizada. Prêmio ${fmtReais(r.premio_final)} — voucher ${r.voucher.codigo}.`
                  : `Finalizada sem voucher (prêmio ${fmtReais(r.premio_final)}).`;
              })
            }
          />
        </Card>
      ) : null}
    </>
  );
}

type MercadoDraft = {
  id?: string;
  grupo: string;
  descricao: string;
  multiplicador: string;
};

function JogoAdmin({
  jogo,
  fechada,
  vencedores,
  setVencedor,
  onDestaque,
  onSalvarMercados,
}: {
  jogo: Jogo;
  fechada: boolean;
  vencedores: Record<string, boolean>;
  setVencedor: (id: string, v: boolean) => void;
  onDestaque: () => void;
  onSalvarMercados: (
    ms: {
      id?: string;
      grupo: string;
      descricao: string;
      multiplicador: number;
    }[],
  ) => void;
}) {
  const { palette: C } = useTheme();
  const [editando, setEditando] = useState(false);
  const [ms, setMs] = useState<MercadoDraft[]>([]);
  const [daApi, setDaApi] = useState<Awaited<
    ReturnType<typeof api.admin.mercadosApi>
  > | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);

  const buscarDaApi = async () => {
    setBuscando(true);
    setErroApi(null);
    try {
      setDaApi(await api.admin.mercadosApi(jogo.id));
    } catch (e) {
      setErroApi(errorMessage(e));
    } finally {
      setBuscando(false);
    }
  };

  const abrirEditor = () => {
    setMs(
      jogo.mercados.map((m) => ({
        id: m.id,
        grupo: m.grupo,
        descricao: m.descricao,
        multiplicador: String(m.multiplicador),
      })),
    );
    setEditando(true);
  };

  return (
    <Card className={`mb-3 ${jogo.destaque ? "border-2 border-primary" : ""}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <T className="text-[11px] uppercase tracking-widest text-muted">
            #{jogo.fixture_id} • {jogo.campeonato} • {fmtData(jogo.horario)}
          </T>
          <T className="mt-1 font-mont-xb text-base">
            {jogo.time_casa} x {jogo.time_fora}
          </T>
        </View>
        {!fechada ? (
          <Pressable
            onPress={onDestaque}
            className="p-1"
            accessibilityLabel="Marcar jogo do dia"
          >
            <Ionicons
              name={jogo.destaque ? "star" : "star-outline"}
              size={22}
              color={C.primary}
            />
          </Pressable>
        ) : null}
      </View>

      {!editando ? (
        <View className="mt-2">
          {agruparMercados(jogo.mercados).map((g) => (
            <View key={g.grupo} className="mt-1">
              {g.grupo ? (
                <T className="mt-1 font-mont-xb text-xs uppercase">{g.grupo}</T>
              ) : null}
              {g.opcoes.map((m) => (
                <View
                  key={m.id}
                  className="flex-row items-center justify-between border-b border-line py-1.5"
                >
                  {fechada ? (
                    <T className="flex-1 text-sm">
                      {m.resultado_final ? "✓ " : ""}
                      {m.descricao}
                    </T>
                  ) : (
                    <View className="flex-1">
                      <Checkbox
                        checked={!!vencedores[m.id]}
                        onChange={(v) => setVencedor(m.id, v)}
                        label={m.descricao}
                      />
                    </View>
                  )}
                  <T className="ml-2 font-odds text-base text-primary">
                    {fmtOdd(m.multiplicador)}
                  </T>
                </View>
              ))}
            </View>
          ))}
          {!fechada ? (
            <Button
              title="Editar mercados"
              variant="ghost"
              icon="create-outline"
              className="mt-2"
              onPress={abrirEditor}
            />
          ) : null}
        </View>
      ) : (
        <View className="mt-2">
          {ms.map((m, i) => (
            <View
              key={m.id ?? `novo-${i}`}
              className="mb-2 flex-row items-center"
            >
              <TextInput
                className="mr-2 flex-1 rounded-lg border border-line bg-cardAlt px-2 py-2 font-mont-sb text-sm text-fg"
                value={m.grupo}
                placeholder="Mercado (ex.: Resultado)"
                placeholderTextColor={C.muted}
                onChangeText={(t) =>
                  setMs((s) =>
                    s.map((x, k) => (k === i ? { ...x, grupo: t } : x)),
                  )
                }
              />
              <TextInput
                className="mr-2 flex-1 rounded-lg border border-line bg-cardAlt px-2 py-2 font-mont-sb text-sm text-fg"
                value={m.descricao}
                placeholder="Opção (ex.: Empate)"
                placeholderTextColor={C.muted}
                onChangeText={(t) =>
                  setMs((s) =>
                    s.map((x, k) => (k === i ? { ...x, descricao: t } : x)),
                  )
                }
              />
              <TextInput
                className="w-20 rounded-lg border border-line bg-cardAlt px-2 py-2 font-odds text-sm text-fg"
                value={m.multiplicador}
                placeholder="2.00"
                keyboardType="decimal-pad"
                placeholderTextColor={C.muted}
                onChangeText={(t) =>
                  setMs((s) =>
                    s.map((x, k) => (k === i ? { ...x, multiplicador: t } : x)),
                  )
                }
              />
              <Pressable
                onPress={() => setMs((s) => s.filter((_, k) => k !== i))}
                className="ml-1 p-1"
              >
                <Ionicons name="trash-outline" size={18} color={C.danger} />
              </Pressable>
            </View>
          ))}
          <Button
            title="Adicionar mercado"
            variant="ghost"
            icon="add"
            onPress={() =>
              setMs((s) => [
                ...s,
                {
                  grupo: s[s.length - 1]?.grupo ?? "",
                  descricao: "",
                  multiplicador: "",
                },
              ])
            }
          />
          {!daApi ? (
            <Button
              title={
                buscando ? "Buscando…" : "Ver mais mercados da API (4 créditos)"
              }
              variant="outline"
              icon="cloud-download-outline"
              className="mt-1"
              onPress={buscando ? undefined : buscarDaApi}
            />
          ) : (
            <View className="mt-2 rounded-lg border border-line p-2">
              <T className="mb-1 text-[11px] uppercase tracking-widest text-muted">
                Mercados da API — toque para adicionar
                {daApi.creditos_restantes != null
                  ? ` • ${daApi.creditos_restantes} créditos`
                  : ""}
              </T>
              {daApi.mercados.length === 0 ? (
                <T className="text-sm text-muted">
                  A API não tem mercados extras para esse jogo.
                </T>
              ) : null}
              {agruparMercados(daApi.mercados).map((g) => {
                const tem = (o: { descricao: string }) =>
                  ms.some(
                    (x) =>
                      x.grupo.trim().toUpperCase() === g.grupo &&
                      x.descricao.trim().toUpperCase() === o.descricao,
                  );
                const ja = g.opcoes.every(tem);
                const casas = Math.min(...g.opcoes.map((o) => o.casas));
                return (
                  <Pressable
                    key={g.grupo}
                    disabled={ja}
                    onPress={() =>
                      setMs((s) => [
                        ...s,
                        ...g.opcoes
                          .filter((o) => !tem(o))
                          .map((o) => ({
                            grupo: g.grupo,
                            descricao: o.descricao,
                            multiplicador: String(o.multiplicador),
                          })),
                      ])
                    }
                    className={`border-b border-line py-2 ${ja ? "opacity-40" : ""}`}
                  >
                    <View className="flex-row items-center">
                      <T className="flex-1 font-mont-xb text-xs">
                        {g.grupo}
                        <T className="text-[11px] text-muted">
                          {" "}
                          ({casas} {casas === 1 ? "casa" : "casas"})
                        </T>
                      </T>
                      <Ionicons
                        name={ja ? "checkmark" : "add-circle-outline"}
                        size={18}
                        color={C.primary}
                      />
                    </View>
                    <T className="mt-0.5 text-sm">
                      {g.opcoes
                        .map((o) => `${o.descricao} ${fmtOdd(o.multiplicador)}`)
                        .join("  |  ")}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          )}
          <ErrorBox erro={erroApi} />
          <View className="mt-2 flex-row">
            <Button
              title="Cancelar"
              variant="outline"
              className="mr-2 flex-1"
              onPress={() => setEditando(false)}
            />
            <Button
              title="Salvar"
              className="flex-1"
              onPress={() => {
                onSalvarMercados(
                  ms.map((m) => ({
                    id: m.id,
                    grupo: m.grupo,
                    descricao: m.descricao,
                    multiplicador: Number(m.multiplicador.replace(",", ".")),
                  })),
                );
                setEditando(false);
              }}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function AbaPool({
  data,
  run,
  onMontada,
}: {
  data: string;
  run: Run;
  onMontada: () => void;
}) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [novo, setNovo] = useState({
    fixture_id: "",
    time_casa: "",
    time_fora: "",
    hora: "",
    campeonato: "",
  });

  const load = useCallback(
    () =>
      run(async () => {
        const r = await api.admin.fixtures(data);
        setFixtures(r.fixtures);
        setSel(
          Object.fromEntries(
            r.fixtures
              .filter((f) => f.selecionado)
              .map((f) => [f.fixture_id, true]),
          ),
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) load();
  }, [data, load]);

  const selecionados = Object.entries(sel)
    .filter(([, v]) => v)
    .map(([id]) => Number(id));

  return (
    <>
      <SectionTitle
        right={
          <T className="text-xs text-muted">
            {selecionados.length} selecionados
          </T>
        }
      >
        Pool do dia
      </SectionTitle>
      <Button
        title="Importar jogos e odds do dia (The Odds API)"
        variant="outline"
        className="mb-3"
        onPress={() =>
          run(async () => {
            const r = await api.admin.importarOdds(data);
            await load();
            const creditos =
              r.creditos_restantes == null
                ? ""
                : ` Créditos restantes: ${r.creditos_restantes}.`;
            return `${r.importados.length} jogos importados com odds.${creditos}`;
          })
        }
      />
      {fixtures.length === 0 ? (
        <T className="text-sm text-muted">
          Nenhum jogo no pool. Importe da API ou cadastre abaixo.
        </T>
      ) : null}
      {fixtures.map((f) => (
        <Card key={f.id} className="mb-2 flex-row items-center">
          <View className="flex-1">
            <Checkbox
              checked={!!sel[f.fixture_id]}
              onChange={(v) => setSel((s) => ({ ...s, [f.fixture_id]: v }))}
              label={`${f.time_casa} x ${f.time_fora}`}
            />
            <T className="-mt-2 ml-9 text-[11px] text-muted">
              {f.campeonato} • {fmtData(f.horario)}
            </T>
            {f.mercados_sugeridos?.length ? (
              <T className="ml-9 mt-1 text-[11px] text-muted">
                {f.mercados_sugeridos
                  .map((m) => `${m.descricao} ${fmtOdd(m.multiplicador)}`)
                  .join(" • ")}
              </T>
            ) : null}
          </View>
          <Pressable
            className="p-2"
            onPress={() =>
              run(async () => {
                await api.admin.removerFixture(f.id);
                await load();
              })
            }
          >
            <Ionicons name="trash-outline" size={18} color="#999" />
          </Pressable>
        </Card>
      ))}
      <Button
        title="Montar múltipla com selecionados"
        className="mt-2"
        disabled={selecionados.length === 0}
        onPress={() =>
          run(async () => {
            await api.admin.selecionar(data, selecionados);
            onMontada();
            return "Múltipla montada. Agora defina mercados e o jogo do dia.";
          })
        }
      />

      <SectionTitle>Adicionar jogo ao pool</SectionTitle>
      <Field
        label="Fixture ID (API-Football)"
        keyboardType="number-pad"
        value={novo.fixture_id}
        onChangeText={(t) => setNovo({ ...novo, fixture_id: t })}
      />
      <Field
        label="Mandante"
        value={novo.time_casa}
        onChangeText={(t) => setNovo({ ...novo, time_casa: t })}
      />
      <Field
        label="Visitante"
        value={novo.time_fora}
        onChangeText={(t) => setNovo({ ...novo, time_fora: t })}
      />
      <Field
        label="Horário (HH:MM, Brasília)"
        value={novo.hora}
        onChangeText={(t) => setNovo({ ...novo, hora: t })}
        placeholder="21:30"
      />
      <Field
        label="Campeonato"
        value={novo.campeonato}
        onChangeText={(t) => setNovo({ ...novo, campeonato: t })}
      />
      <Button
        title="Adicionar"
        variant="outline"
        onPress={() =>
          run(async () => {
            if (!/^\d{2}:\d{2}$/.test(novo.hora))
              throw new ApiError("Horário inválido. Use HH:MM.", 400);
            await api.admin.salvarFixture({
              fixture_id: Number(novo.fixture_id),
              time_casa: novo.time_casa,
              time_fora: novo.time_fora,
              campeonato: novo.campeonato,
              data,
              horario: new Date(`${data}T${novo.hora}:00-03:00`).toISOString(),
            });
            setNovo({
              fixture_id: "",
              time_casa: "",
              time_fora: "",
              hora: "",
              campeonato: "",
            });
            await load();
            return "Jogo adicionado ao pool.";
          })
        }
      />
    </>
  );
}

function AbaConfig({ run }: { run: Run }) {
  const { palette: C } = useTheme();
  const [cfg, setCfg] = useState<Record<keyof Config, string> | null>(null);
  const [faixas, setFaixas] = useState<
    { usuarios_min: string; valor: string }[]
  >([]);

  useEffect(() => {
    run(async () => {
      const r = await api.admin.config();
      setCfg({
        qtd_jogos_dia: String(r.config.qtd_jogos_dia),
        fichas_por_entrada: String(r.config.fichas_por_entrada),
        custo_entrada_pontos: String(r.config.custo_entrada_pontos),
        pontos_boas_vindas: String(r.config.pontos_boas_vindas),
        premio_inicial: String(r.config.premio_inicial),
      });
      setFaixas(
        r.premio_escada.map((f) => ({
          usuarios_min: String(f.usuarios_min),
          valor: String(f.valor),
        })),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cfg) return null;
  const campo = (k: keyof Config, label: string) => (
    <Field
      label={label}
      keyboardType="number-pad"
      value={cfg[k]}
      onChangeText={(t) => setCfg({ ...cfg, [k]: t })}
    />
  );

  return (
    <>
      <SectionTitle>Escada de prêmio</SectionTitle>
      <T className="mb-2 text-xs text-muted">
        A barra começa no prêmio inicial e sobe a cada faixa: palpiteiros (quem
        pagou a entrada) → valor. A última faixa é a META e o teto do prêmio.
      </T>
      <View className="mb-2 flex-row items-center">
        <T className="w-14 text-xs text-muted">Início</T>
        <TextInput
          className="mr-2 flex-1 rounded-lg border border-line bg-card px-2 py-2 font-odds text-sm text-fg"
          value={cfg.premio_inicial}
          keyboardType="decimal-pad"
          placeholder="Prêmio inicial (R$)"
          placeholderTextColor={C.muted}
          onChangeText={(t) => setCfg({ ...cfg, premio_inicial: t })}
        />
        <T className="flex-1 text-[11px] text-muted">prêmio inicial (R$)</T>
        <View className="ml-1 w-[26px]" />
      </View>
      {faixas.map((f, i) => (
        <View key={i} className="mb-2 flex-row items-center">
          <T className="w-14 text-xs text-muted">
            {i === faixas.length - 1 ? "META" : `${i + 1}ª`}
          </T>
          <TextInput
            className="mr-2 flex-1 rounded-lg border border-line bg-card px-2 py-2 font-odds text-sm text-fg"
            value={f.usuarios_min}
            keyboardType="number-pad"
            placeholder="palpiteiros"
            placeholderTextColor={C.muted}
            onChangeText={(t) =>
              setFaixas((s) =>
                s.map((x, k) => (k === i ? { ...x, usuarios_min: t } : x)),
              )
            }
          />
          <TextInput
            className="flex-1 rounded-lg border border-line bg-card px-2 py-2 font-odds text-sm text-fg"
            value={f.valor}
            keyboardType="decimal-pad"
            placeholder="R$"
            placeholderTextColor={C.muted}
            onChangeText={(t) =>
              setFaixas((s) =>
                s.map((x, k) => (k === i ? { ...x, valor: t } : x)),
              )
            }
          />
          <Pressable
            onPress={() => setFaixas((s) => s.filter((_, k) => k !== i))}
            className="ml-1 p-1"
          >
            <Ionicons name="trash-outline" size={18} color={C.danger} />
          </Pressable>
        </View>
      ))}
      <View className="flex-row">
        <Button
          title="Faixa"
          icon="add"
          variant="ghost"
          className="mr-2 flex-1"
          onPress={() =>
            setFaixas((s) => [...s, { usuarios_min: "", valor: "" }])
          }
        />
        <Button
          title="Salvar escada"
          className="flex-1"
          onPress={() =>
            run(async () => {
              await api.admin.salvarConfig({
                premio_inicial: Number(cfg.premio_inicial.replace(",", ".")) || 0,
              });
              await api.admin.salvarEscada(
                faixas.map((f) => ({
                  usuarios_min: Number(f.usuarios_min),
                  valor: Number(f.valor.replace(",", ".")),
                })),
              );
              return "Escada salva.";
            })
          }
        />
      </View>

      <SectionTitle>Regras</SectionTitle>
      {campo("custo_entrada_pontos", "Entrada (PONTOS)")}
      {campo("fichas_por_entrada", "Fichas por entrada")}
      {campo("pontos_boas_vindas", "Bônus de cadastro (PONTOS)")}
      <T className="mb-3 text-xs text-muted">
        Entrada e fichas valem para as próximas múltiplas montadas.
      </T>
      <Button
        title="Salvar regras"
        onPress={() =>
          run(async () => {
            await api.admin.salvarConfig(
              Object.fromEntries(
                Object.entries(cfg)
                  .filter(([k]) => k !== "premio_inicial")
                  .map(([k, v]) => [k, Number(v)]),
              ) as Partial<Config>,
            );
            return "Regras salvas.";
          })
        }
      />
    </>
  );
}

function AbaHistorico({
  run,
  onAbrir,
}: {
  run: Run;
  onAbrir: (data: string) => void;
}) {
  const [ligas, setLigas] = useState<LigaHistorico[] | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const carregar = useCallback(
    () => api.admin.ligas().then((r) => setLigas(r.ligas)),
    [],
  );
  useEffect(() => {
    carregar().catch(() => setLigas([]));
  }, [carregar]);

  if (!ligas) return <T className="mt-4 text-muted">Carregando…</T>;
  if (ligas.length === 0)
    return <T className="mt-4 text-muted">Nenhuma múltipla ainda.</T>;

  return (
    <View className="mt-2">
      <SectionTitle>Múltiplas</SectionTitle>
      {ligas.map((l) => {
        const [a, m, d] = l.data.split("-");
        const fechada = l.status === "finalizada";
        return (
          <Card key={l.id} className="mb-3">
            <View className="flex-row items-center justify-between">
              <T className="font-mont-xb text-base">{`${d}/${m}/${a}`}</T>
              <StatusBadge status={l.status} />
            </View>
            <T className="mt-1 text-sm">
              {l.jogos.length ? l.jogos.join(" • ") : "Sem jogos"}
            </T>
            <T className="mt-1 text-xs text-muted">
              {l.palpiteiros} palpiteiro{l.palpiteiros === 1 ? "" : "s"}
              {l.premio_desc ? ` • ${l.premio_desc}` : ""}
              {fechada && l.premio_final != null
                ? ` • prêmio final ${fmtReais(l.premio_final)}`
                : ""}
              {fechada ? ` • vencedor: ${l.vencedor ?? "ninguém pontuou"}` : ""}
            </T>
            <View className="mt-3 flex-row">
              <Button
                title="Abrir"
                variant="outline"
                className="mr-2 flex-1"
                onPress={() => onAbrir(l.data)}
              />
              {fechada ? (
                <Button
                  title={
                    confirmar === l.id ? "Confirmar reativação" : "Reativar"
                  }
                  variant={confirmar === l.id ? undefined : "outline"}
                  className="flex-1"
                  onPress={() => {
                    if (confirmar !== l.id) return setConfirmar(l.id);
                    setConfirmar(null);
                    run(async () => {
                      await api.admin.reativar(l.id);
                      await carregar();
                      return `Múltipla de ${d}/${m} reativada: voucher cancelado e resultados limpos.`;
                    });
                  }}
                />
              ) : null}
            </View>
            {confirmar === l.id ? (
              <T className="mt-2 text-xs text-muted">
                Isso cancela o voucher, retira os PONTOS devolvidos ao vencedor
                e limpa os resultados. Toque de novo pra confirmar.
              </T>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
