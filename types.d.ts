type GmailLabel = GoogleAppsScript.Gmail.GmailLabel;
type GmailMessage = GoogleAppsScript.Gmail.GmailMessage;
type GmailThread = GoogleAppsScript.Gmail.GmailThread;

interface Actions {
  read: "Immediately" | false = false;
  archive: "Immediately" | "WhenRead" | false = false;
}

interface ThreadScreenState {
  thread: GmailThread;

  // Actions
  mutexLabels?: GmailLabel[] = undefined;
  labelsToApply?: {
    mutex: GmailLabel[];
    other: GmailLabel[];
  };
  unmergedActions?: Actions[] = undefined;
  actionsToApply?: Actions;

  // Thread info
  threadFirstMessage?: GmailMessage;
  threadFirstMessageIsSent?: boolean = undefined;
  threadContactAddress?: string = undefined;
  threadLabels?: GmailLabel[] = undefined;
  threadIsRead?: boolean = undefined;
  threadIsStarred?: boolean = undefined;

  // Reference threads info
  referenceThreads?: GmailThread[] = undefined;
  referenceThread?: GmailThread = undefined;
  referenceLabels?: GmailLabel[] = undefined;

  // Contact threads info
  toContactThreads?: GmailThread[] = undefined;
}

type S<T extends keyof ThreadScreenState = never> =
  //
  ThreadScreenState & Record<T, NonNullable<ThreadScreenState[T]>>;
