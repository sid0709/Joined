"use client";

import * as DesignSystem from "@joined/design-system";
import { Children, isValidElement } from "react";

import type { ChangeEvent, ReactNode } from "react";

export {
  EmptyState,
  FormLayout,
  PageBody,
  Skeleton,
  Text,
  Heading,
  ThemeToggle,
  JoinedLogo,
  BrandLockup,
  BrandFooter,
} from "@joined/design-system";
export type { NavItem } from "@joined/design-system";

const DesignButton = DesignSystem.Button;
const DesignCard = DesignSystem.Card;
const DesignStack = DesignSystem.Stack;
const DesignTextInput = DesignSystem.TextInput;
const DesignTextArea = DesignSystem.TextArea;
const DesignCheckboxInput = DesignSystem.CheckboxInput;
const DesignSelector = DesignSystem.Selector;
const DesignBadge = DesignSystem.Badge;
const DesignBanner = DesignSystem.Banner;
const DesignDialog = DesignSystem.Dialog;
const DesignDialogHeader = DesignSystem.DialogHeader;
const DesignAppShell = DesignSystem.AppShell;
const DesignNav = DesignSystem.Nav;
const DesignThemeToggle = DesignSystem.ThemeToggle;
const DesignChatMessageList = DesignSystem.ChatMessageList;
const DesignChatMessage = DesignSystem.ChatMessage;
const DesignChatMessageBubble = DesignSystem.ChatMessageBubble;
const DesignChatMessageMetadata = DesignSystem.ChatMessageMetadata;
const DesignChatComposer = DesignSystem.ChatComposer;

type DesignButtonProps = DesignSystem.ButtonProps;

export type ButtonProps = Omit<DesignButtonProps, "label" | "children" | "isDisabled"> & {
  label?: string;
  children?: ReactNode;
  disabled?: boolean;
};

export function Button({ label, children, disabled, ...props }: ButtonProps) {
  const accessibleLabel = label ?? (typeof children === "string" ? children : "Action");
  return (
    <DesignButton {...props} label={accessibleLabel} isDisabled={disabled}>
      {children}
    </DesignButton>
  );
}

export function ButtonLink(props: ButtonProps & { href: string }) {
  return <Button {...props} />;
}

type DesignStackProps = DesignSystem.StackProps;

export type StackProps = Omit<DesignStackProps, "gap"> & { gap?: number };

function spacingStepFromPixels(value: number | undefined): DesignStackProps["gap"] {
  if (value === undefined) return undefined;
  const exact: Record<number, number> = {
    0: 0,
    2: 0.5,
    4: 1,
    6: 1.5,
    8: 2,
    12: 3,
    16: 4,
    20: 5,
    24: 6,
    32: 8,
    40: 10,
  };
  return (exact[value] ?? Math.min(10, Math.max(0, value / 4))) as DesignStackProps["gap"];
}

export function Stack({ gap, ...props }: StackProps) {
  return <DesignStack {...props} gap={spacingStepFromPixels(gap)} />;
}

export type GridProps = Omit<DesignSystem.GridProps, "gap"> & { gap?: number };

export function Grid({ gap, ...props }: GridProps) {
  return <DesignSystem.Grid {...props} gap={spacingStepFromPixels(gap)} />;
}

export type AvatarProps = Omit<DesignSystem.AvatarProps, "name"> & {
  name?: string;
  initials?: string;
};

export function Avatar({ name, initials, ...props }: AvatarProps) {
  return <DesignSystem.Avatar {...props} name={name ?? initials} />;
}

export interface CardProps extends Omit<
  DesignSystem.CardProps,
  "children" | "elevation" | "variant"
> {
  children?: ReactNode;
  title?: string;
  meta?: string;
  footer?: ReactNode;
  raised?: boolean;
  selected?: boolean;
  interactive?: boolean;
  variant?: DesignSystem.CardVariant;
  elevation?: DesignSystem.CardProps["elevation"];
}

export function Card({
  title,
  meta,
  footer,
  raised,
  selected,
  children,
  variant,
  elevation,
  ...props
}: CardProps) {
  return (
    <DesignCard
      {...props}
      variant={selected ? "blue" : variant}
      elevation={raised ? "low" : elevation}
    >
      {(title || meta) && (
        <DesignStack gap={0.5}>
          {title && <DesignSystem.Heading level={4}>{title}</DesignSystem.Heading>}
          {meta && (
            <DesignSystem.Text type="supporting" color="secondary">
              {meta}
            </DesignSystem.Text>
          )}
        </DesignStack>
      )}
      {children}
      {footer && (
        <DesignSystem.Text type="supporting" color="secondary">
          {footer}
        </DesignSystem.Text>
      )}
    </DesignCard>
  );
}

export interface InputProps extends Omit<
  DesignSystem.TextInputProps,
  "onChange" | "isDisabled" | "description"
