import type { MessageParams } from "./types";

type MessageNode = string | { [key: string]: MessageNode };

export function translate(
  messages: MessageNode,
  key: string,
  params?: MessageParams
): string {
  const parts = key.split(".");
  let current: MessageNode = messages;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return key;
    }
    current = current[part];
  }

  if (typeof current !== "string") {
    return key;
  }

  return current.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params?.[name];
    return value !== undefined ? String(value) : `{${name}}`;
  });
}
