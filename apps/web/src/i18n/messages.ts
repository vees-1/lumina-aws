type MessageValue = string | MessageTree;
export interface MessageTree {
  [key: string]: MessageValue;
}

function isMessageTree(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeMessages(fallback: MessageTree, translated: MessageTree): MessageTree {
  const merged: MessageTree = { ...fallback };
  for (const [key, value] of Object.entries(translated)) {
    merged[key] = isMessageTree(fallback[key]) && isMessageTree(value)
      ? mergeMessages(fallback[key], value)
      : value;
  }
  return merged;
}

function resolveBrandName(messages: MessageTree): MessageTree {
  const resolved: MessageTree = {};
  for (const [key, value] of Object.entries(messages)) {
    resolved[key] = isMessageTree(value)
      ? resolveBrandName(value)
      : value.replaceAll("{brandName}", "Lumina");
  }
  return resolved;
}

function addRequiredCommonLabels(messages: MessageTree): MessageTree {
  const common = (messages.common ?? {}) as MessageTree;
  return {
    ...messages,
    common: {
      ...common,
      modalityNotes: common.modalityNotes ?? "Clinical notes",
      modalityPhoto: common.modalityPhoto ?? "Patient photo",
      modalityLab: common.modalityLab ?? "Laboratory report",
      modalityVcf: common.modalityVcf ?? "Genetic evidence",
    },
  };
}

/**
 * English is the complete source catalogue. Locale catalogues intentionally
 * override it selectively, so an untranslated key remains readable instead of
 * failing static generation or rendering a message identifier to clinicians.
 */
export async function loadMessages(locale: string): Promise<MessageTree> {
  const english = (await import("@/messages/en.json")).default as MessageTree;
  if (locale === "en") return addRequiredCommonLabels(resolveBrandName(english));

  const translated = (await import(`@/messages/${locale}.json`)).default as MessageTree;
  return addRequiredCommonLabels(resolveBrandName(mergeMessages(english, translated)));
}
