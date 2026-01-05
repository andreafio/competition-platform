import urllib.request
import json

url = 'http://localhost:3001/v1/events/event1/generate-all-brackets'
payload = {
    'webhook': {
        'url': 'http://localhost:8090/webhook',
        'secret': 'shared'
    },
    'overrides': {
        'seeding_mode': 'auto',
        'max_seeds': 8,
        'repechage': True,
        'separate_by': ['club']
    }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print('Status:', response.getcode())
        print('Response:', data)
except Exception as e:
    print('Error:', str(e))