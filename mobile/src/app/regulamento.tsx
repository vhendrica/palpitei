import { Documento } from "../components/Documento";
import { REGULAMENTO_MERCADOS } from "../lib/legal";

export default function Regulamento() {
  return <Documento titulo="Regulamento de Mercados" md={REGULAMENTO_MERCADOS} />;
}
