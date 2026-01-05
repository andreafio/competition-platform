import urllib.request
import json

# Test health
try:
    with urllib.request.urlopen('http://127.0.0.1:3001/health') as response:
        data = json.loads(response.read().decode())
        print('Health:', data)
except Exception as e:
    print('Health error:', str(e))

# Test generate-all-brackets
url = 'http://127.0.0.1:3001/v1/events/event1/generate-all-brackets'
payload = {
    'webhook': {
        'url': 'http://example.com/webhook',
        'secret': 'testsecret'
    },
    'overrides': {
        'seeding_mode': 'auto'
    }
}

try:
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print('Status:', response.getcode())
        print('Response:', data)
except Exception as e:
    print('Error:', str(e))