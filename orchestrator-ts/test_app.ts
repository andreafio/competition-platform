import { default as app } from './src/main.js';

async function test() {
  // Test health
  const healthResponse = await app.inject({
    method: 'GET',
    url: '/health'
  });
  console.log('Health Status:', healthResponse.statusCode);
  console.log('Health Body:', healthResponse.json());

  // Test generate-all-brackets
  const genResponse = await app.inject({
    method: 'POST',
    url: '/v1/events/event1/generate-all-brackets',
    payload: {
      webhook: {
        url: 'http://localhost:8090/webhook',
        secret: 'shared'
      },
      overrides: {
        seeding_mode: 'auto',
        max_seeds: 8,
        repechage: true,
        separate_by: ['club']
      }
    }
  });
  console.log('Gen Status:', genResponse.statusCode);
  console.log('Gen Body:', genResponse.json());
}

test().catch(console.error);