import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as s3 from "@aws-cdk/aws-s3";
import * as glue from "@aws-cdk/aws-glue";
import * as iam from "@aws-cdk/aws-iam";

interface InfraStackProps {
  companyName: string;
  projectName: string;
}

export function createStack(
  scope: cdk.Construct,
  id: string,
  props?: InfraStackProps
) {
  const stack = new cdk.Stack(scope, id);

  const exampleTable = new dynamodb.Table(stack, "SourceTable", {
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
  });

  const targetBucket = new s3.Bucket(stack, "TargetBucket", {
    bucketName: `aws-glue-${props?.companyName}-${props?.projectName}-target`,
  });

  const queriesBucket = new s3.Bucket(stack, "AthenaQueriesBucket", {
    bucketName: `athena-queries-${props?.companyName}-${props?.projectName}`,
  });

  const crawlerRole = new iam.Role(stack, "CrawlerRole", {
    assumedBy: new iam.ServicePrincipal("glue.amazonaws.com"),
    roleName: `AWSGlueServiceRole-${props?.projectName}`,
    managedPolicies: [
      iam.ManagedPolicy.fromManagedPolicyArn(
        stack,
        "glue-service-policy",
        "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
      ),
      iam.ManagedPolicy.fromManagedPolicyArn(
        stack,
        "logs-policy",
        "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
      ),
    ],
  });
  targetBucket.grantReadWrite(crawlerRole);
  exampleTable.grantReadData(crawlerRole);

  const glueDatabase = new glue.Database(stack, "GlueDB", {
    databaseName: `${props?.projectName}-db`,
  });

  const dynamoCrawler = new glue.CfnCrawler(stack, "DynamoCrawler", {
    name: `${props?.projectName}-DynamoCrawler`,
    role: crawlerRole.roleArn,
    targets: {
      dynamoDbTargets: [
        {
          path: exampleTable.tableName,
        },
      ],
    },
    databaseName: glueDatabase.databaseName,
    tablePrefix: `${props?.projectName}-table`,
  });

  const parquetCrawler = new glue.CfnCrawler(stack, "ParquetCrawler", {
    name: `${props?.projectName}-ParquetCrawler`,
    description: "",
    role: crawlerRole.roleArn,
    targets: {
      s3Targets: [
        {
          path: `s3://${targetBucket.bucketName}`,
        },
      ],
    },
    databaseName: glueDatabase.databaseName,
    tablePrefix: "dynamoathenaparquet",
  });

  new cdk.CfnOutput(stack, "GlueDatabaseName", {
    value: glueDatabase.databaseName,
  });
  new cdk.CfnOutput(stack, "S3TargetBucketName", {
    value: targetBucket.bucketName,
  });
  new cdk.CfnOutput(stack, "DynamoCrawlerName", {
    value: dynamoCrawler.name || "",
  });
  new cdk.CfnOutput(stack, "ParquetCrawlerName", {
    value: parquetCrawler.name || "",
  });
  new cdk.CfnOutput(stack, "RoleArn", {
    value: crawlerRole.roleArn,
  });
  new cdk.CfnOutput(stack, "DynamoTableName", {
    value: exampleTable.tableName,
  });

  return stack;
}
