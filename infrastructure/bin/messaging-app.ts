#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MessagingAppStack } from '../lib/messaging-app-stack';

const app = new cdk.App();
new MessagingAppStack(app, 'MessagingAppStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1' 
  },
  description: 'Low-latency, end-to-end encrypted messaging app hosted on AWS',
});