# QBank user guide

QBank turns your own books and question PDFs into a private question bank, on your own computer.
There is no account, server or subscription of ours. AI is optional: if you want it, it is your own
subscription.

## 1. Install and run

```bash
bash scripts/install.sh     # once: tools, packages, the build and a `qbank` command
qbank                       # starts QBank and opens it in your browser
```

- **macOS and Linux:** the command above. On macOS it installs Node itself with Homebrew.
- **Windows:** run `wsl --install` once in PowerShell, then `wsl bash scripts/install.sh` and
  `wsl qbank`.
- `bash scripts/install.sh --check` lists what is missing and changes nothing.
- **Your data** stays in `.data/app/` inside the QBank folder. Nothing leaves your computer except
  what an AI task sends to your provider.

## 2. On your phone

1. Start QBank with `qbank --lan`, with the phone on the same Wi-Fi.
2. Open **Settings → Your other devices** and scan the QR code with the phone's camera.
3. In the phone's browser, choose **"Add to Home Screen"** to open QBank like an app.

**Lost a phone?** Press **"Sign out every other device"** in Settings. Every other device is signed
out, the old link stops working, and a new link is made.

## 3. Make a bank and import a book

1. In the **Library**, type a bank name and press **Create bank**, then **Open bank → Import
   files**.
2. Choose one or more PDFs, and confirm you have the right to use them.
3. **Leave out pages that identify a patient.**
4. Optional: choose your AI and its model. Tick **"Let my AI read whole pages"** for scans and
   complex layouts. It then takes the questions and options, the printed key and explanation, and
   the pictures.
5. Press **Upload and start**. The import report says honestly what was read, what waits for your
   review, and what could not be read.

**Without AI**, QBank reads text pages and scans (OCR in Arabic and English), and finds printed
answers, pen marks, figures and tables. Anything it cannot decide waits for your review; nothing is
ever guessed.

## 4. Review

**Review questions** lists questions by severity: no answer, garbled text, an unsure picture, and so
on.

In the editor:

- **Question and options:** edit the question text, the options and the right answer.
- **Explanation:** "Explanation (as in the book)" is what the book printed.
- **"Newer information":** shown apart from the book's answer, and never changes it.
- **Place and difficulty:** choose the chapter, topic and tags, and a difficulty from 1 to 5. If
  you leave the difficulty unset, your results estimate it after 5 attempts.
- **Fix suggestion:** your AI suggests a fix, shown as a diff that you accept or reject.

Press **Approve** to make the question ready to study.

**Duplicate questions** are shown side by side, and you decide: keep both, or exclude one.

## 5. Study

- **Tutor:** answer and see at once whether you were right (with a symbol and words, not colour
  alone), the right answer and the book's explanation. You can also ask your AI for a separate
  explanation.
- **Exam:** nothing is shown before you submit. The timing is stated before you start, and the
  server ends the time. You get a question map, and can flag questions to come back to.
- **Smart Mix and today's plan:** a mix of new, weak and due questions, with the reason for each
  one.
- **Report a problem** while studying: the report waits in review and changes nothing.
- **Preferences:** in **Settings → study preferences**, choose the default number of questions and
  when the source's explanation shows.

## 6. Your progress

- **Analytics:** score and accuracy, each figure shown with what it is out of. Also your trend,
  session history and a suggested next session.
- **Search:** in question text, options and notes.
- **Results report:** an HTML file you download for yourself.

## 7. Look and feel

**Settings → Look and experience** has four experiences:

- **Clinic Pro:** the default.
- **Calm Minimal.**
- **Native Mobile.**
- **Study Warm.**

The look changes at once and is saved for you. Every experience works in light and dark, and in
Arabic and English.

## 8. AI (optional)

**Settings → AI providers:**

- **Codex:** "Sign in with ChatGPT" with a one-time code, or with an OpenAI API key.
- **Claude:** "Sign in with Claude": approve on the page, then paste the code back.
- Sign-in works from any device, stays signed in and renews on its own.
- Each task lets you choose the provider and model, and QBank remembers your choice for each task.

## 9. Backups and restore

- **Daily automatic backups** of everything: QBank keeps the 7 newest, plus one from each of the 4
  weeks before them.
- **"Back up now"** whenever you want.
- **"Restore…"** shows what comes back against what is here now, and backs up today's state first.
- **A copy off this computer:** type the path of a folder your cloud app syncs (Google Drive,
  iCloud, OneDrive), and every backup is copied there.
- **Export a bank** to a ZIP file, and restore it as a new bank. The file holds no keys or sign-ins.
- **Deleting a bank, or all your data,** shows what goes before anything happens.

## 10. When something goes wrong

- **"System health"** in Settings shows the AI service, disk space, the last backup and the last
  failed import. The home page shows a notice only when something needs your attention.
- **The log** is at `.data/app/logs/qbank.log`. It holds no questions or notes.
- **"Report a problem"** in Help builds a report with no content in it, which you read and then
  copy.
