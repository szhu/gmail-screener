/**
 * If a thread has this label, the thread's other labels should be applied to
 * future messages from this sender's address.
 */
const LabelLearnAddress = Label("📛 Learn");

/**
 * If a thread has this label, we should process it in a rate-limited way.
 */
const LabelTodo = Label("📛 Todo");

/**
 * If a thread has this label, we should process it as soon as possible.
 *
 * @deprecated Not implemented yet.
 */
const LabelTodoManual = Label("📛 Todo (Manual)");

/**
 * The screener will mark processed threads with this label.
 */
const LabelDone = Label("📛 Done");

/**
 * Each thread should have at least one "main label", which is a label
 * containing this emoji. If a thread doesn't have a main label by the time we
 * finish processing it, we'll add the Uncategorized label.
 */
const LabelIconAutoMutex = "🏡";

/**
 * Labels with this emoji are non-main labels, but that still should be
 * auto-applied.
 */
const LabelIconAuto = "🏷";

/**
 * The label that we use to indicate that a thread doesn't have a main label.
 */
const LabelUncategorized = Label("‼️ Uncategorized");

/**
 * The label we use to indicate that a thread is from an unknown sender.
 */
const LabelScreenedOut = Label("‼️ Screened Out");

/**
 * When applying a label with this emoji, mark the message as read.
 *
 * Useful for emails where we don't care about the read status.
 */
const LabelIconAutoRead = "📖";

/**
 * When applying a label with this emoji, remove it from the inbox.
 *
 * Useful for emails that we don't want to see by default.
 */
const LabelIconAutoArchive = "📂";

/**
 * When applying a label with this emoji, keep it in the inbox, but remove it
 * from the Inbox as soon as it is read.
 *
 * Useful for emails where we don't want to separately track "read" and
 * "archived" statuses.
 */
const LabelIconAutoArchiveWhenRead = "📁";

function ScreenEmails() {
  for (let thread of GetTodoThreads()) {
    /** @type {ThreadScreenState} */
    let state = {
      thread,
    };

    getThreadContactAddress(state);
    if (getReferenceThread(state)) {
      getReferenceLabels(state);
    } else {
      getToContactThreads(state);
    }
    updateLabelsAndActionsToApply(state);
    getThreadIsStarred(state);
    getThreadIsRead(state);

    log("---------");
    log(
      "thread",
      thread.getLastMessageDate(),
      state.threadContactAddress,
      thread.getFirstMessageSubject()
    );
    log(
      "referenceThread",
      state.referenceThread?.getLastMessageDate(),
      state.referenceThread?.getFirstMessageSubject()
    );
    log(
      "referenceLabels",
      state.referenceLabels?.map((x) => x.getName())
    );
    log(
      "labelsToApply",
      state.labelsToApply.mutex.map((x) => x.getName()),
      state.labelsToApply.other.map((x) => x.getName())
    );
    log("unmergedActions", state.unmergedActions);
    log("actionsToApply", state.actionsToApply);

    // if (1 === 1) continue;

    applyLabels(state);
    applyActions(state);

    if (state.actionsToApply.archive !== "WhenRead") {
      thread.removeLabel(LabelTodo.object);
    }

    thread.addLabel(LabelDone.object);
  }
}

/**
 * @return {GmailThread[]}
 */
function GetTodoThreads() {
  return LabelTodo.object.getThreads();
}

/**
 * @param {ThreadScreenState} state
 * @return {asserts state is S<"threadContactAddress">}
 */
function getThreadContactAddress(state) {
  // The reason we use the first message instead of the last message is because
  // the last message could just be a forwarded-ish message to keep someone else
  // in the loop. It's not representative of who the overall conversation was
  // with.
  let firstMessage = (state.threadFirstMessage = state.thread.getMessages()[0]);
  state.threadFirstMessageIsSent = GmailHelpers.isMessageFromMe(firstMessage);

  state.threadContactAddress = GmailHelpers.isMessageFromMe(firstMessage)
    ? StringHelpers.extractEmail(firstMessage.getTo().split(",")[0])
    : StringHelpers.extractEmail(firstMessage.getFrom());
}

/**
 * @param {S} state
 * @return {asserts state is S<"threadLabels">}
 */
function getThreadLabels(state) {
  state.threadLabels = state.thread.getLabels();
}

/**
 * @param {S<"threadContactAddress">} state
 * @return {state is S<"referenceThread">}
 */
function getReferenceThread(state) {
  let query = `${LabelLearnAddress.query} to:${state.threadContactAddress} OR from:${state.threadContactAddress}`;
  state.referenceThreads = GmailApp.search(query, 0, 2);
  state.referenceThread = state.referenceThreads[0];
  return state.referenceThread != null;
}

/**
 * @param {S<"referenceThread">} state
 * @return {asserts state is S<"referenceLabels">}
 */
function getReferenceLabels(state) {
  state.referenceLabels = state.referenceThread.getLabels();
}

/**
 * @param {S} state
 * @return {asserts state is S<"toContactThreads">}
 */
function getToContactThreads(state) {
  let query = `to:${state.threadContactAddress}`;
  state.toContactThreads = GmailApp.search(query, 0, 2);
}

/**
 * @param {S<"referenceLabels"> | S<"toContactThreads">} state
 * @return {asserts state is S<"labelsToApply" | "actionsToApply">}
 */
