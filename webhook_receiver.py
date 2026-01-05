from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(content_length)
        event = self.headers.get("X-Athlos-Event", "unknown")
        print(f"WEBHOOK: {event}")
        print("Body:", body.decode())
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8090), WebhookHandler)
    print("Webhook receiver listening on port 8090")
    server.serve_forever()