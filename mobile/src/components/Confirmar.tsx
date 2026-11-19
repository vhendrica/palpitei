import { Modal, View } from "react-native";

import { ThemeVars } from "../store/Theme";
import { Button, T } from "./ui";

/** Confirmação dentro do app (o alerta nativo não existe na web). */
export function Confirmar({
  visivel,
  titulo,
  texto,
  confirmar,
  perigo,
  ocupado,
  onConfirmar,
  onFechar,
}: {
  visivel: boolean;
  titulo: string;
  texto: string;
  confirmar: string;
  perigo?: boolean;
  ocupado?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <ThemeVars>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-[420px] rounded-2xl bg-card p-5">
            <T className="font-mont-xb text-lg">{titulo}</T>
            <T className="mt-1.5 text-sm leading-5 text-muted">{texto}</T>
            <Button
              title={confirmar}
              variant={perigo ? "danger" : "primary"}
              className="mt-4"
              loading={ocupado}
              onPress={onConfirmar}
            />
            <Button title="Voltar" variant="ghost" className="mt-2" onPress={onFechar} />
          </View>
        </View>
      </ThemeVars>
    </Modal>
  );
}
