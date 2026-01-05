const url = 'http://localhost:3001/v1/events/event1/generate-all-brackets';
const payload = {
  webhook: {
    url: 'http://example.com/webhook',
    secret: 'testsecret'
  },
  overrides: {
    seeding_mode: 'auto'
  }
};

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (error) {
  console.error('Error:', error.message);
}