// attach-fields.groovy — JSR223 PreProcessor
// ผนวก extra_fields (คู่ key=value คั่นด้วย &) และ file upload (ถ้ามี)
// ลงใน HTTPSamplerProxy ปัจจุบัน

import org.apache.jmeter.protocol.http.util.HTTPFileArg

def extra = vars.get("extra_fields") ?: ""
extra.split("&").findAll { it.contains("=") }.each { pair ->
    def parts = pair.split("=", 2)
    sampler.addArgument(parts[0], parts.size() > 1 ? parts[1] : "")
}

if (vars.get("has_file") == "true") {
    sampler.setHTTPFiles([new HTTPFileArg(vars.get("file_path"), vars.get("file_field"), vars.get("file_mime"))] as HTTPFileArg[])
} else {
    sampler.setHTTPFiles([] as HTTPFileArg[])
}
