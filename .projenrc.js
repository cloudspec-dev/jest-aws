const { TypeScriptProject } = require('projen');
const project = new TypeScriptProject({
  defaultReleaseBranch: 'main',
  name: '@jest-cloud/aws',
  deps: [
    'jest-environment-node',
    '@aws-sdk/client-xray',
    'got',
    'body-parser',
    'express',
    '@aws-sdk/client-cloudwatch-logs',
    'winston',
    'colors',
  ],
  devDeps: ['@jest/types'],
  peerDeps: ['aws-xray-sdk'],
  minNodeVersion: '12.19.0',
  tsconfig: {
    compilerOptions: {
      esModuleInterop: true,
    },
  },
});
project.synth();