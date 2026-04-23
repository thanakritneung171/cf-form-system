// submit-assert.groovy — JSR223 Assertion for POST /submit/{type}
// Match k6 submitAndCheck:
//   pass  → status 200 && json.ok == true && json.submission_id non-empty
//   fail  → if body looks like HTML (trimStart "<") or is a WR page → count
//           submit_waiting_room_hits; else just log status

import groovy.json.JsonSlurper

def body   = prev.getResponseDataAsString() ?: ""
def status = prev.getResponseCode()
def ft     = vars.get("form_type") ?: "?"

boolean submitted = false
try {
    if (status == "200") {
        def json = new JsonSlurper().parseText(body)
        submitted = (json.ok == true &&
                     json.submission_id instanceof String &&
                     json.submission_id.length() > 0)
    }
} catch (ignored) { /* body is not JSON */ }

if (submitted) return

AssertionResult.setFailure(true)

def trimmed = body.trim()
def isWr = trimmed.startsWith("<") ||
           body.contains("Waiting Room powered by Cloudflare") ||
           body.contains("waitingrooms-text") ||
           body.contains("คุณอยู่ในคิว") ||
           body.contains("ผู้เข้าใช้เต็ม")

if (isWr) {
    synchronized (props) {
        def n = (props.get("submit_waiting_room_hits") ?: "0") as int
        props.put("submit_waiting_room_hits", String.valueOf(n + 1))
    }
    AssertionResult.setFailureMessage("submit blocked by WR")
    log.warn("[Thread ${ctx.getThreadNum()}] submit blocked by WR (${ft})")
} else {
    AssertionResult.setFailureMessage("submit failed status=${status}")
    log.warn("[Thread ${ctx.getThreadNum()}] submit failed status=${status} (${ft})")
}
