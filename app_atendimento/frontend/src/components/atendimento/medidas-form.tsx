"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEDIDAS_CAMPOS } from "@/lib/medidas";

export type Medidas = Record<string, number | undefined>;

interface Props {
  medidas: Medidas;
  onChange: (medidas: Medidas) => void;
  /** Quando informado, mostra só estas medidas (as que a forma da peça pede). */
  camposVisiveis?: string[];
  disabled?: boolean;
}

/**
 * Grade das medidas em cm. Campo vazio = medida não tirada (vira null no
 * backend), diferente de zero.
 */
export function MedidasForm({ medidas, onChange, camposVisiveis, disabled }: Props) {
  const campos =
    camposVisiveis && camposVisiveis.length > 0
      ? MEDIDAS_CAMPOS.filter((c) => camposVisiveis.includes(c.key))
      : MEDIDAS_CAMPOS;

  const alterar = (key: string, valor: string) => {
    const limpo = valor.replace(",", ".").trim();
    const numero = limpo === "" ? undefined : Number(limpo);
    onChange({ ...medidas, [key]: Number.isNaN(numero as number) ? undefined : numero });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {campos.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key} className="text-xs text-muted-foreground">
            {label}
          </Label>
          <Input
            id={key}
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            placeholder="cm"
            value={medidas[key] ?? ""}
            onChange={(e) => alterar(key, e.target.value)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
