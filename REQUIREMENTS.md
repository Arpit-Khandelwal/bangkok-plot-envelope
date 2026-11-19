# REQUIREMENTS

Every item quotes the brief (`BRIEF.md`) exactly. Tick an item only when it has been verified in the deployed tool or the final doc, not when the code is written.

## A. Hard constraints

- [ ] **A1. Browser.** "Anything is fair game, as long as the result runs in a browser."
- [ ] **A2. Deadline.** "48 hours, from the moment you started. The clock runs on our server, and it stops accepting submissions at your deadline." Deadline: Sat 21 Nov 2026, 14:31:21 IST.
- [ ] **A3. No questions.** "We won't answer any. Make a call and write it down." Calls are recorded in `DECISIONS.md`.
- [ ] **A4. One doc, public.** "One doc, submitted through this MCP server with the `submit_application` tool... The doc and every link in it must be viewable by anyone with the link. No email."
- [ ] **A5. Authorship.** "The write-up is yours to write. Your agent can submit it, not author it."

## B. The tool: inputs

"**Input:** the plot, its location or zone, the road it faces, and a building type (for example, a condo)."

- [ ] **B1. The plot.** "the plot is drawn on a map."
- [ ] **B2. Location or zone.** "its location or zone"
- [ ] **B3. The road it faces.** "the road it faces"
- [ ] **B4. Building type.** "a building type (for example, a condo)"

## C. The tool: outputs

"**Output:** the rules that apply, such as floor area ratio, open space, setbacks and height. The space the building is allowed to fill. At least two designs that fit, each with a pass/fail checklist."

- [ ] **C1. Rules.** "the rules that apply, such as floor area ratio, open space, setbacks and height."
- [ ] **C2. Envelope.** "The space the building is allowed to fill."
- [ ] **C3. Two or more designs.** "At least two designs that fit"
- [ ] **C4. Checklist per design.** "each with a pass/fail checklist."
- [ ] **C5. In 3D.** "it shows what's allowed and the concept designs that fit, in 3D."

## D. Scope

- [ ] **D1.** "**Scope:** one zone in Bangkok, done properly."

## E. Execution bar ("real execution, not a prototype")

- [ ] **E1. Any plot shape.** "the plot is drawn on a map. Real plots are rarely rectangles."
- [ ] **E2a. Accurate: outline.** "the allowed space follows the plot's real outline"
- [ ] **E2b. Accurate: rules visible.** "each rule visibly changes it"
- [ ] **E2c. Accurate: arithmetic.** "the floor areas add up."
- [ ] **E3. Real site.** "the plot sits in 3D among the actual buildings and roads around it, not on an empty grid."
- [ ] **E4. Live.** "change the plot, the road or the building type, and everything updates at once, with no reload."
- [ ] **E5a. Finished: performance.** "it runs smoothly on a normal laptop"
- [ ] **E5b. Finished: polish.** "looks like something you could put in front of a client."
- [ ] **E6. Robust.** "We will try to break it." (From section 4. Degenerate plots, self-intersecting polygons, tiny or huge plots, plots outside the zone, no road edge chosen.)

## F. How it is judged

| Criterion | Brief wording | Where we show it |
|---|---|---|
| Thinking | "How you think through a domain you've never seen: how deep your research went, and the calls you made where things were unclear." | `RESEARCH.md`, `DECISIONS.md`, one-pager |
| Working with AI | "How you work with AI from the first session." | Transcripts, `LOG.md` |
| Execution | "How well the tool is built: accurate, on the real site, live, and finished. We will try to break it." | The live tool |
| Decisions and writing | "Clear, specific reasons for your choices, in few words." | One-pager, `DECISIONS.md` |

## G. Submission doc: seven parts, in this order

"One doc (Google Doc, Notion or similar), with these seven parts in this order. All seven are required."

- [ ] **G1. Live link.** "The tool, open to anyone with the link."
- [ ] **G2. Repo.** "The code."
- [ ] **G3. One-pager.** "Your write-up, written in the doc." "One page of the doc, with these four headings. We read it as closely as we use the tool."
  - [ ] "**What you understood.**"
  - [ ] "**What you did, and why.**"
  - [ ] "**Technical decisions, and why.** The stack, how you work out the allowed space, where the site data comes from, and how you kept it smooth."
  - [ ] "**What's still wrong, and what you'd do next.**"
- [ ] **G4. Transcripts.** "Links to your AI sessions, from the very first one."
  - [ ] "Two or three raw, unedited transcripts of your first sessions with AI, starting with the one where you connected to our MCP server and started the assignment, through your research and planning. Not a summary, and not your coding sessions. Link each one from the doc."
  - [ ] "A short note above the links: what did the AI miss, and how did you know it was missing? What made you catch it, and how did you research it?"
- [ ] **G5. Your setup.** "Six short answers, written in the doc." "A few lines each. Name real tools and real numbers."
  - [ ] 1. "What tools, models and agents do you use day to day, and for what?"
  - [ ] 2. "How do you run them? Parallel sessions, rules files, skills, MCP servers, automations."
  - [ ] 3. "Roughly how many tokens, or how much money, do you spend a month?"
  - [ ] 4. "What's the most ambitious thing you've built mostly with AI? Add a link. Where did the AI break?"
  - [ ] 5. "How do you get up to speed on a codebase or domain you've never seen?"
  - [ ] 6. "Have you worked with 3D, vision, diffusion, local or open-source models? Say what you did."
- [ ] **G6. Your best project.** "One link to the most complete project you've owned end to end, and a line on which parts were yours."
- [ ] **G7. About you.** "A short intro and your links."
  - [ ] "**Who you are:** a few lines on what you've done so far and what you're doing now."
  - [ ] "**Your links:** résumé, LinkedIn, GitHub, and a portfolio or personal site if you have one."
  - [ ] "**Projects:** links to anything else you've built that you want us to see."
  - [ ] "**Anything else:** whatever you'd like us to know. Optional."

## H. Submitting

"Call `submit_application` on this server with your details, the doc's link, the same live link and repo link that are in the doc, and your résumé link."

- [ ] **H1. Four links open without sign-in.** "The server opens these four links. If one needs a sign-in or doesn't exist, the submission is rejected with the reason" (doc, live, repo, résumé).
- [ ] **H2. Links match.** "the same live link and repo link that are in the doc"
- [ ] **H3. Same email.** "Submit with this same email"
- [ ] **H4. Receipt.** "A successful call returns a receipt ID. Keep it. `check_submission` confirms what we have on record."
- [ ] **H5. Resubmission allowed.** "You can resubmit until your 48 hours are up. We read the latest one." So: submit early, improve, resubmit.

## I. After submission (shapes how we build)

- "A live call where you walk us through it, show your setup, and take a new requirement on the spot."
  Implication: the rules engine must be easy to change live (rules as data, not scattered constants), and Arpit must be able to explain every rule and decision himself.
