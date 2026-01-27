// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Environment = {
  apiUrl: string;
  environment: 'development' | 'production';
};

const ENV = {
  development: {
    apiUrl: 'https://dev-api.example.com',
    environment: 'development',
  },
  production: {
    apiUrl: 'https://api.example.com',
    environment: 'production',
  },
} as const;

export default ENV[process.env.APP_ENV as keyof typeof ENV] ?? ENV.development;
