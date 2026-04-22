// unique-id.groovy — JSR223 PreProcessor
// สร้าง unique id สำหรับแต่ละ request (ป้องกัน idempotency key ชน)
// ใช้ threadNum + counter + timestamp เหมือน k6 makeId()

def threadNum = ctx.getThreadNum()
def counter   = vars.getIteration()
def ts        = System.currentTimeMillis()

def id = "${threadNum}-${counter}-${ts}"

vars.put("unique_id", id)
vars.put("full_name", "LoadTest User ${id}")
vars.put("email", "jmeter-${id}@perftest.local")
vars.put("phone", "0800000000")
