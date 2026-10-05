import { useEffect } from "react";
import { Text, VStack, useToast } from "sid-ui";
import { MSG, type AcornNoticePayload } from "../types";
import { bindAcornNoticePush, noticeKindDuration, pushAcornNotice } from "./acorn-notice";

/**
 * Shows Acorn notices as Joined toasts: ones pushed in the sidebar and ones the
 * service worker broadcasts. Renders nothing itself; JoinedProvider owns the viewport.
 */
export function AcornNoticeHost() {
  const toast = useToast();

  useEffect(() => {
    return bindAcornNoticePush(({ kind, title, detail }) => {
      toast({
        type: kind === "error" ? "error" : "info",
        autoHideDuration: noticeKindDuration(kind),
        body: (
          <VStack gap={0.5}>
            <Text weight="semibold" color="inherit">
              {title}
            </Text>
            {detail ? (
              <Text type="supporting" color="inherit">
                {detail}
              </Text>
            ) : null}
          </VStack>
        ),
      });
    });
  }, [toast]);

  useEffect(() => {
    const onMessage = (message: { type?: string; notice?: AcornNoticePayload }) => {
      if (message.type !== MSG.OPERATOR_NOTICE || !message.notice?.title) return;
      const { kind, title, detail } = message.notice;
      if (kind !== "error" && kind !== "success" && kind !== "info") return;
      pushAcornNotice({ kind, title, detail });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  return null;
}
