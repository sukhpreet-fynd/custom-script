import { deploy } from '@kaily-ai/chat-sdk/deploy';

const token = process.env.KAILY_APP_TOKEN || process.env.VITE_KAILY_APP_TOKEN;
const environment = process.env.KAILY_DEPLOY_ENVIRONMENT || process.env.VITE_KAILY_ENVIRONMENT || 'production';
const serviceBaseUrl = process.env.KAILY_SERVICE_BASE_URL;

if (!token) {
  console.error('Missing KAILY_APP_TOKEN. Example: KAILY_APP_TOKEN=... npm run deploy:kaily');
  process.exit(1);
}

try {
  const cdnUrl = await deploy('./src/widget.tsx', {
    token,
    environment: serviceBaseUrl ? undefined : environment,
    serviceBaseUrl,
    outfile: 'kaily-chat-widget.js',
  });

  console.log(cdnUrl);
} catch (error) {
  const status = error?.response?.status;
  const message = error?.response?.data?.message || error?.message || 'Kaily deployment failed.';
  const code = error?.response?.data?.code;

  console.error(
    [
      'Kaily deployment failed.',
      status ? `Status: ${status}` : undefined,
      code ? `Code: ${code}` : undefined,
      `Message: ${message}`,
      'The token was not written to project files.',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  process.exit(1);
}
