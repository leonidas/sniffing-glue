import * as cdk from "@aws-cdk/core";
import * as glue from "@aws-cdk/aws-glue";
import * as iam from "@aws-cdk/aws-iam";
import { Asset } from "@aws-cdk/aws-s3-assets";
import * as path from "path";

interface GlueJobProps {
  companyName: string;
  projectName: string;
  roleArn: string;
  bucketName: string;
  glueDatabaseName: string;
  glueTableName: string;
  scriptFile: string;
}

export function createGlueJob(
  scope: cdk.Construct,
  id: string,
  props: GlueJobProps
) {
  const stack = new cdk.Stack(scope, id);

  console.log("props", props);

  const scriptAsset = new Asset(stack, "GlueScriptAsset", {
    path: path.join(__dirname, props.scriptFile),
  });
  scriptAsset.bucket.grantRead(
    iam.Role.fromRoleArn(stack, "CrawlerRole", props.roleArn)
  );

  const glueJob = new glue.CfnJob(stack, "GlueETLJob", {
    role: props.roleArn,
    name: `${props.companyName}-${props.projectName}-ETL-job`,
    command: {
      name: "glueetl",
      pythonVersion: "3",
      scriptLocation: scriptAsset.s3ObjectUrl,
    },
    maxCapacity: 1,
    timeout: 15,
    // defaultArguments: {
    //   "--data_catalog_database": props.glueDatabaseName,
    //   "--data_catalog_table_name": props.glueTableName,
    //   "--s3_path": `s3://${props.bucketName}/`,
    // },
  });

  new cdk.CfnOutput(stack, "ETLJobName", {
    value: glueJob.name || "",
  });

  new cdk.CfnOutput(stack, "AssetS3Url", {
    value: scriptAsset.s3ObjectUrl,
  });

  return stack;
}
