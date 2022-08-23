import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as acm from '@aws-cdk/aws-certificatemanager';

export class CdkImageConverterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    const originName = this.node.tryGetContext('originName') as string
    if (originName == undefined) {
      throw new Error('Context value [originName] is not set')
    }

    const ImageConverterFunction  = new cloudfront.experimental.EdgeFunction(
      this,
      'ImageConverter',
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../resources')
        ),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_14_X,
        memorySize: 512,
        timeout: Duration.seconds(10),
      }
    );

    const myCachePolicy = new cloudfront.CachePolicy(this, 'myCachePolicy', {
      cachePolicyName: 'ImageConvert',
      comment: 'Cache Policy for Image-convert',
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('width', 'format'),
      defaultTtl: Duration.days(30),
      minTtl: Duration.days(1),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: myCachePolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        origin: new origins.HttpOrigin(originName),
        edgeLambdas: [
          {
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: ImageConverterFunction.currentVersion,
          },
        ],
      },
      certificate: acm.Certificate.fromCertificateArn(
        this,
        'customDomainCertificate',
        'arn:aws:acm:us-east-1:817125222256:certificate/5b17965c-0096-4b93-b3dc-3b78f7f367ce'
      ),
      domainNames: ['images.ohdat.io'],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });
  }
}
