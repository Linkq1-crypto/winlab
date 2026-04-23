import net from "net";

const host = process.env.NET_TEST_HOST || "google.com";
const port = Number(process.env.NET_TEST_PORT || 80);

function connectOnce() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("timeout"));
    }, 1500);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve("connected");
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    });
  });
}

try {
  await connectOnce();
  console.error("network_block=failed: outbound connection succeeded");
  process.exit(2);
} catch (err) {
  // Expected under `docker run --network=none ...`
  console.log("network_block=ok");
  process.exit(0);
}