function updateLabelsAndActionsToApply(state) {
  (state.labelsToApply = {
    mutex: [],
    other: [],
  }),
    (state.unmergedActions = []);

  if (state.referenceLabels != null) {
    for (let label of state.referenceLabels) {
      let name = label.getName().replace(/.*\//, "");
      if (name.indexOf(LabelIconAutoMutex) !== -1) {
        state.labelsToApply.mutex.push(label);
        state.unmergedActions.push({
          read: name.indexOf(LabelIconAutoRead) !== -1 ? "Immediately" : false,
          archive:
            name.indexOf(LabelIconAutoArchive) !== -1
              ? "Immediately"
              : name.indexOf(LabelIconAutoArchiveWhenRead) !== -1
              ? "WhenRead"
              : false,
        });
      } else if (name.indexOf(LabelIconAuto) !== -1) {
        state.labelsToApply.other.push(label);
      }
    }
  } else if (state.toContactThreads != null) {
    if (state.toContactThreads.length === 0) {
      state.labelsToApply.mutex.push(LabelScreenedOut.object);
      state.unmergedActions.push({
        read: false,
        archive: "Immediately",
      });
    }
  } else {
    throw new Error("Unreachable code.");
  }

  if (state.labelsToApply.mutex.length === 0) {
    getThreadLabels(state);
    let alreadyHasMutex = false;
    for (let label of state.threadLabels) {
      let name = label.getName().replace(/.*\//, "");
      if (name.indexOf(LabelIconAutoMutex) !== -1) {
        alreadyHasMutex = true;
        break;
      }
    }
    if (!alreadyHasMutex) {
      state.labelsToApply.mutex.push(LabelUncategorized.object);
      state.unmergedActions.push({
        read: false,
        archive: false,
      });
    }
  }

  state.actionsToApply = {
    read: CollectionHelpers.maxInList(
      state.unmergedActions.map((actions) => actions.read),
      ["Immediately", false],
      false
    ),
    archive: CollectionHelpers.maxInList(
      state.unmergedActions.map((actions) => actions.archive),
      ["Immediately", "WhenRead", false],
      false
    ),
  };
}

/**
 * @param {S<"labelsToApply">} state
 * @return {asserts state is S}
 */
function applyLabels(state) {
  let labels = [...state.labelsToApply.mutex, ...state.labelsToApply.other];
  for (let label of labels) {
    state.thread.addLabel(label);
  }
}

/**
 * @param {S} state
 * @return {asserts state is S<"threadIsRead">}
 */
function getThreadIsRead(state) {
  state.threadIsRead = !state.thread.isUnread();
}

/**
 * @param {S} state
 * @return {asserts state is S<"threadIsStarred">}
 */
function getThreadIsStarred(state) {
  state.threadIsStarred = state.thread.hasStarredMessages();
}

/**
 * @param {S<"threadIsStarred" | "threadIsRead" | "labelsToApply" | "actionsToApply">} state
 * @return {asserts state is S<never>}
 */
function applyActions(state) {
  if (!state.threadIsStarred) {
    if (state.actionsToApply.read === "Immediately") {
      state.thread.markRead();
    }
    if (
      state.actionsToApply.archive === "Immediately" ||
      (state.actionsToApply.archive === "WhenRead" && state.threadIsRead)
    ) {
      state.thread.moveToArchive();
    }
  }
}

/*
 * Utils
 */

const log = (/** @type {any[]} */ ...objs) => {
  return Logger.log(objs.map((x) => JSON.stringify(x)).join(" "));
};

const StringHelpers = {
  /**
   * @param {string} email
   */
  extractEmail(email) {
    let match = email.match(/[^\s<>]+@[^\s<>]+/i);
    if (match) {
      return match[0];
    } else {
      return email.split(",")[0];
    }
  },
};

const CollectionHelpers = {
  /**
   * Example:
   *
   *     let values = ["med", "low"];
   *     let possibleValuesInOrder = ["none", "low", "med", "hi"];
   *     maxInList(values, possibleValuesInOrder) => "med"
   *
   * @template T
   * @param {T[]} values
   * @param {T[]} possibleValuesInOrder
   * @param {T} defaultValue
   */
  maxInList(
    values,
    possibleValuesInOrder,
    defaultValue = possibleValuesInOrder[0]
  ) {
    let max = defaultValue;
    let maxIndex = -1;

    for (let value of values) {
      let index = possibleValuesInOrder.indexOf(value);
      if (index !== -1 && index > maxIndex) {
        max = value;
        maxIndex = index;
      }
    }
    return max;
  },
};

function Label(/** @type {string} */ name) {
  const object = GmailApp.getUserLabelByName(name);
  const query = `label:${name.replace(/ +/g, "-")}`;

  if (object == null) {
    console.log("Can't find label", name);
  }

  return { name, object, query };
}

const GmailHelpers = {
  /**
   * @param {string} messageId
   */
  getMessageLabelIds(messageId) {
    return Gmail.Users?.Messages?.get("me", messageId).labelIds;
  },

  /**
   * @param {GmailMessage} message
   */
  isMessageFromMe(message) {
    let messageLabelIds = this.getMessageLabelIds(message.getId());
    return new Set(messageLabelIds).has("SENT");
  },
};
