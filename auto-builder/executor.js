/**
 * executor.js — Safe, non-destructive file operations for RentFlow automation
 * All writes are backed up. All deletes are soft. No exceptions.
 */

const fs = require("fs")
const path = require("path")

const BACKUP_DIR = path.resolve(__dirname, "../../backups")
const ARCHIVE_DIR = path.resolve(__dirname, "../../archive")
const LOG_PATH = path.resolve(__dirname, "../../logs/decisions.md")

// ─── Ensure required directories exist ────────────────────────────────────────

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

ensureDir(BACKUP_DIR)
ensureDir(ARCHIVE_DIR)

// ─── Logging ──────────────────────────────────────────────────────────────────

const logAction = (entry) => {
  const timestamp = new Date().toISOString()
  const formatted = `\n## [${timestamp}] ${entry.title}\n\n**Action:** ${entry.action}\n**File:** ${entry.file || "N/A"}\n**Result:** ${entry.result}\n${entry.note ? `**Note:** ${entry.note}\n` : ""}\n---\n`
  fs.appendFileSync(LOG_PATH, formatted, "utf8")
}

// ─── Backup ───────────────────────────────────────────────────────────────────

/**
 * Creates a timestamped backup of a file before it is modified.
 * @param {string} filePath - Absolute path to the file to back up
 * @returns {string|null} - Path to the backup file, or null if file didn't exist
 */
const backupFile = (filePath) => {
  if (!fs.existsSync(filePath)) return null

  const timestamp = Date.now()
  const relativeName = path.basename(filePath)
  const backupPath = path.join(BACKUP_DIR, `${relativeName}.${timestamp}.bak`)

  fs.copyFileSync(filePath, backupPath)

  logAction({
    title: "File Backed Up",
    action: "BACKUP",
    file: filePath,
    result: `Backup created at ${backupPath}`,
  })

  return backupPath
}

// ─── Safe Write ───────────────────────────────────────────────────────────────

/**
 * Safely writes content to a file using atomic swap + prior backup.
 * Steps: backup → write to .new temp → atomic rename → verify
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 */
const safeWrite = (filePath, content) => {
  ensureDir(path.dirname(filePath))

  const backupPath = backupFile(filePath)
  const tempPath = filePath + ".new"

  try {
    fs.writeFileSync(tempPath, content, "utf8")
    fs.renameSync(tempPath, filePath)

    // Integrity check: re-read and compare
    const written = fs.readFileSync(filePath, "utf8")
    if (written !== content) throw new Error("Content verification failed after write")

    logAction({
      title: "Safe Write Completed",
      action: "WRITE",
      file: filePath,
      result: "File written and verified successfully",
      note: backupPath ? `Backup at: ${backupPath}` : "New file — no backup needed",
    })
  } catch (err) {
    // Restore from backup if write failed
    if (backupPath && fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath)
      logAction({
        title: "Write Failed — Restored from Backup",
        action: "RESTORE",
        file: filePath,
        result: `Write error: ${err.message}. Restored from backup.`,
      })
    }
    throw err
  } finally {
    // Clean up temp file if it still exists
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
}

// ─── Archive (instead of delete) ──────────────────────────────────────────────

/**
 * Moves a file to the /archive directory instead of deleting it.
 * @param {string} filePath - File to archive
 */
const archiveFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    logAction({
      title: "Archive Skipped — File Not Found",
      action: "ARCHIVE_SKIP",
      file: filePath,
      result: "File does not exist, nothing to archive",
    })
    return
  }

  const timestamp = Date.now()
  const relative = path.relative(process.cwd(), filePath).replace(/\\/g, "/")
  const archivePath = path.join(ARCHIVE_DIR, `${timestamp}_${relative.replace(/\//g, "__")}`)

  ensureDir(path.dirname(archivePath))
  fs.renameSync(filePath, archivePath)

  logAction({
    title: "File Archived (Not Deleted)",
    action: "ARCHIVE",
    file: filePath,
    result: `Moved to archive: ${archivePath}`,
    note: "Non-destructive policy enforced. File is fully recoverable.",
  })
}

// ─── Deletion Override ────────────────────────────────────────────────────────

/**
 * Intercepts any attempted deletion and redirects to archive.
 * Call this instead of fs.unlinkSync / fs.rmSync / rm -rf.
 * @param {string} filePath
 */
const safeDelete = (filePath) => {
  logAction({
    title: "DELETION BLOCKED — Switching to Archive",
    action: "DELETION_OVERRIDE",
    file: filePath,
    result: "ACTION BLOCKED. Switching to non-destructive alternative.",
    note: "Non-destructive policy enforced. Archiving instead.",
  })
  archiveFile(filePath)
}

// ─── Append (safe, no overwrite) ─────────────────────────────────────────────

/**
 * Appends content to a file without overwriting existing content.
 * @param {string} filePath
 * @param {string} content
 */
const safeAppend = (filePath, content) => {
  ensureDir(path.dirname(filePath))
  fs.appendFileSync(filePath, content, "utf8")
}

// ─── Response dispatcher ──────────────────────────────────────────────────────

/**
 * Dispatches an autonomous decision response to stdout and to the log.
 * @param {string} response - The decision answer
 * @param {string} reason - Why this decision was made
 */
const sendResponse = (response, reason = "") => {
  const output = `[AUTO RESPONSE] ${response}${reason ? ` | Reason: ${reason}` : ""}`
  console.log(output)
  safeAppend(LOG_PATH, `\n> ${output}\n`)
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  backupFile,
  safeWrite,
  safeDelete,
  archiveFile,
  safeAppend,
  sendResponse,
  logAction,
}
