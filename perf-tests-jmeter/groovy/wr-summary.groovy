// wr-summary.groovy — tearDown Thread Group JSR223 Sampler
// อ่านค่า counter จาก props แล้วเขียนสรุปผล

def active   = (props.get("active_first_hit")  ?: "0") as int
def queued   = (props.get("queue_first_hit")   ?: "0") as int
def cfNative = (props.get("cf_native_wr_hits") ?: "0") as int
def q2a      = (props.get("queue_to_active")   ?: "0") as int
def qTimeout = (props.get("queue_timeout")     ?: "0") as int
def total    = active + queued

def ts = new Date().format("yyyyMMdd-HHmmss")

def banner = """
╔════════════════════════════════════════════════════════════════════╗
║  JMeter Waiting Room First-Hit Summary                           ║
╚════════════════════════════════════════════════════════════════════╝

  Active users (first-hit)  : ${active}
  Queued users (first-hit)  : ${queued}
  CF Native WR hits         : ${cfNative}
  Queue -> Active later     : ${q2a}
  Queue timed out           : ${qTimeout}
  ─────────────────────────────
  Total VUs                 : ${total}

  Generated: ${new Date().format("yyyy-MM-dd HH:mm:ss")}
"""

log.info(banner)

// เขียนไฟล์สรุป
def resultsDir = new File(vars.get("results_dir") ?: "results")
if (!resultsDir.exists()) resultsDir.mkdirs()

def outFile = new File(resultsDir, "wr-summary-${ts}.txt")
outFile.text = banner.trim()

log.info("WR summary written to: ${outFile.absolutePath}")