> {
  disabled?: boolean;
  helper?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function Input({ disabled, helper, onChange, ...props }: InputProps) {
  return (
    <DesignTextInput
      {...props}
      description={helper}
      isDisabled={disabled}
      onChange={(value, event) => onChange?.(event)}
    />
  );
}

export interface TextAreaProps extends Omit<DesignSystem.TextAreaProps, "onChange" | "isDisabled"> {
  disabled?: boolean;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

export function TextArea({ disabled, onChange, ...props }: TextAreaProps) {
  return (
    <DesignTextArea
      {...props}
      isDisabled={disabled}
      onChange={(value, event) => onChange?.(event)}
    />
  );
}

function getTextContent(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child))
        return getTextContent(child.props.children);
      return "";
    })
    .join("");
}

export interface SelectProps {
  label: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function Select({
  label,
  value,
  onChange,
  children,
  disabled,
  className,
  placeholder,
}: SelectProps) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const option = child.props as { value?: string; children?: ReactNode; disabled?: boolean };
      return {
        value: String(option.value ?? ""),
        label: getTextContent(option.children) || option.value || "",
        disabled: option.disabled,
      } satisfies DesignSystem.SelectorOptionData;
    });

  return (
    <DesignSelector
      label={label}
      options={options}
      value={value}
      placeholder={placeholder}
      isDisabled={disabled}
      className={className}
      onChange={(nextValue) =>
        onChange?.({ target: { value: nextValue } } as ChangeEvent<HTMLSelectElement>)
      }
    />
  );
}

export interface CheckboxProps extends Omit<
  DesignSystem.CheckboxInputProps,
  "value" | "onChange" | "isDisabled"
> {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function Checkbox({ checked = false, disabled, onChange, ...props }: CheckboxProps) {
  return (
    <DesignCheckboxInput
      {...props}
      value={checked}
      isDisabled={disabled}
      onChange={(value, event) => onChange?.(event)}
    />
  );
}

export interface BadgeProps extends Omit<DesignSystem.BadgeProps, "variant"> {
  tone?: string;
  variant?: DesignSystem.BadgeVariant;
}

export function Badge({ tone, variant, ...props }: BadgeProps) {
  const mappedVariant = tone === "primary" ? "info" : tone === "danger" ? "error" : tone;
  return (
    <DesignBadge
      {...props}
      variant={(mappedVariant ?? variant ?? "neutral") as DesignSystem.BadgeVariant}
    />
  );
}

export interface BannerProps extends Omit<DesignSystem.BannerProps, "status"> {
  tone?: string;
  status?: DesignSystem.BannerStatus;
}

export function Banner({ tone, status, ...props }: BannerProps) {
  const mappedStatus = tone === "danger" ? "error" : tone;
  return (
    <DesignBanner
      {...props}
      status={(mappedStatus ?? status ?? "info") as DesignSystem.BannerStatus}
      collapsible={false}
    />
  );
}

export interface AppShellProps extends Omit<DesignSystem.AppShellProps, "topNav"> {
  nav?: {
    brand?: string;
    items?: DesignSystem.NavItem[];
    cta?: string;
    onCtaClick?: () => void;
    initials?: string;
    userName?: string;
    userHref?: string;
    showAvatar?: boolean;
    showThemeToggle?: boolean;
  };
}

export function AppShell({ nav, children, ...props }: AppShellProps) {
  return (
    <DesignAppShell
      {...props}
      topNav={
        nav ? (
          <DesignNav
            brand={nav.brand}
            items={nav.items}
            cta={nav.cta}
            onCtaClick={nav.onCtaClick}
            userName={nav.userName ?? nav.initials}
            userHref={nav.userHref}
            showAvatar={nav.showAvatar}
            trailing={nav.showThemeToggle ? <DesignThemeToggle /> : undefined}
          />
        ) : undefined
      }
    >
      {children}
    </DesignAppShell>
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title = "Dialog",
  className,
  children,
  footer,
}: ModalProps) {
  return (
    <DesignDialog
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      className={className}
    >
      <DesignDialogHeader
        title={title}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
      />
      {children}
      {footer}
    </DesignDialog>
  );
}

export function Chat({ children }: { children: ReactNode }) {
  return <DesignChatMessageList align="top">{children}</DesignChatMessageList>;
}

export interface ChatMessageProps {
  author: string;
  initials?: string;
  body: string;
  own?: boolean;
  time?: string;
}

export function ChatMessage({ author, initials, body, own, time }: ChatMessageProps) {
  return (
    <DesignChatMessage
      sender={own ? "user" : "assistant"}
      name={author}
      avatar={<DesignSystem.Avatar name={initials ?? author} size={24} />}
      metadata={<DesignChatMessageMetadata timestamp={time} />}
    >
      <DesignChatMessageBubble>{body}</DesignChatMessageBubble>
    </DesignChatMessage>
  );
}

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
}

export function ChatComposer({ value, onChange, onSend, placeholder }: ChatComposerProps) {
  return (
    <DesignChatComposer
      value={value}
      onChange={onChange}
      onSubmit={() => onSend()}
      placeholder={placeholder}
    />
  );
}
