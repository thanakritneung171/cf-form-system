// detect-wr.groovy — JSR223 PostProcessor
// ตรวจว่า response เป็นหน้า CF Waiting Room หรือไม่
// ใช้ markers เดียวกับ k6 isWaitingRoomResponse()
//
// เช็ค 2 อย่าง:
// 1. HTTP status 202 (CF WR config ส่ง 202 Accepted)
// 2. body มี markers ของ CF native WR

def responseCode = prev.getResponseCode()
def body = prev.getResponseDataAsString() ?: ""

def isCfNativeWr = false
def isQueued = false

// Status 202 = CF Waiting Room
if (responseCode == "202") {
    isCfNativeWr = true
    isQueued = true
}

// Body markers
if (!isQueued) {
    if (body.contains("Waiting Room powered by Cloudflare") || body.contains("waitingrooms-text")) {
        isCfNativeWr = true
        isQueued = true
    } else if (body.contains("waiting-room") || body.contains("\u0e1c\u0e39\u0e49\u0e40\u0e02\u0e49\u0e32\u0e43\u0e0a\u0e49\u0e40\u0e15\u0e47\u0e21") || body.contains("\u0e23\u0e30\u0e1a\u0e1a\u0e22\u0e38\u0e48\u0e07")) {
        // "ผู้เข้าใช้เต็ม" or "ระบบยุ่ง" (custom WR)
        isQueued = true
    }
}

vars.put("is_queued", String.valueOf(isQueued))
vars.put("is_cf_native_wr", String.valueOf(isCfNativeWr))

// Atomic increment shared counters ผ่าน props (thread-safe)
synchronized (props) {
    if (isQueued) {
        def qCount = (props.get("queue_first_hit") ?: "0") as int
        props.put("queue_first_hit", String.valueOf(qCount + 1))

        if (isCfNativeWr) {
            def cfCount = (props.get("cf_native_wr_hits") ?: "0") as int
            props.put("cf_native_wr_hits", String.valueOf(cfCount + 1))
        }
        log.info("[Thread ${ctx.getThreadNum()}] FIRST HIT -> QUEUE status=${responseCode} (cf_native=${isCfNativeWr})")
    } else {
        def aCount = (props.get("active_first_hit") ?: "0") as int
        props.put("active_first_hit", String.valueOf(aCount + 1))
        log.info("[Thread ${ctx.getThreadNum()}] FIRST HIT -> ACTIVE status=${responseCode}")
    }
}
