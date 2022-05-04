#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { createGlueJob } from "../lib/glue-job-stack";
import * as AWS from "aws-sdk";

AWS.config.update({
  region: "eu-north-1",
});

const main = () => {
  const app = new cdk.App();

  cdk.Tags.of(app).add("Project", "SniffingGlue");
  cdk.Tags.of(app).add("TEST", "REMOVE IF YOU SEE THIS");

  const scriptFile = app.node.tryGetContext("scriptFile");
  const glueTableName = app.node.tryGetContext("glueTableName");
  const glueDatabaseName = app.node.tryGetContext("glueDatabaseName");
  const targetBucketName = app.node.tryGetContext("targetBucketName");
  const roleArn = app.node.tryGetContext("roleArn");

  if (
    !scriptFile ||
    !glueTableName ||
    !glueDatabaseName ||
    !targetBucketName ||
    !roleArn
  ) {
    throw new Error(
      `Provide all needed arguements when deploying GlueJobStack: scriptFile, glueTableName, glueDatabaseName, targetBucketName, roleArn`
    );
  }

  const res = createGlueJob(app, "GlueJobStack", {
    companyName: "cirit",
    projectName: "sniffing-glue",
    roleArn: roleArn,
    bucketName: targetBucketName,
    glueDatabaseName: glueDatabaseName,
    glueTableName: glueTableName,
    scriptFile: scriptFile,
  });
};

main();
