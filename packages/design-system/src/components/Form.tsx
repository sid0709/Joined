"use client";

import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, useId } from "react";
import { Input, InputFieldProps, TextareaFieldProps } from "./Input";

export const Field = Input;
export const TextInput = Input;

export function TextArea(props: Omit<TextareaFieldProps, "multiline">) {
  return <Input multiline {...props} />;
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  label?: ReactNode;
  className?: string;
  inputClassName?: string;
}

export function Checkbox({ label, id, className = "", inputClassName = "", ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label className={["body os-check", className].filter(Boolean).join(" ")} htmlFor={inputId}>
      <span className="os-checkbox">
        <input
          id={inputId}
          type="checkbox"
          className={["os-checkbox-input", inputClassName].filter(Boolean).join(" ")}
          {...props}
        />
        <span className="os-checkbox-box" aria-hidden="true" />
      </span>
      {label}
    </label>
  );
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export function Radio({ label, id, className = "", ...props }: RadioProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label className={["body os-radio", className].filter(Boolean).join(" ")} htmlFor={inputId}>
      <input id={inputId} type="radio" {...props} />
      {label}
    </label>
  );
}

export interface RadioListProps {
  name: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function RadioList({ name, options, value, onChange }: RadioListProps) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name}
          label={o.label}
          value={o.value}
          checked={value === o.value}
          onChange={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export function Switch({ label, id, ...props }: SwitchProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label className="body os-check" htmlFor={inputId}>
      <span className="os-switch">
        <input id={inputId} type="checkbox" role="switch" {...props} />
        <span className="os-switch-track" />
      </span>
      {label}
    </label>
  );
}

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function Slider({ label, id, ...props }: SliderProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="os-field-group">
      {label && <label className="label" htmlFor={inputId}>{label}</label>}
      <input id={inputId} type="range" className="os-slider" {...props} />
    </div>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: boolean;
}

export function Select({ label, helper, error, className = "", id, children, ...props }: SelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="os-field-group">
      {label && <label className="label" htmlFor={inputId}>{label}</label>}
      <select id={inputId} className={["os-field", error && "os-field-error", className].filter(Boolean).join(" ")} {...props}>
        {children}
      </select>
      {helper && <span className={"body-sm " + (error ? "os-field-helper-error" : "os-field-helper")}>{helper}</span>}
    </div>
  );
}

export const Selector = Select;

export function NumberInput(props: Omit<InputFieldProps, "type" | "multiline">) {
  return <Input type="number" {...props} />;
}

export function DateInput(props: Omit<InputFieldProps, "type" | "multiline">) {
  return <Input type="date" {...props} />;
}

export function TimeInput(props: Omit<InputFieldProps, "type" | "multiline">) {
  return <Input type="time" {...props} />;
}

export function DateTimeInput(props: Omit<InputFieldProps, "type" | "multiline">) {
  return <Input type="datetime-local" {...props} />;
}

export interface FileInputProps {
  label?: string;
  accept?: string;
  onChange?: (files: FileList | null) => void;
}

export function FileInput({ label = "Drop a file or click to browse", accept, onChange }: FileInputProps) {
  return (
    <label className="body-sm os-file">
      <input type="file" accept={accept} onChange={(e) => onChange?.(e.target.files)} />
      <span>{label}</span>
    </label>
  );
}

export function InputGroup({ children }: { children: ReactNode }) {
  return <div className="os-input-group">{children}</div>;
}

export function InputGroupText({ children }: { children: ReactNode }) {
  return <span className="body-sm os-input-group-text">{children}</span>;
}

export interface TokenizerProps {
  tokens: string[];
  onRemove: (token: string) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
}

export function Tokenizer({ tokens, onRemove, value, onChange, onSubmit, placeholder = "Add…" }: TokenizerProps) {
  return (
    <div className="os-tokenizer">
      {tokens.map((t) => (
        <span key={t} className="body-sm os-token">
          {t}
          <button type="button" className="os-token-remove" onClick={() => onRemove(t)} aria-label={`Remove ${t}`}>
            ✕
          </button>
        </span>
      ))}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            onSubmit?.(value.trim());
          }
        }}
      />
    </div>
  );
}

export interface TypeaheadProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export function Typeahead({ value, onChange, options, placeholder }: TypeaheadProps) {
  const q = value.toLowerCase();
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q)).slice(0, 6) : [];
  return (
    <div className="os-typeahead">
      <input className="os-field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {matches.length > 0 && (
        <div className="os-typeahead-list" role="listbox">
          {matches.map((m) => (
            <button key={m} type="button" className="body-sm os-command-item" onClick={() => onChange(m)}>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
