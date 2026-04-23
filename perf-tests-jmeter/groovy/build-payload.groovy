// build-payload.groovy — JSR223 PreProcessor
// กำหนด extra_fields และ file upload (ถ้ามี) ตาม form_type
// ใช้ร่วมกันระหว่าง ACTIVE path และ QUEUE path ในแผน waiting-room

def ft = vars.get("form_type")
def id = vars.get("unique_id")
def tn = ctx.getThreadNum()

vars.put("has_file", "false")
vars.put("file_field", "")
vars.put("file_path", "")
vars.put("file_mime", "")

switch (ft) {
    case "contact":
        vars.put("extra_fields", "subject=Load test subject ${id}&message=Load test message ${id}")
        break
    case "job-application":
        vars.put("extra_fields", "position=Load Test Engineer&experience=3")
        vars.put("has_file", "true")
        vars.put("file_field", "resume")
        vars.put("file_path", "data/files/mock.pdf")
        vars.put("file_mime", "application/pdf")
        break
    case "complaint":
        vars.put("extra_fields", "category=สินค้าชำรุด&description=Load test complaint ${id}")
        vars.put("has_file", "true")
        vars.put("file_field", "photos")
        vars.put("file_path", "data/files/mock.png")
        vars.put("file_mime", "image/png")
        break
    case "event-registration":
        vars.put("extra_fields", "eventId=EVT-2026-001&dietaryRequirement=ไม่มี&tshirtSize=M")
        break
    case "product-inquiry":
        vars.put("extra_fields", "productCode=PRD-${tn}&quantity=10&message=Load test ${id}")
        break
    case "warranty-claim":
        vars.put("extra_fields", "serialNumber=SN-2024-${id}&issue=Load test warranty ${id}")
        vars.put("has_file", "true")
        vars.put("file_field", "receipt")
        vars.put("file_path", "data/files/mock.pdf")
        vars.put("file_mime", "application/pdf")
        break
    case "newsletter":
        vars.put("extra_fields", "interests=เทคโนโลยี&frequency=ทุกสัปดาห์")
        break
    case "feedback":
        vars.put("extra_fields", "rating=4&category=บริการ&comment=Load test ${id}")
        break
    case "partnership":
        vars.put("extra_fields", "companyName=LoadTest Corp ${id}&businessType=เทคโนโลยี")
        vars.put("has_file", "true")
        vars.put("file_field", "companyProfile")
        vars.put("file_path", "data/files/mock.pdf")
        vars.put("file_mime", "application/pdf")
        break
    case "incident-report":
        vars.put("extra_fields", "location=Location ${tn}&incidentType=ความปลอดภัย&description=Load test incident ${id}")
        vars.put("has_file", "true")
        vars.put("file_field", "evidence")
        vars.put("file_path", "data/files/mock.png")
        vars.put("file_mime", "image/png")
        break
    default:
        vars.put("extra_fields", "")
}

// Submit think time (match k6 submitAndCheck):
//   hasFile  → thinkTime(3, 7)s
//   !hasFile → thinkTime(2, 5)s
// base = min*1000, range = (max-min)*1000
if (vars.get("has_file") == "true") {
    vars.put("submit_think_min_ms",   "3000")
    vars.put("submit_think_range_ms", "4000")
} else {
    vars.put("submit_think_min_ms",   "2000")
    vars.put("submit_think_range_ms", "3000")
}

