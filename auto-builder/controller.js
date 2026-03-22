/**
 * controller.js — Main autonomous execution loop for RentFlow build
 * Reads prompts from Claude Code, resolves decisions, logs everything.
 * Henry does not need to be involved. This runs until all phases are complete.
 */

const { decide } = require("../agents/decisionAgent")
const { safeWrite, sendResponse, logAction, safeAppend } = require("./executor")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

const DECISIONS_LOG = path.resolve(__dirname, "../../logs/decisions.md")
const DAILY_LOG = path.resolve(__dirname, "../../logs/daily_log.md")
const PHASE_STATE = path.resolve(__dirname, "../../logs/phase_state.json")

// ─── Initialize logs ──────────────────────────────────────────────────────────

const initLogs = () => {
  const logsDir = path.dirname(DECISIONS_LOG)
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

  if (!fs.existsSync(DECISIONS_LOG)) {
    safeWrite(DECISIONS_LOG, `# RentFlow — Autonomous Decision Log\n\nStarted: ${new Date().toISOString()}\n\n---\n`)
  }

  if (!fs.existsSync(DAILY_LOG)) {
    safeWrite(DAILY_LOG, `# RentFlow — Daily Execution Log\n\n`)
  }

  if (!fs.existsSync(PHASE_STATE)) {
    safeWrite(PHASE_STATE, JSON.stringify({ currentPhase: 1, completedItems: [], blockers: [] }, null, 2))
  }
}

// ─── Phase state management ───────────────────────────────────────────────────

const getPhaseState = () => {
  return JSON.parse(fs.readFileSync(PHASE_STATE, "utf8"))
}

const updatePhaseState = (updates) => {
  const current = getPhaseState()
  const updated = { ...current, ...updates }
  safeWrite(PHASE_STATE, JSON.stringify(updated, null, 2))
}

const markItemComplete = (itemId) => {
  const state = getPhaseState()
  if (!state.completedItems.includes(itemId)) {
    state.completedItems.push(itemId)
    safeWrite(PHASE_STATE, JSON.stringify(state, null, 2))
  }
}

const logBlocker = (itemId, reason) => {
  const state = getPhaseState()
  state.blockers.push({ itemId, reason, timestamp: new Date().toISOString() })
  safeWrite(PHASE_STATE, JSON.stringify(state, null, 2))

  safeAppend(DAILY_LOG, `\n### BLOCKER: ${itemId}\n- Reason: ${reason}\n- Timestamp: ${new Date().toISOString()}\n`)
}

// ─── Decision resolution with retry ──────────────────────────────────────────

const resolveWithRetry = async (question, context, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const decision = await decide(question, context)
      return decision
    } catch (err) {
      logAction({
        title: `Decision Resolution Attempt ${attempt}/${maxAttempts} Failed`,
        action: "RETRY",
        file: null,
        result: `Error: ${err.message}`,
        note: attempt === maxAttempts ? "All retries exhausted. Using fallback." : "Retrying...",
      })

      if (attempt === maxAttempts) {
        return {
          answer: "Proceed with most conservative/widely-used option available in codebase.",
          reason: "Decision resolution failed after 3 attempts. Using safe fallback.",
        }
      }
    }
  }
}

// ─── Core controller loop ─────────────────────────────────────────────────────

const runController = async () => {
  console.log("╔══════════════════════════════════════════════╗")
  console.log("║  RentFlow Autonomous Execution Controller    ║")
  console.log("║  Operator: Wamala Julius (wamkats@gmail.com) ║")
  console.log("║  Mode: FULLY AUTONOMOUS — No input needed    ║")
  console.log("╚══════════════════════════════════════════════╝\n")

  initLogs()

  // Listen to stdin for Claude Code prompt output
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  rl.on("line", async (rawPrompt) => {
    if (!rawPrompt || !rawPrompt.trim()) return

    const parsed = rawPrompt.trim()

    console.log(`\n[INPUT] ${parsed}`)

    // Detect and block destructive language before routing to agent
    const destructiveKeywords = ["delete", "rm -rf", "drop table", "truncate", "unlink", "purge"]
    const isDestructive = destructiveKeywords.some((kw) => parsed.toLowerCase().includes(kw))

    if (isDestructive) {
      const override = "ACTION BLOCKED — switching to non-destructive alternative."
      sendResponse(override, "Non-destructive policy enforced")
      logAction({
        title: "Destructive Action Intercepted",
        action: "BLOCK",
        file: "stdin input",
        result: override,
        note: `Original prompt: "${parsed.substring(0, 100)}..."`,
      })
      return
    }

    // Resolve decision
    const decision = await resolveWithRetry(parsed, getPhaseState())

    // Dispatch response
    sendResponse(decision.answer, decision.reason)

    // Log decision
    const timestamp = new Date().toISOString()
    safeAppend(
      DECISIONS_LOG,
      `\n## [${timestamp}] Decision\n\n**Question:** ${parsed}\n\n**Answer:** ${decision.answer}\n\n**Reason:** ${decision.reason}\n\n${decision.blocked ? `**⚠️ BLOCKED:** Destructive action prevented.\n\n` : ""}---\n`
    )
  })

  rl.on("close", () => {
    console.log("\n[CONTROLLER] Input stream closed. Session complete.")
    safeAppend(DAILY_LOG, `\n## Session Ended\n- Time: ${new Date().toISOString()}\n- State: ${JSON.stringify(getPhaseState(), null, 2)}\n`)
  })
}

module.exports = { runController, markItemComplete, logBlocker }
