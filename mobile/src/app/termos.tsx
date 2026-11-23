import { Documento } from "../components/Documento";
import { REGULAMENTO_CONCURSO } from "../lib/legal";

export default function Termos() {
  return (
    <Documento
      titulo="Termos de Uso"
      md={REGULAMENTO_CONCURSO}
      links={[
        { label: "Regulamento de Mercados", href: "/regulamento" },
        { label: "Política de Privacidade", href: "/privacidade" },
      ]}
    />
  );
}
