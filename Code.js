// function test() { 
//   // log(Gmail.Users.Settings.Filters.list('me'));
//   let { messages } = Gmail.Users.Messages.list('me', {q: "is:sent"});
//   for (let {id} of messages) {
//     let message = Gmail.Users.Messages.get('me', id);
//     log(message.labelIds)
//     log(message.snippet)
//   }
// }

// function test() {
//   log(GmailApp.search("label:🏷-spam?"));
// }

/**
 * Screen emails from unknown senders out of the Primary Inbox and into a label named "Screener".
 * Inspired by Hey Email's Screener feature.
 */
function screenEmails() {
  let screenerLabel = GmailApp.getUserLabelByName("! Screener");
  let threads = GmailApp.search(`category:primary after:${now() - 600}`, 0, 50);

  for (let thread of threads) {
    let sender = extractEmail(thread.getMessages()[0].getFrom())
    let senderEmailCount = GmailApp.search(`-subject:"Re: " -label:🏷-spam? from:"${sender}""`, 0, 2).length;
    let labels = thread
      .getLabels()
      .filter(label => !label.getName().match(/^\uD83D[\uDCE5\uDCE4]\//))
      ;
    log([
      senderEmailCount, labels.length, thread.getLastMessageDate(),
      sender, thread.getFirstMessageSubject(),
    ]);      

    let lastMessage = thread.getMessages()[thread.getMessageCount() - 1];
    let lastMessageLabelIds = getMessageLabelIds(lastMessage.getId());
    if (new Set(lastMessageLabelIds).has("SENT")) {
      Logger.log("Last message was from me -- archiving!");
      lastMessage.markRead();
      // lastMessage.forward("szhu@hey.com");
      thread.moveToArchive();
      continue;
    }
    
    if (labels.length > 0 || senderEmailCount > 1) {
      continue;
    }
    
    Logger.log("No emails from this sender before -- moving to screener!");
    thread.addLabel(screenerLabel);
    thread.moveToArchive();
  }
}

/**
 * @param {string[]} args
 */
const log = (obj) => Logger.log(JSON.stringify(obj))


/**
 * @param {string} email
 */
function extractEmail(email) {
  return email.match(/[^\s<>]+@[^\s<>]+/i)[0]
}

/**
 * @param {string} messageId
 */
function getMessageLabelIds(messageId) {
  return Gmail.Users.Messages.get('me', messageId).labelIds;
}

function now() {
  return Math.floor(new Date().getTime() / 1000)
}
