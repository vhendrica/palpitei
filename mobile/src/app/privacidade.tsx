import { Documento } from "../components/Documento";
import { POLITICA_PRIVACIDADE } from "../lib/legal";

export default function Privacidade() {
  return <Documento titulo="Política de Privacidade" md={POLITICA_PRIVACIDADE} />;
}
