"use client";

import { useState } from "react";

import { NumberField } from "@/src/client/components/ui/Fields";
import { money } from "@/src/client/lib/format";
import { Button, Modal } from "@/src/shared/marketplace-ui";

const PRESETS = [100, 250, 500, 1000];
const DEFAULT_AMOUNT = "250";

interface TopUpDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

export function TopUpDialog({ open, onClose, onConfirm }: TopUpDialogProps) {
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const value = Number(amount);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add funds to your wallet"
      footer={
        <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button
            variant="primary"
            label={value > 0 ? `Add ${money(value)}` : "Add funds"}
            disabled={!(value > 0)}
            onClick={() => {
              onConfirm(value);
              onClose();
            }}
          />
        </div>
      }
    >
      <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
        <div className="hx-chip-row">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="hx-chip"
              onClick={() => setAmount(String(preset))}
              style={
                value === preset
                  ? {
                      background: "var(--color-accent-muted)",
                      color: "var(--color-text-accent)",
                      borderColor: "var(--color-border-blue)",
                    }
                  : undefined
              }
            >
              {money(preset)}
            </button>
          ))}
        </div>
        <NumberField
          label="Amount (USD)"
          value={amount}
          onChange={setAmount}
          helper="Charged to the card on file ending 4417"
        />
      </div>
    </Modal>
  );
}
