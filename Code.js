// function test() {
//   for (let thread of GmailApp.search("in:sent")) {
//     let firstMessage = thread.getMessages()[0];
//     let sender = isMessageFromMe(firstMessage)
//       ? extractEmail(firstMessage.getTo())
//       : extractEmail(firstMessage.getFrom());
//     if (isMessageFromMe(firstMessage)) {
//       log(firstMessage.getTo(), firstMessage.getSubject());
//       log(isMessageFromMe(firstMessage), sender);
//     }
//   }
// }

const DRY_RUN = false;

const pastDays = 365;
const limit = 20;

const screenerLabelName = "! Screener";

/**
 * Screen emails from unknown senders out of the Primary Inbox and into a label named "Screener".
 * Inspired by Hey Email's Screener feature.
 */
function screenEmails() {
  let screenerLabel = GmailApp.getUserLabelByName(screenerLabelName);
  let autoLabel = GmailApp.getUserLabelByName("! Screener Autolabeled");
  let archiveLabel = GmailApp.getUserLabelByName("! Screener Autoarchived");

  let pastSecs =
    // Every hour, do a deep search.
    new Date().getMinutes() === 0 ?
    pastDays * 24 * 60 * 60 :
    // Every 5 minutes, search the past week.
    new Date().getMinutes() % 5 === 0 ?
    7 * 24 * 60 * 60 :
    // All other minutes, only search the past 3 minutes.
    3 * 60;
  
  // Iterate through threads in the main inbox view from the past 10 minutes.
  let threads = GmailApp.search(`category:primary after:${now() - pastSecs}`, 0, limit);
  for (let thread of threads) {
    let firstMessage = thread.getMessages()[0];
    // `sender` actually refers to the email address of the other person
    // (the person who is not the current user). For users who mostly receive emails, this
    // would in most cases be the sender.
    let sender = isMessageFromMe(firstMessage)
      ? extractEmail(firstMessage.getTo().split(",")[0])
      : extractEmail(firstMessage.getFrom());
      
    let labels = categorizeLabels(thread.getLabels());

    log("----------")
    log(thread.getLastMessageDate(), sender, thread.getFirstMessageSubject());
    log("labels", labels);
    
    // If the email already has manual labels, no need to examine the past.
    if (labels.manual.length > 0) {
      if (!thread.isUnread()) {
        log("Email is read and has existing labels (including possibly Screener). => Archiving email.")
        // If it is read, it can be safely archived, since it's filed away properly.
        if (thread.hasStarredMessages()) {
          log("Actually, thread is starred! => Doing nothing.")  
        } else {
          if (!DRY_RUN) thread.addLabel(archiveLabel);
          if (!DRY_RUN) thread.moveToArchive();
        }
      }
      else {
        log("Email is unread and has labels. => Doing nothing.")
        // Otherwise, leave it alone. It's ready to be read.
      }
      continue;
    }

    // If the email is unlabeled...

    // Look at the last time we got an email from the same sender.
    let lastEmailFromSenderQuery = `-subject:"Re: " -label:"! Screener" from:"${sender}"`;
    log("lastEmailFromSenderQuery", lastEmailFromSenderQuery);
    let lastEmailFromSender = GmailApp
      .search(lastEmailFromSenderQuery, 0, 2)
      .filter(lastThread => lastThread.getId() !== thread.getId())[0];
    let lastLabels = lastEmailFromSender
      ? categorizeLabels(lastEmailFromSender.getLabels())
      : undefined;
    log("lastLabels", lastLabels);

    // If the last email from the sender has label(s), apply the same label(s).
    if (lastLabels && lastLabels.manual.length > 0) {
      for (let pastLabel of lastLabels.manual) {
        log(["Adding label", pastLabel.getName()]);
        if (!DRY_RUN) thread.addLabel(pastLabel);
      }

      log("We just added some labels. => Making sure it's unread.")
      if (!DRY_RUN) thread.addLabel(autoLabel);
      if (!DRY_RUN) thread.markUnread();
      continue;
    }

    if (!lastEmailFromSender || lastLabels?.hasScreener) {
      log("This sender doesn't have previous emails, or the previous email is in the screener. => Moving to screener!");
      if (labels.unknown.length > 0) {
        log("Actually, thread has unknown label(s)! => Doing nothing.")  
      } else if (thread.hasStarredMessages()) {
        log("Actually, thread is starred! => Doing nothing.")  
      } else {
        if (!DRY_RUN) thread.addLabel(screenerLabel);
        if (thread.isUnread()) {
          log("Not archiving because it's already read. (User probably removed it from the screener.)")  
          if (!DRY_RUN) thread.moveToArchive();
        }
      }
    }
    else {
      log("This sender has previous emails that don't have a label. => Doing nothing.")
    }
  }
}

/**
 * @param {GmailLabel[]} labels
 */
function categorizeLabels(labels) {
  /** @type {GmailLabel[]} */
  let screener = [];
  /** @type {GmailLabel[]} */
  let manual = [];
  /** @type {GmailLabel[]} */
  let auto = [];
  /** @type {GmailLabel[]} */
  let unknown = [];

  for (let label of labels) {
    let labelName = label.getName();
    if (labelName === screenerLabelName) {
      screener.push(label);
    } else if (labelName.match(/^\uD83C\uDFF7/)) {
      manual.push(label);
    } else if (labelName.match(/^!|\uD83D\uDDD3|\uD83D[\uDCE5\uDCE4]\//)) {
      auto.push(label);
    } else {
      unknown.push(label);
    }
  }

  if (screener.length > 1) {
    log("warning -- screener.length > 1!! this shouldn't happen")
  }

  return {
    onlyScreener: screener.length > 0 && manual.length === 0,
    hasScreener: screener.length > 0,
    manual,
    auto,
    unknown,
  }
}

/**
 * @param {string[]} args
 */
const log = (...objs) => Logger.log(objs.map(JSON.stringify).join(" "))


/**
 * @param {string} email
 */
function extractEmail(email) {
  let match = email.match(/[^\s<>]+@[^\s<>]+/i);
  if (match) {
    return match[0];
  } else {
    return email.split(",")[0];
  }
}

/**
 * @param {string} messageId
 */
function getMessageLabelIds(messageId) {
  return Gmail.Users.Messages.get('me', messageId).labelIds;
}

/**
 * @param {GmailMessage} thread
 */
function isMessageFromMe(message)  {
    let messageLabelIds = getMessageLabelIds(message.getId());
    return new Set(messageLabelIds).has("SENT");
}

function now() {
  return Math.floor(new Date().getTime() / 1000)
}
