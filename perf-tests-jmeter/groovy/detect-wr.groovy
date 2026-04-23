// detect-wr.groovy — JSR223 PostProcessor
// ตรวจว่า response เป็นหน้า CF Waiting Room หรือไม่ (match k6 isWaitingRoomPage)
//
// ใช้เฉพาะ signal ของ CF WR holding page + custom WR strings เท่านั้น
// หลีกเลี่ยง substring กว้างๆ เช่น 'waiting-room' เพราะหน้าปกติมี link/class
// ที่มีคำนี้ (เช่น /admin/waiting-room) ทำให้ active โดนนับเป็น queue

def body = prev.getResponseDataAsString() ?: ""

def isCfNativeWr = body.contains("Waiting Room powered by Cloudflare") ||
                   body.contains("waitingrooms-text")

// "คุณอยู่ในคิว" = "คุณอยู่ในคิว"
// "ผู้เข้าใช้เต็ม" = "ผู้เข้าใช้เต็ม"
def isCustomWr = body.contains("คุณอยู่ในคิว") ||
                 body.contains("ผู้เข้าใช้เต็ม")

def isQueued = isCfNativeWr || isCustomWr

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
        log.info("[Thread ${ctx.getThreadNum()}] FIRST HIT -> QUEUE (cf_native=${isCfNativeWr})")
    } else {
        def aCount = (props.get("active_first_hit") ?: "0") as int
        props.put("active_first_hit", String.valueOf(aCount + 1))
        log.info("[Thread ${ctx.getThreadNum()}] FIRST HIT -> ACTIVE")
    }
}
