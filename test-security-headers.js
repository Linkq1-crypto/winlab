// test-security-headers.js – Verify security headers are properly configured
import http from "http";

const BASE_URL = "http://localhost:3001";

console.log("🔍 Testing WINLAB Security Headers...\n");

function testHeaders() {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}/api/security/headers`, (res) => {
      let data = "";
      
      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        console.log("📋 Response Headers Found:\n");
        
        // Security headers to check
        const securityHeaders = {
          "content-security-policy": "Content-Security-Policy",
          "strict-transport-security": "Strict-Transport-Security",
          "cross-origin-opener-policy": "Cross-Origin-Opener-Policy",
          "cross-origin-resource-policy": "Cross-Origin-Resource-Policy",
          "x-content-type-options": "X-Content-Type-Options",
          "x-frame-options": "X-Frame-Options",
          "referrer-policy": "Referrer-Policy",
          "permissions-policy": "Permissions-Policy",
        };
        
        console.log("Header Tests:");
        console.log("=".repeat(60));
        
        let passed = 0;
        let failed = 0;
        
        for (const [headerKey, headerName] of Object.entries(securityHeaders)) {
          const value = res.headers[headerKey];
          const status = value ? "✅" : "❌";
          
          if (value) {
            passed++;
            console.log(`\n${status} ${headerName}`);
            console.log(`   Value: ${value.slice(0, 80)}${value.length > 80 ? "..." : ""}`);
          } else {
            failed++;
            console.log(`\n${status} ${headerName} - MISSING`);
          }
        }
        
        console.log("\n" + "=".repeat(60));
        console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
        
        // Parse JSON response for additional info
        try {
          const json = JSON.parse(data);
          console.log("🛡️  Security Protections:");
          console.log("=".repeat(60));
          
          for (const [key, value] of Object.entries(json.protections)) {
            console.log(`  ${key}: ${value}`);
          }
          
          console.log("\n" + "=".repeat(60));
        } catch (e) {
          // Not JSON or error
        }
        
        console.log("\n✅ Security header test complete\n");
        
        resolve({ passed, failed });
      });
    }).on("error", (err) => {
      console.error("❌ Request failed:", err.message);
      reject(err);
    });
  });
}

// Run test
testHeaders()
  .then(({ passed, failed }) => {
    if (failed > 0) {
      console.log("⚠️  Some security headers are missing. Please check configuration.\n");
      process.exit(1);
    } else {
      console.log("🎉 All security headers are properly configured!\n");
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error("\n❌ Test failed. Is the server running on port 3001?\n");
    process.exit(1);
  });
